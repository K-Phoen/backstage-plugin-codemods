import express, { Request } from 'express';
import Router from 'express-promise-router';
import { validate } from 'jsonschema';
import { Logger } from 'winston';
import { PluginDatabaseManager } from '@backstage/backend-common';
import { PluginTaskScheduler } from '@backstage/backend-tasks';
import { CatalogApi } from '@backstage/catalog-client';
import {
  Entity,
  parseEntityRef,
  stringifyEntityRef,
  UserEntity,
} from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import { IdentityApi } from '@backstage/plugin-auth-node';
import {
  CodemodRunSpec,
  ConstraintsQuery,
  getEntityBaseUrl,
  JobSpec,
} from '@k-phoen/plugin-codemods-common';
import { DatabaseRunStore, StorageJobBroker } from '../codemod';
import {
  CodemodAction,
  CodemodActionRegistry,
  createBuiltinActions,
} from '../codemod/actions';
import { JobWorker } from '../codemod/jobs/JobWorker';
import { constrainTargets, findCodemod, getWorkingDirectory } from './helpers';

export interface RouterOptions {
  logger: Logger;
  config: Config;
  catalogClient: CatalogApi;
  identity: IdentityApi;
  database: PluginDatabaseManager;
  scheduler?: PluginTaskScheduler;

  actions?: CodemodAction<any>[];

  /**
   * Sets the number of concurrent jobs that can be run at any given time on the JobWorker
   * @defaultValue 10
   */
  concurrentJobsLimit?: number;
}

interface CreateRunRequest {
  codemodRef: string;
  values: any;
  targets: ConstraintsQuery;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const {
    logger: parentLogger,
    config,
    catalogClient,
    database,
    scheduler,
    identity,
    actions,
    concurrentJobsLimit,
  } = options;

  const logger = parentLogger.child({ plugin: 'codemods' });

  // Express router
  const router = Router();
  router.use(express.json());

  // Dependencies
  const databaseRuntore = await DatabaseRunStore.create({ database });
  const jobBroker = new StorageJobBroker(
    databaseRuntore,
    logger,
    catalogClient,
  );

  const workingDirectory = await getWorkingDirectory(config, logger);
  const actionRegistry = new CodemodActionRegistry();

  if (scheduler && databaseRuntore.listStaleJobs) {
    await scheduler.scheduleTask({
      id: 'close_stale_jobs',
      frequency: { cron: '*/5 * * * *' }, // every 5 minutes, also supports Duration
      timeout: { minutes: 15 },
      fn: async () => {
        const { jobs } = await databaseRuntore.listStaleJobs({
          timeoutS: 86400,
        });

        for (const job of jobs) {
          await databaseRuntore.shutdownJob(job);
          logger.info(`Successfully closed stale job ${job.jobId}`);
        }
      },
    });
  }

  const worker = await JobWorker.create({
    jobBroker,
    actionRegistry,
    logger,
    workingDirectory,
    additionalTemplateFilters: undefined,
    additionalTemplateGlobals: undefined,
    concurrentJobsLimit,
  });

  const actionsToRegister = Array.isArray(actions)
    ? actions
    : createBuiltinActions();

  actionsToRegister.forEach(action => actionRegistry.register(action));

  // Codemod workers start
  worker.start();

  // Endpoints
  router.get(
    '/v1/codemods/:namespace/:name/parameter-schema',
    async (req, res) => {
      const { namespace, name } = req.params;

      const userIdentity = await identity.getIdentity({ request: req });
      const token = userIdentity?.token;

      const template = await findCodemod({
        catalogApi: catalogClient,
        entityRef: { kind: 'codemod', namespace, name },
        token,
      });

      const parameters = template.spec.parameters ?? {};

      res.json({
        title:
          parameters.description ??
          template.metadata.title ??
          template.metadata.name,
        description: parameters.description ?? '',
        ...parameters,
      });
    },
  );

  router.get('/v1/actions', async (_req, res) => {
    const actionsList = actionRegistry
      .list()
      .sort((a, b): number => {
        return a.id.localeCompare(b.id);
      })
      .map(action => {
        return {
          id: action.id,
          description: action.description,
          examples: action.examples,
          schema: action.schema,
        };
      });
    res.json(actionsList);
  });

