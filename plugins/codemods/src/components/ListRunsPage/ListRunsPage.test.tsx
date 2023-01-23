import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import {
  CatalogApi,
  catalogApiRef,
  entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { identityApiRef } from '@backstage/core-plugin-api';
import { ListRunsPage } from './ListRunsPage';
import { CodemodApi } from '../../types';
import { codemodApiRef } from '../../api';
import { rootRouteRef } from '../../routes';
import { act, fireEvent } from '@testing-library/react';

describe('<ListRunsPage />', () => {
  const catalogApi: jest.Mocked<CatalogApi> = {
    getEntityByRef: jest.fn(),
  } as any;

  const identityApi = {
    getBackstageIdentity: jest.fn(),
    getProfileInfo: jest.fn(),
    getCredentials: jest.fn(),
    signOut: jest.fn(),
  };

  const codemodApiMock: jest.Mocked<Required<CodemodApi>> = {
    scaffold: jest.fn(),
    getTemplateParameterSchema: jest.fn(),
    listRuns: jest.fn(),
  } as any;

  it('should render the page', async () => {
    const entity: Entity = {
      apiVersion: 'v1',
      kind: 'service',
      metadata: {
        name: 'test',
      },
      spec: {
        profile: {
          displayName: 'BackUser',
        },
      },
    };
    catalogApi.getEntityByRef.mockResolvedValue(entity);

    codemodApiMock.listRuns.mockResolvedValue({ runs: [] });

    const { getByText } = await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, catalogApi],
          [identityApiRef, identityApi],
          [codemodApiRef, codemodApiMock],
        ]}
      >
        <ListRunsPage />
      </TestApiProvider>,
      {
        mountedRoutes: {
          '/catalog/:namespace/:kind/:name': entityRouteRef,
          '/root': rootRouteRef,
        },
      },
    );

    expect(getByText('List codemod runs')).toBeInTheDocument();
    expect(getByText('All runs that have been started')).toBeInTheDocument();
  });

  it('should render the runs I am owner', async () => {
    codemodApiMock.listRuns.mockResolvedValue({
      runs: [
        {
          id: 'a-random-id',
          spec: {
            user: { ref: 'user:default/foo' },
            codemodInfo: {
              entityRef: 'template:default/test-codemod',
            },
          } as any,
          createdAt: '',
          targetsCount: 2,
          openCount: 2,
          cancelledCount: 0,
          completedCount: 0,
          failedCount: 0,
          processingCount: 0,
        },
      ],
    });

    const { getByText, findByText } = await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, catalogApi],
          [identityApiRef, identityApi],
          [codemodApiRef, codemodApiMock],
        ]}
      >
        <ListRunsPage />
      </TestApiProvider>,
      {
        mountedRoutes: {
          '/catalog/:namespace/:kind/:name': entityRouteRef,
          '/root': rootRouteRef,
        },
      },
    );

    expect(codemodApiMock.listRuns).toHaveBeenCalledWith({
      filterByOwnership: 'owned',
    });
    expect(getByText('List codemod runs')).toBeInTheDocument();
    expect(getByText('All runs that have been started')).toBeInTheDocument();
    expect(getByText('Runs')).toBeInTheDocument();
    expect(
      await findByText('template:default/test-codemod'),
    ).toBeInTheDocument();
    expect(await findByText('BackUser')).toBeInTheDocument();
  });

  it('should render all runs', async () => {
    codemodApiMock.listRuns.mockResolvedValue({
      runs: [
        {
          id: 'a-random-id',
          spec: {
            user: { ref: 'user:default/foo' },
            codemodInfo: {
              entityRef: 'template:default/test-codemod',
            },
          } as any,
          createdAt: '',
          targetsCount: 2,
          openCount: 2,
          cancelledCount: 0,
          completedCount: 0,
          failedCount: 0,
          processingCount: 0,
        },
        {
          id: 'b-random-id',
          spec: {
            user: { ref: 'user:default/bar' },
            codemodInfo: {
              entityRef: 'template:default/test-other-codemod',
            },
          } as any,
          createdAt: '',
          targetsCount: 2,
          openCount: 2,
          cancelledCount: 0,
          completedCount: 0,
          failedCount: 0,
          processingCount: 0,
        },
      ],
    });

    const { getByText, findByText } = await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, catalogApi],
          [identityApiRef, identityApi],
          [codemodApiRef, codemodApiMock],
        ]}
      >
        <ListRunsPage />
      </TestApiProvider>,
      {
        mountedRoutes: {
          '/catalog/:namespace/:kind/:name': entityRouteRef,
          '/root': rootRouteRef,
        },
      },
    );

    await act(async () => {
      const allButton = getByText('All');
      fireEvent.click(allButton);
    });

    expect(codemodApiMock.listRuns).toHaveBeenCalledWith({
      filterByOwnership: 'all',
    });
    expect(
      await findByText('template:default/test-codemod'),
    ).toBeInTheDocument();
    expect(
      await findByText('template:default/test-other-codemod'),
    ).toBeInTheDocument();
  });
});
