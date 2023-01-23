import { ConstraintsQuery } from '@k-phoen/plugin-codemods-common';
import { EntityFilter } from '../types';

export function reduceCatalogFilters(
  filters: EntityFilter[],
): ConstraintsQuery {
  return filters.reduce((compoundFilter, filter) => {
    return {
      ...compoundFilter,
      ...filter.getCatalogFilters(),
    };
  }, {} as ConstraintsQuery);
}
