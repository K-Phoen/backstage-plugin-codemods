import React, { useEffect } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from '@material-ui/core';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Autocomplete } from '@material-ui/lab';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { DefaultEntityFilters } from '../hooks/useEntityListProvider';
import { useEntityFacetFilter } from '../hooks/useEntityFacetFilter';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export type StaticFacetPickerProps = {
  label: string;
  facetName: string;
  filterName: Exclude<keyof DefaultEntityFilters, 'kind'>;
};

/** @public */
export const StaticFacetPicker = (props: StaticFacetPickerProps) => {
  const alertApi = useApi(alertApiRef);

  const { label, facetName, filterName } = props;
  const { loading, error, availableValues, selectedValues, setSelectedValues } =
    useEntityFacetFilter(facetName, filterName);

  useEffect(() => {
    if (error) {
      alertApi.post({
        message: `Failed to load entity values for facet: ${facetName}`,
        severity: 'error',
      });
    }
  }, [error, alertApi, facetName, setSelectedValues]);

  if (availableValues.length === 0 || error) return null;

  return (
    <Box pb={1} pt={1}>
      <Typography variant="button" component="label">
        {label}
        <Autocomplete
          multiple
          options={availableValues}
          value={selectedValues}
          loading={loading}
          onChange={(_: object, value: string[]) => setSelectedValues(value)}
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
          popupIcon={<ExpandMoreIcon data-testid="lifecycle-picker-expand" />}
          renderInput={params => <TextField {...params} variant="outlined" />}
        />
      </Typography>
    </Box>
  );
};
