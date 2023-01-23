import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { errorApiRef } from '@backstage/core-plugin-api';
import { CatalogApi, catalogApiRef } from '@backstage/plugin-catalog-react';
import { CodemodEntity } from '@k-phoen/plugin-codemods-common';
import { rootRouteRef } from '../../routes';
import { codemodApiRef } from '../../api';
import { CodemodApi } from '../../types';
import { StartCodemodPage } from './StartCodemodPage';

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    useParams: jest.fn(() => ({
      namespace: 'codemod-ns',
      codemodName: 'codemod-name',
    })),
  };
});

const codemodApiMock: jest.Mocked<CodemodApi> = {
  getTemplateParameterSchema: jest.fn(),
  applyCodemod: jest.fn(),
  listRuns: jest.fn(),
  listJobs: jest.fn(),
  getRun: jest.fn(),
  getJob: jest.fn(),
  streamLogs: jest.fn(),
  listActions: jest.fn(),
};

const catalogApiMock: jest.Mocked<CatalogApi> = {
  getEntityByRef: jest.fn(),
} as any;

const errorApiMock = { post: jest.fn(), error$: jest.fn() };

const codemodEntity: CodemodEntity = {
  apiVersion: 'codemod.backstage.io/v1alpha1',
  kind: 'Codemod',
  metadata: {
    namespace: 'codemod-ns',
    name: 'codemod-name',
    title: 'Golang dependencies update',
  },
  spec: {
    steps: [],
  },
};

const parameterSchema = {
  title: 'Golang dependencies update',
  description: '',
  steps: [],
};

const apis = TestApiRegistry.from(
  [codemodApiRef, codemodApiMock],
  [catalogApiRef, catalogApiMock],
  [errorApiRef, errorApiMock],
);

describe('StartCodemodPage', () => {
  it('renders correctly', async () => {
    catalogApiMock.getEntityByRef.mockResolvedValue(codemodEntity);
    codemodApiMock.getTemplateParameterSchema.mockResolvedValue(
      parameterSchema,
    );

    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <StartCodemodPage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/': rootRouteRef,
        },
      },
    );

    expect(rendered.getByText('Apply a codemod')).toBeInTheDocument(); // page title
    expect(
      rendered.getByText('Golang dependencies update'),
    ).toBeInTheDocument(); // codemod title
    expect(rendered.getByText('Next step')).toBeInTheDocument(); // "next" button in the run wizard
  });

  it('navigates away if no codemod was loaded', async () => {
    catalogApiMock.getEntityByRef.mockResolvedValue(undefined as any);

    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <Routes>
          <Route path="/test" element={<StartCodemodPage />} />
          <Route path="/" element={<>This is root</>} />
        </Routes>
      </ApiProvider>,
      {
        routeEntries: ['/'],
        mountedRoutes: { '/': rootRouteRef },
      },
    );

    expect(rendered.queryByText('Apply a codemod')).not.toBeInTheDocument();
    expect(rendered.getByText('This is root')).toBeInTheDocument();
  });
});
