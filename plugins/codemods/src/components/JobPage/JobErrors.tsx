import { Box } from '@material-ui/core';
import React, { useEffect, useRef } from 'react';
import { DismissableBanner } from '@backstage/core-components';

type JobErrorsProps = {
  error?: Error;
};

export const JobErrors = ({ error }: JobErrorsProps) => {
  const id = useRef('');

  useEffect(() => {
    id.current = String(Math.random());
  }, [error]);
  return error ? (
    <Box>
      <DismissableBanner
        id={id.current}
        variant="warning"
        message={error.message}
      />
    </Box>
  ) : null;
};
