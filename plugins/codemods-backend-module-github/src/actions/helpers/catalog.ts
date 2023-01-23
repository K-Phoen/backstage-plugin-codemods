import { Entity } from '@backstage/catalog-model';
import { InputError } from '@backstage/errors';

export const GITHUB_ACTIONS_ANNOTATION = 'github.com/project-slug';

export function repoUrlFromEntity(entity: Entity) {
  const githubSlug = entity.metadata?.annotations?.[GITHUB_ACTIONS_ANNOTATION];
  if (!githubSlug) {
    throw new InputError(
      `missing ${GITHUB_ACTIONS_ANNOTATION} annotation on entity`,
    );
  }

  // TODO: properly parse the annotation and extract values from it
  return `https://github.com/${githubSlug}`;
}
