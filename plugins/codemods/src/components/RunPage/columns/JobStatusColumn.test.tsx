import React from 'react';
import { renderInTestApp } from '@backstage/test-utils';
import { JobStatusColumn } from './JobStatusColumn';

describe('<JobStatusColumn />', () => {
  it.each(['open', 'processing', 'error', 'completed'])(
    'should render the column with the status %s',
    async status => {
      const props = {
        status: status,
      };

      const { getByText } = await renderInTestApp(
        <JobStatusColumn {...props} />,
      );

      const text = getByText(status);
      expect(text).toBeDefined();
    },
  );
});
