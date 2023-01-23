import { URL } from 'url';
import { Octokit } from '@octokit/rest';
import { OctokitOptions } from '@octokit/core/dist-types/types';
import {
  DefaultGithubCredentialsProvider,
  GithubCredentials,
  ScmIntegrationRegistry,
} from '@backstage/integration';
import { InputError } from '@backstage/errors';

export const githubCredentials = async (
  integrations: ScmIntegrationRegistry,
  repoUrl: string,
): Promise<GithubCredentials> => {
  const credentialsProvider =
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);

  return credentialsProvider.getCredentials({ url: repoUrl });
};

export const getOctokitOptions = async (options: {
  integrations: ScmIntegrationRegistry;
  repoUrl: string;
}): Promise<OctokitOptions> => {
  const { integrations, repoUrl } = options;
  const url = new URL(repoUrl);

  const integrationConfig = integrations.github.byHost(url.host)?.config;
  if (!integrationConfig) {
    throw new InputError(`No integration for host ${url.host}`);
  }

  const credentialsProvider =
    DefaultGithubCredentialsProvider.fromIntegrations(integrations);

  const { token: credentialProviderToken } =
    await credentialsProvider.getCredentials({ url: repoUrl });

  if (!credentialProviderToken) {
    throw new InputError(`No token available for repo: ${repoUrl}`);
  }

  return {
    auth: credentialProviderToken,
    baseUrl: integrationConfig.apiBaseUrl,
    previews: ['nebula-preview'],
  };
};

type openPullRequestOpts = {
  integrations: ScmIntegrationRegistry;
  repoUrl: string;
  baseBranch: string;
  branchName: string;
  title: string;
  description: string;
};

export const openPullRequest = async (
  opts: openPullRequestOpts,
): Promise<{ remoteUrl: string }> => {
  const octokitOptions = await getOctokitOptions({
    integrations: opts.integrations,
    repoUrl: opts.repoUrl,
  });

  const githubClient = new Octokit({
    ...octokitOptions,
    ...{ throttle: { enabled: false } },
  });

  const repoParts = opts.repoUrl.split('/').filter(Boolean);
  if (repoParts.length !== 4) {
    throw new InputError(`Unexpected repo URL format: ${opts.repoUrl}`);
  }

  const response = await githubClient.pulls.create({
    // where
    owner: repoParts[repoParts.length - 2],
    repo: repoParts[repoParts.length - 1],

    // what
    base: opts.baseBranch,
    head: opts.branchName,

    // PR cosmetics
    title: opts.title,
    body: opts.description,
  });

  return {
    remoteUrl: response.data.html_url,
  };
};
