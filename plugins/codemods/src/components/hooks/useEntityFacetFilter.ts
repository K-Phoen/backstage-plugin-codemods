import { useEffect, useMemo, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { intersect, toList } from '@k-phoen/plugin-codemods-common';
import { FacetFilter } from '../filters';
import {
  DefaultEntityFilters,
  useEntityList,
} from '../hooks/useEntityListProvider';

/**
 * A hook built on top of `useEntityList` for enabling selection of valid values
 * for the given facet, based on the selected EntityKindFilter.
 */
export function useEntityFacetFilter(
  facet: string,
  filterName: Exclude<keyof DefaultEntityFilters, 'kind'>,
): {
  loading: boolean;
  error?: Error;
  availableValues: string[];
  selectedValues: string[];
  setSelectedValues: (types: string[]) => void;
} {
  const catalogApi = useApi(catalogApiRef);
  const {
    filters: { kind: kindFilter, [filterName]: valueFilter },
    queryParameters: { [filterName]: queryParameter },
    updateFilters,
    targetConstraints,
  } = useEntityList();

  const allowedValues = toList(targetConstraints[facet]);
  const flattenedQueryParameters = useMemo(
    () => [queryParameter].flat().filter(Boolean) as string[],
    [queryParameter],
  );

  const [selectedValues, setSelectedValues] = useState(
    flattenedQueryParameters.length
      ? flattenedQueryParameters
      : toList(valueFilter?.rawValue()) ?? toList(allowedValues[0]),
  );

  // Set selected values on query parameter updates; this happens at initial page load and from
  // external updates to the page location.
  useEffect(() => {
    if (flattenedQueryParameters.length) {
      setSelectedValues(flattenedQueryParameters);
    }
  }, [flattenedQueryParameters]);

  const [availableValues, setAvailableValues] = useState<string[]>([]);
  const kind = useMemo(() => kindFilter?.value, [kindFilter]);

  // Load all valid `facet` values straight from the catalogApi, paying attention to only the
  // kind filter for a complete list.
  const {
    error,
    loading,
    value: facets,
  } = useAsync(async () => {
    if (kind) {
      const items = await catalogApi
        .getEntityFacets({
          filter: { kind },
          facets: [facet],
        })
        .then(response => response.facets[facet] || []);
      return items;
    }
    return [];
  }, [kind, catalogApi, facet]);

  const facetsRef = useRef(facets);
  useEffect(() => {
    const oldFacets = facetsRef.current;
    facetsRef.current = facets;
    // Delay processing hook until kind and facets load updates have settled to generate list of values;
    // This prevents resetting the facet filter due to saved value from query params not matching the
    // empty set of facet values while values are still being loaded; also only run this hook on changes
    // to facets
    if (loading || !kind || oldFacets === facets || !facets) {
      return;
    }

    // Sort by facet count descending, so the most common values appear on top
    const newTypes = [
      ...new Set(
        sortBy(facets, f => -f.count).map(f =>
          f.value.toLocaleLowerCase('en-US'),
        ),
      ),
    ];
    const constrainedValues =
      allowedValues.length !== 0
        ? intersect(allowedValues, newTypes)
        : newTypes;
    setAvailableValues(constrainedValues);

    // Update the filter to only valid values when the list of available values has changed
    const stillValidValues = selectedValues.filter(value =>
      constrainedValues.includes(value),
    );
    if (!isEqual(selectedValues, stillValidValues)) {
      setSelectedValues(stillValidValues);
    }
  }, [loading, kind, selectedValues, allowedValues, setSelectedValues, facets]);

  useEffect(() => {
    updateFilters({
      [filterName]: selectedValues.length
        ? new FacetFilter(facet, selectedValues)
        : undefined,
    });
  }, [selectedValues, filterName, facet, updateFilters]);

  return {
    loading,
    error,
    availableValues,
    selectedValues,
    setSelectedValues,
  };
}
