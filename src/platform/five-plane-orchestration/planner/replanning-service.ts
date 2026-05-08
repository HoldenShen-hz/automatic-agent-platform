import { newId } from "../../contracts/types/ids.js";
import type { Plan } from "../oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";

export interface ReplanningTrigger {
  triggerId: string;
  taskId: string;
  reasonCode: string;
  source: "feedback" | "validation" | "operator";
  summary: string;
}

export interface ReplanningDecision {
  decisionId: string;
  taskId: string;
  shouldReplan: boolean;
  nextPlanVersion: number | null;
  strategy: Plan["strategy"] | null;
  reasonCode: string;
  decidedAt: number;
}

export class ReplanningService {
  public createTrigger(taskId: string, reasonCode: string, source: ReplanningTrigger["source"], summary: string): ReplanningTrigger {
    return {
      triggerId: newId("replan_trigger"),
      taskId,
      reasonCode,
      source,
      summary,
    };
  }

  public decide(plan: Plan, feedback: FeedbackBatch, trigger?: ReplanningTrigger | null): ReplanningDecision {
    const repairable = feedback.outcome === "repairable" || feedback.signals.some((signal) => signal.category === "correction");
    const failed = feedback.outcome === "failed" || feedback.outcome === "escalated";
    const shouldReplan = repairable || failed;

    return {
      decisionId: newId("replan_decision"),
      taskId: plan.taskId,
      shouldReplan,
      nextPlanVersion: shouldReplan ? plan.version + 1 : null,
      strategy: shouldReplan ? "replanned" : null,
      reasonCode: trigger?.reasonCode ?? (shouldReplan ? "planning.execution_deviation" : "planning.no_replan_required"),
      decidedAt: Date.now(),
    };
  }
}
