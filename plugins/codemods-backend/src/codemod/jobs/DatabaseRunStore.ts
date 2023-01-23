import { JsonObject } from '@backstage/types';
import {
  PluginDatabaseManager,
  resolvePackagePath,
} from '@backstage/backend-common';
import { ConflictError, NotFoundError } from '@backstage/errors';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import {
  SerializedJob,
  JobStatus,
  JobEventType,
  RunStore,
  SerializedRun,
  RunStoreCreateRunOptions,
  RunStoreCreateRunResult,
  RunStoreListEventsOptions,
  SerializedJobEvent,
  RunStoreShutDownJobOptions,
  RunStoreEmitOptions,
} from './types';
import { DateTime } from 'luxon';

const migrationsDir = resolvePackagePath(
  '@k-phoen/plugin-codemods-backend',
  'migrations',
);

export type RawDbRunRow = {
  id: string;
  spec: string;
  targets_count: number;
  open_count: number;
  processing_count: number;
  failed_count: number;
  cancelled_count: number;
  completed_count: number;
  created_at: string;
  created_by: string | null;
};

export type RawDbJobRow = {
  id: string;
  run_id: string;
  status: JobStatus;
  target: string;
  last_heartbeat_at?: string;
  output?: string;
};

export type RawDbJobEventRow = {
  id: number;
  job_id: string;
  body: string;
  event_type: JobEventType;
  created_at: string;
};

/**
 * DatabaseTaskStore
 *
 * @public
 */
export type DatabaseRunStoreOptions = {
  database: PluginDatabaseManager | Knex;
};

/**
 * Typeguard to help DatabaseTaskStore understand when database is PluginDatabaseManager vs. when database is a Knex instance.
 *
 * * @public
 */
function isPluginDatabaseManager(
  opt: PluginDatabaseManager | Knex,
): opt is PluginDatabaseManager {
  return (opt as PluginDatabaseManager).getClient !== undefined;
}

const parseSqlDateToIsoString = <T>(input: T): T | string => {
  if (typeof input === 'string') {
    return DateTime.fromSQL(input, { zone: 'UTC' }).toISO();
  }

  return input;
};

const dbRowToRun = (row: RawDbRunRow): SerializedRun => {
  return {
    id: row.id,
    spec: JSON.parse(row.spec),
    targetsCount: row.targets_count,
    openCount: row.open_count,
    processingCount: row.processing_count,
    cancelledCount: row.cancelled_count,
    failedCount: row.failed_count,
    completedCount: row.completed_count,
    createdBy: row.created_by ?? undefined,
    createdAt: parseSqlDateToIsoString(row.created_at),
  };
};

const dbRowToJob = (row: RawDbJobRow): SerializedJob => {
  return {
    id: row.id,
    runId: row.run_id,
    target: row.target,
    status: row.status,
    lastHeartbeatAt: parseSqlDateToIsoString(row.last_heartbeat_at),
    output: row.output ? JSON.parse(row.output) : null,
  };
};

/**
 * DatabaseRunStore
 *
 * @public
 */
export class DatabaseRunStore implements RunStore {
  private readonly db: Knex;

  static async create(
    options: DatabaseRunStoreOptions,
  ): Promise<DatabaseRunStore> {
    const { database } = options;
    const client = await this.getClient(database);

    await this.runMigrations(database, client);

    return new DatabaseRunStore(client);
  }

  private static async getClient(
    database: PluginDatabaseManager | Knex,
  ): Promise<Knex> {
    if (isPluginDatabaseManager(database)) {
      return database.getClient();
    }

    return database;
  }

  private static async runMigrations(
    database: PluginDatabaseManager | Knex,
    client: Knex,
  ): Promise<void> {
    if (!isPluginDatabaseManager(database)) {
      await client.migrate.latest({
        directory: migrationsDir,
      });

      return;
    }

    if (!database.migrations?.skip) {
      await client.migrate.latest({
        directory: migrationsDir,
      });
    }
  }

  private constructor(client: Knex) {
    this.db = client;
  }

