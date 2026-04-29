import type { ApiClientConfig } from "../client-sdk/api-client.js";
import { RetryableApiClient, createApiClient } from "../client-sdk/api-client.js";
import {
  createOperationalDirective,
  createDecisionDirective,
  type OperationalDirectiveType,
  type DecisionDirectiveType,
} from "../../platform/contracts/control-directive/index.js";

export interface AdminSdkConfig extends ApiClientConfig {}

/**
 * Directive input for pauseHarnessRun
 */
export interface PauseHarnessRunDirectiveInput {
  readonly harnessRunId: string;
  readonly reason: string;
  readonly issuedBy: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
  };
}

/**
 * Directive input for abortHarnessRun
 */
export interface AbortHarnessRunDirectiveInput {
  readonly harnessRunId: string;
  readonly reason: string;
  readonly issuedBy: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
  };
}

/**
 * Tenant management input
 */
export interface TenantInput {
  readonly tenantId: string;
  readonly name: string;
  readonly displayName?: string;
  readonly status: "active" | "suspended" | "deleted";
  readonly metadata?: Record<string, unknown>;
}

/**
 * Policy management input
 */
export interface PolicyInput {
  readonly policyId: string;
  readonly name: string;
  readonly description?: string;
  readonly effect: "allow" | "deny";
  readonly actions: readonly string[];
  readonly resources: readonly string[];
  readonly conditions?: Record<string, unknown>;
  readonly priority: number;
}

/**
 * Domain lifecycle input
 */
export interface DomainLifecycleInput {
  readonly domainId: string;
  readonly action: "activate" | "deactivate" | "suspend" | "resume";
  readonly reason?: string;
}

/**
 * Rollout control input
 */
