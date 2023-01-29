import mockFs from 'mock-fs';
import * as winston from 'winston';

import { getVoidLogger, resolvePackagePath } from '@backstage/backend-common';
import { parseEntityRef, UserEntity } from '@backstage/catalog-model';
import { CodemodRunSpec } from '@k-phoen/plugin-codemods-common';
import { NunjucksWorkflowRunner } from './NunjucksWorkflowRunner';
import { ActionRegistry } from '../actions';
import { JobContext } from './types';

// The Stream module is lazy loaded, so make sure it's in the module cache before mocking fs
void winston.transports.Stream;

const realFiles = Object.fromEntries(
  [
    resolvePackagePath(
      '@k-phoen/plugin-codemods-backend',
      'assets',
      'nunjucks.js.txt',
    ),
  ].map(k => [k, mockFs.load(k)]),
);

describe('DefaultWorkflowRunner', () => {
  const logger = getVoidLogger();
  let actionRegistry = new ActionRegistry();
  let runner: NunjucksWorkflowRunner;
  let fakeActionHandler: jest.Mock;

  const createMockJobWithSpec = ({
    codemod,
    targetRef,
  }: {
    codemod: CodemodRunSpec;
    targetRef: string;
  }): JobContext => ({
    spec: codemod,
    target: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: parseEntityRef(targetRef).kind,
      metadata: {
        namespace: parseEntityRef(targetRef).namespace,
        name: parseEntityRef(targetRef).name,
      },
      spec: {},
    },
    complete: async () => {},
    done: false,
    emitLog: async () => {},
    getWorkspaceName: () => Promise.resolve('test-workspace'),
  });

  beforeEach(() => {
    winston.format.simple(); // put logform in the require.cache before mocking fs
    mockFs({
      '/tmp': mockFs.directory(),
      ...realFiles,
    });

    jest.resetAllMocks();
    actionRegistry = new ActionRegistry();
    fakeActionHandler = jest.fn();

    actionRegistry.register({
      id: 'jest-mock-action',
      description: 'Mock action for testing',
      handler: fakeActionHandler,
    });

    actionRegistry.register({
      id: 'jest-validated-action',
      description: 'Mock action for testing',
      handler: fakeActionHandler,
      schema: {
        input: {
          type: 'object',
          required: ['foo'],
          properties: {
            foo: {
              type: 'number',
            },
          },
        },
      },
    });

    actionRegistry.register({
      id: 'output-action',
      description: 'Mock action for testing',
      handler: async ctx => {
        ctx.output('mock', 'backstage');
        ctx.output('shouldRun', true);
      },
    });

    runner = new NunjucksWorkflowRunner({
      actionRegistry,
      workingDirectory: '/tmp',
      logger,
      additionalTemplateFilters: {
        testFilter: arg => {
          return `testFilter ${arg}`;
        },
      },
      additionalTemplateGlobals: {
        funcGlobal: () => {
          return 'funcGlobal called';
        },
        jsonValueGlobal: 'jsonValueGlobal returned',
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should throw an error if the action does not exist', async () => {
    const job = createMockJobWithSpec({
      codemod: {
        apiVersion: 'codemod.backstage.io/v1alpha1',
        targets: {},
        parameters: {},
        output: {},
        steps: [{ id: 'test', name: 'name', action: 'does-not-exist' }],
      },
      targetRef: 'component:default/some-target',
    });

    await expect(runner.execute(job)).rejects.toThrow(
      "Codemod action with ID 'does-not-exist' is not registered.",
    );
  });

  describe('validation', () => {
    it('should throw an error if the action has a schema and the input does not match', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          parameters: {},
          output: {},
          steps: [
            { id: 'test', name: 'name', action: 'jest-validated-action' },
          ],
        },
        targetRef: 'component:default/some-target',
      });

      await expect(runner.execute(job)).rejects.toThrow(
        /Invalid input passed to action jest-validated-action, instance requires property \"foo\"/,
      );
    });

    it('should run the action when the validation passes', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          parameters: {},
          output: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-validated-action',
              input: { foo: 1 },
            },
          ],
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler).toHaveBeenCalledTimes(1);
    });

    it('should pass metadata through', async () => {
      const entityRef = `codemod:default/codemod-name`;

      const userEntity: UserEntity = {
        apiVersion: 'backstage.io/v1beta1',
        kind: 'User',
        metadata: {
          name: 'user',
        },
        spec: {
          profile: {
            displayName: 'Bogdan Nechyporenko',
            email: 'bnechyporenko@company.com',
          },
        },
      };

      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          parameters: {},
          output: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-validated-action',
              input: { foo: 1 },
            },
          ],
          codemodInfo: { entityRef },
          user: {
            entity: userEntity,
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler.mock.calls[0][0].codemodInfo).toEqual({
        entityRef,
      });

      expect(fakeActionHandler.mock.calls[0][0].user).toEqual({
        entity: userEntity,
      });
    });
  });

  describe('conditionals', () => {
    it('should execute steps conditionally', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            { id: 'test', name: 'test', action: 'output-action' },
            {
              id: 'conditional',
              name: 'conditional',
              action: 'output-action',
              if: '${{ steps.test.output.shouldRun }}',
            },
          ],
          output: {
            result: '${{ steps.conditional.output.mock }}',
          },
          parameters: {},
        },
        targetRef: 'component:default/some-target',
      });

      const { output } = await runner.execute(job);

      expect(output.result).toBe('backstage');
    });

    it('should skips steps conditionally', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            { id: 'test', name: 'test', action: 'output-action' },
            {
              id: 'conditional',
              name: 'conditional',
              action: 'output-action',
              if: '${{ not steps.test.output.shouldRun}}',
            },
          ],
          output: {
            result: '${{ steps.conditional.output.mock }}',
          },
          parameters: {},
        },
        targetRef: 'component:default/some-target',
      });

      const { output } = await runner.execute(job);

      expect(output.result).toBeUndefined();
    });

    it('should skips steps using the negating equals operator', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            { id: 'test', name: 'test', action: 'output-action' },
            {
              id: 'conditional',
              name: 'conditional',
              action: 'output-action',
              if: '${{ steps.test.output.mock !== "backstage"}}',
            },
          ],
          output: {
            result: '${{ steps.conditional.output.mock }}',
          },
          parameters: {},
        },
        targetRef: 'component:default/some-target',
      });

      const { output } = await runner.execute(job);

      expect(output.result).toBeUndefined();
    });
  });

  describe('templating', () => {
    it('should template the input to an action', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-mock-action',
              input: {
                foo: '${{parameters.input | lower }}',
              },
            },
          ],
          output: {},
          parameters: {
            input: 'BACKSTAGE',
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ input: { foo: 'backstage' } }),
      );
    });

    it('should not try and parse something that is not parsable', async () => {
      jest.spyOn(logger, 'error');
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-mock-action',
              input: {
                foo: 'bob',
              },
            },
          ],
          output: {},
          parameters: {
            input: 'BACKSTAGE',
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should keep the original types for the input and not parse things that are not meant to be parsed', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-mock-action',
              input: {
                number: '${{parameters.number}}',
                string: '${{parameters.string}}',
              },
            },
          ],
          output: {},
          parameters: {
            number: 0,
            string: '1',
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ input: { number: 0, string: '1' } }),
      );
    });

    it('should template complex values into the action', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-mock-action',
              input: {
                foo: '${{parameters.complex}}',
              },
            },
          ],
          output: {},
          parameters: {
            complex: { bar: 'BACKSTAGE' },
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ input: { foo: { bar: 'BACKSTAGE' } } }),
      );
    });

    it('supports really complex structures', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-mock-action',
              input: {
                foo: '${{parameters.complex.baz.something}}',
              },
            },
          ],
          output: {},
          parameters: {
            complex: {
              bar: 'BACKSTAGE',
              baz: { something: 'nested', here: 'yas' },
            },
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ input: { foo: 'nested' } }),
      );
    });

    it('supports numbers as first class too', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'jest-mock-action',
              input: {
                foo: '${{parameters.complex.baz.number}}',
              },
            },
          ],
          output: {},
          parameters: {
            complex: {
              bar: 'BACKSTAGE',
              baz: { number: 1 },
            },
          },
        },
        targetRef: 'component:default/some-target',
      });

      await runner.execute(job);

      expect(fakeActionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ input: { foo: 1 } }),
      );
    });

    it('should template the output from simple actions', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'output-action',
              input: {},
            },
          ],
          output: {
            foo: '${{steps.test.output.mock | upper}}',
          },
          parameters: {},
        },
        targetRef: 'component:default/some-target',
      });

      const { output } = await runner.execute(job);

      expect(output.foo).toEqual('BACKSTAGE');
    });
  });

  describe('additional filters', () => {
    it('exposes additional filters', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'output-action',
              input: {},
            },
          ],
          output: {
            foo: '${{ parameters.inputParam | testFilter }}',
          },
          parameters: {
            inputParam: 'foo',
          },
        },
        targetRef: 'component:default/some-target',
      });

      const { output } = await runner.execute(job);

      expect(output.foo).toEqual('testFilter foo');
    });
  });

  describe('additional globals', () => {
    it('exposes additional globals', async () => {
      const job = createMockJobWithSpec({
        codemod: {
          apiVersion: 'codemod.backstage.io/v1alpha1',
          targets: {},
          steps: [
            {
              id: 'test',
              name: 'name',
              action: 'output-action',
              input: {},
            },
          ],
          output: {
            funcGlobal: '${{ funcGlobal() }}',
            jsonValueGlobal: '${{ jsonValueGlobal }}',
          },
          parameters: {},
        },
        targetRef: 'component:default/some-target',
      });

      const { output } = await runner.execute(job);

      expect(output.funcGlobal).toEqual('funcGlobal called');
      expect(output.jsonValueGlobal).toEqual('jsonValueGlobal returned');
    });
  });
});
