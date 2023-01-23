import { getVoidLogger } from '@backstage/backend-common';
import mock from 'mock-fs';
import os from 'os';
import { Writable } from 'stream';
import { createDebugLogAction } from './log';
import { join } from 'path';

describe('debug:log', () => {
  const logStream = {
    write: jest.fn(),
  } as jest.Mocked<Partial<Writable>> as jest.Mocked<Writable>;

  const mockTmpDir = os.tmpdir();
  const mockContext = {
    input: {},
    baseUrl: 'somebase',
    workspacePath: mockTmpDir,
    logger: getVoidLogger(),
    logStream,
    target: {
      entity: {
        apiVersion: 'codemod.backstage.io/v1alpha1',
        kind: 'Codemod',
        metadata: { name: 'n' },
        spec: {
          owner: 'o',
          steps: [],
        },
      },
      ref: 'component:default/some-entity',
    },
    output: jest.fn(),
    createTemporaryDirectory: jest.fn().mockResolvedValue(mockTmpDir),
  };

  const action = createDebugLogAction();

  beforeEach(() => {
    mock({
      [`${mockContext.workspacePath}/README.md`]: '',
      [`${mockContext.workspacePath}/a-directory/index.md`]: '',
    });
    jest.resetAllMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  it('should do nothing', async () => {
    await action.handler(mockContext);

    expect(logStream.write).toHaveBeenCalledTimes(0);
  });

  it('should log the workspace content, if active', async () => {
    const context = {
      ...mockContext,
      input: {
        listWorkspace: true,
      },
    };

    await action.handler(context);

    expect(logStream.write).toHaveBeenCalledTimes(1);
    expect(logStream.write).toHaveBeenCalledWith(
      expect.stringContaining('README.md'),
    );
    expect(logStream.write).toHaveBeenCalledWith(
      expect.stringContaining(join('a-directory', 'index.md')),
    );
  });

  it('should log message', async () => {
    const context = {
      ...mockContext,
      input: {
        message: 'Hello Backstage!',
      },
    };

    await action.handler(context);

    expect(logStream.write).toHaveBeenCalledTimes(1);
    expect(logStream.write).toHaveBeenCalledWith(
      expect.stringContaining('Hello Backstage!'),
    );
  });
});
