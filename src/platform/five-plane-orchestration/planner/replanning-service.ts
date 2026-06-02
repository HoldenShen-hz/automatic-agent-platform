import { newId } from "../../contracts/types/ids.js";
import type { Plan } from "../oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { createHash } from "node:crypto";

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
  private static readonly MAX_PLAN_VERSION = 1_000;

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
    const trustedSignals = feedback.signals.filter((signal) => isTrustedReplanningSignal(signal));
    const correctionRequested = (!suppressCorrection) && trustedSignals.some((signal) => signal.category === "correction");

    // R5-5: Handle downgrade_mode branch - correction signals trigger replan to reduce scope/complexity.
    // After a replan (suppressCorrection=true), do NOT re-trigger downgrade_mode — the plan already
    // incorporates the necessary adjustments. Re-triggering it would cause spurious re-loops.
    const downgradeMode = (!suppressCorrection) && trustedSignals.some((signal) =>
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
    const nextPlanVersion = shouldReplan && currentVersion < ReplanningService.MAX_PLAN_VERSION
      ? currentVersion + 1
      : null;
    const decisionId = createDeterministicDecisionId({
      taskId,
      currentVersion,
      outcome,
      shouldReplan: nextPlanVersion != null,
      reasonCode,
      triggerId: trigger?.triggerId ?? null,
      trustedSignalIds: trustedSignals.map((signal) => signal.signalId).sort(),
    });

    return {
      decisionId,
      taskId,
      shouldReplan: nextPlanVersion != null,
      nextPlanVersion,
      strategy,
      reasonCode,
      decidedAt: Date.now(),
    };
  }
}

function isTrustedReplanningSignal(signal: FeedbackBatch["signals"][number]): boolean {
  const trustedSource = signal.source === "hitl" || signal.source === "validation" || signal.source === "system";
  const authenticated = signal.trustScore?.overallScore != null
    ? signal.trustScore.overallScore >= 0.65 && signal.trustScore.passedSanityCheck
    : signal.feedbackTrustScore >= 0.65 && signal.trustFactors.authenticatedSource;
  return trustedSource || authenticated;
}

function createDeterministicDecisionId(input: {
  taskId: string;
  currentVersion: number;
  outcome: string;
  shouldReplan: boolean;
  reasonCode: string;
  triggerId: string | null;
  trustedSignalIds: readonly string[];
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `replan_decision:${digest}`;
}
