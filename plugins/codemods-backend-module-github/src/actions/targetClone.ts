import yaml from 'yaml';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { createCodemodAction } from '@k-phoen/plugin-codemods-backend';
import { cloneRepository, repoUrlFromEntity } from './helpers';

const id = 'github:target:repo:clone';

const examples = [
  {
    description: 'Clone the target entity',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'clone-target',
          name: 'Clone the target entity in the `./repo` directory',
          input: {
            destination: './repo',
          },
        },
      ],
    }),
  },
  {
    description: 'Shallow clone',
    example: yaml.stringify({
      steps: [
        {
          action: id,
          id: 'shallow-clone',
          name: 'Shallow-clone the target entity in the `./repo` directory',
          input: {
            destination: './repo',
            depth: 1,
          },
        },
      ],
    }),
  },
];

/**
 * Creates a new action that clones into the workspace the GitHub repository
 * associated to the target catalog entity.
 *
 * @public
 */
export function createGithubTargetCloneAction(options: {
  integrations: ScmIntegrationRegistry;
}) {
  return createCodemodAction<{
    destination: string;
    depth?: number;
  }>({
    id,
    description:
      'Clones the GitHub repository associated to the target entity.',
    examples,
    schema: {
      input: {
        type: 'object',
        required: ['destination'],
        properties: {
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
        repoUrl: repoUrlFromEntity(ctx.target.entity),
        destination: ctx.input.destination,
        depth: ctx.input.depth,
      });
    },
  });
}
