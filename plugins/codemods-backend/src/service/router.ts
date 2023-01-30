import express, { Request } from 'express';
import Router from 'express-promise-router';
import { validate } from 'jsonschema';
import { Logger } from 'winston';
import { PluginDatabaseManager } from '@backstage/backend-common';
import { PluginTaskScheduler } from '@backstage/backend-tasks';
import { CatalogApi } from '@backstage/catalog-client';
import {
  parseEntityRef,
  stringifyEntityRef,
  UserEntity,
} from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import { IdentityApi } from '@backstage/plugin-auth-node';
import {
  CatalogFilters,
  constrainTargets,
} from '@k-phoen/plugin-codemods-common';
import { DatabaseRunStore, StorageJobBroker } from '../codemod';
import {
  CodemodAction,
  ActionRegistry,
  createBuiltinActions,
} from '../codemod/actions';
import { JobWorker } from '../codemod/jobs/JobWorker';
import { codemodToRunSpec, findCodemod, getWorkingDirectory } from './helpers';
import { TemplateFilter, TemplateGlobal } from '../lib';

export interface RouterOptions {
  logger: Logger;
  config: Config;
  catalogClient: CatalogApi;
  identity: IdentityApi;
  database: PluginDatabaseManager;
  scheduler?: PluginTaskScheduler;

  actions?: CodemodAction<any>[];

  additionalTemplateFilters?: Record<string, TemplateFilter>;
  additionalTemplateGlobals?: Record<string, TemplateGlobal>;

  /**
   * Sets the number of concurrent jobs that can be run at any given time on the JobWorker
   * @defaultValue 10
   */
  concurrentJobsLimit?: number;
}

interface CreateRunRequest {
  codemodRef: string;
  values: any;
  targets: CatalogFilters;
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
    additionalTemplateFilters,
    additionalTemplateGlobals,
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
  const actionRegistry = ActionRegistry.create(
    actions ?? createBuiltinActions(),
  );

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
    additionalTemplateFilters,
    additionalTemplateGlobals,
    concurrentJobsLimit,
  });

  // Codemod workers start
  worker.start();

  // Endpoints
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
        entityRef: parseEntityRef(codemodRef, {
          defaultKind: 'codemod',
        }),
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

      const codemodSpec = codemodToRunSpec({
        codemod,
        targets: constrainTargets(targets, codemod.spec.constraints || {}),
        parameters: values,
        user: userEntity as UserEntity,
      });

      const targetEntities = await catalogClient.getEntities(
        {
          filter: codemodSpec.targets,
          fields: ['kind', 'metadata.name', 'metadata.namespace'],
        },
        { token },
      );

      const result = await jobBroker.dispatch({
        codemodSpec: codemodSpec,
        targets: targetEntities.items.map(entity => stringifyEntityRef(entity)),
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
