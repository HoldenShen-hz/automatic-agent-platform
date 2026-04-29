export interface GovernanceDelegationRevocationRequest {
  readonly delegationId: string;
  readonly requestedAtMs: number;
  readonly derivedResourceIds: readonly string[];
  readonly derivedDelegationIds?: readonly string[];
  readonly cascadeScope?: GovernanceDelegationCascadeScope;
}

export interface GovernanceDelegationCascadeScope {
  readonly pendingApprovals: boolean;
  readonly activeSessions: boolean;
  readonly secretLeases: boolean;
  readonly workerLeases: boolean;
  readonly scheduledTriggers: boolean;
}

export interface GovernanceDelegationRevocationSagaContext {
  readonly delegationId: string;
  readonly failedStage: "prepare" | "commit" | "compensate" | "audit" | null;
}

export interface GovernanceDelegationRevocationSagaHandlers {
  readonly freezeResource?: (resourceId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokePendingApprovals?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeActiveSessions?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeSecretLeases?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeWorkerLeases?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeScheduledTriggers?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly revokeDerivedDelegation?: (delegationId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly compensateResource?: (resourceId: string, context: GovernanceDelegationRevocationSagaContext) => void;
  readonly audit?: (receipt: GovernanceDelegationRevocationReceipt, context: GovernanceDelegationRevocationSagaContext) => void;
}

export interface GovernanceDelegationRevocationReceipt {
  readonly delegationId: string;
  readonly status: "completed" | "compensated";
  readonly frozenResourceIds: readonly string[];
  readonly revokedPendingApprovals: readonly string[];
  readonly revokedActiveSessions: readonly string[];
  readonly revokedSecretLeases: readonly string[];
  readonly revokedWorkerLeases: readonly string[];
  readonly revokedScheduledTriggers: readonly string[];
  readonly revokedDerivedDelegationIds: readonly string[];
  readonly revokeWithinSlo: boolean;
  readonly cascadeWithinSlo: boolean;
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

const DEFAULT_CASCADE_SCOPE: GovernanceDelegationCascadeScope = {
  pendingApprovals: true,
  activeSessions: true,
  secretLeases: true,
  workerLeases: true,
  scheduledTriggers: true,
};

// Revocation SLO thresholds (in milliseconds)
const REVOKE_SLO_MS = 60_000;
const CASCADE_SLO_MS = 300_000;

export class GovernanceDelegationRevocationSaga {
  public constructor(private readonly handlers: GovernanceDelegationRevocationSagaHandlers = {}) {}

  public revoke(
    request: GovernanceDelegationRevocationRequest,
    completedAtMs: number,
  ): GovernanceDelegationRevocationReceipt {
    const elapsed = completedAtMs - request.requestedAtMs;
    const cascadeScope = request.cascadeScope ?? DEFAULT_CASCADE_SCOPE;
    const frozenResourceIds: string[] = [];
    const revokedPendingApprovals: string[] = [];
    const revokedActiveSessions: string[] = [];
    const revokedSecretLeases: string[] = [];
    const revokedWorkerLeases: string[] = [];
    const revokedScheduledTriggers: string[] = [];
    const revokedDerivedDelegationIds: string[] = [];
    const compensationResourceIds: string[] = [];
    const executionLog: Array<GovernanceDelegationRevocationReceipt["executionLog"][number]> = [];
    let failedStage: GovernanceDelegationRevocationReceipt["failedStage"] = null;
    const context = (): GovernanceDelegationRevocationSagaContext => ({
      delegationId: request.delegationId,
      failedStage,
    });

    let currentStage: "prepare" | "commit" = "prepare";
    try {
      for (const resourceId of request.derivedResourceIds) {
        this.handlers.freezeResource?.(resourceId, context());
        frozenResourceIds.push(resourceId);
        executionLog.push({ stage: "prepare", subjectId: resourceId, outcome: "completed" });
      }

      if (cascadeScope.pendingApprovals) {
        this.handlers.revokePendingApprovals?.(request.delegationId, context());
        revokedPendingApprovals.push(request.delegationId);
        executionLog.push({ stage: "prepare", subjectId: `pending_approvals:${request.delegationId}`, outcome: "completed" });
      }
      if (cascadeScope.activeSessions) {
        this.handlers.revokeActiveSessions?.(request.delegationId, context());
        revokedActiveSessions.push(request.delegationId);
        executionLog.push({ stage: "prepare", subjectId: `active_sessions:${request.delegationId}`, outcome: "completed" });
      }
      if (cascadeScope.secretLeases) {
        this.handlers.revokeSecretLeases?.(request.delegationId, context());
        revokedSecretLeases.push(request.delegationId);
        executionLog.push({ stage: "prepare", subjectId: `secret_leases:${request.delegationId}`, outcome: "completed" });
      }
      if (cascadeScope.workerLeases) {
        this.handlers.revokeWorkerLeases?.(request.delegationId, context());
        revokedWorkerLeases.push(request.delegationId);
        executionLog.push({ stage: "prepare", subjectId: `worker_leases:${request.delegationId}`, outcome: "completed" });
      }
      if (cascadeScope.scheduledTriggers) {
        this.handlers.revokeScheduledTriggers?.(request.delegationId, context());
        revokedScheduledTriggers.push(request.delegationId);
        executionLog.push({ stage: "prepare", subjectId: `scheduled_triggers:${request.delegationId}`, outcome: "completed" });
      }

      currentStage = "commit";
      for (const delegationId of request.derivedDelegationIds ?? []) {
        this.handlers.revokeDerivedDelegation?.(delegationId, context());
        revokedDerivedDelegationIds.push(delegationId);
        executionLog.push({ stage: "commit", subjectId: delegationId, outcome: "completed" });
      }
    } catch {
      failedStage = currentStage;
      const lastSubject = revokedDerivedDelegationIds.at(-1) ?? revokedScheduledTriggers.at(-1)
        ?? revokedWorkerLeases.at(-1) ?? revokedSecretLeases.at(-1) ?? revokedActiveSessions.at(-1)
        ?? revokedPendingApprovals.at(-1) ?? frozenResourceIds.at(-1) ?? request.delegationId;
      executionLog.push({
        stage: failedStage,
        subjectId: lastSubject,
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
      revokedPendingApprovals,
      revokedActiveSessions,
      revokedSecretLeases,
      revokedWorkerLeases,
      revokedScheduledTriggers,
      revokedDerivedDelegationIds,
      revokeWithinSlo: elapsed <= REVOKE_SLO_MS,
      cascadeWithinSlo: failedStage == null && elapsed <= CASCADE_SLO_MS,
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
