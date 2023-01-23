import { ScmIntegrationRegistry } from '@backstage/integration';
import {
  createCodemodAction,
  sanitizeWorkspacePath,
} from '@k-phoen/plugin-codemods-backend';
import { pushToBranch } from './helpers';

/**
 * Creates a new action that commits new content into a branch and pushes it.
 *
 * @public
 */
export function createGithubPushBranchAction(options: {
  integrations: ScmIntegrationRegistry;
}) {
  return createCodemodAction<{
    repoUrl: string;
    repositoryPath: string;
    add?: string[];
    branchName: string;
    commitMessage: string;
  }>({
    id: 'github:repo:push-branch',
    description: 'Commits and pushes new content into a branch.',
    schema: {
      input: {
        type: 'object',
        required: ['repoUrl', 'repositoryPath', 'branchName', 'commitMessage'],
        properties: {
          repoUrl: {
            title: 'URL of the repository to clone.',
            type: 'string',
          },
          repositoryPath: {
            title: 'Path of the git repository within the workspace.',
            type: 'string',
          },
          add: {
            title: 'List of paths to add to the commit.',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          branchName: {
            title: 'Name of the branch to create and push.',
            type: 'string',
          },
          commitMessage: {
            type: 'string',
            title: 'Commit message',
            description: 'Content of the commit message.',
          },
        },
      },
    },
    async handler(ctx) {
      const repoPath = sanitizeWorkspacePath(
        ctx.workspacePath,
        ctx.input.repositoryPath,
      );

      await pushToBranch({
        integrations: options.integrations,
        logger: ctx.logger,
        repoPath: repoPath,
        repoUrl: ctx.input.repoUrl,
        addTargets: ctx.input.add,
        branchName: ctx.input.branchName,
        commitMessage: ctx.input.commitMessage,
      });
    },
  });
}
