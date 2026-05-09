import type { ApiClientConfig } from "../client-sdk/api-client.js";
import { RetryableApiClient, createApiClient } from "../client-sdk/api-client.js";
import {
  createOperationalDirective,
  createDecisionDirective,
  type OperationalDirective,
  type OperationalDirectiveType,
  type OperationalDirectiveScope,
  type DecisionDirective,
  type DecisionDirectiveType,
  type DecisionDirectiveScope,
} from "../../platform/contracts/control-directive/index.js";

export interface AdminSdkConfig extends ApiClientConfig {}

// R8-23 FIX: Operational and Decision directive types for admin operations
export type { OperationalDirective, OperationalDirectiveType, OperationalDirectiveScope };
export type { DecisionDirective, DecisionDirectiveType, DecisionDirectiveScope };

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

  // R8-23 FIX: OperationalDirective methods for runtime control
  /**
   * Issue an OperationalDirective for runtime control (pause, resume, quota adjust, kill, etc.)
   * Per §4.3, P2 sends to P3/P4 for runtime control operations.
   */
  public issueOperationalDirective<TParams extends Record<string, unknown> = Record<string, unknown>>(input: {
    type: OperationalDirectiveType;
    scope?: OperationalDirectiveScope;
    issuedBy: OperationalDirective["issuedBy"];
    reason: string;
    params?: TParams;
    expiresAt?: string;
  }): OperationalDirective<TParams> {
    return createOperationalDirective<TParams>(input);
  }

  /**
   * Send an OperationalDirective to the platform via API.
   */
  public async sendOperationalDirective<TResponse, TParams extends Record<string, unknown> = Record<string, unknown>>(
    directive: OperationalDirective<TParams>,
  ): Promise<{ data: TResponse; status: number; headers: Record<string, string> }> {
    const envelope = this.client.createEnvelope(directive, { command: "operational_directive" }, 30000);
    return this.client.sendEnvelope<TResponse, OperationalDirective<TParams>>("/directives/operational", envelope);
  }

  // R8-23 FIX: DecisionDirective methods for business/approval decisions
  /**
   * Issue a DecisionDirective for business/approval decisions (approve, deny, override, patch, takeover)
   * Per §4.3, P2 sends to P3/P4 for business/approval decisions.
   */
  public issueDecisionDirective<TPayload = unknown>(input: {
    type: DecisionDirectiveType;
    scope?: DecisionDirectiveScope;
    issuedBy: DecisionDirective["issuedBy"];
    targetRef: string;
    payload: TPayload;
    reason: string;
    riskAcknowledged?: boolean;
    expiresAt?: string;
  }): DecisionDirective<TPayload> {
    return createDecisionDirective<TPayload>(input);
  }

  /**
   * Send a DecisionDirective to the platform via API.
   */
  public async sendDecisionDirective<TResponse, TPayload = unknown>(
    directive: DecisionDirective<TPayload>,
  ): Promise<{ data: TResponse; status: number; headers: Record<string, string> }> {
    const envelope = this.client.createEnvelope(directive, { command: "decision_directive" }, 30000);
    return this.client.sendEnvelope<TResponse, DecisionDirective<TPayload>>("/directives/decision", envelope);
  }
}
