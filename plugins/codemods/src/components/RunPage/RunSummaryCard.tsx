import React from 'react';
import {
  EmptyState,
  ErrorPanel,
  InfoCard,
  Progress,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { codemodApiRef } from '../../api';
import {
  createStyles,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@material-ui/core';
import { humanizeDate } from '../dates';
import { CodemodEntityRef } from '../CodemodEntityRef';

const useStyles = makeStyles(() =>
  createStyles({
    tableHeader: {
      fontWeight: 'bold',
      width: '15rem',
    },
  }),
);

export const RunSummaryCard = ({ runId }: { runId: string }) => {
  const classes = useStyles();
  const codemodApi = useApi(codemodApiRef);
  let content: React.ReactNode;

  const {
    value: run,
    loading,
    error,
  } = useAsync(() => codemodApi.getRun({ runId }), [codemodApi]);

  if (loading) {
    content = <Progress />;
  } else if (error) {
    content = (
      <>
        <ErrorPanel error={error} />
        <EmptyState
          missing="info"
          title="No information to display"
          description="There are no jobs or there was an issue communicating with backend."
        />
      </>
    );
  } else {
    content = (
      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell component="th" className={classes.tableHeader}>
              ID
            </TableCell>
            <TableCell>{run!.id}</TableCell>
          </TableRow>

          <TableRow>
            <TableCell component="th" className={classes.tableHeader}>
              Codemod
            </TableCell>
            <TableCell>
              <CodemodEntityRef entityRef={run!.spec.codemodInfo?.entityRef!} />
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell component="th" className={classes.tableHeader}>
              Created
            </TableCell>
            <TableCell>
              <span title={run!.createdAt}>{humanizeDate(run!.createdAt)}</span>
            </TableCell>
          </TableRow>

          {run!.openCount !== 0 && (
            <TableRow>
              <TableCell component="th" className={classes.tableHeader}>
                Open jobs
              </TableCell>
              <TableCell>{run!.openCount}</TableCell>
            </TableRow>
          )}

          {run!.processingCount !== 0 && (
            <TableRow>
              <TableCell component="th" className={classes.tableHeader}>
                Processing jobs
              </TableCell>
              <TableCell>{run!.processingCount}</TableCell>
            </TableRow>
          )}

          {run!.cancelledCount !== 0 && (
            <TableRow>
              <TableCell component="th" className={classes.tableHeader}>
                Cancelled jobs
              </TableCell>
              <TableCell>{run!.cancelledCount}</TableCell>
            </TableRow>
          )}

          <TableRow>
            <TableCell component="th" className={classes.tableHeader}>
              Failed jobs
            </TableCell>
            <TableCell>
              {run!.failedCount} / {run!.targetsCount}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell component="th" className={classes.tableHeader}>
              Completed jobs
            </TableCell>
            <TableCell>
              {run!.completedCount} / {run!.targetsCount}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return <InfoCard title="Run summary">{content}</InfoCard>;
};
