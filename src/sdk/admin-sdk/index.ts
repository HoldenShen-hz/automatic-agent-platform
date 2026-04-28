import type { ApiClientConfig } from "../client-sdk/api-client.js";
import { RetryableApiClient, createApiClient } from "../client-sdk/api-client.js";

export interface AdminSdkConfig extends ApiClientConfig {}

export class AdminSdk {
  private readonly client: RetryableApiClient;

  public constructor(config: AdminSdkConfig) {
    this.client = createApiClient(config);
  }

  public listDomains<T>() {
    return this.client.getPaginated<T>("/domains");
  }

  public registerDomain<T>(body: unknown) {
    return this.client.post<T>("/domains", body);
  }

  public publishPack<T>(packId: string, body: unknown) {
    return this.client.publishPack<T>(packId, body);
  }

  public pauseHarnessRun<T>(runId: string, reason?: string) {
    return this.client.pauseHarnessRun<T>(runId, reason);
  }

  public abortHarnessRun<T>(runId: string, reason?: string) {
    return this.client.abortHarnessRun<T>(runId, reason);
  }

  public triggerPanic<T>(body: unknown) {
    return this.client.post<T>("/panic/trigger", body);
  }

  public resumePanic<T>(scope: string, body: unknown) {
    return this.client.post<T>(`/panic/${encodeURIComponent(scope)}/resume`, body);
  }

  public manageAgentLifecycle<T>(agentId: string, action: string, body?: unknown) {
    return this.client.post<T>(`/agents/${encodeURIComponent(agentId)}/${action}`, body ?? {});
  }

  public rotateSecrets<T>(body: unknown) {
    return this.client.post<T>("/secrets/rotate", body);
  }
}
