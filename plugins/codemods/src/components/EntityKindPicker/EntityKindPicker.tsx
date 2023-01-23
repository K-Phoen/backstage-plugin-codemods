import React, { useEffect, useMemo, useState } from 'react';
import { Box } from '@material-ui/core';
import { Select } from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { toList } from '@k-phoen/plugin-codemods-common';
import { filterKinds, useAllKinds } from './kindFilterUtils';
import { useEntityList } from '../hooks/useEntityListProvider';
import { EntityKindFilter } from '../filters';

function useEntityKindFilter(opts: { initialFilter: string }): {
  loading: boolean;
  error?: Error;
  allKinds: string[];
  allowedKinds?: string[];
  selectedKind: string;
  setSelectedKind: (kind: string) => void;
} {
  const {
    filters,
    queryParameters: { kind: kindParameter },
    updateFilters,
    targetConstraints,
  } = useEntityList();

  const allowedKinds = toList(targetConstraints.kind);

  const queryParamKind = useMemo(
    () => [kindParameter].flat()[0],
    [kindParameter],
  );

  const [selectedKind, setSelectedKind] = useState(
    queryParamKind ??
      filters.kind?.value ??
      allowedKinds[0] ??
      opts.initialFilter,
  );

  // Set selected kinds on query parameter updates; this happens at initial page load and from
  // external updates to the page location.
  useEffect(() => {
    if (queryParamKind) {
      setSelectedKind(queryParamKind);
    }
  }, [queryParamKind]);

  // Set selected kind from filters; this happens when the kind filter is
  // updated from another component
  useEffect(() => {
    if (filters.kind?.value) {
      setSelectedKind(filters.kind?.value);
    }
  }, [filters.kind]);

  useEffect(() => {
    updateFilters({
      kind: selectedKind ? new EntityKindFilter(selectedKind) : undefined,
    });
  }, [selectedKind, updateFilters]);

  const { allKinds, loading, error } = useAllKinds();

  return {
    loading,
    error,
    allKinds: allKinds ?? [],
    allowedKinds,
    selectedKind,
    setSelectedKind,
  };
}

/**
 * Props for {@link EntityKindPicker}.
 *
 * @public
 */
export interface EntityKindPickerProps {
  initialFilter?: string;
}

/** @public */
export const EntityKindPicker = (props: EntityKindPickerProps) => {
  const alertApi = useApi(alertApiRef);
  const { initialFilter = 'component' } = props;

  const { error, allKinds, allowedKinds, selectedKind, setSelectedKind } =
    useEntityKindFilter({
      initialFilter: initialFilter,
    });

  useEffect(() => {
    if (error) {
      alertApi.post({
        message: `Failed to load entity kinds`,
        severity: 'error',
      });
    }
  }, [error, alertApi]);

  if (error) return null;

  const options = filterKinds(allKinds, allowedKinds, selectedKind);

  const items = Object.keys(options).map(key => ({
    value: key,
    label: options[key],
  }));

  return (
    <Box pb={1} pt={1}>
      <Select
        label="Kind"
        items={items}
        selected={selectedKind.toLocaleLowerCase('en-US')}
        onChange={value => setSelectedKind(String(value))}
      />
    </Box>
  );
};
