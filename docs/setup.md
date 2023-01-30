# Setup

## Backend

Add the plugin to your backend app:

```bash
cd packages/backend && yarn add @k-phoen/plugin-codemods-backend @k-phoen/codemods-backend-module-github
```

Create a file in `packages/backend/src/plugins/codemods.ts`:

```ts
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
```

In `packages/backend/src/index.ts` add the following:

```ts
import codemods from './plugins/codemods';

// ...
async function main() {
  // ...
  const codemodsEnv = useHotMemoize(module, () => createEnv('codemods'));

  const apiRouter = Router();
  apiRouter.use('/codemods', await codemods(codemodsEnv));
  // ...
}
```

## Frontend

Add the plugin to your frontend app:

```bash
cd packages/app && yarn add @k-phoen/plugin-codemods
```

Expose the codemods page:

```ts
// packages/app/src/App.tsx
import { CodemodPage } from '@k-phoen/plugin-codemods';

// ...

const AppRoutes = () => (
  <FlatRoutes>
    // ...
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
    // ...
  </FlatRoutes>
);
```

**Optional** Add a link in the sidebar:

```ts
// packages/app/src/components/Root/Root.tsx
import DeveloperModeIcon from '@material-ui/icons/DeveloperMode';

export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
      <SidebarLogo />
      <SidebarDivider />
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        {/* Global nav, not org-specific */}
        <SidebarItem icon={HomeIcon} to="catalog" text="Home" />
        {/* End global nav */}
        <SidebarDivider />

        <SidebarItem icon={DeveloperModeIcon} to="codemods" text="Codemods" />
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
    </Sidebar>
    {children}
  </SidebarPage>
);
```
