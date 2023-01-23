import React from 'react';
import { Entity } from '@backstage/catalog-model';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import {
  CatalogApi,
  catalogApiRef,
  entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { identityApiRef } from '@backstage/core-plugin-api';
import { OwnerEntityColumn } from './OwnerEntityColumn';

describe('<OwnerEntityColumn />', () => {
  const catalogApi: jest.Mocked<CatalogApi> = {
    getEntityByRef: jest.fn(),
  } as any;

  const identityApi = {
    getBackstageIdentity: jest.fn(),
    getProfileInfo: jest.fn(),
    getCredentials: jest.fn(),
    signOut: jest.fn(),
  };

  it('should render the column with the user', async () => {
    const props = {
      entityRef: 'user:default/foo',
    };

    const entity: Entity = {
      apiVersion: 'v1',
      kind: 'User',
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

    const { getByText } = await renderInTestApp(
      <TestApiProvider
        apis={[
          [catalogApiRef, catalogApi],
          [identityApiRef, identityApi],
        ]}
      >
        <OwnerEntityColumn {...props} />
      </TestApiProvider>,
      {
        mountedRoutes: {
          '/catalog/:namespace/:kind/:name': entityRouteRef,
        },
      },
    );

    const text = getByText('BackUser');
    expect(text).toBeDefined();
  });
});
