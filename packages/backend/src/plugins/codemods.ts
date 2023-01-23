import { Router } from 'express';
import { CatalogClient } from '@backstage/catalog-client';
import { ScmIntegrations } from '@backstage/integration';
import {
  createBuiltinActions,
  createRouter,
} from '@k-phoen/plugin-codemods-backend';
import { createBuiltinGithubActions } from '@k-phoen/codemods-backend-module-github';
import type { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({
    discoveryApi: env.discovery,
  });
  const integrations = ScmIntegrations.fromConfig(env.config);

  const builtInActions = createBuiltinActions();
  const githubActions = createBuiltinGithubActions({ integrations });

  const actions = [...builtInActions, ...githubActions];

  return await createRouter({
    logger: env.logger,
    config: env.config,
    catalogClient: catalogClient,
    database: env.database,
    identity: env.identity,
    actions: actions,
  });
}
