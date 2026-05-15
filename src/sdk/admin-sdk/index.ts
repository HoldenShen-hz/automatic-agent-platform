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
import { ValidationError } from "../../platform/contracts/errors.js";
import { z } from "zod";

// R31-38 FIX: Input validation schema for registerDomain
const registerDomainSchema = z.object({
  domainId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
}).refine((value) => (value.displayName ?? value.name)?.trim().length !== 0, {
  message: "displayName or name is required",
  path: ["displayName"],
}).transform((value) => ({
  domainId: value.domainId,
  displayName: value.displayName ?? value.name!,
  description: value.description,
  version: value.version,
  capabilities: value.capabilities,
}));

function encodePathPreservingSlashes(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export interface AdminSdkConfig extends ApiClientConfig {
  /** R31-39 FIX: Legacy role field retained for compatibility. */
  requiredRole?: string;
  principal?: {
    readonly principalId?: string;
    readonly subject?: string;
    readonly tenantId?: string;
    readonly roles?: readonly string[];
    readonly permissions?: readonly string[];
  };
}

function normalizeAdminSdkPrincipal(config: AdminSdkConfig): NonNullable<ApiClientConfig["principal"]> {
  const roles = config.principal?.roles ?? (config.requiredRole ? [config.requiredRole] : []);
  const tenantId = config.principal?.tenantId ?? config.tenantId;
  return {
    subject: config.principal?.principalId ?? config.principal?.subject ?? "admin-sdk",
    roles,
    ...(tenantId != null ? { tenantId } : {}),
  };
}

const ADMIN_ROLE_ALLOWLIST = new Set(["admin", "operator"]);
const ADMIN_PERMISSION_WILDCARDS = new Set(["admin:*", "platform:admin"]);

function normalizeValues(values: readonly string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function hasAdminRole(config: AdminSdkConfig): boolean {
  const roles = new Set(normalizeValues(config.principal?.roles));
  const legacyRole = config.requiredRole?.trim();
  if (legacyRole != null && legacyRole.length > 0) {
    roles.add(legacyRole);
  }
  return [...roles].some((role) => ADMIN_ROLE_ALLOWLIST.has(role));
}

function hasAdminPermission(config: AdminSdkConfig, requiredPermissions: readonly string[]): boolean {
  const permissions = new Set(normalizeValues(config.principal?.permissions));
  if ([...permissions].some((permission) => ADMIN_PERMISSION_WILDCARDS.has(permission))) {
    return true;
  }
  return requiredPermissions.some((permission) => permissions.has(permission));
}

function assertAdminAccess(config: AdminSdkConfig, operation: string, requiredPermissions: readonly string[]): void {
  if (hasAdminRole(config) || hasAdminPermission(config, requiredPermissions)) {
    return;
  }
  throw new ValidationError(
    "admin_sdk.permission_denied",
    `admin_sdk.permission_denied: ${operation} requires admin authorization`,
    {
      details: {
        operation,
        requiredPermissions: [...requiredPermissions],
      },
    },
  );
}

// R8-23 FIX: Operational and Decision directive types for admin operations
export type { OperationalDirective, OperationalDirectiveType, OperationalDirectiveScope };
export type { DecisionDirective, DecisionDirectiveType, DecisionDirectiveScope };

export class AdminSdk {
  private readonly client: RetryableApiClient;
  private readonly config: AdminSdkConfig;

  public constructor(config: AdminSdkConfig) {
    const normalizedConfig: AdminSdkConfig = {
      ...config,
      platformVersion: config.platformVersion ?? "v4.3",
      sdkVersion: config.sdkVersion ?? "1.0.0",
      principal: config.principal ?? normalizeAdminSdkPrincipal(config),
    };
    this.client = createApiClient({
      ...normalizedConfig,
      principal: normalizeAdminSdkPrincipal(normalizedConfig),
    });
    this.config = normalizedConfig;
  }

  public listDomains<T>() {
    assertAdminAccess(this.config, "listDomains", ["admin:domains:read"]);
    return this.client.getPaginated<T>("/domains");
  }

  public registerDomain<T>(body: unknown) {
    assertAdminAccess(this.config, "registerDomain", ["admin:domains:write"]);
    // R31-38 FIX: Validate input with Zod schema
    const parseResult = registerDomainSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError(
        "admin_sdk.invalid_input",
        `registerDomain validation failed: ${parseResult.error.message}`,
        { details: { errors: parseResult.error.errors } }
      );
    }
    return this.client.post<T>("/domains", parseResult.data);
  }

  public publishPack<T>(packId: string, body: unknown) {
    assertAdminAccess(this.config, "publishPack", ["admin:packs:publish"]);
    return this.client.publishPack<T>(packId, body);
  }

  public activateDomain<T>(domainId: string, reason?: string) {
    assertAdminAccess(this.config, "activateDomain", ["admin:domains:write"]);
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/activate`, reason ? { reason } : {});
  }

  public deactivateDomain<T>(domainId: string, reason?: string) {
    assertAdminAccess(this.config, "deactivateDomain", ["admin:domains:write"]);
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/deactivate`, reason ? { reason } : {});
  }

  public suspendDomain<T>(domainId: string, reason?: string) {
    assertAdminAccess(this.config, "suspendDomain", ["admin:domains:write"]);
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/suspend`, reason ? { reason } : {});
  }

  public resumeDomain<T>(domainId: string) {
    assertAdminAccess(this.config, "resumeDomain", ["admin:domains:write"]);
    return this.client.post<T>(`/domains/${encodeURIComponent(domainId)}/resume`, {});
  }

  public getDomainStatus<T>(domainId: string) {
    assertAdminAccess(this.config, "getDomainStatus", ["admin:domains:read"]);
    return this.client.get<T>(`/domains/${encodeURIComponent(domainId)}/status`);
  }

  public pauseHarnessRun<T>(runId: string, reason?: string): Promise<{ data: T; status: number; headers: Record<string, string> }>;
  public pauseHarnessRun(input: {
    harnessRunId: string;
    reason: string;
    issuedBy: OperationalDirective["issuedBy"];
  }): OperationalDirective;
  public pauseHarnessRun<T>(
    inputOrRunId:
      | string
      | {
          harnessRunId: string;
          reason: string;
          issuedBy: OperationalDirective["issuedBy"];
        },
    reason?: string,
  ) {
    assertAdminAccess(this.config, "pauseHarnessRun", ["admin:harness_runs:control"]);
    if (typeof inputOrRunId === "string") {
      return this.client.pauseHarnessRun<T>(inputOrRunId, reason);
    }
    return createOperationalDirective({
      type: "pause",
      scope: { harnessRunId: inputOrRunId.harnessRunId },
      issuedBy: inputOrRunId.issuedBy,
      reason: inputOrRunId.reason,
    });
  }

  public abortHarnessRun<T>(runId: string, reason?: string): Promise<{ data: T; status: number; headers: Record<string, string> }>;
  public abortHarnessRun(input: {
    harnessRunId: string;
    reason: string;
    issuedBy: OperationalDirective["issuedBy"];
  }): OperationalDirective;
  public abortHarnessRun<T>(
    inputOrRunId:
      | string
      | {
          harnessRunId: string;
          reason: string;
          issuedBy: OperationalDirective["issuedBy"];
        },
    reason?: string,
  ) {
    assertAdminAccess(this.config, "abortHarnessRun", ["admin:harness_runs:control"]);
    if (typeof inputOrRunId === "string") {
      return this.client.abortHarnessRun<T>(inputOrRunId, reason);
    }
    return createOperationalDirective({
      type: "kill",
      scope: { harnessRunId: inputOrRunId.harnessRunId },
      issuedBy: inputOrRunId.issuedBy,
      reason: inputOrRunId.reason,
    });
  }

  public resumeHarnessRun(runId: string, issuedBy: OperationalDirective["issuedBy"]) {
    assertAdminAccess(this.config, "resumeHarnessRun", ["admin:harness_runs:control"]);
    return createOperationalDirective({
      type: "resume",
      scope: { harnessRunId: runId },
      issuedBy,
      reason: "Resume harness run",
    });
  }

  public triggerPanic<T>(body: unknown) {
    assertAdminAccess(this.config, "triggerPanic", ["admin:panic:manage"]);
    return this.client.post<T>("/panic/trigger", body);
  }

  public resumePanic<T>(scope: string, body: unknown) {
    assertAdminAccess(this.config, "resumePanic", ["admin:panic:manage"]);
    return this.client.post<T>(`/panic/${encodeURIComponent(scope)}/resume`, body);
  }

  public manageAgentLifecycle<T>(agentId: string, action: string, body?: unknown) {
    assertAdminAccess(this.config, "manageAgentLifecycle", ["admin:agents:lifecycle"]);
    return this.client.post<T>(`/agents/${encodeURIComponent(agentId)}/${action}`, body ?? {});
  }

  public rotateSecrets<T>(body: unknown) {
    assertAdminAccess(this.config, "rotateSecrets", ["admin:secrets:rotate"]);
    return this.client.post<T>("/secrets/rotate", body);
  }

  // =============================================================================
  // Tenant Management Operations
  // =============================================================================

  /**
   * Create a new tenant.
   */
  public createTenant<T>(body: unknown) {
    assertAdminAccess(this.config, "createTenant", ["admin:tenants:create"]);
    return this.client.post<T>("/tenants", body);
  }

  /**
   * Get tenant details by ID.
   */
  public getTenant<T>(tenantId: string) {
    assertAdminAccess(this.config, "getTenant", ["admin:tenants:read"]);
    return this.client.get<T>(`/tenants/${encodeURIComponent(tenantId)}`);
  }

  /**
   * List all tenants with optional filtering.
   */
  public listTenants<T>(query?: { cursor?: string; limit?: number; status?: string }) {
    assertAdminAccess(this.config, "listTenants", ["admin:tenants:read"]);
    return this.client.getPaginated<T>("/tenants", query);
  }

  /**
   * Update tenant configuration.
   */
  public updateTenant<T>(tenantId: string, body: unknown) {
    assertAdminAccess(this.config, "updateTenant", ["admin:tenants:update"]);
    return this.client.patch<T>(`/tenants/${encodeURIComponent(tenantId)}`, body);
  }

  /**
   * Delete a tenant (soft delete).
   */
  public deleteTenant<T>(tenantId: string) {
    assertAdminAccess(this.config, "deleteTenant", ["admin:tenants:delete"]);
    return this.client.delete<T>(`/tenants/${encodeURIComponent(tenantId)}`);
  }

  /**
   * Activate a suspended tenant.
   */
  public activateTenant<T>(tenantId: string) {
    assertAdminAccess(this.config, "activateTenant", ["admin:tenants:activate"]);
    return this.client.post<T>(`/tenants/${encodeURIComponent(tenantId)}/activate`, {});
  }

  /**
   * Suspend an active tenant.
   */
  public suspendTenant<T>(tenantId: string, reason?: string) {
    assertAdminAccess(this.config, "suspendTenant", ["admin:tenants:suspend"]);
    return this.client.post<T>(`/tenants/${encodeURIComponent(tenantId)}/suspend`, { reason });
  }

  /**
   * Resume a suspended tenant.
   */
  public resumeTenant<T>(tenantId: string) {
    assertAdminAccess(this.config, "resumeTenant", ["admin:tenants:activate"]);
    return this.client.post<T>(`/tenants/${encodeURIComponent(tenantId)}/resume`, {});
  }

  // =============================================================================
  // Configuration Management Operations
  // =============================================================================

  /**
   * Get configuration value(s) by key pattern.
   */
  public getConfig<T>(configKey?: string, tenantId?: string) {
    assertAdminAccess(this.config, "getConfig", ["admin:config:read"]);
    const path = configKey == null ? "/config" : `/config/${encodePathPreservingSlashes(configKey)}`;
    return this.client.get<T>(tenantId ? `${path}?tenantId=${encodeURIComponent(tenantId)}` : path);
  }

  /**
   * List configurations with optional filtering.
   */
  public listConfigs<T>(query?: { scope?: string; tenantId?: string; cursor?: string; limit?: number }) {
    assertAdminAccess(this.config, "listConfigs", ["admin:config:read"]);
    return this.client.getPaginated<T>("/config", query);
  }

  /**
   * Set a configuration value.
   */
  public setConfig<T>(configKey: string, body: unknown) {
    assertAdminAccess(this.config, "setConfig", ["admin:config:write"]);
    return this.client.put<T>(`/config/${encodePathPreservingSlashes(configKey)}`, body);
  }

  /**
   * Update a configuration value (partial update).
   */
  public updateConfig<T>(configKey: string, body: unknown) {
    assertAdminAccess(this.config, "updateConfig", ["admin:config:write"]);
    return this.client.patch<T>(`/config/${encodePathPreservingSlashes(configKey)}`, body);
  }

  /**
   * Delete a configuration entry.
   */
  public deleteConfig<T>(configKey: string) {
    assertAdminAccess(this.config, "deleteConfig", ["admin:config:delete"]);
    return this.client.delete<T>(`/config/${encodePathPreservingSlashes(configKey)}`);
  }

  public listPolicies<T>(query?: { cursor?: string; limit?: number; tenantId?: string; effect?: string }) {
    assertAdminAccess(this.config, "listPolicies", ["admin:policy:read"]);
    return this.client.getPaginated<T>("/policies", query);
  }

  public getPolicy<T>(policyId: string) {
    assertAdminAccess(this.config, "getPolicy", ["admin:policy:read"]);
    return this.client.get<T>(`/policies/${encodeURIComponent(policyId)}`);
  }

  public createPolicy<T>(body: unknown) {
    assertAdminAccess(this.config, "createPolicy", ["admin:policy:write"]);
    return this.client.post<T>("/policies", body);
  }

  public updatePolicy<T>(policyId: string, body: unknown) {
    assertAdminAccess(this.config, "updatePolicy", ["admin:policy:write"]);
    return this.client.patch<T>(`/policies/${encodeURIComponent(policyId)}`, body);
  }

  public deletePolicy<T>(policyId: string) {
    assertAdminAccess(this.config, "deletePolicy", ["admin:policy:write"]);
    return this.client.delete<T>(`/policies/${encodeURIComponent(policyId)}`);
  }

  public attachPolicy<T>(targetType: string, targetId: string, policyId: string) {
    assertAdminAccess(this.config, "attachPolicy", ["admin:policy:write"]);
    return this.client.post<T>(`/policies/${encodeURIComponent(policyId)}/attachments`, { targetType, targetId });
  }

  public detachPolicy<T>(targetType: string, targetId: string, policyId: string) {
    assertAdminAccess(this.config, "detachPolicy", ["admin:policy:write"]);
    return this.client.post<T>(`/policies/${encodeURIComponent(policyId)}/attachments/detach`, { targetType, targetId });
  }

  public listPolicyAttachments<T>(policyId: string, query?: { cursor?: string; limit?: number }) {
    assertAdminAccess(this.config, "listPolicyAttachments", ["admin:policy:read"]);
    return this.client.getPaginated<T>(`/policies/${encodeURIComponent(policyId)}/attachments`, query);
  }

  /**
   * List configuration revisions for a key.
   */
  public listConfigRevisions<T>(configKey: string, query?: { cursor?: string; limit?: number }) {
    assertAdminAccess(this.config, "listConfigRevisions", ["admin:config:read"]);
    return this.client.getPaginated<T>(`/config/${encodePathPreservingSlashes(configKey)}/revisions`, query);
  }

  /**
   * Rollback configuration to a specific revision.
   */
  public rollbackConfig<T>(configKey: string, revisionId: string) {
    assertAdminAccess(this.config, "rollbackConfig", ["admin:config:write"]);
    return this.client.post<T>(`/config/${encodePathPreservingSlashes(configKey)}/rollback`, { revisionId });
  }

  // =============================================================================
  // Audit Access/Logging Operations
  // =============================================================================

  /**
   * Query audit logs with filtering criteria.
   */
  public queryAuditLogs<T>(query?: {
    tenantId?: string;
    principalId?: string;
    action?: string;
    resource?: string;
    startTime?: string;
    endTime?: string;
    cursor?: string;
    limit?: number;
  }) {
    assertAdminAccess(this.config, "queryAuditLogs", ["admin:audit:read"]);
    return this.client.getPaginated<T>("/audit/logs", query);
  }

  /**
   * Get a specific audit log entry by ID.
   */
  public getAuditLog<T>(auditId: string) {
    assertAdminAccess(this.config, "getAuditLog", ["admin:audit:read"]);
    return this.client.get<T>(`/audit/logs/${encodeURIComponent(auditId)}`);
  }

  /**
   * Export audit logs to a specified destination.
   */
  public exportAuditLogs<T>(body: unknown) {
    assertAdminAccess(this.config, "exportAuditLogs", ["admin:audit:export"]);
    return this.client.post<T>("/audit/export", body);
  }

  /**
   * Get audit statistics and metrics.
   */
  public getAuditStats<T>(query?: { tenantId?: string; startTime?: string; endTime?: string }) {
    assertAdminAccess(this.config, "getAuditStats", ["admin:audit:read"]);
    return this.client.get<T>("/audit/stats", query);
  }

  /**
   * Archive audit logs older than a specified retention period.
   */
  public archiveAuditLogs<T>(body: unknown) {
    assertAdminAccess(this.config, "archiveAuditLogs", ["admin:audit:archive"]);
    return this.client.post<T>("/audit/archive", body);
  }

  public listAuditLogs<T>(
    tenantId: string,
    query?: {
      limit?: number;
      cursor?: string;
      principalId?: string;
      action?: string;
      fromTimestamp?: string;
      toTimestamp?: string;
    },
  ) {
    assertAdminAccess(this.config, "listAuditLogs", ["admin:audit:read"]);
    return this.client.get<T[]>("/audit/logs", {
      tenantId,
      limit: query?.limit,
      cursor: query?.cursor,
      principalId: query?.principalId,
      action: query?.action,
      fromTimestamp: query?.fromTimestamp,
      toTimestamp: query?.toTimestamp,
    });
  }

  public getAuditEntry<T>(auditId: string) {
    assertAdminAccess(this.config, "getAuditEntry", ["admin:audit:read"]);
    return this.client.get<T>(`/audit/logs/${encodeURIComponent(auditId)}`);
  }

  public async bulkCreateTenants<T>(tenants: readonly unknown[]) {
    assertAdminAccess(this.config, "bulkCreateTenants", ["admin:tenants:create"]);
    const response = await this.client.post<{ successes: T[]; failures: unknown[] }>("/tenants/bulk", { tenants });
    return response.data;
  }

  public async bulkUpdateTenants<T>(updates: readonly unknown[]) {
    assertAdminAccess(this.config, "bulkUpdateTenants", ["admin:tenants:update"]);
    const response = await this.client.patch<{ successes: T[]; failures: unknown[] }>("/tenants/bulk", { updates });
    return response.data;
  }

  public async bulkDeleteTenants<T>(tenantIds: readonly string[]) {
    assertAdminAccess(this.config, "bulkDeleteTenants", ["admin:tenants:delete"]);
    const response = await this.client.post<{ successes: T[]; failures: unknown[] }>("/tenants/bulk-delete", {
      tenantIds,
    });
    return response.data;
  }

  public async bulkCreatePolicies<T>(policies: readonly unknown[]) {
    assertAdminAccess(this.config, "bulkCreatePolicies", ["admin:policy:write"]);
    const response = await this.client.post<{ successes: T[]; failures: unknown[] }>("/policies/bulk", { policies });
    return response.data;
  }

  public async bulkAttachPolicies<T>(
    attachments: readonly { targetType: string; targetId: string; policyId: string }[],
  ) {
    assertAdminAccess(this.config, "bulkAttachPolicies", ["admin:policy:write"]);
    const response = await this.client.post<{ successes: T[]; failures: unknown[] }>(
      "/policies/attachments/bulk",
      { attachments },
    );
    return response.data;
  }

  public async bulkDomainLifecycle<T>(
    operations: readonly { domainId: string; action: string; reason?: string }[],
  ) {
    assertAdminAccess(this.config, "bulkDomainLifecycle", ["admin:domains:write"]);
    const response = await this.client.post<{ successes: T[]; failures: unknown[] }>("/domains/lifecycle/bulk", {
      operations,
    });
    return response.data;
  }

  public listWorkers<T = unknown>(tenantId?: string) {
    assertAdminAccess(this.config, "listWorkers", ["admin:workers:read"]);
    return this.client.get<T[]>("/workers", tenantId == null ? undefined : { tenantId });
  }

  public listRollouts<T>(query?: { cursor?: string; limit?: number; status?: string }) {
    assertAdminAccess(this.config, "listRollouts", ["admin:rollouts:read"]);
    return this.client.getPaginated<T>("/rollouts", query);
  }

  public getRollout<T>(rolloutId: string) {
    assertAdminAccess(this.config, "getRollout", ["admin:rollouts:read"]);
    return this.client.get<T>(`/rollouts/${encodeURIComponent(rolloutId)}`);
  }

  public createRollout<T>(body: unknown) {
    assertAdminAccess(this.config, "createRollout", ["admin:rollouts:write"]);
    return this.client.post<T>("/rollouts", body);
  }

  public updateRollout<T>(rolloutId: string, body: unknown) {
    assertAdminAccess(this.config, "updateRollout", ["admin:rollouts:write"]);
    return this.client.patch<T>(`/rollouts/${encodeURIComponent(rolloutId)}`, body);
  }

  public pauseRollout<T>(rolloutId: string, reason?: string) {
    assertAdminAccess(this.config, "pauseRollout", ["admin:rollouts:write"]);
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/pause`, reason ? { reason } : {});
  }

  public resumeRollout<T>(rolloutId: string) {
    assertAdminAccess(this.config, "resumeRollout", ["admin:rollouts:write"]);
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/resume`, {});
  }

  public cancelRollout<T>(rolloutId: string, reason?: string) {
    assertAdminAccess(this.config, "cancelRollout", ["admin:rollouts:write"]);
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/cancel`, reason ? { reason } : {});
  }

  public getRolloutStatus<T>(rolloutId: string) {
    assertAdminAccess(this.config, "getRolloutStatus", ["admin:rollouts:read"]);
    return this.client.get<T>(`/rollouts/${encodeURIComponent(rolloutId)}/status`);
  }

  public rollbackRollout<T>(rolloutId: string) {
    assertAdminAccess(this.config, "rollbackRollout", ["admin:rollouts:write"]);
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/rollback`, {});
  }

  public advanceRolloutPercentage<T>(rolloutId: string, percentage: number) {
    assertAdminAccess(this.config, "advanceRolloutPercentage", ["admin:rollouts:write"]);
    return this.client.post<T>(`/rollouts/${encodeURIComponent(rolloutId)}/advance`, { percentage });
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
    assertAdminAccess(this.config, "sendOperationalDirective", ["admin:directives:send"]);
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
    assertAdminAccess(this.config, "sendDecisionDirective", ["admin:directives:send"]);
    const envelope = this.client.createEnvelope(directive, { command: "decision_directive" }, 30000);
    return this.client.sendEnvelope<TResponse, DecisionDirective<TPayload>>("/directives/decision", envelope);
  }
}
