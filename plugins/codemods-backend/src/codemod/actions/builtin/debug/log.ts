import { readdir, stat } from 'fs-extra';
import { relative, join } from 'path';
import yaml from 'yaml';
import { createCodemodAction } from '../../createCodemodAction';

const id = 'debug:log';

const examples = [
  {
    description: 'Write a debug message',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'write-debug-line',
          name: 'Write "Hello Backstage!" log line',
          input: {
            message: 'Hello Backstage!',
          },
        },
      ],
    }),
  },
  {
    description: 'List the workspace directory',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'write-workspace-directory',
          name: 'List the workspace directory',
          input: {
            listWorkspace: true,
          },
        },
      ],
    }),
  },
];

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
    id,
    description:
      'Writes a message into the log or lists all files in the workspace.',
    examples,
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
