import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { CatalogEntityPage, CatalogIndexPage } from '@backstage/plugin-catalog';
import { AlertDisplay, OAuthRequestDialog } from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CodemodPage } from '@k-phoen/plugin-codemods';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { Root } from './components/Root';

const app = createApp({
  apis,
});

const routes = (
  <FlatRoutes>
    <Route path="/" element={<Navigate to="catalog" />} />
    <Route path="/catalog" element={<CatalogIndexPage />} />
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={<CatalogEntityPage />}
    >
      {entityPage}
    </Route>

    <Route
      path="/codemods"
      element={
        <CodemodPage
          groups={[
            {
              title: 'Recommended',
              filter: entity =>
                entity?.metadata?.tags?.includes('recommended') ?? false,
            },
          ]}
        />
      }
    />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <AppRouter>
      <Root>{routes}</Root>
    </AppRouter>
  </>,
);
