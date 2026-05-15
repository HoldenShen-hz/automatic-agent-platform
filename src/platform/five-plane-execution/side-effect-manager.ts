import {
  createPlatformFactEvent,
  type CompensationRecord,
  type JsonValue,
  type ReconciliationRecord,
  type SideEffectRecord,
  type SideEffectStatus,
} from "../contracts/executable-contracts/index.js";
import {
  RuntimeStateMachine,
  type RuntimeTransitionResult,
} from "./runtime-state-machine.js";
import { newId } from "../contracts/types/ids.js";

export interface SideEffectManagerOptions {
  readonly stateMachine?: RuntimeStateMachine;
  readonly preCommitValidator?: {
    validate(request: {
      sideEffect: SideEffectRecord;
      targetStatus: SideEffectStatus;
      context: SideEffectManagerContext;
    }): void;
  };
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
    this.preCommitValidator = options.preCommitValidator ?? null;
  }

  private readonly preCommitValidator: NonNullable<SideEffectManagerOptions["preCommitValidator"]> | null;

  public applyReconciliation(
    sideEffect: SideEffectRecord,
    reconciliation: ReconciliationRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    const targetStatus = targetStatusForReconciliation(sideEffect, reconciliation);
    if (
      ["confirmed", "compensation_required", "compensating", "compensated"].includes(targetStatus)
      && (sideEffect.leaseId == null || sideEffect.fencingToken == null)
    ) {
      throw new Error("Side effect reconciliation requires an active lease and fencing token");
    }
    return this.transitionSideEffect(sideEffect, targetStatusForReconciliation(sideEffect, reconciliation), {
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

  public registerProposal(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "proposed", { ...context, reasonCode: "side_effect.proposed" });
  }

  public approve(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "approved", { ...context, reasonCode: "side_effect.approved" });
  }

  public reserve(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "reserved", { ...context, reasonCode: "side_effect.reserved" });
  }

  public startCommit(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "committing", { ...context, reasonCode: "side_effect.committing" });
  }

  public recordCommitted(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "committed", { ...context, reasonCode: "side_effect.committed" });
  }

  public startConfirmation(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "confirming", { ...context, reasonCode: "side_effect.confirming" });
  }

  public confirm(
    sideEffect: SideEffectRecord,
    context: SideEffectManagerContext,
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.transitionSideEffect(sideEffect, "confirmed", { ...context, reasonCode: "side_effect.confirmed" });
  }

  public async sweepReconciliation(input: {
    sideEffects: readonly SideEffectRecord[];
    probe(sideEffect: SideEffectRecord): Promise<{
      probeKind: ReconciliationRecord["probeKind"];
      observedState: ReconciliationRecord["externalObservedState"];
      result: ReconciliationRecord["result"];
      evidenceRefs: ReconciliationRecord["evidenceRefs"];
    }>;
    context: SideEffectManagerContext;
  }): Promise<Array<{ reconciliation: ReconciliationRecord; transition: RuntimeTransitionResult<SideEffectRecord> }>> {
    const results: Array<{ reconciliation: ReconciliationRecord; transition: RuntimeTransitionResult<SideEffectRecord> }> = [];
    for (const sideEffect of input.sideEffects) {
      if (sideEffect.status !== "ambiguous" && sideEffect.status !== "reconciling") {
        continue;
      }
      const probe = await input.probe(sideEffect);
      const reconciliation: ReconciliationRecord = {
        reconciliationId: newId("recon"),
        sideEffectId: sideEffect.sideEffectId,
        probeKind: probe.probeKind,
        externalObservedState: probe.observedState,
        result: probe.result,
        evidenceRefs: probe.evidenceRefs,
        nextAction: nextActionForProbeResult(probe.result),
        createdAt: input.context.occurredAt ?? new Date().toISOString(),
      };
      results.push({
        reconciliation,
        transition: this.applyReconciliation(sideEffect, reconciliation, input.context),
      });
    }
    return results;
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
    if (toStatus !== "proposed") {
      this.preCommitValidator?.validate({ sideEffect, targetStatus: toStatus, context });
    }
    const occurredAt = context.occurredAt ?? new Date().toISOString();
    const aggregate: SideEffectRecord = {
      ...sideEffect,
      status: toStatus,
      updatedAt: occurredAt,
    };
    const payload = {
      fromStatus: sideEffect.status,
      toStatus,
      reasonCode: context.reasonCode,
      auditRef: `audit://side-effects/${sideEffect.sideEffectId}/${context.reasonCode}`,
      sideEffectSafety: {
        idempotencyKey: sideEffect.idempotencyKey,
        preCommitPolicyProofRef: sideEffect.preCommitPolicyProofRef.uri,
        ...(sideEffect.approvalRef != null ? { humanApprovalRef: sideEffect.approvalRef } : {}),
      },
    } satisfies JsonValue;
    const event = createPlatformFactEvent({
      eventType: "platform.side_effect.status_changed",
      aggregateType: "SideEffectRecord",
      aggregateId: sideEffect.sideEffectId,
      aggregateSeq: 1,
      tenantId: context.tenantId,
      runId: sideEffect.harnessRunId,
      traceId: context.traceId,
      payload,
      source: context.emittedBy,
      occurredAt,
    });
    return { aggregate, event };
  }

  private transitionSideEffectViaStateMachine(
    sideEffect: SideEffectRecord,
    toStatus: SideEffectStatus,
    context: SideEffectManagerContext & { readonly reasonCode: string },
  ): RuntimeTransitionResult<SideEffectRecord> {
    return this.stateMachine.transition({
      commandId: newId("sidefx-cmd"),
      entityType: "SideEffectRecord",
      entityId: sideEffect.sideEffectId,
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: sideEffect.status,
      toStatus,
      principal: context.emittedBy,
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

function targetStatusForReconciliation(sideEffect: SideEffectRecord, reconciliation: ReconciliationRecord): SideEffectStatus {
  switch (reconciliation.nextAction) {
    case "mark_confirmed":
      return "confirmed";
    case "retry_probe":
      return "reconciling";
    case "compensate":
      return "compensation_required";
    case "escalate_hitl":
      return sideEffect.status === "ambiguous" ? "manual_review_required" : "ambiguous";
    case "mark_failed":
      return "failed";
  }
}

function nextActionForProbeResult(result: ReconciliationRecord["result"]): ReconciliationRecord["nextAction"] {
  switch (result) {
    case "confirmed":
      return "mark_confirmed";
    case "not_found":
    case "failed":
      return "compensate";
    case "ambiguous":
      return "retry_probe";
  }
}
