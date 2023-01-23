import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { act, fireEvent, within } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { TemplatePage } from './TemplatePage';
import { ApiProvider } from '@backstage/core-app-api';
import { errorApiRef } from '@backstage/core-plugin-api';
import { rootRouteRef } from '../../routes';
import { codemodApiRef } from '../../api';
import { CodemodApi } from '../../types';

jest.mock('react-router-dom', () => {
  return {
    ...(jest.requireActual('react-router-dom') as any),
    useParams: () => ({
      templateName: 'test',
    }),
  };
});

const codemodApiMock: jest.Mocked<CodemodApi> = {
  getTemplateParameterSchema: jest.fn(),
  applyCodemod: jest.fn(),
  listRuns: jest.fn(),
  listJobs: jest.fn(),
  getRun: jest.fn(),
  getJob: jest.fn(),
  streamLogs: jest.fn(),
  listActions: jest.fn(),
};

const errorApiMock = { post: jest.fn(), error$: jest.fn() };

const schemaMockValue = {
  title: 'my-schema',
  steps: [
    {
      title: 'Fill in some steps',
      schema: {
        title: 'Fill in some steps',
        'backstage:featureFlag': 'experimental-feature',
        properties: {
          name: {
            title: 'Name',
            type: 'string',
            'backstage:featureFlag': 'should-show-some-stuff-first-option',
          },
          description: {
            title: 'Description',
            type: 'string',
            description: 'A description for the component',
          },
          owner: {
            title: 'Owner',
            type: 'string',
            description: 'Owner of the component',
          },
        },
        type: 'object',
      },
    },
    {
      title: 'Send data',
      schema: {
        title: 'Send data',
        properties: {
          user: {
            title: 'User',
            type: 'string',
          },
        },
        type: 'object',
      },
    },
  ],
};

const apis = TestApiRegistry.from(
  [codemodApiRef, codemodApiMock],
  [errorApiRef, errorApiMock],
);

describe('StartCodemodPage', () => {
  beforeEach(() => jest.resetAllMocks());

  it('renders correctly', async () => {
    codemodApiMock.getTemplateParameterSchema.mockResolvedValue({
      title: 'React SSR Template',
      steps: [],
    });
    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <TemplatePage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/create': rootRouteRef,
        },
      },
    );

    expect(rendered.getByText('Create a New Component')).toBeInTheDocument();
    expect(rendered.getByText('React SSR Template')).toBeInTheDocument();
  });

  it('renders spinner while loading', async () => {
    let resolve: Function;
    const promise = new Promise<any>(res => {
      resolve = res;
    });
    codemodApiMock.getTemplateParameterSchema.mockReturnValueOnce(promise);
    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <TemplatePage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/create': rootRouteRef,
        },
      },
    );

    expect(rendered.getByText('Create a New Component')).toBeInTheDocument();
    expect(rendered.getByTestId('loading-progress')).toBeInTheDocument();

    await act(async () => {
      resolve!({
        title: 'React SSR Template',
        steps: [],
      });
    });
  });

  it('navigates away if no template was loaded', async () => {
    codemodApiMock.getTemplateParameterSchema.mockResolvedValue(
      undefined as any,
    );

    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <Routes>
          <Route path="/create/test" element={<TemplatePage />} />
          <Route path="/create" element={<>This is root</>} />
        </Routes>
      </ApiProvider>,
      {
        routeEntries: ['/create'],
        mountedRoutes: { '/create': rootRouteRef },
      },
    );

    expect(
      rendered.queryByText('Create a New Component'),
    ).not.toBeInTheDocument();
    expect(rendered.getByText('This is root')).toBeInTheDocument();
  });

  it('display template with oneOf', async () => {
    codemodApiMock.getTemplateParameterSchema.mockResolvedValue({
      title: 'my-schema',
      steps: [
        {
          title: 'Fill in some steps',
          schema: {
            oneOf: [
              {
                title: 'First',
                properties: {
                  name: {
                    title: 'Name',
                    type: 'string',
                  },
                },
                required: ['name'],
              },
              {
                title: 'Second',
                properties: {
                  something: {
                    title: 'Something',
                    type: 'string',
                  },
                },
                required: ['something'],
              },
            ],
          },
        },
      ],
    });

    const { findByText, findByLabelText, findAllByRole, findByRole } =
      await renderInTestApp(
        <ApiProvider apis={apis}>
          <TemplatePage />
        </ApiProvider>,
        {
          mountedRoutes: {
            '/create/actions': rootRouteRef,
          },
        },
      );

    expect(await findByText('Fill in some steps')).toBeInTheDocument();

    // Fill the first option
    fireEvent.change(await findByLabelText('Name', { exact: false }), {
      target: { value: 'my-name' },
    });

    // Switch to second option
    fireEvent.mouseDown((await findAllByRole('button'))[0]);
    const listbox = within(await findByRole('listbox'));
    fireEvent.click(listbox.getByText(/Second/i));

    // Fill the second option
    fireEvent.change(await findByLabelText('Something', { exact: false }), {
      target: { value: 'my-something' },
    });

    // Go to the final page
    fireEvent.click(await findByText('Next step'));
    expect(await findByText('Reset')).toBeInTheDocument();
  });
});
