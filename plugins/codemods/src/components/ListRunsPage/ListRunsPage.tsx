import React, { useState } from 'react';
import {
  Content,
  EmptyState,
  ErrorPanel,
  Header,
  Link,
  Page,
  Progress,
  Table,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { CatalogFilterLayout } from '@backstage/plugin-catalog-react';
import useAsync from 'react-use/lib/useAsync';
import { codemodApiRef } from '../../api';
import { codemodRunRouteRef } from '../../routes';
import { OwnerListPicker } from './OwnerListPicker';
import { CodemodRun } from '../../types';
import { humanizeDate } from '../dates';
import { CodemodEntityRef } from '../CodemodEntityRef';
import { OwnerEntityColumn } from './columns';
import {
  CodemodContextMenu,
  CodemodContextMenuProps,
} from '../CodemodContextMenu';

export interface ListRunsPageProps {
  initiallySelectedFilter?: 'owned' | 'all';
  contextMenu?: CodemodContextMenuProps;
}

const ListRunsPageContent = (props: ListRunsPageProps) => {
  const { initiallySelectedFilter = 'owned' } = props;

  const codemodApi = useApi(codemodApiRef);
  const runLink = useRouteRef(codemodRunRouteRef);

  const [ownerFilter, setOwnerFilter] = useState(initiallySelectedFilter);
  const { value, loading, error } = useAsync(
    () => codemodApi.listRuns({ filterByOwnership: ownerFilter }),
    [codemodApi, ownerFilter],
  );

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <>
        <ErrorPanel error={error} />
        <EmptyState
          missing="info"
          title="No information to display"
          description="There are no runs or there was an issue communicating with backend."
        />
      </>
    );
  }

  return (
    <CatalogFilterLayout>
      <CatalogFilterLayout.Filters>
        <OwnerListPicker
          filter={ownerFilter}
          onSelectOwner={id => setOwnerFilter(id)}
        />
      </CatalogFilterLayout.Filters>
      <CatalogFilterLayout.Content>
        <Table<CodemodRun>
          data={value?.runs ?? []}
          title="Runs"
          columns={[
            {
              title: 'ID',
              field: 'id',
              render: row => (
                <Link to={runLink({ runId: row.id })}>{row.id}</Link>
              ),
            },
            {
              title: 'Codemod',
              render: row => (
                <CodemodEntityRef
                  entityRef={row.spec.codemodInfo?.entityRef || ''}
                />
              ),
            },
            {
              title: 'Targets',
              field: 'spec.targets',
              render: row => <code>{JSON.stringify(row.spec.targets)}</code>,
            },
            {
              title: 'Targets count',
              field: 'targetsCount',
              type: 'numeric',
            },
            { title: 'Open jobs', field: 'openCount', type: 'numeric' },
            {
              title: 'Processing jobs',
              field: 'processingCount',
              type: 'numeric',
            },
            { title: 'Failed jobs', field: 'failedCount', type: 'numeric' },
            {
              title: 'Cancelled jobs',
              field: 'cancelledCount',
              type: 'numeric',
            },
            {
              title: 'Completed jobs',
              field: 'completedCount',
              type: 'numeric',
            },
            {
              title: 'Created',
              field: 'createdAt',
              render: row => (
                <span title={row.createdAt}>{humanizeDate(row.createdAt)}</span>
              ),
            },
            {
              title: 'Created By',
              field: 'createdBy',
              render: row => (
                <OwnerEntityColumn entityRef={row.spec?.user?.ref} />
              ),
            },
          ]}
        />
      </CatalogFilterLayout.Content>
    </CatalogFilterLayout>
  );
};

export const ListRunsPage = (props: ListRunsPageProps) => {
  return (
    <Page themeId="home">
      <Header
        pageTitleOverride="Codemod runs"
        title="List codemod runs"
        subtitle="All runs that have been started"
      >
        <CodemodContextMenu {...props.contextMenu} />
      </Header>
      <Content>
        <ListRunsPageContent {...props} />
      </Content>
    </Page>
  );
};
