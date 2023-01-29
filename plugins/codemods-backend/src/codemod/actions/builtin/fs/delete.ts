import yaml from 'yaml';
import { rmSync } from 'fs';
import { Logger } from 'winston';
import { createCodemodAction } from '../../createCodemodAction';
import { sanitizeWorkspacePath } from '../../helpers';

const id = 'fs:delete';

const examples = [
  {
    description: 'Delete a file',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'delete-file',
          name: 'Delete a file',
          input: {
            targets: ['./some/file.txt'],
          },
        },
      ],
    }),
  },
  {
    description: 'Delete a directory',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'delete-directory',
          name: 'Delete a directory',
          input: {
            targets: ['./some/directory'],
          },
        },
      ],
    }),
  },
  {
    description: 'Delete a multiple targets',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'delete-multiple',
          name: 'Delete multiple targets',
          input: {
            targets: ['./some/directory', './some/file.txt'],
          },
        },
      ],
    }),
  },
];

/**
 * Creates new action that enables deletion of files and directories in the workspace.
 * @public
 */
export const createFsDeleteAction = () => {
  return createCodemodAction<{ targets: string[] }>({
    id,
    description: 'Deletes files and directories from the workspace',
    examples,
    schema: {
      input: {
        required: ['targets'],
        type: 'object',
        properties: {
          targets: {
            title: 'Files and/or directories',
            description: 'A list of files and directories that will be deleted',
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
    async handler(ctx) {
      doRemove({
        workspace: ctx.workspacePath,
        targets: ctx.input.targets,
        logger: ctx.logger,
      });
    },
  });
};

function doRemove({
  workspace,
  targets,
  logger,
}: {
  workspace: string;
  targets: string[];
  logger: Logger;
}): void {
  targets
    // remove "empty" targets
    .filter(target => target.trim().length !== 0)
    // make sure the path is clean
    .map(target => sanitizeWorkspacePath(workspace, target))
    // and delete!
    .forEach(fullPath => {
      logger.info(`Deleting ${fullPath}`);
      rmSync(fullPath, { recursive: true });
    });
}
