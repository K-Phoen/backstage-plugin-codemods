import { JsonObject } from '@backstage/types';
import { CodemodAction } from './types';

/**
 * This function is used to create new codemod actions to get type safety.
 * @public
 */
export const createCodemodAction = <TInput extends JsonObject>(
  codemodAction: CodemodAction<TInput>,
): CodemodAction<TInput> => {
  // TODO: validate the action
  return codemodAction;
};
