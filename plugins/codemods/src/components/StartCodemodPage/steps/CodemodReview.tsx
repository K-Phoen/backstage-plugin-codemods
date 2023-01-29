import React from 'react';
import { Box, Typography } from '@material-ui/core';
import { UiSchema } from '@rjsf/core';
import {
  Progress,
  StructuredMetadataTable,
  WarningPanel,
} from '@backstage/core-components';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { useEntityList } from '../../hooks/useEntityListProvider';
import { JsonObject } from '@backstage/types';

const getReviewData = (
  formData: Record<string, any>,
  uiSchemas: UiSchema[],
) => {
  const reviewData: Record<string, any> = {};
  for (const key in formData) {
    if (!formData.hasOwnProperty(key)) {
      continue;
    }

    const uiSchema = uiSchemas.find(us => us.name === key);

    if (!uiSchema) {
      reviewData[key] = formData[key];
      continue;
    }

    if (uiSchema['ui:widget'] === 'password') {
      reviewData[key] = '******';
      continue;
    }

    if (!uiSchema['ui:backstage'] || !uiSchema['ui:backstage'].review) {
      reviewData[key] = formData[key];
      continue;
    }

    const review = uiSchema['ui:backstage'].review as JsonObject;
    if (review.mask) {
      reviewData[key] = review.mask;
      continue;
    }

    if (!review.show) {
      continue;
    }
    reviewData[key] = formData[key];
  }

  return reviewData;
};

const getUiSchemas = (codemod: CodemodEntityV1alpha1): UiSchema[] => {
  if (!codemod.spec.parameters) {
    return [];
  }

  const uiSchemas: UiSchema[] = [];
  const schemaProps = codemod.spec.parameters.properties as JsonObject;

  for (const key in schemaProps) {
    if (!schemaProps.hasOwnProperty(key)) {
      continue;
    }

    const uiSchema = schemaProps[key] as UiSchema;
    uiSchema.name = key;
    uiSchemas.push(uiSchema);
  }

  return uiSchemas;
};

export const CodemodReview = ({
  codemod,
  formData,
}: {
  codemod: CodemodEntityV1alpha1;
  formData: Record<string, any>;
}) => {
  const { loading, error, entities } = useEntityList();

  return (
    <>
      {loading && <Progress />}

      {error && (
        <WarningPanel title="Oops! Something went wrong loading the templates">
          {error.message}
        </WarningPanel>
      )}

      {entities && entities.length && (
        <>
          <Box>
            The "{codemod.metadata.title || codemod.metadata.name}" codemod will
            be applied on <b>{entities.length} entities</b>.
          </Box>
          <Box mb={4} />
        </>
      )}

      <Box>
        <Typography variant="h6">Parameters</Typography>
        <StructuredMetadataTable
          dense
          metadata={getReviewData(formData, getUiSchemas(codemod))}
        />
      </Box>

      <Box mb={4} />
    </>
  );
};
