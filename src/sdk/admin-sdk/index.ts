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
  displayName: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
});

export interface AdminSdkConfig extends ApiClientConfig {
  /** R31-39 FIX: Legacy role field retained for compatibility. */
  requiredRole?: string;
  principal?: {
    readonly principalId?: string;
    readonly tenantId?: string;
    readonly roles?: readonly string[];
    readonly permissions?: readonly string[];
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
    this.client = createApiClient(config);
    this.config = config;
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

  public pauseHarnessRun<T>(runId: string, reason?: string) {
    assertAdminAccess(this.config, "pauseHarnessRun", ["admin:harness_runs:control"]);
    return this.client.pauseHarnessRun<T>(runId, reason);
  }

  public abortHarnessRun<T>(runId: string, reason?: string) {
    assertAdminAccess(this.config, "abortHarnessRun", ["admin:harness_runs:control"]);
    return this.client.abortHarnessRun<T>(runId, reason);
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
