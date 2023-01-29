import { CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { CodemodRunSpec } from '@k-phoen/plugin-codemods-common';
import { JsonObject, Observable } from '@backstage/types';
import { Logger } from 'winston';
import ObservableImpl from 'zen-observable';
import {
  JobBroker,
  JobBrokerDispatchOptions,
  JobBrokerDispatchResult,
  JobCompletionState,
  JobContext,
  RunStore,
  SerializedJob,
  SerializedJobEvent,
  SerializedRun,
} from './types';

/**
 * JobManager
 *
 * @public
 */
export class JobManager implements JobContext {
  private isDone = false;

  private heartbeatTimeoutId?: ReturnType<typeof setInterval>;

  static create(
    jobId: string,
    codemod: CodemodRunSpec,
    target: Entity,
    storage: RunStore,
    logger: Logger,
  ) {
    const agent = new JobManager(jobId, codemod, target, storage, logger);
    agent.startTimeout();
    return agent;
  }

  // Runs heartbeat internally
  private constructor(
    private readonly jobId: string,
    private readonly codemod: CodemodRunSpec,
    readonly target: Entity,
    private readonly storage: RunStore,
    private readonly logger: Logger,
  ) {}

  get spec() {
    return this.codemod;
  }

  async getWorkspaceName() {
    return this.jobId;
  }

  get done() {
    return this.isDone;
  }

  async emitLog(message: string, logMetadata?: JsonObject): Promise<void> {
    await this.storage.emitLogEvent({
      jobId: this.jobId,
      body: { message, ...logMetadata },
    });
  }

  async complete(
    result: JobCompletionState,
    metadata?: JsonObject,
  ): Promise<void> {
    await this.storage.completeJob({
      jobId: this.jobId,
      status: result === 'failed' ? 'failed' : 'completed',
      eventBody: {
        message: `Run completed with status: ${result}`,
        ...metadata,
      },
    });

    this.isDone = true;

    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }
  }

  private startTimeout() {
    this.heartbeatTimeoutId = setTimeout(async () => {
      try {
        await this.storage.heartbeatJob(this.jobId);
        this.startTimeout();
      } catch (error) {
        this.isDone = true;
        this.logger.error(`Heartbeat for job ${this.jobId} failed`, error);
      }
    }, 1000);
  }
}

function defer() {
  let resolve = () => {};
  const promise = new Promise<void>(_resolve => {
    resolve = _resolve;
  });
  return { promise, resolve };
}

export class StorageJobBroker implements JobBroker {
  constructor(
    private readonly storage: RunStore,
    private readonly logger: Logger,
    private readonly catalog: CatalogApi,
  ) {}

  async listRuns(options?: {
    createdBy?: string;
  }): Promise<{ runs: SerializedRun[] }> {
    return await this.storage.listRuns({ createdBy: options?.createdBy });
  }

  async listJobs(options?: {
    run?: string;
  }): Promise<{ jobs: SerializedJob[] }> {
    return await this.storage.listJobs({ run: options?.run });
  }

  private deferredDispatch = defer();

  /**
   * {@inheritdoc JobBroker.claim}
   */
  async claim(): Promise<JobContext> {
    for (;;) {
      const pendingJob = await this.storage.claimJob();
      if (pendingJob) {
        const run = await this.storage.getRun(pendingJob.runId);
        const target = await this.catalog.getEntityByRef(pendingJob.target);

        if (!target) {
          await this.storage.completeJob({
            jobId: pendingJob.id,
            status: 'failed',
            eventBody: {
              message: `Target not found in catalog: ${pendingJob.target}`,
            },
          });
          continue;
        }

        return JobManager.create(
          pendingJob.id,
          run.spec,
          target,
          this.storage,
          this.logger,
        );
      }

      await this.waitForDispatch();
    }
  }

  /**
   * {@inheritdoc JobBroker.dispatch}
   */
  async dispatch(
    options: JobBrokerDispatchOptions,
  ): Promise<JobBrokerDispatchResult> {
    const run = await this.storage.createRun(options);
    this.signalDispatch();
    return {
      runId: run.runId,
    };
  }

  /**
   * {@inheritdoc JobBroker.getRun}
   */
  async getRun(runId: string): Promise<SerializedRun> {
    return this.storage.getRun(runId);
  }

  /**
   * {@inheritdoc JobBroker.getJob}
   */
  async getJob(jobId: string): Promise<SerializedJob> {
    return this.storage.getJob(jobId);
  }

  /**
   * {@inheritdoc JobBroker.event$}
   */
  event$(options: {
    jobId: string;
    after?: number;
  }): Observable<{ events: SerializedJobEvent[] }> {
    return new ObservableImpl(observer => {
      const { jobId } = options;

      let after = options.after;
      let cancelled = false;

      (async () => {
        while (!cancelled) {
          const result = await this.storage.listEvents({ jobId, after });
          const { events } = result;
          if (events.length) {
            after = events[events.length - 1].id;
            observer.next(result);
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }

  /**
   * {@inheritdoc JobBroker.vacuumJobs}
   */
  async vacuumJobs(options: { timeoutS: number }): Promise<void> {
    const { jobs } = await this.storage.listStaleJobs(options);
    await Promise.all(
      jobs.map(async job => {
        try {
          await this.storage.completeJob({
            jobId: job.jobId,
            status: 'failed',
            eventBody: {
              message:
                'The task was cancelled because the task worker lost connection to the task broker',
            },
          });
        } catch (error) {
          this.logger.warn(`Failed to cancel job '${job.jobId}', ${error}`);
        }
      }),
    );
  }

  private waitForDispatch() {
    return this.deferredDispatch.promise;
  }

  private signalDispatch() {
    this.deferredDispatch.resolve();
    this.deferredDispatch = defer();
  }
}
