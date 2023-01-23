import React, { useCallback, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@material-ui/core';
import qs from 'qs';
import { InfoCard, Progress } from '@backstage/core-components';
import {
  errorApiRef,
  useApi,
  useRouteRef,
  useRouteRefParams,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { codemodApiRef } from '../../api';
import {
  codemodRunRouteRef,
  rootRouteRef,
  selectedCodemodRouteRef,
} from '../../routes';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { useEntityList } from '../hooks/useEntityListProvider';
import {
  CodemodDescription,
  CodemodParameters,
  CodemodReview,
  TargetSelector,
} from './steps';
import { CodemodParameterSchema } from '../../types';
import { IChangeEvent } from '@rjsf/core';

type CodemodSetupStep = {
  label: string;
  component: React.ReactFragment;
};

type StepperProps = {
  codemod: CodemodEntityV1alpha1;
  parameterSchema: CodemodParameterSchema;
  formData: Record<string, any>;

  onSubmit: () => void;
  onChange: (e: IChangeEvent) => void;
};

const CodemodStepper = ({
  codemod,
  parameterSchema,
  formData,
  onSubmit,
  onChange,
}: StepperProps) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const steps: CodemodSetupStep[] = [
    {
      label: 'Description',
      component: <CodemodDescription codemod={codemod} />,
    },
  ];

  if (codemod.spec.parameters) {
    steps.push({
      label: 'Parameters',
      component: (
        <CodemodParameters
          schema={parameterSchema}
          formData={formData}
          onChange={onChange}
        />
      ),
    });
  }

  steps.push(
    {
      label: 'Select targets',
      component: <TargetSelector />,
    },
    {
      label: 'Review and apply',
      component: <CodemodReview codemod={codemod} />,
    },
  );

  const handleNext = () => {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  };

  return (
    <Paper>
      <Stepper activeStep={activeStep} orientation="horizontal">
        {steps.map(step => {
          return (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="h6" component="h3">
                  {step.label}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
      <div style={{ padding: '1rem' }}>
        {steps[activeStep].component}

        <Box style={{ marginTop: '1rem' }}>
          <Button disabled={activeStep === 0} onClick={handleBack}>
            Back
          </Button>

          {activeStep !== steps.length - 1 && (
            <Button variant="contained" color="primary" onClick={handleNext}>
              Next step
            </Button>
          )}

          {activeStep === steps.length - 1 && (
            <Button color="primary" variant="contained" onClick={onSubmit}>
              Apply codemod
            </Button>
          )}
        </Box>
      </div>
    </Paper>
  );
};

export const RunWizard = () => {
  const errorApi = useApi(errorApiRef);
  const codemodApi = useApi(codemodApiRef);
  const catalogApi = useApi(catalogApiRef);
  const { codemodName, namespace } = useRouteRefParams(selectedCodemodRouteRef);
  const { backendFilters } = useEntityList();
  const codemodRef = stringifyEntityRef({
    name: codemodName,
    kind: 'codemod',
    namespace,
  });

  const navigate = useNavigate();
  const codemodRunRoute = useRouteRef(codemodRunRouteRef);
  const rootRoute = useRouteRef(rootRouteRef);
  const { value, loading, error } = useAsync(() => {
    const codemod = catalogApi.getEntityByRef(codemodRef);
    const parameterSchema = codemodApi.getTemplateParameterSchema(codemodRef);

    return Promise.all([codemod, parameterSchema]);
  });

  // parameters management
  const [formState, setFormState] = useState<Record<string, any>>(() => {
    const query = qs.parse(window.location.search, {
      ignoreQueryPrefix: true,
    });

    try {
      return JSON.parse(query.formData as string);
    } catch (e) {
      return query.formData ?? {};
    }
  });
  const handleChange = useCallback(
    (e: IChangeEvent) => setFormState(e.formData),
    [setFormState],
  );

  const handleCreate = async () => {
    const { runId } = await codemodApi.applyCodemod({
      codemodRef,
      values: formState,
      targets: backendFilters,
    });

    const formParams = qs.stringify(
      { formData: formState },
      { addQueryPrefix: true },
    );
    const newUrl = `${window.location.pathname}${formParams}`;
    // We use direct history manipulation since useSearchParams and
    // useNavigate in react-router-dom cause unnecessary extra rerenders.
    // Also make sure to replace the state rather than pushing to avoid
    // extra back/forward slots.
    window.history?.replaceState(null, document.title, newUrl);

    navigate(codemodRunRoute({ runId }));
  };

  if (error) {
    errorApi.post(new Error(`Failed to load codemod, ${error}`));
    return <Navigate to={rootRoute()} />;
  }
  if (!loading && !value) {
    errorApi.post(new Error('Codemod was not found.'));
    return <Navigate to={rootRoute()} />;
  }

  return (
    <>
      {loading && <Progress data-testid="loading-progress" />}
      {value && value[0] && value[1] && (
        <InfoCard
          title={value![0].metadata.title || value![0].metadata.name}
          noPadding
          titleTypographyProps={{ component: 'h2' }}
        >
          <CodemodStepper
            codemod={value![0] as CodemodEntityV1alpha1}
            parameterSchema={value![1]}
            formData={formState}
            onSubmit={handleCreate}
            onChange={handleChange}
          />
        </InfoCard>
      )}
    </>
  );
};
