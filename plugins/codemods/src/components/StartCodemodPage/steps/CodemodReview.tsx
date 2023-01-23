import React from 'react';
import { Box } from '@material-ui/core';
import { Progress, WarningPanel } from '@backstage/core-components';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { useEntityList } from '../../hooks/useEntityListProvider';

export const CodemodReview = ({
  codemod,
}: {
  codemod: CodemodEntityV1alpha1;
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
        <Box>
          The "{codemod.metadata.title || codemod.metadata.name}" codemod will
          be applied on <b>{entities.length} entities</b>.
        </Box>
      )}
    </>
  );
};
