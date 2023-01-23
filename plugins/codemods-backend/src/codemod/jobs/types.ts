import { JsonValue, JsonObject, Observable } from '@backstage/types';
import { CodemodRunSpec, JobSpec } from '@k-phoen/plugin-codemods-common';
import { Entity } from '@backstage/catalog-model';

/**
 * The status of each step of the Job
 *
 * @public
 */
export type JobStatus =
  | 'open'
  | 'processing'
  | 'failed'
  | 'cancelled'
  | 'completed';

/**
 * The state of a completed job.
 *
 * @public
 */
export type JobCompletionState = 'failed' | 'completed';

/**
 * SerializedRun
 *
 * @public
 */
export type SerializedRun = {
  id: string;
  spec: CodemodRunSpec;
  targetsCount: number;
  openCount: number;
  processingCount: number;
  failedCount: number;
  cancelledCount: number;
  completedCount: number;
  createdAt: string;
  createdBy?: string;
};

/**
 * SerializedJob
 *
 * @public
 */
export type SerializedJob = {
  id: string;
  runId: string;
  target: string;
  status: JobStatus;
  lastHeartbeatAt?: string;
  output?: JsonObject;
};

/**
 * JobEventType
 *
 * @public
 */
export type JobEventType = 'completion' | 'log';

/**
 * SerializedJobEvent
 *
 * @public
 */
export type SerializedJobEvent = {
  id: number;
  jobId: string;
  body: JsonObject;
  type: JobEventType;
  createdAt: string;
};

/**
 * The result of {@link JobBroker.dispatch}
 *
 * @public
 */
export type JobBrokerDispatchResult = {
  runId: string;
};

/**
 * The options passed to {@link JobBroker.dispatch}
 * Currently a spec and some metadata
 *
 * @public
 */
export type JobBrokerDispatchOptions = {
  codemodSpec: CodemodRunSpec;
  jobsSpecs: JobSpec[];
  createdBy?: string;
};

/**
 * JobContext
 *
 * @public
 */
export interface JobContext {
  spec: JobSpec;
  target: Entity;
  createdBy?: string;
  done: boolean;
  emitLog(message: string, logMetadata?: JsonObject): Promise<void>;
  complete(result: JobCompletionState, metadata?: JsonObject): Promise<void>;
  getWorkspaceName(): Promise<string>;
}

/**
 * JobBroker
 *
 * @public
 */
export interface JobBroker {
  claim(): Promise<JobContext>;
  dispatch(options: JobBrokerDispatchOptions): Promise<JobBrokerDispatchResult>;
  vacuumJobs(options: { timeoutS: number }): Promise<void>;
  event$(options: {
    jobId: string;
    after: number | undefined;
  }): Observable<{ events: SerializedJobEvent[] }>;
  getJob(jobId: string): Promise<SerializedJob>;
  getRun(runId: string): Promise<SerializedRun>;
  listRuns?(options?: {
    createdBy?: string;
  }): Promise<{ runs: SerializedRun[] }>;
  listJobs?(options?: { run?: string }): Promise<{ jobs: SerializedJob[] }>;
}

/**
 * RunStoreEmitOptions
 *
 * @public
 */
export type RunStoreEmitOptions<TBody = JsonObject> = {
  jobId: string;
  body: TBody;
};

/**
 * RunStoreListEventsOptions
 *
 * @public
 */
export type RunStoreListEventsOptions = {
  jobId: string;
  after?: number | undefined;
};

/**
 * RunStoreShutDownJobOptions
 *
 * @public
 */
export type RunStoreShutDownJobOptions = {
  jobId: string;
};

/**
 * The options passed to {@link RunStore.createRun}
 * @public
 */
export type RunStoreCreateRunOptions = {
  codemodSpec: CodemodRunSpec;
  jobsSpecs: JobSpec[];
  createdBy?: string;
};

/**
 * The response from {@link RunStore.createRun}
 * @public
 */
export type RunStoreCreateRunResult = {
  runId: string;
};

/**
 * RunStore
 *
 * @public
 */
export interface RunStore {
  createRun(
    options: RunStoreCreateRunOptions,
  ): Promise<RunStoreCreateRunResult>;
  getRun(runId: string): Promise<SerializedRun>;
  getJob(jobId: string): Promise<SerializedJob>;
  claimJob(): Promise<SerializedJob | undefined>;
  completeJob(options: {
    jobId: string;
    status: JobStatus;
    eventBody: JsonObject;
  }): Promise<void>;
  heartbeatJob(jobId: string): Promise<void>;
  listStaleJobs(options: { timeoutS: number }): Promise<{
    jobs: { jobId: string }[];
  }>;
  listJobs(options: { run?: string }): Promise<{ jobs: SerializedJob[] }>;
  listRuns(options: { createdBy?: string }): Promise<{ runs: SerializedRun[] }>;

  emitLogEvent({ jobId, body }: RunStoreEmitOptions): Promise<void>;
  listEvents({
    jobId,
    after,
  }: RunStoreListEventsOptions): Promise<{ events: SerializedJobEvent[] }>;
  shutdownJob?({ jobId }: RunStoreShutDownJobOptions): Promise<void>;
}

export type WorkflowResponse = { output: { [key: string]: JsonValue } };

export interface WorkflowRunner {
  execute(job: JobContext): Promise<WorkflowResponse>;
}
