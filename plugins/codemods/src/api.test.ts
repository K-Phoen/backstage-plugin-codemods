import { MockFetchApi, setupRequestMockHandlers } from '@backstage/test-utils';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { CodemodClient } from './api';

const MockedEventSource = global.EventSource as jest.MockedClass<
  typeof EventSource
>;

const server = setupServer();

describe('api', () => {
  setupRequestMockHandlers(server);
  const mockBaseUrl = 'http://backstage/api';

  const discoveryApi = { getBaseUrl: async () => mockBaseUrl };
  const fetchApi = new MockFetchApi();
  const identityApi = {
    getBackstageIdentity: jest.fn(),
    getProfileInfo: jest.fn(),
    getCredentials: jest.fn(),
    signOut: jest.fn(),
  };

  let apiClient: CodemodClient;
  beforeEach(() => {
    apiClient = new CodemodClient({
      discoveryApi,
      fetchApi,
      identityApi,
    });

    jest.restoreAllMocks();
    identityApi.getBackstageIdentity.mockReturnValue({});
  });

  describe('streamEvents', () => {
    it('should work', async () => {
      MockedEventSource.prototype.addEventListener.mockImplementation(
        (type, fn) => {
          if (typeof fn !== 'function') {
            return;
          }

          if (type === 'log') {
            fn({
              data: '{"id":1,"jobId":"a-random-id","type":"log","createdAt":"","body":{"message":"My log message"}}',
            } as any);
          } else if (type === 'completion') {
            fn({
              data: '{"id":2,"jobId":"a-random-id","type":"completion","createdAt":"","body":{"message":"Finished!"}}',
            } as any);
          }
        },
      );

      const next = jest.fn();

      await new Promise<void>(complete => {
        apiClient
          .streamLogs({ runId: 'a-random-run-id', jobId: 'a-random-job-id' })
          .subscribe({ next, complete });
      });

      expect(MockedEventSource).toHaveBeenCalledWith(
        'http://backstage/api/v1/runs/a-random-run-id/jobs/a-random-job-id/eventstream',
        { withCredentials: true },
      );
      expect(MockedEventSource.prototype.close).toHaveBeenCalled();

      expect(next).toHaveBeenCalledTimes(2);
      expect(next).toHaveBeenCalledWith({
        id: 1,
        jobId: 'a-random-id',
        type: 'log',
        createdAt: '',
        body: { message: 'My log message' },
      });
      expect(next).toHaveBeenCalledWith({
        id: 2,
        jobId: 'a-random-id',
        type: 'completion',
        createdAt: '',
        body: { message: 'Finished!' },
      });
    });
  });

  describe('listRuns', () => {
    it('should list all runs', async () => {
      server.use(
        rest.get(`${mockBaseUrl}/v1/runs`, (req, res, ctx) => {
          const createdBy = req.url.searchParams.get('createdBy');

          if (createdBy) {
            return res(
              ctx.json([
                {
                  createdBy,
                },
              ]),
            );
          }

          return res(
            ctx.json({
              runs: [
                {
                  createdBy: null,
                },
                {
                  createdBy: null,
                },
              ],
            }),
          );
        }),
      );

      const result = await apiClient.listRuns({ filterByOwnership: 'all' });
      expect(result.runs).toHaveLength(2);
    });

    it('should list runs using the current user as owner', async () => {
      server.use(
        rest.get(`${mockBaseUrl}/v1/runs`, (req, res, ctx) => {
          const createdBy = req.url.searchParams.get('createdBy');

          if (createdBy) {
            return res(
              ctx.json({
                runs: [
                  {
                    createdBy,
                  },
                ],
              }),
            );
          }

          return res(
            ctx.json({
              runs: [
                {
                  createdBy: null,
                },
                {
                  createdBy: null,
                },
              ],
            }),
          );
        }),
      );

      identityApi.getBackstageIdentity.mockResolvedValueOnce({
        userEntityRef: 'user:default/foo',
      });

      const result = await apiClient.listRuns({ filterByOwnership: 'owned' });
      expect(identityApi.getBackstageIdentity).toHaveBeenCalled();
      expect(result.runs).toHaveLength(1);
    });
  });

  describe('listJobs', () => {
    it('should list all jobs for a run', async () => {
      server.use(
        rest.get(
          `${mockBaseUrl}/v1/runs/a-random-run-id/jobs`,
          (_req, res, ctx) => {
            return res(
              ctx.json({
                jobs: [{}, {}],
              }),
            );
          },
        ),
      );

      const result = await apiClient.listJobs({ runId: 'a-random-run-id' });
      expect(result.jobs).toHaveLength(2);
    });
  });

  describe('getRun', () => {
    it('should get a run', async () => {
      server.use(
        rest.get(`${mockBaseUrl}/v1/runs/a-random-run-id`, (_req, res, ctx) => {
          return res(ctx.json({}));
        }),
      );

      const result = await apiClient.getRun({ runId: 'a-random-run-id' });
      expect(result).toBeTruthy();
    });
  });

  describe('getJob', () => {
    it('should get a job', async () => {
      server.use(
        rest.get(
          `${mockBaseUrl}/v1/runs/a-random-run-id/jobs/a-random-job-id`,
          (_req, res, ctx) => {
            return res(ctx.json({}));
          },
        ),
      );

      const result = await apiClient.getJob({
        runId: 'a-random-run-id',
        jobId: 'a-random-job-id',
      });
      expect(result).toBeTruthy();
    });
  });
});
