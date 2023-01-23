import { lightTheme } from '@backstage/theme';
import { ThemeProvider } from '@material-ui/core';
import CloudIcon from '@material-ui/icons/Cloud';
import { render } from '@testing-library/react';
import React from 'react';
import { IconLink } from './IconLink';

describe('IconLink', () => {
  it('should render an icon link', () => {
    const rendered = render(
      <ThemeProvider theme={lightTheme}>
        <IconLink
          href="https://example.com"
          text="I am Link"
          Icon={CloudIcon}
        />
      </ThemeProvider>,
    );

    expect(rendered.getByText('I am Link')).toBeInTheDocument();
  });
});
