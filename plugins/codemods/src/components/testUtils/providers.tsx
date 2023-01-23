import React, {
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  DefaultEntityFilters,
  EntityListContext,
  EntityListContextProps,
} from '../hooks/useEntityListProvider';

/** @public */
export const MockEntityListContextProvider = ({
  children,
  value,
}: PropsWithChildren<{
  value?: Partial<EntityListContextProps>;
}>) => {
  // Provides a default implementation that stores filter state, for testing components that
  // reflect filter state.
  const [filters, setFilters] = useState<DefaultEntityFilters>(
    value?.filters ?? {},
  );

  const updateFilters = useCallback(
    (
      update:
        | Partial<DefaultEntityFilters>
        | ((
            prevFilters: DefaultEntityFilters,
          ) => Partial<DefaultEntityFilters>),
    ) => {
      setFilters(prevFilters => {
        const newFilters =
          typeof update === 'function' ? update(prevFilters) : update;
        return { ...prevFilters, ...newFilters };
      });
    },
    [],
  );

  // Memoize the default values since pickers have useEffect triggers on these; naively defaulting
  // below with `?? <X>` breaks referential equality on subsequent updates.
  const defaultValues = useMemo(
    () => ({
      entities: [],
      backendEntities: [],
      backendFilters: [],
      queryParameters: {},
    }),
    [],
  );

  const resolvedValue: EntityListContextProps = useMemo(
    () => ({
      targetConstraints: {},
      entities: value?.entities ?? defaultValues.entities,
      backendEntities: value?.backendEntities ?? defaultValues.backendEntities,
      backendFilters: value?.backendFilters ?? defaultValues.backendFilters,
      updateFilters: value?.updateFilters ?? updateFilters,
      filters,
      loading: value?.loading ?? false,
      queryParameters: value?.queryParameters ?? defaultValues.queryParameters,
      error: value?.error,
    }),
    [value, defaultValues, filters, updateFilters],
  );

  return (
    <EntityListContext.Provider value={resolvedValue}>
      {children}
    </EntityListContext.Provider>
  );
};
