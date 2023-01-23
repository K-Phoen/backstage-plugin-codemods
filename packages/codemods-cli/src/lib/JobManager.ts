import { Logger } from 'winston';
import { Entity } from '@backstage/catalog-model';
import {
  CurrentClaimedJob,
  JobCompletionState,
  JobContext,
} from '@k-phoen/plugin-codemods-backend';
import { JsonObject } from '@backstage/types';

export class JobManager implements JobContext {
  private isDone = false;

  private heartbeatTimeoutId?: ReturnType<typeof setInterval>;

  static create(job: CurrentClaimedJob, target: Entity, logger: Logger) {
    const agent = new JobManager(job, target, logger);
    agent.startTimeout();
    return agent;
  }

  // Runs heartbeat internally
  private constructor(
    private readonly job: CurrentClaimedJob,
    readonly target: Entity,
    private readonly logger: Logger,
  ) {}

  get spec() {
    return this.job.spec;
  }

  get createdBy() {
    return this.job.createdBy;
  }

  async getWorkspaceName() {
    return this.job.jobId;
  }

  get done() {
    return this.isDone;
  }

  async emitLog(message: string, logMetadata?: JsonObject): Promise<void> {
    this.logger.info(message, logMetadata);
  }

  async complete(
    result: JobCompletionState,
    metadata?: JsonObject,
  ): Promise<void> {
    this.logger.info('job completed', { result: result, metadata: metadata });

    this.isDone = true;

    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }
  }

  private startTimeout() {
    this.heartbeatTimeoutId = setTimeout(async () => {
      try {
        this.startTimeout();
      } catch (error) {
        this.isDone = true;
        this.logger.error(`Heartbeat for job ${this.job.jobId} failed`, error);
      }
    }, 1000);
  }
}
