import { JsonObject } from '@backstage/types';
import { CodemodAction } from '../types';
import { createDebugLogAction } from './debug';
import { createFsDeleteAction, createFsWriteAction } from './fs';
import { createShellExecAction } from './shell';

/**
 * A function to generate create a list of default actions that the codemod plugin provides.
 * Is called internally in the default setup, but can be used when adding your own actions or overriding the default ones
 *
 * @public
 *
 * @returns A list of actions that can be used in codemods
 */
export const createBuiltinActions = (): CodemodAction<JsonObject>[] => {
  const actions = [
    createDebugLogAction(),

    createFsDeleteAction(),
    createFsWriteAction(),

    createShellExecAction(),
  ];

  return actions as CodemodAction<JsonObject>[];
};
