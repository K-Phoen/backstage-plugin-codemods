import React from 'react';
import { Box, makeStyles } from '@material-ui/core';
import { MarkdownContent } from '@backstage/core-components';
import { CodemodEntityV1alpha1 } from '@k-phoen/plugin-codemods-common';
import { BackstageTheme } from '@backstage/theme';

const useStyles = makeStyles<BackstageTheme>(() => ({
  markdown: {
    /** to make the styles for React Markdown not leak into the description */
    '& :first-child': {
      marginTop: 0,
    },
    '& :last-child': {
      marginBottom: 0,
    },
  },
}));

export const CodemodDescription = ({
  codemod,
}: {
  codemod: CodemodEntityV1alpha1;
}) => {
  const styles = useStyles();

  return (
    <>
      {codemod.spec.details && (
        <>
          <MarkdownContent
            className={styles.markdown}
            content={codemod.spec.details || ''}
          />
          <hr />
        </>
      )}
      <Box style={{ marginTop: '1rem' }}>
        Codemods are applied on catalog entities. The next step will allow you
        to select which entities should be targeted by the "
        {codemod.metadata.title || codemod.metadata.name}" codemod.
      </Box>
    </>
  );
};
