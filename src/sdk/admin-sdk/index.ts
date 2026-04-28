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
}
