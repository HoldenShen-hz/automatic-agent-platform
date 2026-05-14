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

  public decide(plan: Plan | { readonly harnessRunId?: string; readonly graphVersion?: number }, feedback: FeedbackBatch, trigger?: ReplanningTrigger | null): ReplanningDecision {
    const repairable = feedback.outcome === "repairable" || feedback.signals.some((signal) => signal.category === "correction");
    const failed = feedback.outcome === "failed" || feedback.outcome === "escalated";
    const shouldReplan = repairable || failed;

    // R5-5: Handle downgrade_mode branch - if feedback indicates a need to reduce scope or complexity
    const downgradeMode = feedback.signals.some((signal) =>
      signal.category === "correction" ||
      (signal.payload as Record<string, unknown>)?.reasonCode === "scope_too_broad" ||
      (signal.payload as Record<string, unknown>)?.reasonCode === "complexity_exceeded"
    );

    let strategy: Plan["strategy"] | null = shouldReplan ? "replanned" : null;
    let reasonCode = trigger?.reasonCode ?? (shouldReplan ? "planning.execution_deviation" : "planning.no_replan_required");

    if (downgradeMode) {
      strategy = "replanned";
      reasonCode = "planning.downgrade_mode";
    }

    const taskId = "taskId" in plan ? plan.taskId : plan.harnessRunId ?? "unknown_task";
    const currentVersion = "version" in plan ? plan.version : plan.graphVersion ?? 1;

    return {
      decisionId: newId("replan_decision"),
      taskId,
      shouldReplan: shouldReplan || downgradeMode,
      nextPlanVersion: shouldReplan || downgradeMode ? currentVersion + 1 : null,
      strategy,
      reasonCode,
      decidedAt: Date.now(),
    };
  }
}
