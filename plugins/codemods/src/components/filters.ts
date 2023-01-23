import { EntityFilter } from './types';

/**
 * Filter entities based on Kind.
 * @public
 */
export class EntityKindFilter implements EntityFilter {
  constructor(readonly value: string) {}

  getCatalogFilters(): Record<string, string> {
    return { kind: this.value };
  }

  toQueryValue(): string {
    return this.value;
  }

  rawValue(): string {
    return this.value;
  }
}

/**
 * Filters entities on a facet.
 * @public
 */
export class FacetFilter implements EntityFilter {
  constructor(readonly facet: string, readonly values: string[]) {}

  getCatalogFilters(): Record<string, string[]> {
    return {
      [this.facet]: this.values,
    };
  }

  toQueryValue(): string[] {
    return this.values;
  }

  rawValue(): string[] {
    return this.values;
  }
}
