import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export interface GovernanceDelegationRevocationRequest {
  readonly delegationId: string;
  readonly requestedAtMs: number;
  readonly derivedResourceIds: readonly string[];
  readonly derivedDelegationIds?: readonly string[];
  /** Cascade scope: max depth for cascade operations or explicit sub-scope toggles. */
  readonly cascadeScope?: number | GovernanceDelegationCascadeScope;
}

export interface GovernanceDelegationCascadeScope {
  readonly pendingApprovals?: boolean;
  readonly activeSessions?: boolean;
  readonly secretLeases?: boolean;
  readonly workerLeases?: boolean;
  readonly scheduledTriggers?: boolean;
}

export interface GovernanceDelegationRevocationSagaContext {
  readonly delegationId: string;
  readonly failedStage: "prepare" | "commit" | "compensate" | "audit" | null;
}

export interface GovernanceDelegationRevocationSagaHandlers {
  readonly freezeResource?: (resourceId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokePendingApprovals?: (context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeActiveSessions?: (context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeSecretLeases?: (context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeWorkerLeases?: (context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeScheduledTriggers?: (context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeDerivedDelegation?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly compensateResource?: (resourceId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly audit?: (receipt: GovernanceDelegationRevocationReceipt, context: GovernanceDelegationRevocationSagaContext) => void;
}

export interface GovernanceDelegationRevocationReceipt {
  readonly delegationId: string;
  readonly status: "completed" | "compensated";
  readonly frozenResourceIds: readonly string[];
  readonly revokedDerivedDelegationIds: readonly string[];
  readonly revokeWithinSlo: boolean;
  readonly cascadeWithinSlo: boolean;
  /** Actual cascade depth applied (0 = no cascade, 1 = immediate, 2+ = transitive) */
  readonly cascadeDepthApplied: number;
  /** Max cascade depth that was permitted per request */
  readonly cascadeScopeRequested: number;
  readonly completedAtMs: number;
  readonly sagaStages: readonly ("prepare" | "commit" | "compensate" | "audit")[];
  readonly compensationResourceIds: readonly string[];
  readonly failedStage: "prepare" | "commit" | "compensate" | "audit" | null;
  readonly executionLog: readonly {
    readonly stage: "prepare" | "commit" | "compensate" | "audit";
    readonly subjectId: string;
    readonly outcome: "completed" | "failed";
  }[];
}

export class GovernanceDelegationRevocationSaga {
  public constructor(private readonly handlers: GovernanceDelegationRevocationSagaHandlers = {}) {}

  public revoke(
    request: GovernanceDelegationRevocationRequest,
    completedAtMs: number,
  ): GovernanceDelegationRevocationReceipt {
    const elapsed = completedAtMs - request.requestedAtMs;
    const frozenResourceIds: string[] = [];
    const revokedDerivedDelegationIds: string[] = [];
    const compensationResourceIds: string[] = [];
    const executionLog: Array<GovernanceDelegationRevocationReceipt["executionLog"][number]> = [];
    let failedStage: GovernanceDelegationRevocationReceipt["failedStage"] = null;
    const context = (): GovernanceDelegationRevocationSagaContext => ({
      delegationId: request.delegationId,
      failedStage,
    });
    // Cascade depth tracking: each level of derived delegation revoked increments depth
    let cascadeDepthApplied = 0;
    const cascadeScope = resolveCascadeScope(request.cascadeScope);
    const maxCascadeScope = typeof request.cascadeScope === "number" ? request.cascadeScope : 1;

    let currentStage: "prepare" | "commit" = "prepare";
    try {
      for (const resourceId of request.derivedResourceIds) {
        this.handlers.freezeResource?.(resourceId, context());
        frozenResourceIds.push(resourceId);
        executionLog.push({ stage: "prepare", subjectId: resourceId, outcome: "completed" });
      }

      const prepareCascadeSteps: ReadonlyArray<{
        enabled: boolean;
        subjectId: string;
        handler: ((context: GovernanceDelegationRevocationSagaContext) => void) | undefined;
      }> = [
        { enabled: cascadeScope.pendingApprovals, subjectId: "pendingApprovals", handler: this.handlers.revokePendingApprovals },
        { enabled: cascadeScope.activeSessions, subjectId: "activeSessions", handler: this.handlers.revokeActiveSessions },
        { enabled: cascadeScope.secretLeases, subjectId: "secretLeases", handler: this.handlers.revokeSecretLeases },
        { enabled: cascadeScope.workerLeases, subjectId: "workerLeases", handler: this.handlers.revokeWorkerLeases },
        { enabled: cascadeScope.scheduledTriggers, subjectId: "scheduledTriggers", handler: this.handlers.revokeScheduledTriggers },
      ];

      for (const step of prepareCascadeSteps) {
        if (!step.enabled) {
          continue;
        }
        step.handler?.(context());
        executionLog.push({ stage: "prepare", subjectId: step.subjectId, outcome: "completed" });
      }

      if (maxCascadeScope >= 1) {
        currentStage = "commit";
        for (const delegationId of request.derivedDelegationIds ?? []) {
          this.handlers.revokeDerivedDelegation?.(delegationId, context());
          revokedDerivedDelegationIds.push(delegationId);
          cascadeDepthApplied = Math.max(cascadeDepthApplied, 1);
          executionLog.push({ stage: "commit", subjectId: delegationId, outcome: "completed" });
        }
      }
    } catch (error) {
      failedStage = currentStage;
      logger.warn("governance delegation revocation saga stage failed", {
        delegationId: request.delegationId,
        stage: currentStage,
        error: error instanceof Error ? error.message : String(error),
      });
      executionLog.push({
        stage: failedStage,
        subjectId: revokedDerivedDelegationIds.at(-1) ?? frozenResourceIds.at(-1) ?? request.delegationId,
        outcome: "failed",
      });
    }

    if (failedStage != null || elapsed > 300_000) {
      for (const resourceId of [...frozenResourceIds].reverse()) {
        this.handlers.compensateResource?.(resourceId, context());
        compensationResourceIds.push(resourceId);
        executionLog.push({ stage: "compensate", subjectId: resourceId, outcome: "completed" });
      }
    }

    const receipt: GovernanceDelegationRevocationReceipt = {
      delegationId: request.delegationId,
      status: compensationResourceIds.length > 0 ? "compensated" : "completed",
      frozenResourceIds,
      revokedDerivedDelegationIds,
      revokeWithinSlo: elapsed <= 60_000,
      cascadeWithinSlo: failedStage == null && elapsed <= 300_000 && (maxCascadeScope === 0 || (cascadeDepthApplied > 0 && cascadeDepthApplied <= maxCascadeScope)),
      cascadeDepthApplied,
      cascadeScopeRequested: maxCascadeScope,
      completedAtMs,
      sagaStages: compensationResourceIds.length > 0
        ? ["prepare", "commit", "compensate", "audit"]
        : ["prepare", "commit", "audit"],
      compensationResourceIds,
      failedStage,
      executionLog,
    };
    this.handlers.audit?.(receipt, context());
    executionLog.push({ stage: "audit", subjectId: request.delegationId, outcome: "completed" });
    return {
      ...receipt,
      executionLog,
    };
  }
}

function resolveCascadeScope(
  scope: GovernanceDelegationRevocationRequest["cascadeScope"],
): Required<GovernanceDelegationCascadeScope> {
  if (typeof scope === "number") {
    return {
      pendingApprovals: scope >= 1,
      activeSessions: scope >= 1,
      secretLeases: scope >= 1,
      workerLeases: scope >= 1,
      scheduledTriggers: scope >= 1,
    };
  }
  return {
    pendingApprovals: scope?.pendingApprovals ?? true,
    activeSessions: scope?.activeSessions ?? true,
    secretLeases: scope?.secretLeases ?? true,
    workerLeases: scope?.workerLeases ?? true,
    scheduledTriggers: scope?.scheduledTriggers ?? true,
  };
}
