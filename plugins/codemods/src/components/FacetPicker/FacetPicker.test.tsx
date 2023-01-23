import { default as React } from 'react';
import { fireEvent, waitFor, screen } from '@testing-library/react';
import { capitalize } from 'lodash';
import { GetEntityFacetsResponse } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { ApiProvider } from '@backstage/core-app-api';
import { alertApiRef } from '@backstage/core-plugin-api';
import { renderWithEffects, TestApiRegistry } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { MockEntityListContextProvider } from '../testUtils';
import { EntityKindFilter } from '../filters';
import { EntityKindPicker } from '../EntityKindPicker';

const entities: Entity[] = [
  {
    apiVersion: '1',
    kind: 'Component',
    metadata: {
      name: 'component',
    },
  },
  {
    apiVersion: '1',
    kind: 'Domain',
    metadata: {
      name: 'domain',
    },
  },
  {
    apiVersion: '1',
    kind: 'Group',
    metadata: {
      name: 'group',
    },
  },
];

describe('<EntityKindPicker/>', () => {
  const apis = TestApiRegistry.from(
    [
      catalogApiRef,
      {
        getEntityFacets: jest.fn().mockResolvedValue({
          facets: {
            kind: entities.map(e => ({
              value: e.kind,
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

  it('renders available entity kinds', async () => {
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{ filters: { kind: new EntityKindFilter('component') } }}
        >
          <EntityKindPicker />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );
    expect(screen.getByText('Kind')).toBeInTheDocument();

    const input = screen.getByTestId('select');
    fireEvent.click(input);

    await waitFor(() => screen.getByText('Domain'));

    entities.forEach(entity => {
      expect(
        screen.getByRole('option', {
          name: capitalize(entity.kind as string),
        }),
      ).toBeInTheDocument();
    });
  });

  it('sets the selected kind filter', async () => {
    const updateFilters = jest.fn();
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{
            filters: { kind: new EntityKindFilter('component') },
            updateFilters,
          }}
        >
          <EntityKindPicker />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );
    const input = screen.getByTestId('select');
    fireEvent.click(input);

    await waitFor(() => screen.getByText('Domain'));
    fireEvent.click(screen.getByText('Domain'));

    expect(updateFilters).toHaveBeenLastCalledWith({
      kind: new EntityKindFilter('domain'),
    });
  });

  it('respects the query parameter filter value', async () => {
    const updateFilters = jest.fn();
    const queryParameters = { kind: 'group' };
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{
            updateFilters,
            queryParameters,
          }}
        >
          <EntityKindPicker initialFilter="group" />
        </MockEntityListContextProvider>
        ,
      </ApiProvider>,
    );

    expect(updateFilters).toHaveBeenLastCalledWith({
      kind: new EntityKindFilter('group'),
    });
  });

  it('renders unknown kinds provided in query parameters', async () => {
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{ queryParameters: { kind: 'FROb' } }}
        >
          <EntityKindPicker />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );

    expect(screen.getByText('FROb')).toBeInTheDocument();
  });

  it('limits kinds when allowedKinds is set', async () => {
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider>
          <EntityKindPicker allowedKinds={['component', 'domain']} />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );

    const input = screen.getByTestId('select');
    fireEvent.click(input);

    expect(
      screen.getByRole('option', { name: 'Component' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Domain' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Template' }),
    ).not.toBeInTheDocument();
  });

  it('renders kind from the query parameter even when not in allowedKinds', async () => {
    await renderWithEffects(
      <ApiProvider apis={apis}>
        <MockEntityListContextProvider
          value={{ queryParameters: { kind: 'Frob' } }}
        >
          <EntityKindPicker allowedKinds={['domain']} />
        </MockEntityListContextProvider>
      </ApiProvider>,
    );

    expect(screen.getByText('Frob')).toBeInTheDocument();

    const input = screen.getByTestId('select');
    fireEvent.click(input);
    expect(screen.getByRole('option', { name: 'Domain' })).toBeInTheDocument();
  });
});
