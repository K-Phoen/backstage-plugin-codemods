import express from 'express';
import request from 'supertest';
import {
  DatabaseManager,
  getVoidLogger,
  PluginDatabaseManager,
} from '@backstage/backend-common';
import { CatalogApi } from '@backstage/catalog-client';
import { ConfigReader } from '@backstage/config';
import { IdentityApi } from '@backstage/plugin-auth-node';

import { createRouter } from './router';
import { createBuiltinActions } from '../codemod';

function createDatabase(): PluginDatabaseManager {
  return DatabaseManager.fromConfig(
    new ConfigReader({
      backend: {
        database: {
          client: 'better-sqlite3',
          connection: ':memory:',
        },
      },
    }),
  ).forPlugin('codemods');
}

describe('createRouter', () => {
  let app: express.Express;

  const catalogClient = { getEntityByRef: jest.fn() } as unknown as CatalogApi;
  const identityClient = {
    getEntityByRef: jest.fn(),
  } as unknown as IdentityApi;

  beforeAll(async () => {
    const router = await createRouter({
      logger: getVoidLogger(),
      config: new ConfigReader({}),
      database: createDatabase(),
      catalogClient,
      identity: identityClient,
      actions: createBuiltinActions(),
    });
    app = express().use(router);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /v1/actions', () => {
    it('lists available actions', async () => {
      const response = await request(app).get('/v1/actions').send();

      expect(response.status).toEqual(200);
      expect(response.body[0].id).toBeDefined();
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
