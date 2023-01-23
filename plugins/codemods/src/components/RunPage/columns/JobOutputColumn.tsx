import React from 'react';
import { JobOutput } from '../../../types';
import { JobOutputLinks } from '../../JobOutputLinks';

export const JobOutputColumn = ({ output }: { output?: JobOutput }) => {
  if (!output || !output.links) {
    return <>—</>;
  }

  return <JobOutputLinks output={output} />;
};
