import { join as joinPath, normalize as normalizePath } from 'path';
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
