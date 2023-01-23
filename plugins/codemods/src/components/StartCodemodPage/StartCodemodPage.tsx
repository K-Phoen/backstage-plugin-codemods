import React from 'react';
import { Navigate } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { Content, Header, Page, Progress } from '@backstage/core-components';
import {
  AnalyticsContext,
  errorApiRef,
  useApi,
  useRouteRef,
  useRouteRefParams,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CodemodEntity } from '@k-phoen/plugin-codemods-common';
import { rootRouteRef, selectedCodemodRouteRef } from '../../routes';
import { RunWizard } from './RunWizard';
import { EntityListProvider } from '../hooks/useEntityListProvider';

type Props = {
  headerOptions?: {
    pageTitleOverride?: string;
    title?: string;
    subtitle?: string;
  };
};

export const StartCodemodPage = ({ headerOptions }: Props) => {
  const catalogApi = useApi(catalogApiRef);
  const errorApi = useApi(errorApiRef);
  const rootRoute = useRouteRef(rootRouteRef);
  const { codemodName, namespace } = useRouteRefParams(selectedCodemodRouteRef);
  const codemodRef = stringifyEntityRef({
    kind: 'codemod',
    name: codemodName,
    namespace,
  });

  const { value, loading, error } = useAsync(() => {
    return catalogApi.getEntityByRef(codemodRef);
  });
  if (error) {
    errorApi.post(new Error(`Failed to load codemod, ${error}`));
    return <Navigate to={rootRoute()} />;
  }

  return (
    <AnalyticsContext attributes={{ entityRef: codemodRef }}>
      <Page themeId="home">
        <Header
          pageTitleOverride="Apply a codemod"
          title="Apply a codemod"
          subtitle="Patch software components using standard codemods"
          {...headerOptions}
        />
        <Content>
          {loading && <Progress data-testid="loading-progress" />}
          {value && (
            <EntityListProvider codemod={value! as CodemodEntity}>
              <RunWizard />
            </EntityListProvider>
          )}
        </Content>
      </Page>
    </AnalyticsContext>
  );
};
