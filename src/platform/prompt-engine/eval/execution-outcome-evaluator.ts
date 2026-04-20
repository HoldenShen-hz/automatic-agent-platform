import { newId } from "../../contracts/types/ids.js";
import type { Plan } from "../../orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";

export interface ExecutionOutcomeEvaluation {
  evaluationId: string;
  taskId: string;
  passed: boolean;
  qualityScore: number;
  nextAction: "complete" | "retry" | "replan" | "approve" | "escalate";
  reasons: string[];
  evaluatedAt: number;
}

export class ExecutionOutcomeEvaluator {
  public evaluate(plan: Plan, feedback: FeedbackBatch): ExecutionOutcomeEvaluation {
    const failureSignals = feedback.signals.filter((signal) => signal.category === "failure" || signal.category === "timeout");
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");
    const qualityScore = Math.max(
      0,
      Math.min(1, (successSignals.length * 0.35) + (feedback.outcome === "completed" ? 0.45 : 0) - (failureSignals.length * 0.3) - (partialSignals.length * 0.1)),
    );

    const nextAction =
      feedback.outcome === "completed"
        ? "complete"
        : feedback.outcome === "repairable"
          ? "replan"
          : failureSignals.some((signal) => String(signal.payload.reasonCode ?? "").includes("approval"))
            ? "approve"
            : failureSignals.length > 0
              ? "retry"
              : "escalate";

    return {
      evaluationId: newId("outcome_eval"),
      taskId: plan.taskId,
      passed: nextAction === "complete" && qualityScore >= 0.5,
      qualityScore: Number(qualityScore.toFixed(2)),
      nextAction,
      reasons: feedback.signals.map((signal) => `${signal.category}:${String(signal.payload.summary ?? signal.payload.reasonCode ?? signal.category)}`),
      evaluatedAt: Date.now(),
    };
  }
}
