import { ScmIntegrationRegistry } from '@backstage/integration';
import {
  createCodemodAction,
  sanitizeWorkspacePath,
} from '@k-phoen/plugin-codemods-backend';
import {
  openPullRequest,
  pushToBranch,
  repoUrlFromEntity,
  setLabelsToissue,
} from './helpers';

/**
 * Creates a new action that opens a pull request with some new content.
 *
 * @public
 */
export function createGithubTargetPullRequestAction(options: {
  integrations: ScmIntegrationRegistry;
}) {
  return createCodemodAction<{
    repositoryPath: string;
    add?: string[];
    branchName: string;
    title: string;
    description: string;
    labels?: string[];
  }>({
    id: 'github:target:repo:pull-request',
    description: 'Opens a pull request with some new content.',
    schema: {
      input: {
        type: 'object',
        required: ['repositoryPath', 'branchName', 'title', 'description'],
        properties: {
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
          title: {
            type: 'string',
            title: 'Pull request title',
            description:
              'Title of the pull request (also used for the commit message).',
          },
          description: {
            type: 'string',
            title: 'Pull request description',
          },
          labels: {
            title: 'Labels.',
            description: 'List of labels to add to the pull request',
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
      output: {
        required: ['remoteUrl'],
        type: 'object',
        properties: {
          remoteUrl: {
            type: 'string',
            title: 'Pull Request URL',
            description: 'Link to the pull request in Github',
          },
          pullRequestNumber: {
            type: 'number',
            title: 'Pull Request Number',
            description: 'The pull request number',
          },
        },
      },
    },
    async handler(ctx) {
      const repoPath = sanitizeWorkspacePath(
        ctx.workspacePath,
        ctx.input.repositoryPath,
      );

      const branches = await pushToBranch({
        integrations: options.integrations,
        logger: ctx.logger,
        repoPath: repoPath,
        repoUrl: repoUrlFromEntity(ctx.target.entity),
        addTargets: ctx.input.add,
        branchName: ctx.input.branchName,
        commitMessage: ctx.input.title,
      });

      const pr = await openPullRequest({
        integrations: options.integrations,
        repoUrl: repoUrlFromEntity(ctx.target.entity),
        baseBranch: branches.base,
        branchName: ctx.input.branchName,
        title: ctx.input.title,
        description: ctx.input.description,
      });

      await setLabelsToissue({
        integrations: options.integrations,
        repoUrl: repoUrlFromEntity(ctx.target.entity),
        issueNumber: pr.prNumber,
        labels: ctx.input.labels || [],
      });

      ctx.output('pullRequestNumber', pr.prNumber);
      ctx.output('remoteUrl', pr.remoteUrl);
    },
  });
}
