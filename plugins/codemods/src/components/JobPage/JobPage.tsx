import {
  Content,
  ErrorPage,
  Header,
  Page,
  LogViewer,
  Progress,
} from '@backstage/core-components';
import { useRouteRefParams } from '@backstage/core-plugin-api';
import { BackstageTheme } from '@backstage/theme';
import {
  CircularProgress,
  Paper,
  StepButton,
  StepIconProps,
} from '@material-ui/core';
import Grid from '@material-ui/core/Grid';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import Stepper from '@material-ui/core/Stepper';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Cancel from '@material-ui/icons/Cancel';
import Check from '@material-ui/icons/Check';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import classNames from 'classnames';
import { DateTime, Interval } from 'luxon';
import React, { memo, useEffect, useMemo, useState } from 'react';
import useInterval from 'react-use/lib/useInterval';
import { jobRouteRef } from '../../routes';
import { JobOutput, StepStatus } from '../../types';
import { useJobEventStream } from '../hooks/useEventStream';
import { JobOutputLinks } from '../JobOutputLinks';
import { JobErrors } from './JobErrors';

// typings are wrong for this library, so fallback to not parsing types.
const humanizeDuration = require('humanize-duration');

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
    },
    button: {
      marginBottom: theme.spacing(2),
      marginLeft: theme.spacing(2),
    },
    actionsContainer: {
      marginBottom: theme.spacing(2),
    },
    resetContainer: {
      padding: theme.spacing(3),
    },
    labelWrapper: {
      display: 'flex',
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    stepWrapper: {
      width: '100%',
    },
  }),
);

type JobStep = {
  id: string;
  name: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
};

const StepTimeTicker = ({ step }: { step: JobStep }) => {
  const [time, setTime] = useState('');

  useInterval(() => {
    if (!step.startedAt) {
      setTime('');
      return;
    }

    const end = step.endedAt
      ? DateTime.fromISO(step.endedAt)
      : DateTime.local();

    const startedAt = DateTime.fromISO(step.startedAt);
    const formatted = Interval.fromDateTimes(startedAt, end)
      .toDuration()
      .valueOf();

    setTime(humanizeDuration(formatted, { round: true }));
  }, 1000);

  return <Typography variant="caption">{time}</Typography>;
};

const useStepIconStyles = makeStyles((theme: BackstageTheme) =>
  createStyles({
    root: {
      color: theme.palette.text.disabled,
      display: 'flex',
      height: 22,
      alignItems: 'center',
    },
    completed: {
      color: theme.palette.status.ok,
    },
    error: {
      color: theme.palette.status.error,
    },
  }),
);

function TaskStepIconComponent(props: StepIconProps) {
  const classes = useStepIconStyles();
  const { active, completed, error } = props;

  const getMiddle = () => {
    if (active) {
      return <CircularProgress size="24px" />;
    }
    if (completed) {
      return <Check />;
    }
    if (error) {
      return <Cancel />;
    }
    return <FiberManualRecordIcon />;
  };

  return (
    <div
      className={classNames(classes.root, {
        [classes.completed]: completed,
        [classes.error]: error,
      })}
    >
      {getMiddle()}
    </div>
  );
}

