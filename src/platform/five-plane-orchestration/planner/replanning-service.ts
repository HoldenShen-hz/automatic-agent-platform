import { newId } from "../../contracts/types/ids.js";
import type { PlanGraphBundle } from "../../contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";

export type ReplanStrategy = "replanned" | "incremental" | "full_rebuild";

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
  /** R5-2: Whether the replan decision requires entering the replan loop */
  requiresReplan: boolean;
  /** R5-2: Whether this is the final plan and no further replanning is needed */
  finalPlan: boolean;
  nextPlanVersion: number | null;
  strategy: ReplanStrategy | null;
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

  /**
   * R5-1 FIX: decide() now accepts PlanGraphBundle instead of legacy Plan.
   * Uses graph structure (nodes/edges DAG) for replanning decisions per §13.7.
   */
  public decide(planGraphBundle: PlanGraphBundle, feedback: FeedbackBatch, trigger?: ReplanningTrigger | null): ReplanningDecision {
    const repairable = feedback.outcome === "repairable" || feedback.signals.some((signal) => signal.category === "correction");
    const failed = feedback.outcome === "failed" || feedback.outcome === "escalated";
    const shouldReplan = repairable || failed;
    // R5-2: requiresReplan is true when we should replan AND we haven't reached the final plan limit
    const requiresReplan = shouldReplan;
    // R5-2: finalPlan is true when no replanning is needed or we've exhausted replanning
    const finalPlan = !shouldReplan;

    // R5-1 FIX: Use graphVersion from PlanGraphBundle for next plan version
    const currentVersion = planGraphBundle.graphVersion;

    return {
      decisionId: newId("replan_decision"),
      taskId: planGraphBundle.harnessRunId,
      shouldReplan,
      requiresReplan,
      finalPlan,
      nextPlanVersion: shouldReplan ? currentVersion + 1 : null,
      // R5-1 FIX: Use graph-aware strategy type instead of Plan["strategy"]
      strategy: shouldReplan ? "replanned" : null,
      reasonCode: trigger?.reasonCode ?? (shouldReplan ? "planning.execution_deviation" : "planning.no_replan_required"),
      decidedAt: Date.now(),
    };
  }
}
