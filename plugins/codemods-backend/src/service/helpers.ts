import fs from 'fs';
import os from 'os';
import { Logger } from 'winston';
import { CatalogApi } from '@backstage/catalog-client';
import {
  CompoundEntityRef,
  stringifyEntityRef,
  UserEntity,
} from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { assertError, InputError, NotFoundError } from '@backstage/errors';
import {
  CatalogFilters,
  CodemodEntity,
  CodemodEntityV1alpha1,
  CodemodRunSpec,
  getEntityBaseUrl,
} from '@k-phoen/plugin-codemods-common';
import { JsonObject } from '@backstage/types';

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
    await fs.accessSync(
      workingDirectory,
      fs.constants.F_OK | fs.constants.W_OK,
    );
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

export const codemodToRunSpec = ({
  codemod,
  user,
  targets,
  parameters,
}: {
  codemod: CodemodEntity;
  user?: UserEntity;
  targets: CatalogFilters;
  parameters: JsonObject;
}): CodemodRunSpec => {
  return {
    apiVersion: codemod.apiVersion,
    user: {
      entity: user,
      ref: user ? stringifyEntityRef(user) : undefined,
    },
    targets: targets,
    parameters: parameters,
    steps: codemod.spec.steps.map((step, index) => ({
      ...step,
      id: step.id ?? `step-${index + 1}`,
      name: step.name ?? step.action,
    })),
    output: codemod.spec.output ?? {},
    codemodInfo: {
      entityRef: stringifyEntityRef(codemod),
      baseUrl: getEntityBaseUrl(codemod),
      entity: {
        metadata: codemod.metadata,
      },
    },
  };
};
