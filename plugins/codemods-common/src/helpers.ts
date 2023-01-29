import {
  Entity,
  ANNOTATION_LOCATION,
  parseLocationRef,
  ANNOTATION_SOURCE_LOCATION,
} from '@backstage/catalog-model';
import { CatalogFilters } from './CodemodEntityV1alpha1';

/**
 * Gets the base URL of the entity location that points to the source location
 * of the entity description within a repo. If there is not source location
 * or if it has an invalid type, undefined will be returned instead.
 *
 * For file locations this will return a `file://` URL.
 */
export function getEntityBaseUrl(entity: Entity): string | undefined {
  let location = entity.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION];
  if (!location) {
    location = entity.metadata.annotations?.[ANNOTATION_LOCATION];
  }
  if (!location) {
    return undefined;
  }

  const { type, target } = parseLocationRef(location);
  if (type === 'url') {
    return target;
  } else if (type === 'file') {
    return `file://${target}`;
  }

  // Only url and file location are handled, as we otherwise don't know if
  // what the url is pointing to makes sense to use as a baseUrl
  return undefined;
}

/**
 * Returns the intersection of the a and b lists.
 */
export const intersect = <T>(a: T[], b: T[]): T[] => {
  const intersection = new Set(a.filter(x => b.includes(x)));
  return Array.from(intersection);
};

/**
 * Ensures the given value is a list.
 */
export const toList = <T>(input?: T | T[]): T[] => {
  if (!input) {
    return [];
  }

  return Array.isArray(input) ? input : [input];
};

/**
 * Constraints the given set of targets using constraints defined on a codemod.
 * Returns a new set of constraints, describing catalog entities satisfying both
 * the filters defined by `targets` and `constaints`.
 */
export const constrainTargets = (
  targets: CatalogFilters,
  constraints: CatalogFilters,
): CatalogFilters => {
  const merged: CatalogFilters = { ...constraints };

  for (const [key, value] of Object.entries(targets)) {
    // no constraint on `key`
    if (!constraints[key]) {
      merged[key] = value;
      continue;
    }

    merged[key] = intersect(toList(targets[key]), toList(constraints[key]));
  }

  return merged;
};
