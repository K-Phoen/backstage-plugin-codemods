import React from 'react';
import { codemodApiRef } from '../../api';
import { ActionsPage } from './ActionsPage';
import { rootRouteRef } from '../../routes';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { CodemodApi } from '../../types';

const codemodApiMock: jest.Mocked<CodemodApi> = {
  getTemplateParameterSchema: jest.fn(),
  applyCodemod: jest.fn(),
  listRuns: jest.fn(),
  getRun: jest.fn(),
  listJobs: jest.fn(),
  getJob: jest.fn(),
  streamLogs: jest.fn(),
  listActions: jest.fn(),
};

const apis = TestApiRegistry.from([codemodApiRef, codemodApiMock]);

describe('ActionsPage', () => {
  beforeEach(() => jest.resetAllMocks());

  it('renders action with input', async () => {
    codemodApiMock.listActions.mockResolvedValue([
      {
        id: 'test',
        description: 'example description',
        schema: {
          input: {
            type: 'object',
            required: ['foobar'],
            properties: {
              foobar: {
                title: 'Test title',
                type: 'string',
              },
            },
          },
        },
      },
    ]);
    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <ActionsPage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/create/actions': rootRouteRef,
        },
      },
    );
    expect(rendered.getByText('Test title')).toBeInTheDocument();
    expect(rendered.getByText('example description')).toBeInTheDocument();
    expect(rendered.getByText('foobar')).toBeInTheDocument();
    expect(rendered.queryByText('output')).not.toBeInTheDocument();
  });

  it('renders action with input and output', async () => {
    codemodApiMock.listActions.mockResolvedValue([
      {
        id: 'test',
        description: 'example description',
        schema: {
          input: {
            type: 'object',
            required: ['foobar'],
            properties: {
              foobar: {
                title: 'Test title',
                type: 'string',
              },
            },
          },
          output: {
            type: 'object',
            properties: {
              buzz: {
                title: 'Test output',
                type: 'string',
              },
            },
          },
        },
      },
    ]);
    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <ActionsPage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/create/actions': rootRouteRef,
        },
      },
    );
    expect(rendered.getByText('Test title')).toBeInTheDocument();
    expect(rendered.getByText('example description')).toBeInTheDocument();
    expect(rendered.getByText('foobar')).toBeInTheDocument();
    expect(rendered.getByText('Test output')).toBeInTheDocument();
  });

  it('renders action with multipel input types', async () => {
    codemodApiMock.listActions.mockResolvedValue([
      {
        id: 'test',
        description: 'example description',
        schema: {
          input: {
            type: 'object',
            required: ['foobar'],
            properties: {
              foobar: {
                title: 'Test title',
                type: ['array', 'number'],
              },
            },
          },
          output: {
            type: 'object',
            properties: {
              buzz: {
                title: 'Test output',
                type: 'string',
              },
            },
          },
        },
      },
    ]);
    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <ActionsPage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/create/actions': rootRouteRef,
        },
      },
    );
    expect(rendered.getByText('array')).toBeInTheDocument();
    expect(rendered.getByText('number')).toBeInTheDocument();
  });

  it('renders action with oneOf input', async () => {
    codemodApiMock.listActions.mockResolvedValue([
      {
        id: 'test',
        description: 'example description',
        schema: {
          input: {
            oneOf: [
              {
                type: 'object',
                required: ['foo'],
                properties: {
                  foo: {
                    title: 'Foo title',
                    description: 'Foo description',
                    type: 'string',
                  },
                },
              },
              {
                type: 'object',
                required: ['bar'],
                properties: {
                  bar: {
                    title: 'Bar title',
                    description: 'Bar description',
                    type: 'string',
                  },
                },
              },
            ],
          },
        },
      },
    ]);
    const rendered = await renderInTestApp(
      <ApiProvider apis={apis}>
        <ActionsPage />
      </ApiProvider>,
      {
        mountedRoutes: {
          '/create/actions': rootRouteRef,
        },
      },
    );
    expect(rendered.getByText('oneOf')).toBeInTheDocument();
    expect(rendered.getByText('Foo title')).toBeInTheDocument();
    expect(rendered.getByText('Foo description')).toBeInTheDocument();
    expect(rendered.getByText('Bar title')).toBeInTheDocument();
    expect(rendered.getByText('Bar description')).toBeInTheDocument();
  });
});
