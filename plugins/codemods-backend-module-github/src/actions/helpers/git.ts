import fs from 'fs';
import * as isoGit from 'isomorphic-git';
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

type gitAddOpts = {
  integrations: ScmIntegrationRegistry;
  logger: Logger;
  repoPath: string;
  addTargets: string[];
};

export const gitAdd = async (opts: gitAddOpts): Promise<void> => {
  if (opts.addTargets.length === 0) {
    return;
  }

  opts.logger.info('Adding', { targets: opts.addTargets });

  opts.addTargets.forEach(
    async target =>
      await isoGit.add({
        fs,
        dir: opts.repoPath,
        filepath: target,
      }),
  );

  const statusMatrix = await isoGit.statusMatrix({ fs, dir: opts.repoPath });

  opts.logger.info('Looking for deleted files', { len: statusMatrix.length });

  // isomorphic-git `add` function ignores deleted files.
  // To mimic `git add` functionality, we get a list of files from the
  // workdir and run git remove on every file marked as no longer present.
  opts.addTargets.forEach(async target => {
    const deletedFiles = statusMatrix
      // exclude files not matching our target
      .filter(status => status[0].startsWith(target))
      // status[2] === 0 selects deleted files. See: https://isomorphic-git.org/docs/en/statusMatrix.html
      .filter(status => status[2] === 0)
      /// map statuses to filenames
      .map(status => status[0]);

    deletedFiles.forEach(async file => {
      await isoGit.remove({
        fs,
        dir: opts.repoPath,
        filepath: file,
      });
    });
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

  await gitAdd({
    integrations: opts.integrations,
    logger: opts.logger,
    repoPath: opts.repoPath,
    addTargets: opts.addTargets || [],
  });

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
