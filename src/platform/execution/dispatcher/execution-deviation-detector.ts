import { newId } from "../../contracts/types/ids.js";
import type { Plan } from "../../orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";

export interface ExecutionDeviation {
  deviationId: string;
  taskId: string;
  severity: "low" | "medium" | "high" | "critical";
  reasonCode: string;
  summary: string;
  detectedAt: number;
}

export class ExecutionDeviationDetector {
  public detect(plan: Plan, feedback: FeedbackBatch): ExecutionDeviation[] {
    const deviations: ExecutionDeviation[] = [];
    if (feedback.outcome === "repairable" || feedback.outcome === "failed" || feedback.outcome === "escalated") {
      deviations.push({
        deviationId: newId("deviation"),
        taskId: plan.taskId,
        severity: feedback.outcome === "repairable" ? "high" : "critical",
        reasonCode: `execution.${feedback.outcome}`,
        summary: `Execution outcome drifted to ${feedback.outcome}`,
        detectedAt: Date.now(),
      });
    }
    if (feedback.signals.some((signal) => signal.category === "timeout")) {
      deviations.push({
        deviationId: newId("deviation"),
        taskId: plan.taskId,
        severity: "high",
        reasonCode: "execution.timeout",
        summary: "Execution exceeded expected timing budget.",
        detectedAt: Date.now(),
      });
    }
    return deviations;
  }
}