  async listJobs(options: {
    run?: string;
  }): Promise<{ jobs: SerializedJob[] }> {
    const queryBuilder = this.db<RawDbJobRow>('jobs');

    if (options.run) {
      queryBuilder.where({ run_id: options.run });
    }

    const results = await queryBuilder.select();

    return { jobs: results.map(dbRowToJob) };
  }

  async getJob(jobId: string): Promise<SerializedJob> {
    const [result] = await this.db<RawDbJobRow>('jobs')
      .where({ id: jobId })
      .select();
    if (!result) {
      throw new NotFoundError(`No job with id '${jobId}' found`);
    }
    try {
      return dbRowToJob(result);
    } catch (error) {
      throw new Error(`Failed to parse spec of job '${jobId}', ${error}`);
    }
  }

  async listRuns(options: {
    createdBy?: string;
  }): Promise<{ runs: SerializedRun[] }> {
    const queryBuilder = this.db<RawDbRunRow>('runs');

    if (options.createdBy) {
      queryBuilder.where({ created_by: options.createdBy });
    }

    const results = await queryBuilder.orderBy('created_at', 'desc').select();

    return { runs: results.map(dbRowToRun) };
  }

  async getRun(runId: string): Promise<SerializedRun> {
    const [result] = await this.db<RawDbRunRow>('runs')
      .where({ id: runId })
      .select();

    if (!result) {
      throw new NotFoundError(`No run with id '${runId}' found`);
    }

    try {
      return dbRowToRun(result);
    } catch (error) {
      throw new Error(`Failed to parse spec of run '${runId}', ${error}`);
    }
  }

  async createRun(
    options: RunStoreCreateRunOptions,
  ): Promise<RunStoreCreateRunResult> {
    const runId = uuid();

    await this.db.transaction(async tx => {
      await tx<RawDbRunRow>('runs').insert({
        id: runId,
        spec: JSON.stringify(options.codemodSpec),
        targets_count: options.jobsSpecs.length,
        created_by: options.createdBy ?? null,
      });

      for (const task of options.jobsSpecs) {
        await tx<RawDbJobRow>('jobs').insert({
          id: uuid(),
          run_id: runId,
          target: task.targetRef,
          status: 'open',
        });
      }
    });

    return { runId: runId };
  }

  async claimJob(): Promise<SerializedJob | undefined> {
    return this.db.transaction(async tx => {
      const [job] = await tx<RawDbJobRow>('jobs')
        .where({
          status: 'open',
        })
        .limit(1)
        .select();

      if (!job) {
        return undefined;
      }

      const updateCount = await tx<RawDbJobRow>('jobs')
        .where({ id: job.id, status: 'open' })
        .update({
          status: 'processing',
          last_heartbeat_at: this.db.fn.now(),
        });

      if (updateCount < 1) {
        return undefined;
      }

      // update the number of processing jobs for that run
      await tx<RawDbRunRow>('runs')
        .where({ id: job.run_id })
        .update({ processing_count: tx.raw('processing_count + 1') });

      return {
        id: job.id,
        runId: job.run_id,
        target: job.target,
        status: 'processing',
        lastHeartbeatAt: job.last_heartbeat_at,
      };
    });
  }

  async heartbeatJob(jobId: string): Promise<void> {
    const updateCount = await this.db<RawDbJobRow>('jobs')
      .where({ id: jobId, status: 'processing' })
      .update({ last_heartbeat_at: this.db.fn.now() });
    if (updateCount === 0) {
      throw new ConflictError(`No running job with jobId ${jobId} found`);
    }
  }

  async listStaleJobs(options: {
    timeoutS: number;
  }): Promise<{ jobs: { jobId: string }[] }> {
    const { timeoutS } = options;

    const rawRows = await this.db<RawDbJobRow>('jobs')
      .where('status', 'processing')
      .andWhere(
        'last_heartbeat_at',
        '<=',
        this.db.client.config.client.includes('sqlite3')
          ? this.db.raw(`datetime('now', ?)`, [`-${timeoutS} seconds`])
          : this.db.raw(`? - interval '${timeoutS} seconds'`, [
              this.db.fn.now(),
            ]),
      );

    const jobs = rawRows.map(row => ({
      jobId: row.id,
    }));

    return { jobs };
  }

