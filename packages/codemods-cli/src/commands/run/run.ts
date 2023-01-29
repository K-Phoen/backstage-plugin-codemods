import { tmpdir } from 'os';
import path from 'path';
import {
  DEFAULT_NAMESPACE,
  Entity,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { JsonObject } from '@backstage/types';
import {
  ActionRegistry,
  createBuiltinActions,
  JobBroker,
  JobWorker,
} from '@k-phoen/plugin-codemods-backend';
import {
  getEntityBaseUrl,
  CodemodEntityV1alpha1,
  CodemodRunSpec,
} from '@k-phoen/plugin-codemods-common';
import { createLogger, JobManager, parseYamlFile } from '../../lib';

type RunOptions = {
  codemodManifest: string;
  entityManifest: string;
  parameters: JsonObject;
  verbose: boolean;
};

export default async function run(opts: RunOptions) {
  const logger = createLogger({ verbose: opts.verbose }).child({
    component: 'cli',
  });
  const codemodLogger = logger.child({ component: 'codemod' });

  const codemod = await parseYamlFile<CodemodEntityV1alpha1>(
    path.resolve(opts.codemodManifest),
  );
  const entity = await parseYamlFile<Entity>(path.resolve(opts.entityManifest));

  logger.info(
    `Codemod ${stringifyEntityRef(
      codemod,
    )} will be applied to ${stringifyEntityRef(entity)}`,
  );

  // actions setup
  const actionRegistry = ActionRegistry.create(createBuiltinActions());

  // dependencies setup
  const workingDirectory = tmpdir();
  const jobWorker = await JobWorker.create({
    logger: codemodLogger,
    jobBroker: {} as JobBroker,
    actionRegistry,
    workingDirectory,
    concurrentJobsLimit: 1,
  });

  // describe the job
  const codemodRunSpec: CodemodRunSpec = {
    apiVersion: codemod.apiVersion,
    targets: {
      kind: entity.kind,
      'metadata.namespace': entity.metadata.namespace || DEFAULT_NAMESPACE,
      'metadata.name': entity.metadata.name,
    },
    codemodInfo: {
      entityRef: stringifyEntityRef(codemod),
      baseUrl: getEntityBaseUrl(codemod),
      entity: {
        metadata: codemod.metadata,
      },
    },
    parameters: opts.parameters,
    steps: codemod.spec.steps.map((step, index) => ({
      ...step,
      id: step.id ?? `step-${index + 1}`,
      name: step.name ?? step.action,
    })),
    output: codemod.spec.output ?? {},
  };

  const jobId = `codemods-cli-job-${Date.now()}`;

  // start executing the codemod!
  await jobWorker.runOneJob(
    JobManager.create(jobId, codemodRunSpec, entity, codemodLogger),
  );

  logger.info('Done!');
  logger.info(`Working directory: ${workingDirectory}/${jobId}`);
}
