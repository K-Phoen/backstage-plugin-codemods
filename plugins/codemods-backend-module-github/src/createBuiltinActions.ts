import { ScmIntegrations } from '@backstage/integration';
import { CodemodAction } from '@k-phoen/plugin-codemods-backend';
import { JsonObject } from '@backstage/types';
import {
  createGithubCloneAction,
  createGithubPushBranchAction,
  createGithubTargetCloneAction,
  createGithubTargetPullRequestAction,
  createGithubTargetPushBranchAction,
} from './actions';

export const createBuiltinGithubActions = ({
  integrations,
}: {
  integrations: ScmIntegrations;
}): CodemodAction<JsonObject>[] => {
  const actions = [
    createGithubCloneAction({ integrations }),
    createGithubTargetCloneAction({ integrations }),

    createGithubTargetPullRequestAction({ integrations }),

    createGithubPushBranchAction({ integrations }),
    createGithubTargetPushBranchAction({ integrations }),
  ];

  return actions as CodemodAction<JsonObject>[];
};
