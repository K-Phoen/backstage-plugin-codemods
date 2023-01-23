import { useImmerReducer } from 'use-immer';
import { useEffect } from 'react';
import { codemodApiRef } from '../../api';
import { CodemodRun, Job, LogEvent, StepStatus } from '../../types';
import { useApi } from '@backstage/core-plugin-api';
import { Subscription } from '@backstage/types';

type Step = {
  id: string;
  status: StepStatus;
  endedAt?: string;
  startedAt?: string;
};

export type JobStream = {
  loading: boolean;
  error?: Error;
  stepLogs: { [stepId in string]: string[] };
  completed: boolean;
  job?: Job;
  run?: CodemodRun;
  steps: { [stepId in string]: Step };
  output?: any; // TODO
};

type ReducerLogEntry = {
  createdAt: string;
  body: {
    stepId?: string;
    status?: any; // TODO
    message: string;
    output?: any; // TODO
    error?: Error;
  };
};

type ReducerAction =
  | { type: 'INIT'; data: Job; run: CodemodRun }
  | { type: 'LOGS'; data: ReducerLogEntry[] }
  | { type: 'COMPLETED'; data: ReducerLogEntry }
  | { type: 'ERROR'; data: Error };

function reducer(draft: JobStream, action: ReducerAction) {
  switch (action.type) {
    case 'INIT': {
      draft.steps = action.run.spec.steps.reduce((current, next) => {
        current[next.id] = { status: 'open', id: next.id };
        return current;
      }, {} as { [stepId in string]: Step });
      draft.stepLogs = action.run.spec.steps.reduce((current, next) => {
        current[next.id] = [];
        return current;
      }, {} as { [stepId in string]: string[] });
      draft.loading = false;
      draft.error = undefined;
      draft.completed = false;
      draft.job = action.data;
      draft.run = action.run;
      return;
    }

    case 'LOGS': {
      const entries = action.data;
      const logLines = [];

      for (const entry of entries) {
        const logLine = `${entry.createdAt} ${entry.body.message}`;
        logLines.push(logLine);

        if (!entry.body.stepId || !draft.steps?.[entry.body.stepId]) {
          continue;
        }

        const currentStepLog = draft.stepLogs?.[entry.body.stepId];
        const currentStep = draft.steps?.[entry.body.stepId];

        if (entry.body.status && entry.body.status !== currentStep.status) {
          currentStep.status = entry.body.status;

          if (currentStep.status === 'processing') {
            currentStep.startedAt = entry.createdAt;
          }

          if (
            ['cancelled', 'failed', 'completed'].includes(currentStep.status)
          ) {
            currentStep.endedAt = entry.createdAt;
          }
        }

        currentStepLog?.push(logLine);
      }

      return;
    }

    case 'COMPLETED': {
      draft.completed = true;
      draft.output = action.data.body.output;
      draft.error = action.data.body.error;

      return;
    }

    case 'ERROR': {
      draft.error = action.data;
      draft.loading = false;
      draft.completed = true;
      return;
    }

    default:
      return;
  }
}

export const useJobEventStream = ({
  runId,
  jobId,
}: {
  runId: string;
  jobId: string;
}): JobStream => {
  const codemodApi = useApi(codemodApiRef);
  const [state, dispatch] = useImmerReducer(reducer, {
    loading: true,
    completed: false,
    stepLogs: {} as { [stepId in string]: string[] },
    steps: {} as { [stepId in string]: Step },
  });

  useEffect(() => {
    let didCancel = false;
    let subscription: Subscription | undefined;
    let logPusher: NodeJS.Timeout | undefined;

    codemodApi.getRun({ runId }).then(
      run => {
        codemodApi.getJob({ runId, jobId }).then(
          job => {
            if (didCancel) {
              return;
            }
            dispatch({ type: 'INIT', data: job, run: run });

            // TODO(blam): Use a normal fetch to fetch the current log for the event stream
            // and use that for an INIT_EVENTs dispatch event, and then
            // use the last event ID to subscribe using after option to
            // stream logs. Without this, if you have a lot of logs, it can look like the
            // task is being rebuilt on load as it progresses through the steps at a slower
            // rate whilst it builds the status from the event logs
            const observable = codemodApi.streamLogs({ runId, jobId });

            const collectedLogEvents = new Array<LogEvent>();

            function emitLogs() {
              if (collectedLogEvents.length) {
                const logs = collectedLogEvents.splice(
                  0,
                  collectedLogEvents.length,
                );
                dispatch({ type: 'LOGS', data: logs });
              }
            }

            logPusher = setInterval(emitLogs, 500);

            subscription = observable.subscribe({
              next: event => {
                switch (event.type) {
                  case 'log':
                    return collectedLogEvents.push(event);
                  case 'completion':
                    emitLogs();
                    dispatch({ type: 'COMPLETED', data: event });
                    return undefined;
                  default:
                    throw new Error(
                      `Unhandled event type ${event.type} in observer`,
                    );
                }
              },
              error: error => {
                emitLogs();
                dispatch({ type: 'ERROR', data: error });
              },
            });
          },
          error => {
            if (!didCancel) {
              dispatch({ type: 'ERROR', data: error });
            }
          },
        );
      },
      error => {
        if (!didCancel) {
          dispatch({ type: 'ERROR', data: error });
        }
      },
    );

    return () => {
      didCancel = true;
      if (subscription) {
        subscription.unsubscribe();
      }
      if (logPusher) {
        clearInterval(logPusher);
      }
    };
  }, [codemodApi, dispatch, runId, jobId]);

  return state;
};
