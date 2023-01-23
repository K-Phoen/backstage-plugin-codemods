import { getVoidLogger, DatabaseManager } from '@backstage/backend-common';
import { CatalogApi } from '@backstage/catalog-client';
import { ConfigReader } from '@backstage/config';
import {
  CodemodRunSpec,
  CodemodSpecV1alpha1,
} from '@k-phoen/plugin-codemods-common';
import { DatabaseRunStore } from './DatabaseRunStore';
import { JobManager, StorageJobBroker } from './StorageJobBroker';
import { RunStore, SerializedJobEvent } from './types';

async function createStore(): Promise<RunStore> {
  const manager = DatabaseManager.fromConfig(
    new ConfigReader({
      backend: {
        database: {
          client: 'better-sqlite3',
          connection: ':memory:',
        },
      },
    }),
  ).forPlugin('codemod');

  return await DatabaseRunStore.create({
    database: manager,
  });
}

describe('StorageJobBroker', () => {
  let storage: RunStore;
  const catalog = {
    getEntityByRef: jest.fn(async (_entityRef: string) => {
      return {};
    }),
  } as unknown as CatalogApi;
  const logger = getVoidLogger();
  let broker: StorageJobBroker;

  beforeAll(async () => {
    storage = await createStore();
    broker = new StorageJobBroker(storage, logger, catalog);
  });

  it('should claim a dispatched work item', async () => {
    await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });

    await expect(broker.claim()).resolves.toEqual(
      expect.any(JobManager as any),
    );
  });

  it('should wait for a dispatched work item', async () => {
    const promise = broker.claim();

    await expect(Promise.race([promise, 'waiting'])).resolves.toBe('waiting');

    await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });
    await expect(promise).resolves.toEqual(expect.any(JobManager as any));
  });

  it('should dispatch multiple items and claim them in order', async () => {
    await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target-a',
        },
      ],
    });
    await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target-b',
        },
      ],
    });
    await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target-c',
        },
      ],
    });

    const jobA = await broker.claim();
    const jobB = await broker.claim();
    const jobC = await broker.claim();
    await expect(jobA).toEqual(expect.any(JobManager as any));
    await expect(jobB).toEqual(expect.any(JobManager as any));
    await expect(jobC).toEqual(expect.any(JobManager as any));
    await expect(jobA.spec.targetRef).toBe('component:default/target-a');
    await expect(jobB.spec.targetRef).toBe('component:default/target-b');
    await expect(jobC.spec.targetRef).toBe('component:default/target-c');
  });

  it('should complete a job', async () => {
    const dispatchResult = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });
    const job = await broker.claim();
    await job.complete('completed');
    const jobRow = await storage.getRun(dispatchResult.runId);
    expect(jobRow.completedCount).toBe(1);
  }, 10000);

  it('should fail a job', async () => {
    const dispatchResult = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });
    const job = await broker.claim();
    await job.complete('failed');
    const jobRow = await storage.getRun(dispatchResult.runId);
    expect(jobRow.failedCount).toBe(1);
  });

  it('multiple brokers should be able to observe a single job', async () => {
    const broker1 = new StorageJobBroker(storage, logger, catalog);
    const broker2 = new StorageJobBroker(storage, logger, catalog);

    const { runId } = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });

    const { jobs } = await storage.listJobs({ run: runId });

    const logPromise = new Promise<SerializedJobEvent[]>(resolve => {
      const observedEvents = new Array<SerializedJobEvent>();

      const subscription = broker2
        .event$({ jobId: jobs[0].id, after: undefined })
        .subscribe(({ events }) => {
          observedEvents.push(...events);
          if (events.some(e => e.type === 'completion')) {
            resolve(observedEvents);
            subscription.unsubscribe();
          }
        });
    });
    const job = await broker1.claim();
    await job.emitLog('log 1');
    await job.emitLog('log 2');
    await job.emitLog('log 3');
    await job.complete('completed');

    const logs = await logPromise;
    expect(logs.map(l => l.body.message, logger)).toEqual([
      'log 1',
      'log 2',
      'log 3',
      'Run completed with status: completed',
    ]);

    const afterLogs = await new Promise<string[]>(resolve => {
      const subscription = broker2
        .event$({ jobId: jobs[0].id, after: logs[1].id })
        .subscribe(({ events }) => {
          resolve(events.map(e => e.body.message as string));
          subscription.unsubscribe();
        });
    });
    expect(afterLogs).toEqual([
      'log 3',
      'Run completed with status: completed',
    ]);
  });

  it('should heartbeat', async () => {
    const { runId } = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });
    const job = await broker.claim();

    const { jobs: initialJobs } = await storage.listJobs({ run: runId });
    const initialJob = initialJobs[0];

    for (;;) {
      const { jobs: maybeJobs } = await storage.listJobs({ run: runId });
      const maybeJob = maybeJobs[0];
      if (maybeJob.lastHeartbeatAt !== initialJob.lastHeartbeatAt) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await job.complete('completed');
    expect.assertions(0);
  });

  it('should be update the status to failed if heartbeat fails', async () => {
    const { runId } = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });
    const job = await broker.claim();

    jest
      .spyOn((job as any).storage, 'heartbeatJob')
      .mockRejectedValue(new Error('nah m8'));

    const intervalId = setInterval(() => {
      broker.vacuumJobs({ timeoutS: 2 });
    }, 500);

    for (;;) {
      const { jobs: maybeJobs } = await storage.listJobs({ run: runId });
      const maybeJob = maybeJobs[0];
      if (maybeJob.status === 'failed') {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    clearInterval(intervalId);

    expect(job.done).toBe(true);
  });

  it('should list all runs and their jobs', async () => {
    const { runId } = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
    });

    const runsPpromise = broker.listRuns();
    await expect(runsPpromise).resolves.toEqual({
      runs: expect.arrayContaining([
        expect.objectContaining({
          id: runId,
        }),
      ]),
    });

    const jobsPromise = broker.listJobs({ run: runId });
    await expect(jobsPromise).resolves.toEqual({
      jobs: expect.arrayContaining([
        expect.objectContaining({
          runId: runId,
        }),
      ]),
    });
  });

  it('should list only tasks createdBy a specific user', async () => {
    const { runId } = await broker.dispatch({
      codemodSpec: {} as CodemodRunSpec,
      jobsSpecs: [
        {
          codemod: {} as CodemodSpecV1alpha1,
          targetRef: 'component:default/target',
        },
      ],
      createdBy: 'user:default/foo',
    });

    const run = await storage.getRun(runId);

    const promise = broker.listRuns({ createdBy: 'user:default/foo' });
    await expect(promise).resolves.toEqual({ runs: [run] });
  });
});