  async completeJob(options: {
    jobId: string;
    status: JobStatus;
    eventBody: JsonObject;
  }): Promise<void> {
    const { jobId, status, eventBody } = options;

    if (status !== 'failed' && status !== 'completed') {
      throw new Error(
        `Invalid status update of job '${jobId}' to status '${status}'`,
      );
    }

    const oldStatus = 'processing';

    await this.db.transaction(async tx => {
      const [job] = await tx<RawDbJobRow>('jobs')
        .where({
          id: jobId,
        })
        .limit(1)
        .select();

      if (!job) {
        throw new Error(`No job with jobId ${jobId} found`);
      }
      if (job.status !== oldStatus) {
        throw new ConflictError(
          `Refusing to update status of job '${jobId}' to status '${status}' ` +
            `as it is currently '${job.status}', expected '${oldStatus}'`,
        );
      }
      const updateCount = await tx<RawDbJobRow>('jobs')
        .where({
          id: jobId,
          status: oldStatus,
        })
        .update({
          status,
          output: JSON.stringify((eventBody.output || {}) as JsonObject),
        });

      if (updateCount !== 1) {
        throw new ConflictError(
          `Failed to update status to '${status}' for jobId ${jobId}`,
        );
      }

      // update the run statuses counters
      const runCountersUpdate: Record<string, any> = {
        processing_count: tx.raw('processing_count - 1'),
      };
      if (status === 'failed') {
        runCountersUpdate.failed_count = tx.raw('failed_count + 1');
      } else {
        runCountersUpdate.completed_count = tx.raw('completed_count + 1');
      }

      await tx<RawDbRunRow>('runs')
        .where({ id: job.run_id })
        .update(runCountersUpdate);

      await tx<RawDbJobEventRow>('job_events').insert({
        job_id: jobId,
        event_type: 'completion',
        body: JSON.stringify(eventBody),
      });
    });
  }

  async emitLogEvent(
    options: RunStoreEmitOptions<{ message: string } & JsonObject>,
  ): Promise<void> {
    const { jobId, body } = options;
    const serializedBody = JSON.stringify(body);
    await this.db<RawDbJobEventRow>('job_events').insert({
      job_id: jobId,
      event_type: 'log',
      body: serializedBody,
    });
  }

  async listEvents(
    options: RunStoreListEventsOptions,
  ): Promise<{ events: SerializedJobEvent[] }> {
    const { jobId, after } = options;
    const rawEvents = await this.db<RawDbJobEventRow>('job_events')
      .where({
        job_id: jobId,
      })
      .andWhere(builder => {
        if (typeof after === 'number') {
          builder.where('id', '>', after).orWhere('event_type', 'completion');
        }
      })
      .orderBy('id')
      .select();

    const events = rawEvents.map(event => {
      try {
        const body = JSON.parse(event.body) as JsonObject;
        return {
          id: Number(event.id),
          jobId,
          body,
          type: event.event_type,
          createdAt: parseSqlDateToIsoString(event.created_at),
        };
      } catch (error) {
        throw new Error(
          `Failed to parse event body from event jobId=${jobId} id=${event.id}, ${error}`,
        );
      }
    });

    return { events };
  }

  async shutdownJob({ jobId }: RunStoreShutDownJobOptions): Promise<void> {
    const message = `This job was marked as stale as it exceeded its timeout`;

    const statusStepEvents = (await this.listEvents({ jobId })).events.filter(
      ({ body }) => body?.stepId,
    );

    const completedSteps = statusStepEvents
      .filter(
        ({ body: { status } }) => status === 'failed' || status === 'completed',
      )
      .map(step => step.body.stepId);

    const hungProcessingSteps = statusStepEvents
      .filter(({ body: { status } }) => status === 'processing')
      .map(event => event.body.stepId)
      .filter(step => !completedSteps.includes(step));

    for (const step of hungProcessingSteps) {
      await this.emitLogEvent({
        jobId,
        body: {
          message,
          stepId: step,
          status: 'failed',
        },
      });
    }

    await this.completeJob({
      jobId,
      status: 'failed',
      eventBody: {
        message,
      },
    });
  }
}
