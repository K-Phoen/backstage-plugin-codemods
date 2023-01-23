import {
  Entity,
  ANNOTATION_LOCATION,
  parseLocationRef,
  ANNOTATION_SOURCE_LOCATION,
} from '@backstage/catalog-model';

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

export const intersect = <T>(a: T[], b: T[]): T[] => {
  const intersection = new Set(a.filter(x => b.includes(x)));
  return Array.from(intersection);
};

export const toList = <T>(input?: T | T[]): T[] => {
  if (!input) {
    return [];
  }

  return Array.isArray(input) ? input : [input];
};
