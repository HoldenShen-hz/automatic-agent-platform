import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";
import type { EvaluationReport } from "./execution-outcome-evaluator.js";

export interface PostExecutionQualityGateDecision {
  accepted: boolean;
  releaseStage: "released" | "repair" | "approval" | "blocked";
  reasonCodes: string[];
}

export class PostExecutionQualityGate {
  public decide(evaluation: ExecutionOutcomeEvaluation): PostExecutionQualityGateDecision;
  /** R5-7: Accept EvaluationReport as the canonical output format */
  public decide(evaluation: EvaluationReport): PostExecutionQualityGateDecision;
  public decide(evaluation: ExecutionOutcomeEvaluation | EvaluationReport): PostExecutionQualityGateDecision {
    // R5-7: Handle both ExecutionOutcomeEvaluation (legacy) and EvaluationReport (canonical)
    const verdict = "verdict" in evaluation ? evaluation.verdict : this.mapNextActionToVerdict(evaluation.nextAction);
    const passed = "passed" in evaluation ? evaluation.passed : verdict === "accept";

    if (passed && verdict === "accept") {
      return {
        accepted: true,
        releaseStage: "released",
        reasonCodes: ["quality.accepted"],
      };
    }
    if (verdict === "approve" || ("nextAction" in evaluation && evaluation.nextAction === "approve")) {
      return {
        accepted: false,
        releaseStage: "approval",
        reasonCodes: ["quality.approval_required"],
      };
    }
    if (verdict === "escalate") {
      return {
        accepted: false,
        releaseStage: "blocked",
        reasonCodes: ["quality.blocked", "quality.escalate"],
      };
    }
    if (verdict === "retry") {
      return {
        accepted: false,
        releaseStage: "repair",
        reasonCodes: ["quality.repair_required", "quality.retry_required"],
      };
    }
    if (verdict === "replan") {
      return {
        accepted: false,
        releaseStage: "repair",
        reasonCodes: ["quality.repair_required", "quality.replan_required"],
      };
    }
    return {
      accepted: false,
      releaseStage: "blocked",
      reasonCodes: ["quality.blocked"],
    };
  }

  private mapNextActionToVerdict(nextAction: ExecutionOutcomeEvaluation["nextAction"]): EvaluationReport["verdict"] {
    switch (nextAction) {
      case "complete":
        return "accept";
      case "approve":
        return "approve";
      case "replan":
        return "replan";
      case "retry":
        return "retry";
      case "escalate":
        return "escalate";
    }
  }
}
