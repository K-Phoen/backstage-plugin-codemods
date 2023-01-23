import { rmSync } from 'fs';
import { Logger } from 'winston';
import { createCodemodAction } from '../../createCodemodAction';
import { sanitizeWorkspacePath } from '../../helpers';

/**
 * Creates new action that enables deletion of files and directories in the workspace.
 * @public
 */
export const createFsDeleteAction = () => {
  return createCodemodAction<{ targets: string[] }>({
    id: 'fs:delete',
    description: 'Deletes files and directories from the workspace',
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
  const filteredTargets = targets.filter(target => target.trim().length !== 0);
  const fullPaths = filteredTargets.map(target =>
    sanitizeWorkspacePath(workspace, target),
  );

  fullPaths.forEach(fullPath => {
    logger.info(`rm ${fullPath}`);
    rmSync(fullPath, { recursive: true });
  });
}
