import { Entity } from '@backstage/catalog-model';
import { compact, isEqual } from 'lodash';
import qs from 'qs';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';
import useMountedState from 'react-use/lib/useMountedState';
import { EntityKindFilter, FacetFilter } from '../filters';
import { useApi } from '@backstage/core-plugin-api';
import { EntityFilterQuery } from '@backstage/catalog-client';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { EntityFilter } from '../types';
import { CodemodEntity, CatalogFilters } from '@k-phoen/plugin-codemods-common';

/** @public */
export interface DefaultEntityFilters {
  // ensure all properties have a consistent type.
  [P: keyof any]: EntityFilter | undefined;

  kind?: EntityKindFilter;
  type?: FacetFilter;
  lifecycles?: FacetFilter;
  owners?: FacetFilter;
  facet?: FacetFilter;
}

/** @public */
export type EntityListContextProps<
  EntityFilters extends DefaultEntityFilters = DefaultEntityFilters,
> = {
  /**
   * The currently registered filters, adhering to the shape of DefaultEntityFilters or an extension
   * of that default (to add custom filter types).
   */
  filters: EntityFilters;

  /**
   * The resolved list of catalog entities, after all filters are applied.
   */
  entities: Entity[];

  /**
   * The resolved list of catalog entities, after _only catalog-backend_ filters are applied.
   */
  backendEntities: Entity[];

  /**
   * The resolve filters used to query the catalog.
   */
  backendFilters: EntityFilterQuery;

  /**
   * Set of filters defined by the codemod, constraining the possible targets.
   */
  targetConstraints: CatalogFilters;

  /**
   * Update one or more of the registered filters. Optional filters can be set to `undefined` to
   * reset the filter.
   */
  updateFilters: (
    filters:
      | Partial<EntityFilters>
      | ((prevFilters: EntityFilters) => Partial<EntityFilters>),
  ) => void;

  /**
   * Filter values from query parameters.
   */
  queryParameters: Partial<Record<keyof EntityFilters, string | string[]>>;

  loading: boolean;
  error?: Error;
};

const reduceCatalogFilters = (filters: EntityFilter[]): CatalogFilters => {
  return filters.reduce((compoundFilter, filter) => {
    return {
      ...compoundFilter,
      ...filter.getCatalogFilters(),
    };
  }, {} as CatalogFilters);
};

/**
 * Creates new context for entity listing and filtering.
 * @public
 */
export const EntityListContext = createContext<
  EntityListContextProps<any> | undefined
>(undefined);

type OutputState<EntityFilters extends DefaultEntityFilters> = {
  appliedFilters: EntityFilters;
  entities: Entity[];
  backendEntities: Entity[];
  backendFilters: EntityFilterQuery;
};

type EntityListProviderProps = PropsWithChildren<{
  codemod: CodemodEntity;
}>;

/**
 * Provides entities and filters for a catalog listing.
 * @public
 */
export const EntityListProvider = <EntityFilters extends DefaultEntityFilters>({
  codemod,
  children,
}: EntityListProviderProps) => {
  const isMounted = useMountedState();
  const catalogApi = useApi(catalogApiRef);
  const [requestedFilters, setRequestedFilters] = useState<EntityFilters>(
    {} as EntityFilters,
  );

  // We use react-router's useLocation hook so updates from external sources trigger an update to
  // the queryParameters in outputState. Updates from this hook use replaceState below and won't
  // trigger a useLocation change; this would instead come from an external source, such as a manual
  // update of the URL or two catalog sidebar links with different catalog filters.
  const location = useLocation();
  const queryParameters = useMemo(
    () =>
      (qs.parse(location.search, {
        ignoreQueryPrefix: true,
      }).filters ?? {}) as Record<string, string | string[]>,
    [location],
  );

  const [outputState, setOutputState] = useState<OutputState<EntityFilters>>(
    () => {
      return {
        appliedFilters: {} as EntityFilters,
        entities: [],
        backendEntities: [],
        backendFilters: [],
      };
    },
  );

  // The main async filter worker. Note that while it has a lot of dependencies
  // in terms of its implementation, the triggering only happens (debounced)
  // based on the requested filters changing.
  const [{ loading, error }, refresh] = useAsyncFn(
    async () => {
      const compacted = compact(Object.values(requestedFilters));
      const backendFilter = reduceCatalogFilters(compacted);
      const previousBackendFilter = reduceCatalogFilters(
        compact(Object.values(outputState.appliedFilters)),
      );

      const queryParams = Object.keys(requestedFilters).reduce(
        (params, key) => {
          const filter: EntityFilter | undefined =
            requestedFilters[key as keyof EntityFilters];
          if (filter) {
            params[key] = filter.toQueryValue();
          }
          return params;
        },
        {} as Record<string, string | string[]>,
      );

      // TODO(mtlewis): currently entities will never be requested unless
      // there's at least one filter, we should allow an initial request
      // to happen with no filters.
      if (!isEqual(previousBackendFilter, backendFilter)) {
        // TODO(timbonicus): should limit fields here, but would need filter
        // fields + table columns
        const response = await catalogApi.getEntities({
          filter: backendFilter,
        });
        setOutputState({
          appliedFilters: requestedFilters,
          backendFilters: backendFilter,
          backendEntities: response.items,
          entities: response.items,
        });
      } else {
        setOutputState({
          appliedFilters: requestedFilters,
          backendFilters: outputState.backendFilters,
          backendEntities: outputState.backendEntities,
          entities: outputState.backendEntities,
        });
      }

      if (isMounted()) {
        const oldParams = qs.parse(location.search, {
          ignoreQueryPrefix: true,
        });
        const newParams = qs.stringify(
          { ...oldParams, filters: queryParams },
          { addQueryPrefix: true, arrayFormat: 'repeat' },
        );
        const newUrl = `${window.location.pathname}${newParams}`;
        // We use direct history manipulation since useSearchParams and
        // useNavigate in react-router-dom cause unnecessary extra rerenders.
        // Also make sure to replace the state rather than pushing, since we
        // don't want there to be back/forward slots for every single filter
        // change.
        window.history?.replaceState(null, document.title, newUrl);
      }
    },
    [catalogApi, queryParameters, requestedFilters, outputState],
    { loading: true },
  );

  // Slight debounce on the refresh, since (especially on page load) several
  // filters will be calling this in rapid succession.
  useDebounce(refresh, 10, [requestedFilters]);

  const updateFilters = useCallback(
    (
      update:
        | Partial<EntityFilter>
        | ((prevFilters: EntityFilters) => Partial<EntityFilters>),
    ) => {
      setRequestedFilters(prevFilters => {
        const newFilters =
          typeof update === 'function' ? update(prevFilters) : update;
        return { ...prevFilters, ...newFilters };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      targetConstraints: codemod.spec.constraints || {},
      filters: outputState.appliedFilters,
      entities: outputState.entities,
      backendEntities: outputState.backendEntities,
      backendFilters: outputState.backendFilters,
      updateFilters,
      queryParameters,
      loading,
      error,
    }),
    [outputState, updateFilters, codemod, queryParameters, loading, error],
  );

  return (
    <EntityListContext.Provider value={value}>
      {children}
    </EntityListContext.Provider>
  );
};

/**
 * Hook for interacting with the entity list context provided by the {@link EntityListProvider}.
 * @public
 */
export function useEntityList<
  EntityFilters extends DefaultEntityFilters = DefaultEntityFilters,
>(): EntityListContextProps<EntityFilters> {
  const context = useContext(EntityListContext);
  if (!context)
    throw new Error('useEntityList must be used within EntityListProvider');
  return context;
}
