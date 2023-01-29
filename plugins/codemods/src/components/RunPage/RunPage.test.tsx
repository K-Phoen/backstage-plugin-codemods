import React from 'react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { CatalogApi, catalogApiRef } from '@backstage/plugin-catalog-react';
import { CodemodApi, CodemodRun, Job } from '../../types';
import { codemodApiRef } from '../../api';
import { rootRouteRef } from '../../routes';
import { RunPage } from './RunPage';

const sampleRunId = 'some-run-uuid';

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    useParams: jest.fn(() => ({
      runId: sampleRunId,
    })),
  };
});

const codemodRun: CodemodRun = {
  id: sampleRunId,
  spec: {
    apiVersion: 'codemod.backstage.io/v1alpha1',
    targets: {},
    parameters: {},
    steps: [],
    output: {},
    codemodInfo: { entityRef: 'codemod:default/some-codemod' },
  },
  targetsCount: 0,
  openCount: 0,
  processingCount: 0,
  cancelledCount: 0,
  failedCount: 0,
  completedCount: 0,
  createdAt: '2023-01-10T15:40:03.307Z',
};

const codemodEntity = {
  apiVersion: 'codemod.backstage.io/v1alpha1',
  kind: 'Codemod',
  metadata: {
    name: 'some-codemod',
    namespace: 'default',
  },
};

const jobs: Job[] = [
  {
    id: 'job-uuid',
    runId: sampleRunId,
    target: 'component:default/some-entity',
    status: 'completed',
    lastHeartbeatAt: '2023-01-10T15:40:05.307Z',
  },
  {
    id: 'other-job-uuid',
    runId: sampleRunId,
    target: 'component:default/some-other-entity',
    status: 'completed',
    lastHeartbeatAt: '2023-01-10T15:40:07.307Z',
  },
];

describe('<RunPage />', () => {
  const catalogApi: jest.Mocked<CatalogApi> = {
    getEntityByRef: jest.fn(),
  } as any;

  const codemodApiMock: jest.Mocked<CodemodApi> = {
    applyCodemod: jest.fn(),
    listRuns: jest.fn(),
    getRun: jest.fn(),
    listJobs: jest.fn(),
    getJob: jest.fn(),
    streamLogs: jest.fn(),
    listActions: jest.fn(),
  };

  it('should render the page', async () => {
    // summary card
    codemodApiMock.getRun.mockResolvedValue(codemodRun);
    catalogApi.getEntityByRef.mockResolvedValue(codemodEntity);

    // jobs list
    codemodApiMock.listJobs.mockResolvedValue({ jobs: jobs });

    const { getByText } = await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, catalogApi],
          [codemodApiRef, codemodApiMock],
        ]}
      >
        <RunPage />
      </TestApiProvider>,
      {
        mountedRoutes: {
          '/root': rootRouteRef,
        },
      },
    );

    expect(getByText('Run summary')).toBeInTheDocument();
    expect(getByText('Jobs')).toBeInTheDocument();
    expect(getByText('codemod:default/some-codemod')).toBeInTheDocument();
    expect(getByText('component:default/some-entity')).toBeInTheDocument();
    expect(
      getByText('component:default/some-other-entity'),
    ).toBeInTheDocument();
  });
});
