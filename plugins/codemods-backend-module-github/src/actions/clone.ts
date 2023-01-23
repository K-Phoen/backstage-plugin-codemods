import { ScmIntegrationRegistry } from '@backstage/integration';
import { createCodemodAction } from '@k-phoen/plugin-codemods-backend';
import { cloneRepository } from './helpers';

/**
 * Creates a new action that clones a GitHub repository in the workspace.
 *
 * @public
 */
export function createGithubCloneAction(options: {
  integrations: ScmIntegrationRegistry;
}) {
  return createCodemodAction<{
    repoUrl: string;
    destination: string;
    depth?: number;
  }>({
    id: 'github:repo:clone',
    description: 'Clones a GitHub repository in the workspace.',
    schema: {
      input: {
        type: 'object',
        required: ['repoUrl', 'destination'],
        properties: {
          repoUrl: {
            title: 'URL of the repository to clone.',
            type: 'string',
          },
          destination: {
            title:
              'Path within the workspace in which the clone will be created.',
            type: 'string',
          },
          depth: {
            title:
              "Determines how much of the git repository's history to retrieve. Default: 1",
            type: 'integer',
          },
        },
      },
    },
    async handler(ctx) {
      await cloneRepository({
        integrations: options.integrations,
        logger: ctx.logger,
        workspacePath: ctx.workspacePath,
        repoUrl: ctx.input.repoUrl,
        destination: ctx.input.destination,
        depth: ctx.input.depth,
      });
    },
  });
}
