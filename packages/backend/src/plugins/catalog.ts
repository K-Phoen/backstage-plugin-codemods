import { Router } from 'express';
import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { CodemodEntitiesProcessor } from '@k-phoen/plugin-codemods-backend';
import { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder = await CatalogBuilder.create(env);
  builder.addProcessor(new CodemodEntitiesProcessor());
  const { processingEngine, router } = await builder.build();
  await processingEngine.start();
  return router;
}
