import type { ImprovementCandidate } from "./improvement-candidate-registry.js";
import type { StrategyVersion } from "./strategy-versioning.js";

export interface GuardrailEvaluation {
  allowed: boolean;
  reasonCodes: string[];
}

export class GuardrailEvaluator {
  public evaluate(candidate: ImprovementCandidate, strategyVersion: StrategyVersion): GuardrailEvaluation {
    const reasonCodes: string[] = [];

    if (candidate.sourceSignalRefs.length === 0) {
      reasonCodes.push("improvement.guardrail_missing_evidence");
    }
    if (candidate.sourceLearningObjectIds.length === 0) {
      reasonCodes.push("improvement.guardrail_missing_learning_object");
    }
    if (strategyVersion.sourceLearningObjectIds.length === 0) {
      reasonCodes.push("improvement.guardrail_unlinked_strategy");
    }
    if (strategyVersion.releaseLevel === "shadow" && candidate.status !== "approved" && candidate.status !== "shadow_running") {
      reasonCodes.push("improvement.guardrail_shadow_requires_approval");
    }

    return {
      allowed: reasonCodes.length === 0,
      reasonCodes,
    };
  }
}
