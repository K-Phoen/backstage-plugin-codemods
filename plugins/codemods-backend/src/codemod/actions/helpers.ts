import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { join as joinPath, normalize as normalizePath } from 'path';
import { PassThrough, Writable } from 'stream';
import { isChildPath } from '@backstage/backend-common';

export const sanitizeWorkspacePath = (
  workspacePath: string,
  sourcePath: string | undefined,
) => {
  if (!sourcePath) {
    return workspacePath;
  }

  const safeSuffix = normalizePath(sourcePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const path = joinPath(workspacePath, safeSuffix);
  if (!isChildPath(workspacePath, path)) {
    throw new Error('Invalid source path');
  }

  return path;
};

/** @public */
export type RunCommandOptions = {
  /** command to run */
  command: string;
  /** arguments to pass the command */
  args: string[];
  /** options to pass to spawn */
  options?: SpawnOptionsWithoutStdio;
  /** stream to capture stdout and stderr output */
  logStream?: Writable;
};

/**
 * Run a command in a sub-process, normally a shell command.
 *
 * @public
 */
export const executeShellCommand = async (options: RunCommandOptions) => {
  const {
    command,
    args,
    options: spawnOptions,
    logStream = new PassThrough(),
  } = options;
  await new Promise<void>((resolve, reject) => {
    const process = spawn(command, args, spawnOptions);

    process.stdout.on('data', stream => {
      logStream.write(stream);
    });

    process.stderr.on('data', stream => {
      logStream.write(stream);
    });

    process.on('error', error => {
      return reject(error);
    });

    process.on('close', code => {
      if (code !== 0) {
        return reject(
          new Error(`Command ${command} failed, exit code: ${code}`),
        );
      }
      return resolve();
    });
  });
};
