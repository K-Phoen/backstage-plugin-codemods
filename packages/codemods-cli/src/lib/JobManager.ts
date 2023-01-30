import { Logger } from 'winston';
import { Entity } from '@backstage/catalog-model';
import { JsonObject } from '@backstage/types';
import {
  JobCompletionState,
  JobContext,
} from '@k-phoen/plugin-codemods-backend';
import { CodemodRunSpec } from '@k-phoen/plugin-codemods-common';

export class JobManager implements JobContext {
  private isDone = false;

  private heartbeatTimeoutId?: ReturnType<typeof setInterval>;

  static create(
    jobId: string,
    codemod: CodemodRunSpec,
    target: Entity,
    logger: Logger,
  ) {
    const agent = new JobManager(jobId, codemod, target, logger);
    agent.startTimeout();
    return agent;
  }

  // Runs heartbeat internally
  private constructor(
    private readonly jobId: string,
    private readonly codemod: CodemodRunSpec,
    readonly target: Entity,
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
        this.logger.error(`Heartbeat for job ${this.jobId} failed`, error);
      }
    }, 1000);
  }
}
