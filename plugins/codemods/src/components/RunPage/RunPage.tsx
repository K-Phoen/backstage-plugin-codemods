import React from 'react';
import useAsync from 'react-use/lib/useAsync';
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
import {
  useApi,
  useRouteRef,
  useRouteRefParams,
} from '@backstage/core-plugin-api';
import { EntityPeekAheadPopover } from '@backstage/plugin-catalog-react';
import { Grid } from '@material-ui/core';
import { codemodApiRef } from '../../api';
import { codemodRunRouteRef, jobRouteRef } from '../../routes';
import { Job } from '../../types';
import { JobOutputColumn, JobStatusColumn } from './columns';
import { RunSummaryCard } from './RunSummaryCard';
import { humanizeDate } from '../dates';
import {
  CodemodContextMenu,
  CodemodContextMenuProps,
} from '../CodemodContextMenu';

const RunPageContent = () => {
  const codemodApi = useApi(codemodApiRef);
  const { runId } = useRouteRefParams(codemodRunRouteRef);
  const jobLink = useRouteRef(jobRouteRef);

  const { value, loading, error } = useAsync(
    () => codemodApi.listJobs({ runId }),
    [codemodApi],
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
          description="There are no jobs or there was an issue communicating with backend."
        />
      </>
    );
  }

  return (
    <Table<Job>
      data={value?.jobs ?? []}
      title="Jobs"
      columns={[
        {
          title: 'ID',
          field: 'id',
          render: row => (
            <Link to={jobLink({ runId: row.runId, jobId: row.id })}>
              {row.id}
            </Link>
          ),
        },
        {
          title: 'Target',
          field: 'target',
          render: row => (
            <EntityPeekAheadPopover entityRef={row.target}>
              <span style={{ textDecoration: 'underline dotted' }}>
                {row.target}
              </span>
            </EntityPeekAheadPopover>
          ),
        },
        {
          title: 'Status',
          field: 'status',
          render: row => <JobStatusColumn status={row.status} />,
        },
        {
          title: 'Last heartbeat',
          field: 'lastHeartbeatAt',
          render: row => (
            <span title={row.lastHeartbeatAt}>
              {humanizeDate(row.lastHeartbeatAt)}
            </span>
          ),
        },
        {
          title: 'Output',
          field: 'output',
          render: row => <JobOutputColumn output={row.output} />,
        },
      ]}
    />
  );
};

export const RunPage = ({
  contextMenu,
}: {
  contextMenu?: CodemodContextMenuProps;
}) => {
  const { runId } = useRouteRefParams(codemodRunRouteRef);

  return (
    <Page themeId="home">
      <Header
        pageTitleOverride="Codemod run"
        title="Codemod run"
        subtitle={`Activity for codemod run: ${runId}`}
      >
        <CodemodContextMenu {...contextMenu} />
      </Header>
      <Content>
        <Grid container>
          <Grid item xs={12}>
            <RunSummaryCard runId={runId} />
          </Grid>
          <Grid item xs={12}>
            <RunPageContent />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
