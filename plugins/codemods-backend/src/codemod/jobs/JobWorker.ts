import { Logger } from 'winston';
import PQueue from 'p-queue';
import { assertError } from '@backstage/errors';
import { WorkflowRunner, JobBroker, JobContext } from './types';
import { NunjucksWorkflowRunner } from './NunjucksWorkflowRunner';
import { ActionRegistry } from '../actions';
import {
  TemplateFilter,
  TemplateGlobal,
} from '../../lib/templating/SecureTemplater';

/**
 * JobWorkerOptions
 *
 * @public
 */
export type JobWorkerOptions = {
  jobBroker: JobBroker;
  runners: {
    workflowRunner: WorkflowRunner;
  };
  concurrentJobsLimit: number;
};

/**
 * CreateWorkerOptions
 *
 * @public
 */
export type CreateWorkerOptions = {
  jobBroker: JobBroker;
  actionRegistry: ActionRegistry;
  workingDirectory: string;
  logger: Logger;
  additionalTemplateFilters?: Record<string, TemplateFilter>;
  additionalTemplateGlobals?: Record<string, TemplateGlobal>;
  /**
   * The number of jobs that can be executed at the same time by the worker
   * @defaultValue 10
   * @example
   * ```
   * {
   *   concurrentJobsLimit: 1,
   *   // OR
   *   concurrentJobsLimit: Infinity
   * }
   * ```
   */
  concurrentJobsLimit?: number;
};

/**
 * JobWorker
 *
 * @public
 */
export class JobWorker {
  private constructor(private readonly options: JobWorkerOptions) {}

  private jobQueue: PQueue = new PQueue({
    concurrency: this.options.concurrentJobsLimit,
  });

  static async create(options: CreateWorkerOptions): Promise<JobWorker> {
    const {
      jobBroker,
      logger,
      actionRegistry,
      workingDirectory,
      additionalTemplateFilters,
      concurrentJobsLimit = 10, // from 1 to Infinity
      additionalTemplateGlobals,
    } = options;

    const workflowRunner = new NunjucksWorkflowRunner({
      actionRegistry,
      logger,
      workingDirectory,
      additionalTemplateFilters,
      additionalTemplateGlobals,
    });

    return new JobWorker({
      jobBroker: jobBroker,
      runners: { workflowRunner },
      concurrentJobsLimit,
    });
  }

  start() {
    (async () => {
      for (;;) {
        await this.onReadyToClaimJob();
        const job = await this.options.jobBroker.claim();
        this.jobQueue.add(() => this.runOneJob(job));
      }
    })();
  }

  protected onReadyToClaimJob(): Promise<void> {
    if (this.jobQueue.pending < this.options.concurrentJobsLimit) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      // "next" event emits when a task completes
      // https://github.com/sindresorhus/p-queue#next
      this.jobQueue.once('next', () => {
        resolve();
      });
    });
  }

  async runOneJob(job: JobContext) {
    try {
      if (job.spec.apiVersion !== 'codemod.backstage.io/v1alpha1') {
        throw new Error(
          `Unsupported Codemod apiVersion ${job.spec.apiVersion}`,
        );
      }

      const { output } = await this.options.runners.workflowRunner.execute(job);

      await job.complete('completed', { output });
    } catch (error) {
      assertError(error);
      await job.complete('failed', {
        error: { name: error.name, message: error.message },
      });
    }
  }
}
