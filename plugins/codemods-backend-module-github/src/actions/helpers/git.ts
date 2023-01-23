import { Logger } from 'winston';
import { Git } from '@backstage/backend-common';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { sanitizeWorkspacePath } from '@k-phoen/plugin-codemods-backend';
import { githubCredentials } from './github';

type repoCloneOpts = {
  integrations: ScmIntegrationRegistry;
  logger: Logger;
  workspacePath: string;

  repoUrl: string;
  destination: string;
  depth?: number;
};

export const cloneRepository = async (opts: repoCloneOpts): Promise<void> => {
  const { token } = await githubCredentials(opts.integrations, opts.repoUrl);

  const git = Git.fromAuth({
    logger: opts.logger,
    username: token,
    password: '',
  });

  opts.logger.info(`Cloning repository ${opts.repoUrl}`);

  return git.clone({
    url: opts.repoUrl,
    dir: sanitizeWorkspacePath(opts.workspacePath, opts.destination),
    depth: opts.depth || 1,
  });
};

type pushToBranchOpts = {
  integrations: ScmIntegrationRegistry;
  logger: Logger;
  repoPath: string;
  repoUrl: string;
  addTargets?: string[];
  branchName: string;
  commitMessage: string;
};

export const pushToBranch = async (
  opts: pushToBranchOpts,
): Promise<{ base: string; head: string }> => {
  const { token } = await githubCredentials(opts.integrations, opts.repoUrl);

  const git = Git.fromAuth({
    logger: opts.logger,
    username: token,
    password: '',
  });

  const baseBranch = await git.currentBranch({ dir: opts.repoPath });

  await git.branch({ dir: opts.repoPath, ref: opts.branchName });
  await git.checkout({ dir: opts.repoPath, ref: opts.branchName });

  opts.addTargets?.forEach(
    async target => await git.add({ dir: opts.repoPath, filepath: target }),
  );

  // todo: make this configurable
  const authorInfo = {
    name: 'Codemod',
    email: 'codemod@backstage.io',
  };

  await git.commit({
    dir: opts.repoPath,
    message: opts.commitMessage,
    author: authorInfo,
    committer: authorInfo,
  });

  await git.push({ dir: opts.repoPath, remote: 'origin' });

  return {
    base: baseBranch || 'main',
    head: opts.branchName,
  };
};
