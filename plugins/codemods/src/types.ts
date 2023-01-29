import { EntityFilterQuery } from '@backstage/catalog-client';
import { CodemodRunSpec } from '@k-phoen/plugin-codemods-common';
import { JsonObject, Observable } from '@backstage/types';
import { JSONSchema7 } from 'json-schema';

/**
 * The input options to the `applyCodemod` method of the `CodemodApi`.
 *
 * @public
 */
export interface CodemodApplyOptions {
  codemodRef: string;
  values: any;
  targets: EntityFilterQuery;
}

/**
 * The response shape of the `applyCodemod` method of the `CodemodApi`.
 *
 * @public
 */
export interface CodemodApplyResponse {
  runId: string;
}

/**
 * The shape of a codemod returned from the `codemod-backend`
 *
 * @public
 */
export type CodemodRun = {
  id: string;
  spec: CodemodRunSpec;
  targetsCount: number;
  openCount: number;
  processingCount: number;
  cancelledCount: number;
  failedCount: number;
  completedCount: number;
  createdAt: string;
};

/**
 * A single action example
 *
 * @public
 */
export type ActionExample = {
  description: string;
  example: string;
};

/**
 * A codemod action.
 *
 * @public
 */
export type Action = {
  id: string;
  description?: string;
  schema?: {
    input?: JSONSchema7;
    output?: JSONSchema7;
  };
  examples?: ActionExample[];
};

/**
 * The response shape for the `listActions` call to the `codemod-backend`
 *
 * @public
 */
export type ListActionsResponse = Action[];

/**
 * @public
 */
export type Job = {
  id: string;
  runId: string;
  target: string;
  status: 'failed' | 'completed' | 'processing' | 'open' | 'cancelled';
  lastHeartbeatAt: string;
  output?: JobOutput;
};

export type JobOutput = {
  links?: OutputLink[];
} & {
  [key: string]: unknown;
};

export type OutputLink = {
  text?: string;
  icon?: string;
  url?: string;
  entityRef?: string;
};

/**
 * The input options to the `streamLogs` method of the `CodemodClient`.
 *
 * @public
 */
export interface StreamLogsOptions {
  runId: string;
  jobId: string;
  after?: number;
}

/**
 * The status of each step in a Job
 *
 * @public
 */
export type StepStatus =
  | 'open'
  | 'processing'
  | 'failed'
  | 'completed'
  | 'skipped';

/**
 * The shape of a `LogEvent` message from the `codemod-backend`
 *
 * @public
 */
export type LogEvent = {
  type: 'log' | 'completion';
  body: {
    message: string;
    stepId?: string;
    status?: StepStatus;
  };
  createdAt: string;
  id: string;
  jobId: string;
};

/**
 * The shape of each entry of parameters which gets rendered
 * as a separate step in the wizard input
 *
 * @public
 */
export type CodemodParameterSchema = {
  title: string;
  description?: string;
  steps: Array<{
    title: string;
    description?: string;
    schema: JsonObject;
  }>;
};

/**
 * An API to interact with the codemod backend.
 *
 * @public
 */
export interface CodemodApi {
  getTemplateParameterSchema(
    codemodRef: string,
  ): Promise<CodemodParameterSchema>;

  /**
   * Executes a codemod on catalog entities.
   *
   * @param options - The {@link CodemodApplyOptions} options to use to run the codemod.
   */
  applyCodemod(options: CodemodApplyOptions): Promise<CodemodApplyResponse>;

  listRuns(options: {
    filterByOwnership: 'owned' | 'all';
  }): Promise<{ runs: CodemodRun[] }>;
  listJobs(options: { runId: string }): Promise<{ jobs: Job[] }>;

  getRun({ runId }: { runId: string }): Promise<CodemodRun>;
  getJob({ runId, jobId }: { runId: string; jobId: string }): Promise<Job>;

  streamLogs(options: StreamLogsOptions): Observable<LogEvent>;

  /**
   * Returns a list of all installed actions.
   */
  listActions(): Promise<ListActionsResponse>;
}
