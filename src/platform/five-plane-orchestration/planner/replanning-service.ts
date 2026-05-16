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

  public decide(
    plan: Plan | { readonly harnessRunId?: string; readonly graphVersion?: number },
    feedback: FeedbackBatch,
    trigger?: ReplanningTrigger | null,
    suppressCorrection?: boolean,
  ): ReplanningDecision {
    const outcome = feedback.outcome as string;
    // After a replan (suppressCorrection=true), correction signals should NOT trigger another replan.
    // The plan was just rebuilt to address the correction — re-applying the same correction would cause
    // an infinite loop: plan→execute→feedback→plan→execute→feedback→...
    // We only allow replan for new problems (failed/escalated outcomes).
    const failed = outcome === "failed" || outcome === "escalated";
    const correctionRequested = (!suppressCorrection) && feedback.signals.some((signal) => signal.category === "correction");

    // R5-5: Handle downgrade_mode branch - correction signals trigger replan to reduce scope/complexity.
    // After a replan (suppressCorrection=true), do NOT re-trigger downgrade_mode — the plan already
    // incorporates the necessary adjustments. Re-triggering it would cause spurious re-loops.
    const downgradeMode = (!suppressCorrection) && feedback.signals.some((signal) =>
      (signal.payload as Record<string, unknown>)?.reasonCode === "scope_too_broad" ||
      (signal.payload as Record<string, unknown>)?.reasonCode === "complexity_exceeded"
    );
    const repairable = (!suppressCorrection) && outcome === "repairable";
    const shouldReplan = failed || repairable || downgradeMode || correctionRequested;

    let strategy: Plan["strategy"] | null = shouldReplan ? "replanned" : null;
    let reasonCode = trigger?.reasonCode ?? (shouldReplan ? "planning.execution_deviation" : "planning.no_replan_required");

    if (downgradeMode) {
      strategy = "replanned";
      reasonCode = "planning.downgrade_mode";
    } else if (correctionRequested) {
      strategy = "replanned";
      reasonCode = trigger?.reasonCode ?? "planning.downgrade_mode";
    }

    const taskId = "taskId" in plan ? plan.taskId : plan.harnessRunId ?? "unknown_task";
    const currentVersion = "version" in plan ? plan.version : plan.graphVersion ?? 1;

    return {
      decisionId: newId("replan_decision"),
      taskId,
      shouldReplan,
      nextPlanVersion: shouldReplan ? currentVersion + 1 : null,
      strategy,
      reasonCode,
      decidedAt: Date.now(),
    };
  }
}
