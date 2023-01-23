import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { MockEntityListContextProvider } from '../testUtils';
import { alertApiRef } from '@backstage/core-plugin-api';
import { ApiProvider } from '@backstage/core-app-api';
import { renderWithEffects, TestApiRegistry } from '@backstage/test-utils';
import { GetEntityFacetsResponse } from '@backstage/catalog-client';
import { EntityKindFilter, FacetFilter } from '../filters';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { StaticFacetPicker } from './StaticFacetPicker';

const entities: Entity[] = [
  {
    apiVersion: '1',
    kind: 'Component',
    metadata: {
      name: 'component-1',
    },
    spec: {
      type: 'service',
    },
  },
  {
    apiVersion: '1',
    kind: 'Component',
    metadata: {
      name: 'component-2',
    },
    spec: {
      type: 'website',
    },
  },
  {
    apiVersion: '1',
    kind: 'Component',
    metadata: {
      name: 'component-3',
    },
    spec: {
      type: 'library',
    },
  },
];

const apis = TestApiRegistry.from(
  [
    catalogApiRef,
    {
      getEntityFacets: jest.fn().mockResolvedValue({
        facets: {
          'spec.type': entities.map(e => ({
            value: (e.spec as any).type,
            count: 1,
          })),
        },
      } as GetEntityFacetsResponse),
    },
  ],
  [
    alertApiRef,
    {
      post: jest.fn(),
    },
  ],
);

describe('<StaticFacetPicker/>', () => {
  it('renders available entity types', async () => {
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{ filters: { kind: new EntityKindFilter('component') } }}
        >
          <StaticFacetPicker
            label="Type"
            facetName="spec.type"
            filterName="type"
          />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );
    expect(screen.getByText('Type')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('lifecycle-picker-expand'));
    entities
      .map(e => e.spec?.type!)
      .forEach(type => {
        expect(screen.getByText(type as string)).toBeInTheDocument();
      });
  });

  it('adds the selected type filter', async () => {
    const updateFilters = jest.fn();
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{
            filters: { kind: new EntityKindFilter('component') },
            updateFilters,
          }}
        >
          <StaticFacetPicker
            label="Type"
            facetName="spec.type"
            filterName="type"
          />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );
    expect(updateFilters).toHaveBeenLastCalledWith({
      type: undefined,
    });

    fireEvent.click(screen.getByTestId('lifecycle-picker-expand'));
    fireEvent.click(screen.getByText('library'));
    expect(updateFilters).toHaveBeenLastCalledWith({
      type: new FacetFilter('spec.type', ['library']),
    });
  });

  it('responds to external queryParameters changes', async () => {
    const updateFilters = jest.fn();
    const rendered = await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{
            updateFilters,
            queryParameters: { type: ['service'] },
          }}
        >
          <StaticFacetPicker
            label="Type"
            facetName="spec.type"
            filterName="type"
          />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );
    expect(updateFilters).toHaveBeenLastCalledWith({
      type: new FacetFilter('spec.type', ['service']),
    });
    rendered.rerender(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{
            updateFilters,
            queryParameters: { type: ['tool'] },
          }}
        >
          <StaticFacetPicker
            label="Type"
            facetName="spec.type"
            filterName="type"
          />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );
    expect(updateFilters).toHaveBeenLastCalledWith({
      type: new FacetFilter('spec.type', ['tool']),
    });
  });
});
