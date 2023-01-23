import { JsonObject } from '@backstage/types';
import { CodemodAction } from './types';

/**
 * This function is used to create new codemod actions to get type safety.
 * @public
 */
export const createCodemodAction = <TInput extends JsonObject>(
  codemodAction: CodemodAction<TInput>,
): CodemodAction<TInput> => {
  // TODO(blam): Can add some more validation here to validate the action later on
  return codemodAction;
};