export const TaskStatusStepper = memo(
  (props: {
    steps: JobStep[];
    currentStepId: string | undefined;
    onUserStepChange: (id: string) => void;
    classes?: {
      root?: string;
    };
  }) => {
    const { steps, currentStepId, onUserStepChange } = props;
    const classes = useStyles(props);

    return (
      <div className={classes.root}>
        <Stepper
          activeStep={steps.findIndex(s => s.id === currentStepId)}
          orientation="vertical"
          nonLinear
        >
          {steps.map((step, index) => {
            const isCompleted = step.status === 'completed';
            const isFailed = step.status === 'failed';
            const isActive = step.status === 'processing';
            const isSkipped = step.status === 'skipped';

            return (
              <Step key={String(index)} expanded>
                <StepButton onClick={() => onUserStepChange(step.id)}>
                  <StepLabel
                    StepIconProps={{
                      completed: isCompleted,
                      error: isFailed,
                      active: isActive,
                    }}
                    StepIconComponent={TaskStepIconComponent}
                    className={classes.stepWrapper}
                  >
                    <div className={classes.labelWrapper}>
                      <Typography variant="subtitle2">{step.name}</Typography>
                      {isSkipped ? (
                        <Typography variant="caption">Skipped</Typography>
                      ) : (
                        <StepTimeTicker step={step} />
                      )}
                    </div>
                  </StepLabel>
                </StepButton>
              </Step>
            );
          })}
        </Stepper>
      </div>
    );
  },
);

const hasLinks = ({ links = [] }: JobOutput): boolean => links.length > 0;

/**
 * TaskPageProps for constructing a TaskPage
 * @param loadingText - Optional loading text shown before a task begins executing.
 *
 * @public
 */
export type JobPageProps = {
  loadingText?: string;
};

/**
 * JobPage for showing the status of the jobId provided as a param
 * @param loadingText - Optional loading text shown before a task begins executing.
 *
 * @public
 */
export const JobPage = ({ loadingText }: JobPageProps) => {
  const [userSelectedStepId, setUserSelectedStepId] = useState<
    string | undefined
  >(undefined);
  const [lastActiveStepId, setLastActiveStepId] = useState<string | undefined>(
    undefined,
  );
  const { runId, jobId } = useRouteRefParams(jobRouteRef);
  const jobStream = useJobEventStream({ runId, jobId });
  const completed = jobStream.completed;
  const steps = useMemo(
    () =>
      jobStream.run?.spec?.steps.map(step => ({
        ...step,
        ...jobStream?.steps?.[step.id],
      })) ?? [],
    [jobStream],
  );

  useEffect(() => {
    const mostRecentFailedOrActiveStep = steps.find(step =>
      ['failed', 'processing'].includes(step.status),
    );
    if (completed && !mostRecentFailedOrActiveStep) {
      setLastActiveStepId(steps[steps.length - 1]?.id);
      return;
    }

    setLastActiveStepId(mostRecentFailedOrActiveStep?.id);
  }, [steps, completed]);

  const currentStepId = userSelectedStepId ?? lastActiveStepId;

  const logAsString = useMemo(() => {
    if (!currentStepId) {
      return loadingText ? loadingText : 'Loading...';
    }
    const log = jobStream.stepLogs[currentStepId];

    if (!log?.length) {
      return 'Waiting for logs...';
    }
    return log.join('\n');
  }, [jobStream.stepLogs, currentStepId, loadingText]);

  const jobNotFound =
    jobStream.completed === true &&
    jobStream.loading === false &&
    !jobStream.job;

  const { output } = jobStream;

  return (
    <Page themeId="home">
      <Header
        pageTitleOverride={`Job ${jobId}`}
        title="Job Activity"
        subtitle={`Activity for job: ${jobId}`}
      />
      <Content>
        {jobNotFound ? (
          <ErrorPage
            status="404"
            statusMessage="Job not found"
            additionalInfo="No job found with this ID"
          />
        ) : (
          <div>
            <Grid container>
              <Grid item xs={3}>
                <Paper>
                  <TaskStatusStepper
                    steps={steps}
                    currentStepId={currentStepId}
                    onUserStepChange={setUserSelectedStepId}
                  />
                  {output && hasLinks(output) && (
                    <JobOutputLinks output={output} />
                  )}
                </Paper>
              </Grid>
              <Grid item xs={9}>
                {!currentStepId && <Progress />}

                <div style={{ height: '80vh' }}>
                  <JobErrors error={jobStream.error} />
                  <LogViewer text={logAsString} />
                </div>
              </Grid>
            </Grid>
          </div>
        )}
      </Content>
    </Page>
  );
};
