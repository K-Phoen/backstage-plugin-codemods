import { createCodemodAction } from '../../createCodemodAction';
import { executeShellCommand, sanitizeWorkspacePath } from '../../helpers';

/**
 * Creates a new action that enables the execution of arbitrary commands.
 * @public
 */
export const createShellExecAction = () => {
  return createCodemodAction<{
    command: string;
    args?: string[];
    directory?: string;
  }>({
    id: 'shell:exec',
    description: 'Runs an arbitrary command',
    schema: {
      input: {
        required: ['command'],
        type: 'object',
        properties: {
          command: {
            title: 'Command',
            description: 'Command to run',
            type: 'string',
          },
          args: {
            title: 'Arguments',
            description: 'A list of arguments to give to the command',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          directory: {
            title: 'Working directory',
            description:
              'Directory in which the command will be executed. Defaults to the workspace.',
            type: 'string',
          },
        },
      },
    },
    async handler(ctx) {
      const curDirBackup = process.cwd();
      const directory = sanitizeWorkspacePath(
        ctx.workspacePath,
        ctx.input.directory ?? ctx.workspacePath,
      );

      try {
        process.chdir(directory);

        await executeShellCommand({
          logStream: ctx.logStream,
          command: ctx.input.command,
          args: ctx.input.args || [],
        });
      } catch (e) {
        process.chdir(curDirBackup);
        throw e;
      } finally {
        process.chdir(curDirBackup);
      }
    },
  });
};
