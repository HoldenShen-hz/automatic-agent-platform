import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";

export interface PostExecutionQualityGateDecision {
  accepted: boolean;
  releaseStage: "released" | "repair" | "approval" | "blocked";
  reasonCodes: string[];
}

export class PostExecutionQualityGate {
  /**
   * Evaluates critical_case_pass==100% as a hard release gate per §21.5.
   * If critical cases exist and any fail (pass rate < 1), the release is blocked.
   */
  public decide(evaluation: ExecutionOutcomeEvaluation, context?: {
    criticalCaseCount?: number;
    criticalCasePassedCount?: number;
  }): PostExecutionQualityGateDecision {
    // §21.5: Hard gate - if critical cases exist and not all passed, block release
    if (context?.criticalCaseCount != null && context.criticalCaseCount > 0) {
      const criticalPassRate = context.criticalCasePassedCount / context.criticalCaseCount;
      if (criticalPassRate < 1) {
        return {
          accepted: false,
          releaseStage: "blocked",
          reasonCodes: [`quality.critical_case_failed:${criticalPassRate}`],
        };
      }
    }

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