  router.post(
    '/v1/runs',
    async (request: Request<{}, {}, CreateRunRequest, {}>, response) => {
      const { codemodRef, targets } = request.body;
      const { kind, namespace, name } = parseEntityRef(codemodRef, {
        defaultKind: 'codemod',
      });

      const callerIdentity = await identity.getIdentity({ request });
      const token = callerIdentity?.token;
      const userEntityRef = callerIdentity?.identity.userEntityRef;

      const userEntity = userEntityRef
        ? await catalogClient.getEntityByRef(userEntityRef, { token })
        : undefined;

      let auditLog = `Codemod run for ${codemodRef}`;
      if (userEntityRef) {
        auditLog += ` created by ${userEntityRef}`;
      }
      logger.info(auditLog);

      const codemod = await findCodemod({
        catalogApi: catalogClient,
        entityRef: { kind, namespace, name },
        token,
      });

      const values = request.body.values;
      for (const parameters of [codemod.spec.parameters ?? []].flat()) {
        const result = validate(values, parameters);
        if (!result.valid) {
          response.status(400).json({ errors: result.errors });
          return;
        }
      }

      const mergedTargets = constrainTargets(
        targets,
        codemod.spec.constraints || {},
      );

      const codemodSpec: CodemodRunSpec = {
        apiVersion: codemod.apiVersion,
        user: {
          entity: userEntity as UserEntity,
          ref: userEntityRef,
        },
        targets: mergedTargets,
        parameters: values,
        steps: codemod.spec.steps.map((step, index) => ({
          ...step,
          id: step.id ?? `step-${index + 1}`,
          name: step.name ?? step.action,
        })),
        output: codemod.spec.output ?? {},
        codemodInfo: {
          entityRef: stringifyEntityRef({
            kind,
            namespace,
            name: codemod.metadata?.name,
          }),
          baseUrl: getEntityBaseUrl(codemod),
          entity: {
            metadata: codemod.metadata,
          },
        },
      };

      const targetEntities = await catalogClient.getEntities(
        {
          filter: mergedTargets,
          fields: ['kind', 'metadata.name', 'metadata.namespace'],
        },
        { token },
      );
      const jobsSpecs = targetEntities.items.map(
        (entity: Entity): JobSpec => ({
          codemod: codemodSpec,
          targetRef: stringifyEntityRef(entity),
        }),
      );

      const result = await jobBroker.dispatch({
        codemodSpec: codemodSpec,
        jobsSpecs: jobsSpecs,
        createdBy: userEntityRef,
      });

      response.status(201).json({ id: result.runId });
    },
  );

  router.get('/v1/runs', async (req, res) => {
    const [userEntityRef] = [req.query.createdBy].flat();

    if (
      typeof userEntityRef !== 'string' &&
      typeof userEntityRef !== 'undefined'
    ) {
      throw new InputError('createdBy query parameter must be a string');
    }

    const runs = await jobBroker.listRuns({
      createdBy: userEntityRef,
    });

    res.status(200).json(runs);
  });

  router.get('/v1/runs/:id', async (req, res) => {
    const run = await jobBroker.getRun(req.params.id);

    res.status(200).json(run);
  });

  router.get('/v1/runs/:id/jobs', async (req, res) => {
    const jobs = await jobBroker.listJobs({
      run: req.params.id,
    });

    res.status(200).json(jobs);
  });

  router.get('/v1/runs/:runId/jobs/:jobId', async (req, res) => {
    const job = await jobBroker.getJob(req.params.jobId);

    res.status(200).json(job);
  });

  router.get('/v1/runs/:runId/jobs/:jobId/eventstream', async (req, res) => {
    const { jobId } = req.params;
    const after =
      req.query.after !== undefined ? Number(req.query.after) : undefined;

    logger.debug(`Event stream observing jobId '${jobId}' opened`);

    // Mandatory headers and http status to keep connection open
    res.writeHead(200, {
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
    });

    // After client opens connection send all events as string
    const subscription = jobBroker.event$({ jobId, after }).subscribe({
      error: error => {
        logger.error(
          `Received error from event stream when observing jobId '${jobId}', ${error}`,
        );
        res.end();
      },
      next: ({ events }) => {
        let shouldUnsubscribe = false;
        for (const event of events) {
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          if (event.type === 'completion') {
            shouldUnsubscribe = true;
          }
        }
        // res.flush() is only available with the compression middleware
        // @ts-ignore
        res.flush?.();
        if (shouldUnsubscribe) {
          subscription.unsubscribe();
          res.end();
        }
      },
    });

    // When client closes connection we update the clients list
    // avoiding the disconnected one
    req.on('close', () => {
      subscription.unsubscribe();
      logger.debug(`Event stream observing jobId '${jobId}' closed`);
    });
  });

  const app = express();
  app.set('logger', logger);
  app.use('/', router);

  return app;
}
