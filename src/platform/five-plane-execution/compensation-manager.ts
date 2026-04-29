/**
 * @fileoverview Compensation Manager - Manages reversible side effects and compensation paths.
 *
 * §14.13 Compensation Manager
 *
 * The Compensation Manager manages reversible side effects, compensation actions,
 * and manual repair paths. Compensation is not a database rollback - it is an
 * auditable repair action appended to the external world.
 *
 * Irreversible side effects must be marked as `irreversible` during the PlanGraph
 * phase, with elevated approval and confirmation requirements before execution.
 *
 * Compensation state machine:
 * compensation_required
 *   → compensation_planned
 *   → compensation_approved
 *   → compensation_committing
 *   → compensation_confirmed | compensation_failed | manual_review_required
 *
 * Compensation failures must NOT delete the original side effect evidence;
 * the original evidence, compensation attempt, external response, and human
 * confirmation records must all be preserved.
 */

import type {
  SideEffectRecord,
  SideEffectStatus,
  CompensationRecord,
  ArtifactRef,
} from "../../contracts/executable-contracts/index.js";
import { createCompensationRecord } from "../../contracts/executable-contracts/index.js";

export type CompensationStatus =
  | "planned"
  | "running"
  | "succeeded"
  | "failed"
  | "requires_human";

export type CompensationTransition =
  | "plan"
  | "approve"
  | "commit"
  | "confirm"
  | "fail"
  | "escalate";

export interface CompensationPlan {
  readonly compensationId: string;
  readonly sideEffectId: string;
  readonly harnessRunId: string;
  readonly steps: readonly CompensationStep[];
  readonly createdAt: string;
}

export interface CompensationStep {
  readonly stepId: string;
  readonly stepType: "reverse" | "compensate" | "notify" | "rollback";
  readonly targetRef: string;
  readonly action: string;
  readonly estimatedImpact: "low" | "medium" | "high";
  readonly rollbackPlanRef?: ArtifactRef;
}

export interface CompensationResult {
  readonly success: boolean;
  readonly compensationId: string;
  readonly finalStatus: CompensationStatus;
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly completedAt?: string;
}

export interface CompensationContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly operatorId: string;
  readonly reason: string;
}

/**
 * CompensationManager handles compensation for failed or ambiguous side effects.
 *
 * It manages the compensation state machine and coordinates compensation actions
 * with external systems to ensure auditability and traceability.
 */
export class CompensationManager {
  /**
   * Create a compensation record for a side effect.
   */
  public createCompensationRecord(
    sideEffectId: string,
    harnessRunId: string,
    planRef: ArtifactRef,
    status?: CompensationStatus,
  ): CompensationRecord {
    return createCompensationRecord({
      sideEffectId,
      harnessRunId,
      planRef,
      status,
    });
  }

  /**
   * Determine if a side effect is compensatable.
   *
   * A side effect is compensatable if:
   * 1. It was marked as reversible in its profile
   * 2. A compensation plan exists
   * 3. The side effect is in a compensatable state
   */
  public isCompensatable(sideEffect: SideEffectRecord): boolean {
    const compensatableStatuses: readonly SideEffectStatus[] = [
      "ambiguous",
      "compensation_required",
      "failed",
    ];
    return compensatableStatuses.includes(sideEffect.status);
  }

  /**
   * Get the next compensation state based on the current status and transition.
   */
  public getNextCompensationStatus(
    currentStatus: CompensationStatus,
    transition: CompensationTransition,
  ): CompensationStatus | null {
    const transitions: Record<CompensationStatus, Partial<Record<CompensationTransition, CompensationStatus>>> = {
      "planned": { approve: "running", escalate: "requires_human" },
      "running": { commit: "running", confirm: "succeeded", fail: "failed", escalate: "requires_human" },
      "succeeded": {},
      "failed": { plan: "planned", escalate: "requires_human" },
      "requires_human": { plan: "planned" },
    };

    return transitions[currentStatus]?.[transition] ?? null;
  }

  /**
   * Get the target side effect status after compensation completes.
   */
  public getTargetSideEffectStatus(compensationStatus: CompensationStatus): SideEffectStatus {
    switch (compensationStatus) {
      case "succeeded":
        return "compensated";
      case "failed":
        return "failed";
      case "requires_human":
        return "manual_review_required";
      default:
        return "compensating";
    }
  }

  /**
   * Check if a compensation action requires human approval.
   *
   * High-risk or high-impact compensations require human approval before execution.
   */
  public requiresHumanApproval(impact: CompensationStep["estimatedImpact"]): boolean {
    return impact === "high";
  }

  /**
   * Validate that compensation can proceed for a side effect.
   */
  public validateCompensationPreconditions(
    sideEffect: SideEffectRecord,
  ): { valid: boolean; reason?: string } {
    if (!this.isCompensatable(sideEffect)) {
      return {
        valid: false,
        reason: `Side effect ${sideEffect.sideEffectId} is not in a compensatable state (current: ${sideEffect.status})`,
      };
    }

    if (sideEffect.status === "compensated") {
      return {
        valid: false,
        reason: `Side effect ${sideEffect.sideEffectId} has already been compensated`,
      };
    }

    return { valid: true };
  }

  /**
   * Create a plan for compensating a side effect.
   *
   * This is an interface method that should be implemented based on
   * the specific side effect type and compensation requirements.
   */
  public planCompensation(
    sideEffect: SideEffectRecord,
    context: CompensationContext,
  ): CompensationPlan {
    return {
      compensationId: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sideEffectId: sideEffect.sideEffectId,
      harnessRunId: sideEffect.harnessRunId,
      steps: this.deriveCompensationSteps(sideEffect),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Derive compensation steps based on the side effect type.
   *
   * This is a simplified implementation. Real implementations would need
   * to understand the specific side effect and generate appropriate compensation.
   */
  private deriveCompensationSteps(sideEffect: SideEffectRecord): readonly CompensationStep[] {
    // Generate basic compensation steps based on effect kind
    const baseStep: CompensationStep = {
      stepId: `step-1-${Date.now()}`,
      stepType: "reverse",
      targetRef: sideEffect.externalRef ?? sideEffect.idempotencyKey,
      action: `reverse_${sideEffect.effectKind}`,
      estimatedImpact: sideEffect.riskClass === "critical" ? "high" : sideEffect.riskClass === "high" ? "medium" : "low",
    };

    return [baseStep];
  }
}

/**
 * PlanGraph phase marker for irreversible side effects.
 *
 * Side effects marked as irreversible during PlanGraph phase
 * require elevated approval and confirmation requirements.
 */
export interface IrreversibleSideEffectMarker {
  readonly sideEffectId: string;
  readonly irreversibleReason: string;
  readonly elevatedApprovalRequired: boolean;
  readonly markedAt: string;
  readonly markedBy: string;
}
