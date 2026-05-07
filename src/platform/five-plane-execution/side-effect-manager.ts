import {
  createPlatformFactEvent,
  type CompensationRecord,
  type ReconciliationRecord,
  type SideEffectRecord,
  type SideEffectStatus,
} from "../contracts/executable-contracts/index.js";
import { newId } from "../contracts/types/ids.js";
import {
  RuntimeStateMachine,
  type RuntimeTransitionResult,
} from "./runtime-state-machine.js";

export interface SideEffectManagerOptions {
  readonly stateMachine?: RuntimeStateMachine;
  readonly preCommitValidator?: SideEffectPreCommitValidator;
}

export interface SideEffectManagerContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly occurredAt?: string;
  readonly leaseId?: string;
  readonly fencingToken?: string;
}

export interface SideEffectPreCommitValidationRequest {
  readonly sideEffect: SideEffectRecord;
  readonly targetStatus: SideEffectStatus;
  readonly context: SideEffectManagerContext;
}

export interface SideEffectPreCommitValidator {
  validate(request: SideEffectPreCommitValidationRequest): void;
}

export class SideEffectManager {
  private readonly stateMachine: RuntimeStateMachine;
  private readonly preCommitValidator?: SideEffectPreCommitValidator;

  public constructor(options: SideEffectManagerOptions = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
    this.preCommitValidator = options.preCommitValidator ?? undefined;
  }

  public registerProposal(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    if (sideEffect.status === "proposed") {
      return this.materializeCurrentState(sideEffect, context, "registration.proposed");
    }
    return this.transitionSideEffect(sideEffect, "proposed", {
      ...context,
      reasonCode: "registration.proposed",
    });
  }

  public approve(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    this.validatePreCommit(sideEffect, "approved", context);
    return this.transitionSideEffect(sideEffect, "approved", {
      ...context,
      reasonCode: "registration.approved",
    });
  }

  public reserve(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    this.validatePreCommit(sideEffect, "reserved", context);
    return this.transitionSideEffect(sideEffect, "reserved", {
      ...context,
      reasonCode: "registration.reserved",
    });
  }

  public startCommit(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    this.validatePreCommit(sideEffect, "committing", context);
    return this.transitionSideEffect(sideEffect, "committing", {
      ...context,
      reasonCode: "commit.started",
    });
  }

  public recordCommitted(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    this.validatePreCommit(sideEffect, "committed", context);
    return this.transitionSideEffect(sideEffect, "committed", {
      ...context,
      reasonCode: "commit.recorded",
    });
  }

  public startConfirmation(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    this.validatePreCommit(sideEffect, "confirming", context);
    return this.transitionSideEffect(sideEffect, "confirming", {
      ...context,
      reasonCode: "commit.confirming",
    });
  }

  public confirm(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    this.validatePreCommit(sideEffect, "confirmed", context);
    return this.transitionSideEffect(sideEffect, "confirmed", {
      ...context,
      reasonCode: "commit.confirmed",
    });
  }

  public applyReconciliation(
    sideEffect: SideEffectRecord,
    reconciliation: ReconciliationRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    const reasonCode = `reconciliation.${reconciliation.result}.${reconciliation.nextAction}`;
    if (reconciliation.nextAction === "mark_confirmed" && sideEffect.status === "ambiguous") {
      const reconciling = this.transitionSideEffect(sideEffect, "reconciling", {
        ...context,
        reasonCode: `${reasonCode}.reconciling`,
      });
      return this.transitionSideEffect(reconciling.aggregate, "confirmed", {
        ...context,
        reasonCode,
      });
    }
    return this.transitionSideEffect(sideEffect, targetStatusForReconciliation(reconciliation), {
      ...context,
      reasonCode,
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
      commandId: newId("cmd"),
      entityType: "SideEffectRecord",
      entityId: sideEffect.sideEffectId,
      principal: context.emittedBy,
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
      ...(context.leaseId != null ? { leaseId: context.leaseId } : {}),
      ...(context.fencingToken != null ? { fencingToken: context.fencingToken } : {}),
      ...(context.occurredAt != null ? { occurredAt: context.occurredAt } : {}),
    });
  }

  private validatePreCommit(
    sideEffect: SideEffectRecord,
    targetStatus: SideEffectStatus,
    context: SideEffectManagerContext,
  ): void {
    this.preCommitValidator?.validate({
      sideEffect,
      targetStatus,
      context,
    });
  }

  private materializeCurrentState(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
    reasonCode: string,
  ): RuntimeTransitionResult<SideEffectRecord> {
    const occurredAt = context.occurredAt ?? new Date(Date.now()).toISOString();
    return {
      aggregate: {
        ...sideEffect,
        updatedAt: occurredAt,
      },
      event: createPlatformFactEvent({
        eventType: "platform.side_effect.status_changed",
        aggregateType: "SideEffectRecord",
        aggregateId: sideEffect.sideEffectId,
        aggregateSeq: 1,
        tenantId: context.tenantId,
        runId: context.traceId,
        traceId: context.traceId,
        payload: {
          aggregateType: "SideEffectRecord",
          fromStatus: sideEffect.status,
          toStatus: sideEffect.status,
          reasonCode,
          emittedBy: context.emittedBy,
          sideEffectSafety: {
            idempotencyKey: sideEffect.idempotencyKey,
            preCommitPolicyProofRef: sideEffect.preCommitPolicyProofRef.uri,
            ...(sideEffect.approvalRef != null ? { humanApprovalRef: sideEffect.approvalRef } : {}),
          },
          auditRef: `audit://side-effects/${sideEffect.sideEffectId}/${reasonCode}`,
        },
        occurredAt,
      }),
    };
  }
}

function targetStatusForReconciliation(reconciliation: ReconciliationRecord): SideEffectStatus {
  switch (reconciliation.nextAction) {
    case "mark_confirmed":
      return "confirmed";
    case "retry_probe":
      return "reconciling";
    case "compensate":
      return "compensation_required";
    case "escalate_hitl":
      return "manual_review_required";
    case "mark_failed":
      return "failed";
    default:
      return "failed";
  }
}
