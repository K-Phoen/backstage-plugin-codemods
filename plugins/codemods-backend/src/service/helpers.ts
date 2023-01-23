import fs from 'fs-extra';
import os from 'os';
import { Logger } from 'winston';
import { CatalogApi } from '@backstage/catalog-client';
import {
  CompoundEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { assertError, InputError, NotFoundError } from '@backstage/errors';
import {
  CodemodEntityV1alpha1,
  ConstraintsQuery,
  intersect,
  toList,
} from '@k-phoen/plugin-codemods-common';

export const getWorkingDirectory = async (
  config: Config,
  logger: Logger,
): Promise<string> => {
  if (!config.has('backend.workingDirectory')) {
    return os.tmpdir();
  }

  const workingDirectory = config.getString('backend.workingDirectory');
  try {
    // Check if working directory exists and is writable
    await fs.access(workingDirectory, fs.constants.F_OK | fs.constants.W_OK);
    logger.info(`using working directory: ${workingDirectory}`);
  } catch (err) {
    assertError(err);
    logger.error(
      `working directory ${workingDirectory} ${
        err.code === 'ENOENT' ? 'does not exist' : 'is not writable'
      }`,
    );
    throw err;
  }
  return workingDirectory;
};

/**
 * Will use the provided CatalogApi to go find the given codemod entity with an additional token.
 * Returns the matching codemod, or throws a NotFoundError if no such codemod existed.
 */
export const findCodemod = async (options: {
  entityRef: CompoundEntityRef;
  token?: string;
  catalogApi: CatalogApi;
}): Promise<CodemodEntityV1alpha1> => {
  const { entityRef, token, catalogApi } = options;

  if (entityRef.kind.toLocaleLowerCase('en-US') !== 'codemod') {
    throw new InputError(`Invalid kind, only 'Codemod' kind is supported`);
  }

  const codemod = await catalogApi.getEntityByRef(entityRef, { token });
  if (!codemod) {
    throw new NotFoundError(
      `Codemod ${stringifyEntityRef(entityRef)} not found`,
    );
  }

  return codemod as CodemodEntityV1alpha1;
};

export const constrainTargets = (
  targets: ConstraintsQuery,
  constraints: ConstraintsQuery,
): ConstraintsQuery => {
  const merged: ConstraintsQuery = { ...constraints };

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
