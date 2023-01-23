import React, { useEffect, useMemo, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from '@material-ui/core';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Autocomplete } from '@material-ui/lab';
import { useEntityList } from '../hooks/useEntityListProvider';
import { FacetFilter } from '../filters';

type facetFilter = {
  facet: string;
  value: string[];
};

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

function useEntityFacetFilter(): {
  loading: boolean;
  error?: Error;
  facetValues: string[];
  selectedFilter: facetFilter;
  setSelectedFilter: (filter: facetFilter) => void;
} {
  const catalogApi = useApi(catalogApiRef);

  const {
    filters,
    backendFilters,
    queryParameters: { facet: facetParameter },
    updateFilters,
  } = useEntityList();

  const queryParamFacet = useMemo(
    () => [facetParameter].flat()[0],
    [facetParameter],
  );

  const [selectedFilter, setSelectedFilter] = useState<facetFilter>({
    facet: queryParamFacet ?? filters.facet?.values[0] ?? '', // TODO how to store the facet name and get it back from the URL/filters?
    value:
      ([queryParamFacet].filter(Boolean) as string[]) ??
      filters.facet?.values ??
      [],
  });

  // Set selected facet/value on query parameter updates; this happens at initial page load and from
  // external updates to the page location.
  useEffect(() => {
    if (queryParamFacet) {
      // FIXME
      setSelectedFilter({
        facet: queryParamFacet,
        value: selectedFilter.value,
      });
    }
  }, [queryParamFacet, selectedFilter, setSelectedFilter]);

  useEffect(() => {
    updateFilters({
      facet:
        selectedFilter.facet && selectedFilter.value
          ? new FacetFilter(selectedFilter.facet, selectedFilter.value)
          : undefined,
    });
  }, [selectedFilter, updateFilters]);

  const {
    loading,
    error,
    value: availableValues,
  } = useAsync(async () => {
    if (!selectedFilter.facet) {
      return [];
    }

    const backendFiltersNoFacet = backendFilters as Record<string, any>;
    backendFiltersNoFacet[selectedFilter.facet] = undefined;

    const items = await catalogApi.getEntityFacets({
      filter: backendFiltersNoFacet,
      facets: [selectedFilter.facet],
    });

    return (
      items.facets[selectedFilter.facet].map(result => result.value).sort() ||
      []
    );
  }, [selectedFilter.facet, backendFilters, catalogApi]);

  return {
    loading,
    error,
    facetValues: availableValues ?? [],
    selectedFilter,
    setSelectedFilter,
  };
}

/** @public */
export const FacetPicker = () => {
  const alertApi = useApi(alertApiRef);
  const { error, facetValues, selectedFilter, setSelectedFilter } =
    useEntityFacetFilter();

  useEffect(() => {
    if (error) {
      alertApi.post({
        message: `Failed to load facet values`,
        severity: 'error',
      });
    }
  }, [error, alertApi]);

  if (error) return null;

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="button" component="label">
          Advanced
        </Typography>
      </AccordionSummary>

      <AccordionDetails>
        <FormGroup>
          <TextField
            label="Facet"
            placeholder="metadata.name, spec.system, …"
            value={selectedFilter.facet}
            onChange={event => {
              setSelectedFilter({
                facet: event.target.value,
                value: [],
              });
            }}
            style={{ marginBottom: '1rem' }}
          />
          <Typography variant="button" component="label">
            Value
            <Autocomplete
              multiple
              options={facetValues}
              value={selectedFilter.value}
              onChange={(_: object, value: string[]) =>
                setSelectedFilter({ facet: selectedFilter.facet, value })
              }
              renderOption={(option, { selected }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      icon={icon}
                      checkedIcon={checkedIcon}
                      checked={selected}
                    />
                  }
                  label={option}
                />
              )}
              size="small"
              popupIcon={<ExpandMoreIcon data-testid="owner-picker-expand" />}
              renderInput={params => (
                <TextField {...params} variant="outlined" />
              )}
            />
          </Typography>
        </FormGroup>
      </AccordionDetails>
    </Accordion>
  );
};
