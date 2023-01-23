import { codemodApiRef, CodemodClient } from './api';
import { rootRouteRef } from './routes';
import {
  createApiFactory,
  createPlugin,
  createRoutableExtension,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';

/**
 * The main plugin export for the codemod.
 * @public
 */
export const codemodsPlugin = createPlugin({
  id: 'codemods',
  apis: [
    createApiFactory({
      api: codemodApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
        identityApi: identityApiRef,
      },
      factory: ({ discoveryApi, fetchApi, identityApi }) =>
        new CodemodClient({
          discoveryApi,
          fetchApi,
          identityApi,
        }),
    }),
  ],
  routes: {
    root: rootRouteRef,
  },
});

/**
 * The Router and main entrypoint to the Codemod plugin.
 *
 * @public
 */
export const CodemodPage = codemodsPlugin.provide(
  createRoutableExtension({
    name: 'CodemodPage',
    component: () => import('./components/Router').then(m => m.Router),
    mountPoint: rootRouteRef,
  }),
);
