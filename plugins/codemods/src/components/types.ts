import { CatalogFilters } from '@k-phoen/plugin-codemods-common';

/** @public */
export type EntityFilter = {
  /**
   * Get filters to add to the catalog-backend request. These are a dot-delimited field with
   * value(s) to accept. For example:
   *   `{ 'kind': ['component'], 'metadata.name': ['component-1', 'component-2'] }`
   */
  getCatalogFilters: () => CatalogFilters;

  /**
   * Serialize the filter value to a string for query params. The UI component responsible for
   * handling this filter should retrieve this from useEntityList.queryParameters. The
   * value restored should be in the precedence: queryParameters `>` initialValue prop `>` default.
   */
  toQueryValue: () => string | string[];

  /**
   * Raw value.
   */
  rawValue: () => string | string[];
};
