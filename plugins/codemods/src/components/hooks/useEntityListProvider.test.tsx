import React, { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import qs from 'qs';
import { act, renderHook } from '@testing-library/react-hooks';
import { CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import {
  alertApiRef,
  ConfigApi,
  configApiRef,
  IdentityApi,
  identityApiRef,
  storageApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { MockStorageApi, TestApiProvider } from '@backstage/test-utils';
import { EntityKindPicker } from '../EntityKindPicker';
import { EntityKindFilter, FacetFilter } from '../filters';
import { EntityListProvider, useEntityList } from './useEntityListProvider';
import { CodemodEntity } from '@k-phoen/plugin-codemods-common';

const entities: Entity[] = [
  {
    apiVersion: '1',
    kind: 'Component',
    metadata: {
      name: 'component-1',
    },
    relations: [
      {
        type: 'ownedBy',
        targetRef: 'user:default/guest',
      },
    ],
  },
  {
    apiVersion: '1',
    kind: 'Component',
    metadata: {
      name: 'component-2',
    },
  },
];

const mockConfigApi = {
  getOptionalString: () => '',
} as Partial<ConfigApi>;
const mockIdentityApi: Partial<IdentityApi> = {
  getBackstageIdentity: async () => ({
    type: 'user',
    userEntityRef: 'user:default/guest',
    ownershipEntityRefs: [],
  }),
  getCredentials: async () => ({ token: undefined }),
};
const mockCatalogApi: Partial<CatalogApi> = {
  getEntities: jest.fn().mockImplementation(async () => ({ items: entities })),
  getEntityByRef: async () => undefined,
};

const wrapper = ({
  location,
  children,
}: PropsWithChildren<{
  location?: string;
}>) => {
  const codemod = { spec: {} } as CodemodEntity;

  return (
    <MemoryRouter initialEntries={[location ?? '']}>
      <TestApiProvider
        apis={[
          [configApiRef, mockConfigApi],
          [catalogApiRef, mockCatalogApi],
          [identityApiRef, mockIdentityApi],
          [storageApiRef, MockStorageApi.create()],
          [alertApiRef, { post: jest.fn() }],
        ]}
      >
        <EntityListProvider codemod={codemod}>
          <EntityKindPicker initialFilter="component" />
          {children}
        </EntityListProvider>
      </TestApiProvider>
    </MemoryRouter>
  );
};

describe('<EntityListProvider />', () => {
  const origReplaceState = window.history.replaceState;
  beforeEach(() => {
    window.history.replaceState = jest.fn();
  });
  afterEach(() => {
    window.history.replaceState = origReplaceState;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves backend filters', async () => {
    const { result, waitForValueToChange } = renderHook(() => useEntityList(), {
      wrapper,
    });
    await waitForValueToChange(() => result.current.backendEntities);
    expect(result.current.backendEntities.length).toBe(2);
    expect(mockCatalogApi.getEntities).toHaveBeenCalledWith({
      filter: { kind: 'component' },
    });
  });

  it('resolves query param filter values', async () => {
    const query = qs.stringify({
      filters: { kind: 'component', type: 'service' },
    });
    const { result, waitFor } = renderHook(() => useEntityList(), {
      wrapper,
      initialProps: {
        location: `/catalog?${query}`,
      },
    });
    await act(() => waitFor(() => !!result.current.queryParameters));
    expect(result.current.queryParameters).toEqual({
      kind: 'component',
      type: 'service',
    });
  });

  it('debounces multiple filter changes', async () => {
    const { result, waitForNextUpdate, waitForValueToChange } = renderHook(
      () => useEntityList(),
      {
        wrapper,
      },
    );
    await waitForValueToChange(() => result.current.backendEntities);
    expect(result.current.backendEntities.length).toBe(2);
    expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateFilters({ kind: new EntityKindFilter('component') });
      result.current.updateFilters({
        type: new FacetFilter('spec.type', ['service']),
      });
    });
    await waitForNextUpdate();
    expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(2);
  });

  it('returns an error on catalogApi failure', async () => {
    const { result, waitForValueToChange, waitFor } = renderHook(
      () => useEntityList(),
      {
        wrapper,
      },
    );
    await waitForValueToChange(() => result.current.backendEntities);
    expect(result.current.backendEntities.length).toBe(2);

    mockCatalogApi.getEntities = jest.fn().mockRejectedValue('error');
    act(() => {
      result.current.updateFilters({ kind: new EntityKindFilter('api') });
    });
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
