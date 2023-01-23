import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

/** @public */
export const rootRouteRef = createRouteRef({
  id: 'codemod',
});

/** @public */
export const selectedCodemodRouteRef = createSubRouteRef({
  id: 'codemod/selected-codemod',
  parent: rootRouteRef,
  path: '/codemod/:namespace/:codemodName',
});

export const codemodListRunsRouteRef = createSubRouteRef({
  id: 'codemod/list-runs',
  parent: rootRouteRef,
  path: '/runs',
});

export const codemodRunRouteRef = createSubRouteRef({
  id: 'codemod/view-run',
  parent: rootRouteRef,
  path: '/runs/:runId',
});

export const jobRouteRef = createSubRouteRef({
  id: 'codemod/view-job',
  parent: rootRouteRef,
  path: '/runs/:runId/jobs/:jobId',
});

export const actionsRouteRef = createSubRouteRef({
  id: 'codemod/actions',
  parent: rootRouteRef,
  path: '/actions',
});