export interface RolloutInput {
  readonly rolloutId: string;
  readonly name: string;
  readonly targetType: "domain" | "plugin" | "feature" | "tenant_group";
  readonly targetId: string;
  readonly strategy: "canary" | "rolling" | "blue_green" | "immediate";
  readonly percentage: number;
  readonly status: "pending" | "in_progress" | "paused" | "completed" | "cancelled";
}

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

  /**
   * Issue an OperationalDirective to pause a harness run.
   * Per §4.3, uses the directive envelope model instead of direct API call.
   */
  public pauseHarnessRun(directive: PauseHarnessRunDirectiveInput): ReturnType<typeof createOperationalDirective> {
    return createOperationalDirective({
      type: "pause",
      scope: { harnessRunId: directive.harnessRunId },
      issuedBy: directive.issuedBy,
      reason: directive.reason,
    });
  }

  /**
   * Issue an OperationalDirective to abort a harness run.
   * Per §4.3, uses the directive envelope model instead of direct API call.
   */
  public abortHarnessRun(directive: AbortHarnessRunDirectiveInput): ReturnType<typeof createOperationalDirective> {
    return createOperationalDirective({
      type: "kill",
      scope: { harnessRunId: directive.harnessRunId },
      issuedBy: directive.issuedBy,
      reason: directive.reason,
    });
  }

  /**
   * Issue a DecisionDirective for approval decisions.
   * Per §4.3, uses the directive envelope model.
   */
  public issueDecisionDirective(directive: {
    readonly type: DecisionDirectiveType;
    readonly targetRef: string;
    readonly payload: unknown;
    readonly reason: string;
    readonly issuedBy: {
      readonly principalId: string;
      readonly tenantId: string;
      readonly roles: readonly string[];
      readonly displayName?: string;
    };
    readonly riskAcknowledged?: boolean;
  }): ReturnType<typeof createDecisionDirective> {
    return createDecisionDirective({
      type: directive.type,
      scope: {},
      issuedBy: directive.issuedBy,
      targetRef: directive.targetRef,
      payload: directive.payload,
      reason: directive.reason,
      riskAcknowledged: directive.riskAcknowledged,
    });
  }

  /**
   * Issue an OperationalDirective with custom parameters.
   * Per §4.3, uses the directive envelope model.
   */
  public issueOperationalDirective<TParams extends Record<string, unknown>>(directive: {
    readonly type: OperationalDirectiveType;
    readonly scope?: {
      readonly tenantId?: string;
      readonly harnessRunId?: string;
      readonly nodeRunId?: string;
      readonly workerId?: string;
    };
    readonly issuedBy: {
      readonly principalId: string;
      readonly tenantId: string;
      readonly roles: readonly string[];
    };
    readonly reason: string;
    readonly params?: TParams;
    readonly expiresAt?: string;
  }): ReturnType<typeof createOperationalDirective<TParams>> {
    return createOperationalDirective<TParams>({
      type: directive.type,
      scope: directive.scope,
      issuedBy: directive.issuedBy,
      reason: directive.reason,
      params: directive.params,
      expiresAt: directive.expiresAt,
    });
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

  // --- Tenant Management ---

  public listTenants<T>() {
    return this.client.getPaginated<T>("/tenants");
  }

  public getTenant<T>(tenantId: string) {
    return this.client.get<T>(`/tenants/${encodeURIComponent(tenantId)}`);
  }

  public createTenant<T>(body: TenantInput) {
    return this.client.post<T>("/tenants", body);
  }

  public updateTenant<T>(tenantId: string, body: Partial<TenantInput>) {
    return this.client.patch<T>(`/tenants/${encodeURIComponent(tenantId)}`, body);
  }

  public deleteTenant<T>(tenantId: string) {
    return this.client.delete<T>(`/tenants/${encodeURIComponent(tenantId)}`);
  }

  public suspendTenant<T>(tenantId: string, reason: string) {
    return this.client.post<T>(`/tenants/${encodeURIComponent(tenantId)}/suspend`, { reason });
  }

  public resumeTenant<T>(tenantId: string) {
    return this.client.post<T>(`/tenants/${encodeURIComponent(tenantId)}/resume`, {});
  }

  // --- Policy Management ---

  public listPolicies<T>() {
    return this.client.getPaginated<T>("/policies");
  }

  public getPolicy<T>(policyId: string) {
    return this.client.get<T>(`/policies/${encodeURIComponent(policyId)}`);
  }

  public createPolicy<T>(body: PolicyInput) {
    return this.client.post<T>("/policies", body);
  }

  public updatePolicy<T>(policyId: string, body: Partial<PolicyInput>) {
    return this.client.patch<T>(`/policies/${encodeURIComponent(policyId)}`, body);
  }

  public deletePolicy<T>(policyId: string) {
    return this.client.delete<T>(`/policies/${encodeURIComponent(policyId)}`);
  }

  public attachPolicy<T>(targetType: string, targetId: string, policyId: string) {
    return this.client.post<T>(`/policies/attachments`, { targetType, targetId, policyId });
  }

  public detachPolicy<T>(targetType: string, targetId: string, policyId: string) {
    return this.client.delete<T>(`/policies/attachments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}&policyId=${encodeURIComponent(policyId)}`);
  }

  public listPolicyAttachments<T>(policyId: string) {
    return this.client.getPaginated<T>(`/policies/${encodeURIComponent(policyId)}/attachments`);
  }

  // --- Domain Lifecycle ---

  public activateDomain<T>(domainId: string, reason?: string) {
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/lifecycle/activate`, { reason });
  }

  public deactivateDomain<T>(domainId: string, reason?: string) {
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/lifecycle/deactivate`, { reason });
  }

  public suspendDomain<T>(domainId: string, reason: string) {
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/lifecycle/suspend`, { reason });
  }

  public resumeDomain<T>(domainId: string) {
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/lifecycle/resume`, {});
  }

  public getDomainStatus<T>(domainId: string) {
    return this.client.get<T>(`/domains/${encodeURIComponent(domainId)}/lifecycle/status`);
  }

  // --- Rollout Control ---

  public listRollouts<T>() {
    return this.client.getPaginated<T>("/rollouts");
  }

  public getRollout<T>(rolloutId: string) {
    return this.client.get<T>(`/rollouts/${encodeURIComponent(rolloutId)}`);
  }

  public createRollout<T>(body: RolloutInput) {
    return this.client.post<T>("/rollouts", body);
  }

  public updateRollout<T>(rolloutId: string, body: Partial<RolloutInput>) {
    return this.client.patch<T>(`/rollouts/${encodeURIComponent(rolloutId)}`, body);
  }

  public pauseRollout<T>(rolloutId: string, reason?: string) {
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/pause`, { reason });
  }

  public resumeRollout<T>(rolloutId: string) {
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/resume`, {});
  }

  public cancelRollout<T>(rolloutId: string, reason?: string) {
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/cancel`, { reason });
  }

  public getRolloutStatus<T>(rolloutId: string) {
    return this.client.get<T>(`/rollouts/${encodeURIComponent(rolloutId)}/status`);
  }

  public rollbackRollout<T>(rolloutId: string) {
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/rollback`, {});
  }

  public advanceRolloutPercentage<T>(rolloutId: string, targetPercentage: number) {
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/advance`, { targetPercentage });
  }
}
