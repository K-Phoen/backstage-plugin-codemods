import { readdir, stat } from 'fs-extra';
import { relative, join } from 'path';
import { createCodemodAction } from '../../createCodemodAction';

/**
 * Writes a message into the log or lists all files in the workspace
 *
 * @remarks
 *
 * This task is useful for local development and testing of both the codemod plugin
 * and codemods.
 *
 * @public
 */
export function createDebugLogAction() {
  return createCodemodAction<{ message?: string; listWorkspace?: boolean }>({
    id: 'debug:log',
    description:
      'Writes a message into the log or lists all files in the workspace.',
    schema: {
      input: {
        type: 'object',
        properties: {
          message: {
            title: 'Message to output.',
            type: 'string',
          },
          listWorkspace: {
            title: 'List all files in the workspace, if true.',
            type: 'boolean',
          },
          extra: {
            title: 'Extra info',
          },
        },
      },
    },
    async handler(ctx) {
      ctx.logger.info(JSON.stringify(ctx.input, null, 2));

      if (ctx.input?.message) {
        ctx.logStream.write(ctx.input.message);
      }

      if (ctx.input?.listWorkspace) {
        const files = await recursiveReadDir(ctx.workspacePath);
        ctx.logStream.write(
          `Workspace:\n${files
            .map(f => `  - ${relative(ctx.workspacePath, f)}`)
            .join('\n')}`,
        );
      }
    },
  });
}

async function recursiveReadDir(dir: string): Promise<string[]> {
  const subdirs = await readdir(dir);
  const files = await Promise.all(
    subdirs.map(async subdir => {
      const res = join(dir, subdir);
      return (await stat(res)).isDirectory() ? recursiveReadDir(res) : [res];
    }),
  );
  return files.reduce((a, f) => a.concat(f), []);
}
