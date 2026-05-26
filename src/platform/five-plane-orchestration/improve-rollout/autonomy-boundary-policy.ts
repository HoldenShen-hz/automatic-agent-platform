import type { LearningObject } from "../learn/learning-object-model.js";

export type AutonomyTarget =
  | "routing_policy"
  | "planning_policy"
  | "execution_policy"
  | "memory_policy"
  | "sandbox_policy"
  | "provider_registry";

export interface AutonomyBoundaryDecision {
  allowed: boolean;
  reasonCode: string;
}

export interface AutonomyBoundaryContext {
  readonly actionMode?: "auto_execute" | "suggest" | "silent_record";
}

const AUTO_ALLOWED_TARGETS = new Set<AutonomyTarget>([
  "routing_policy",
  "planning_policy",
  "execution_policy",
  "memory_policy",
]);

export class AutonomyBoundaryPolicy {
  public decide(
    target: AutonomyTarget,
    learningObjects: readonly LearningObject[],
    context: AutonomyBoundaryContext = {},
  ): AutonomyBoundaryDecision {
    if (!AUTO_ALLOWED_TARGETS.has(target)) {
      return {
        allowed: false,
        reasonCode: "improvement.manual_approval_required",
      };
    }
    if (learningObjects.length === 0) {
      return {
        allowed: true,
        reasonCode: "improvement.allowed",
      };
    }
    const allEvidenceBacked = learningObjects.every(
      (item) => item.evidenceRefs.length > 0 && (item.promotionStatus === "validated" || item.promotionStatus === "promoted"),
    );
    if (context.actionMode === "auto_execute") {
      const autoExecuteEvidenceSatisfied = learningObjects.every(
        (item) => item.evidenceRefs.length >= 2 && item.promotionStatus === "promoted",
      );
      return {
        allowed: autoExecuteEvidenceSatisfied,
        reasonCode: autoExecuteEvidenceSatisfied
          ? "improvement.allowed"
          : "improvement.auto_execute_requires_promoted_evidence",
      };
    }
    return {
      allowed: allEvidenceBacked,
      reasonCode: allEvidenceBacked ? "improvement.allowed" : "improvement.learning_object_not_validated",
    };
  }
}
