import { writeFile } from 'fs/promises';
import { createCodemodAction } from '../../createCodemodAction';
import { sanitizeWorkspacePath } from '../../helpers';

/**
 * Creates an action that writes content into a file.
 *
 * @public
 */
export function createFsWriteAction() {
  return createCodemodAction<{ to: string; content: string }>({
    id: 'fs:write',
    description: 'Writes content into a file in the workspace.',
    schema: {
      input: {
        type: 'object',
        required: ['to', 'content'],
        properties: {
          to: {
            title: 'File in the workspace to write into.',
            type: 'string',
          },
          content: {
            title: 'Content to write.',
            type: 'string',
          },
        },
      },
    },
    async handler(ctx) {
      await writeFile(
        sanitizeWorkspacePath(ctx.workspacePath, ctx.input.to),
        ctx.input.content,
        { flag: 'w' }, // create the file if not exists, truncate if it does
      );
    },
  });
}
