import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { screen } from '@testing-library/react';
import React from 'react';
import { rootRouteRef } from '../../routes';
import { CodemodContextMenu } from './CodemodContextMenu';

describe('CodemodContextMenu', () => {
  it('does not render anything if fully disabled', async () => {
    await renderInTestApp(
      <div data-testid="container">
        <CodemodContextMenu runs={false} actions={false} />
      </div>,
      { mountedRoutes: { '/': rootRouteRef } },
    );

    expect(screen.getByTestId('container')).toBeEmptyDOMElement();
  });

  it('renders the runs option', async () => {
    await renderInTestApp(
      <div data-testid="container">
        <CodemodContextMenu actions={false} />
      </div>,
      {
        mountedRoutes: { '/': rootRouteRef },
      },
    );

    await userEvent.click(screen.getByTestId('container').firstElementChild!);

    expect(screen.getByText('Runs List')).toBeInTheDocument();
    expect(screen.queryByText('Installed Actions')).not.toBeInTheDocument();
  });

  it('renders the actions option', async () => {
    await renderInTestApp(
      <div data-testid="container">
        <CodemodContextMenu actions runs={false} />
      </div>,
      {
        mountedRoutes: { '/': rootRouteRef },
      },
    );

    await userEvent.click(screen.getByTestId('container').firstElementChild!);

    expect(screen.queryByText('Runs List')).not.toBeInTheDocument();
    expect(screen.getByText('Installed Actions')).toBeInTheDocument();
  });

  it('renders all options', async () => {
    await renderInTestApp(
      <div data-testid="container">
        <CodemodContextMenu />
      </div>,
      {
        mountedRoutes: { '/': rootRouteRef },
      },
    );

    await userEvent.click(screen.getByTestId('container').firstElementChild!);

    expect(screen.getByText('Runs List')).toBeInTheDocument();
    expect(screen.getByText('Installed Actions')).toBeInTheDocument();
  });
});
