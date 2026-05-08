import {
  type CompensationRecord,
  type ReconciliationRecord,
  type SideEffectRecord,
  type SideEffectStatus,
} from "../contracts/executable-contracts/index.js";
import {
  RuntimeStateMachine,
  type RuntimeTransitionResult,
} from "./runtime-state-machine.js";

export interface SideEffectManagerOptions {
  readonly stateMachine?: RuntimeStateMachine;
}

export interface SideEffectManagerContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly occurredAt?: string;
}

export class SideEffectManager {
  private readonly stateMachine: RuntimeStateMachine;

  public constructor(options: SideEffectManagerOptions = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
  }

  public applyReconciliation(
    sideEffect: SideEffectRecord,
    reconciliation: ReconciliationRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, targetStatusForReconciliation(reconciliation), {
      ...context,
      reasonCode: `reconciliation.${reconciliation.result}.${reconciliation.nextAction}`,
    });
  }

  public startCompensation(
    sideEffect: SideEffectRecord,
    compensation: CompensationRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "compensating", {
      ...context,
      reasonCode: `compensation.${compensation.status}`,
    });
  }

  public completeCompensation(
    sideEffect: SideEffectRecord,
    compensation: CompensationRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    const targetStatus = compensation.status === "succeeded" ? "compensated" : "failed";
    return this.transitionSideEffect(sideEffect, targetStatus, {
      ...context,
      reasonCode: `compensation.${compensation.status}`,
    });
  }

  private transitionSideEffect(
    sideEffect: SideEffectRecord,
    toStatus: SideEffectStatus,
    context: SideEffectManagerContext & { readonly reasonCode: string },
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.stateMachine.transition({
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: sideEffect.status,
      toStatus,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: context.reasonCode,
      emittedBy: context.emittedBy,
      sideEffectSafety: {
        idempotencyKey: sideEffect.idempotencyKey,
        preCommitPolicyProofRef: sideEffect.preCommitPolicyProofRef.uri,
        ...(sideEffect.approvalRef != null ? { humanApprovalRef: sideEffect.approvalRef } : {}),
      },
      auditRef: `audit://side-effects/${sideEffect.sideEffectId}/${context.reasonCode}`,
      ...(context.occurredAt != null ? { occurredAt: context.occurredAt } : {}),
    });
  }
}

function targetStatusForReconciliation(reconciliation: ReconciliationRecord): SideEffectStatus {
  switch (reconciliation.nextAction) {
    case "mark_confirmed":
      return "confirmed";
    case "retry_probe":
      return "reconciling";
    case "compensate":
      return "compensating";
    case "escalate_hitl":
      return "ambiguous";
    case "mark_failed":
      return "failed";
  }
}
