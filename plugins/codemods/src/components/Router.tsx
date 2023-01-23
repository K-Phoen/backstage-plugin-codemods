import React, { ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Entity } from '@backstage/catalog-model';
import {
  actionsRouteRef,
  codemodListRunsRouteRef,
  codemodRunRouteRef,
  jobRouteRef,
  selectedCodemodRouteRef,
} from '../routes';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { CodemodPage } from './CodemodPage';
import { ListRunsPage } from './ListRunsPage';
import { StartCodemodPage } from './StartCodemodPage';
import { ActionsPage } from './ActionsPage';
import { RunPage } from './RunPage';
import { JobPage } from './JobPage';

/**
 * The props for the entrypoint `CodemodPage` component the plugin.
 * @public
 */
export type RouterProps = {
  components?: {
    CodemodCardComponent?:
      | ComponentType<{ codemod: CodemodEntityV1alpha1 }>
      | undefined;
  };
  groups?: Array<{
    title?: React.ReactNode;
    filter: (entity: Entity) => boolean;
  }>;
  headerOptions?: {
    pageTitleOverride?: string;
    title?: string;
    subtitle?: string;
  };
  /**
   * Options for the context menu on the codemods page.
   */
  contextMenu?: {
    /** Whether to show a link to the actions documentation */
    actions?: boolean;
    /** Whether to show a link to the runs page */
    runs?: boolean;
  };
};

/**
 * The main entrypoint `Router` for the `CodemodPlugin`.
 *
 * @public
 */
export const Router = (props: RouterProps) => {
  const { groups, components = {} } = props;
  const { CodemodCardComponent } = components;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <CodemodPage
            groups={groups}
            CodemodCardComponent={CodemodCardComponent}
            contextMenu={props.contextMenu}
            headerOptions={props.headerOptions}
          />
        }
      />

      <Route
        path={selectedCodemodRouteRef.path}
        element={<StartCodemodPage headerOptions={props.headerOptions} />}
      />

      <Route
        path={codemodListRunsRouteRef.path}
        element={<ListRunsPage contextMenu={props.contextMenu} />}
      />
      <Route
        path={codemodRunRouteRef.path}
        element={<RunPage contextMenu={props.contextMenu} />}
      />
      <Route path={jobRouteRef.path} element={<JobPage />} />

      <Route path={actionsRouteRef.path} element={<ActionsPage />} />
    </Routes>
  );
};
