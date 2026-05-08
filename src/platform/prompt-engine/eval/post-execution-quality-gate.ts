import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";

export interface PostExecutionQualityGateDecision {
  accepted: boolean;
  releaseStage: "released" | "repair" | "approval" | "blocked";
  reasonCodes: string[];
}

export class PostExecutionQualityGate {
  public decide(evaluation: ExecutionOutcomeEvaluation): PostExecutionQualityGateDecision {
    if (evaluation.nextAction === "complete" && evaluation.passed) {
      return {
        accepted: true,
        releaseStage: "released",
        reasonCodes: ["quality.accepted"],
      };
    }
    if (evaluation.nextAction === "approve") {
      return {
        accepted: false,
        releaseStage: "approval",
        reasonCodes: ["quality.approval_required"],
      };
    }
    if (evaluation.nextAction === "retry" || evaluation.nextAction === "replan") {
      return {
        accepted: false,
        releaseStage: "repair",
        reasonCodes: ["quality.repair_required"],
      };
    }
    return {
      accepted: false,
      releaseStage: "blocked",
      reasonCodes: ["quality.blocked"],
    };
  }
}
