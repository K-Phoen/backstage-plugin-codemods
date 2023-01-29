import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
  IdentityApi,
} from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { Observable } from '@backstage/types';
import queryString from 'qs';
import ObservableImpl from 'zen-observable';
import {
  CodemodApi,
  CodemodApplyOptions,
  CodemodApplyResponse,
  CodemodRun,
  Job,
  ListActionsResponse,
  LogEvent,
  StreamLogsOptions,
} from './types';

/**
 * Utility API reference for the {@link CodemodApi}.
 *
 * @public
 */
export const codemodApiRef = createApiRef<CodemodApi>({
  id: 'plugin.codemod.service',
});

/**
 * An API to interact with the codemod backend.
 *
 * @public
 */
export class CodemodClient implements CodemodApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly identityApi: IdentityApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    identityApi: IdentityApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi ?? { fetch };
    this.identityApi = options.identityApi;
  }

  async applyCodemod(
    options: CodemodApplyOptions,
  ): Promise<CodemodApplyResponse> {
    const { codemodRef, values, targets } = options;
    const url = `${await this.baseUrl()}/v1/runs`;
    const response = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codemodRef,
        values: { ...values },
        targets,
      }),
    });

    if (response.status !== 201) {
      const status = `${response.status} ${response.statusText}`;
      const body = await response.text();
      throw new Error(`Backend request failed, ${status} ${body.trim()}`);
    }

    const { id } = (await response.json()) as { id: string };
    return { runId: id };
  }

  async listRuns(options: {
    filterByOwnership: 'owned' | 'all';
  }): Promise<{ runs: CodemodRun[] }> {
    const baseUrl = await this.baseUrl();
    const { userEntityRef } = await this.identityApi.getBackstageIdentity();

    const query = queryString.stringify(
      options.filterByOwnership === 'owned' ? { createdBy: userEntityRef } : {},
    );

    const response = await this.fetchApi.fetch(`${baseUrl}/v1/runs?${query}`);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return await response.json();
  }

  async listJobs(options: { runId: string }): Promise<{ jobs: Job[] }> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/v1/runs/${options.runId}/jobs`,
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return await response.json();
  }

  async getRun({ runId }: { runId: string }): Promise<CodemodRun> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/v1/runs/${runId}`);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return await response.json();
  }

  async getJob({
    runId,
    jobId,
  }: {
    runId: string;
    jobId: string;
  }): Promise<Job> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/v1/runs/${runId}/jobs/${jobId}`,
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return await response.json();
  }

  streamLogs(options: StreamLogsOptions): Observable<LogEvent> {
    return new ObservableImpl(subscriber => {
      const params = new URLSearchParams();
      if (options.after !== undefined) {
        params.set('after', String(Number(options.after)));
      }

      this.baseUrl().then(
        baseUrl => {
          const url = `${baseUrl}/v1/runs/${
            options.runId
          }/jobs/${encodeURIComponent(options.jobId)}/eventstream`;
          const eventSource = new EventSource(url, { withCredentials: true });
          eventSource.addEventListener('log', (event: any) => {
            if (event.data) {
              try {
                subscriber.next(JSON.parse(event.data));
              } catch (ex) {
                subscriber.error(ex);
              }
            }
          });
          eventSource.addEventListener('completion', (event: any) => {
            if (event.data) {
              try {
                subscriber.next(JSON.parse(event.data));
              } catch (ex) {
                subscriber.error(ex);
              }
            }
            eventSource.close();
            subscriber.complete();
          });
          eventSource.addEventListener('error', event => {
            subscriber.error(event);
          });
        },
        error => {
          subscriber.error(error);
        },
      );
    });
  }

  async listActions(): Promise<ListActionsResponse> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/v1/actions`);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return await response.json();
  }

  private async baseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('codemods');
  }
}
