export interface GovernanceDelegationRevocationRequest {
  readonly delegationId: string;
  readonly requestedAtMs: number;
  readonly derivedResourceIds: readonly string[];
  readonly derivedDelegationIds?: readonly string[];
}

export interface GovernanceDelegationRevocationSagaContext {
  readonly delegationId: string;
  readonly failedStage: "prepare" | "commit" | "compensate" | "audit" | null;
}

export interface GovernanceDelegationRevocationSagaHandlers {
  readonly freezeResource?: (resourceId: string, context: GovernanceDelegationRevocationSagaContext) => void;
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

    let currentStage: "prepare" | "commit" = "prepare";
    try {
      for (const resourceId of request.derivedResourceIds) {
        this.handlers.freezeResource?.(resourceId, context());
        frozenResourceIds.push(resourceId);
        executionLog.push({ stage: "prepare", subjectId: resourceId, outcome: "completed" });
      }
      currentStage = "commit";
      for (const delegationId of request.derivedDelegationIds ?? []) {
        this.handlers.revokeDerivedDelegation?.(delegationId, context());
        revokedDerivedDelegationIds.push(delegationId);
        executionLog.push({ stage: "commit", subjectId: delegationId, outcome: "completed" });
      }
    } catch {
      failedStage = currentStage;
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
      cascadeWithinSlo: elapsed <= 300_000 && (request.derivedDelegationIds?.length ?? 0) >= 0,
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
