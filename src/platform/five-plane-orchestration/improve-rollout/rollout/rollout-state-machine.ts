import { newId } from "../../../contracts/types/ids.js";
import {
  parseRolloutRecord,
  type RolloutLevel,
  type RolloutRecord,
  type RolloutStatus,
} from "../../oapeflir/types/rollout-record.js";
import type { ImprovementCandidate } from "../improvement-candidate-registry.js";

export interface RolloutTransitionOptions {
  approvedBy?: string | undefined;
  strategyVersionId?: string | null | undefined;
  guardrailReasonCodes?: readonly string[] | undefined;
  currentStatus?: RolloutStatus | undefined;
  targetStatus?: RolloutStatus | undefined;
}

const ROLLOUT_TRANSITIONS: Readonly<Record<RolloutStatus, readonly RolloutStatus[]>> = {
  candidate_created: ["under_review", "draft", "rejected"],
  under_review: ["draft", "rejected", "paused"],
  draft: ["pending_approval", "rejected", "paused", "shadow", "rolled_back"],
  pending_approval: ["evaluation_enabled", "rejected", "paused", "shadow", "suggest"],
  rejected: [],
  evaluation_enabled: ["suggest", "shadow", "canary_5", "canary_20", "canary_50", "partial_25", "partial_50", "partial_75", "stable", "stable_100", "rolled_back", "paused"],
  suggest: ["pending_approval", "rejected", "paused", "shadow"],
  shadow: ["canary_5", "rolled_back", "paused"],
  canary_5: ["canary_20", "partial_25", "rolled_back", "paused"],
  canary_20: ["canary_50", "rolled_back", "paused"],
  canary_50: ["stable_100", "rolled_back", "paused"],
  partial_25: ["partial_50", "rolled_back", "paused"],
  partial_50: ["partial_75", "rolled_back", "paused"],
  partial_75: ["stable", "rolled_back", "paused"],
  stable: ["stable_100", "rolled_back", "paused"],
  stable_100: ["released", "rolled_back", "paused"],
  released: ["rolled_back", "paused"],
  rolled_back: [],
  paused: ["pending_approval", "evaluation_enabled", "suggest", "shadow", "canary_5", "canary_20", "canary_50", "partial_25", "partial_50", "partial_75", "stable", "rolled_back"],
};

export class RolloutStateMachine {
  public transition(
    candidate: ImprovementCandidate,
    nextLevel: RolloutLevel,
    options: RolloutTransitionOptions = {},
  ): RolloutRecord {
    const currentStatus = options.currentStatus ?? inferCurrentStatus(candidate, nextLevel);
    const targetStatus = options.targetStatus ?? inferStatusFromLevel(nextLevel, currentStatus);
    const allowedTransitions = ROLLOUT_TRANSITIONS[currentStatus] ?? [];
    if (currentStatus === targetStatus) {
      throw new Error(`Self-transition not allowed: ${currentStatus} -> ${targetStatus}`);
    }
    if (!allowedTransitions.includes(targetStatus)) {
      throw new Error(`Invalid rollout transition: ${currentStatus} -> ${targetStatus}`);
    }

    const fromLevel = inferLevelFromStatus(currentStatus);
    const record = parseRolloutRecord({
      recordId: newId("rollout"),
      candidateId: candidate.candidateId,
      fromLevel,
      toLevel: nextLevel,
      previousLevel: fromLevel,
      strategyVersionId: options.strategyVersionId ?? null,
      status: targetStatus,
      transitionedAt: Date.now(),
      approvedBy: options.approvedBy,
      guardrailReasonCodes: options.guardrailReasonCodes ?? [],
      evidence: [...candidate.sourceSignalRefs],
    });
    // level is a legacy alias for toLevel maintained for backwards compatibility
    (record as Record<string, unknown>)["level"] = nextLevel;
    return record;
  }
}

function inferCurrentStatus(candidate: ImprovementCandidate, nextLevel: RolloutLevel): RolloutStatus {
  switch (candidate.status) {
    case "candidate_created":
      return "candidate_created";
    case "under_review":
      return "under_review";
    case "proposed":
      return "draft";
    case "approved":
      return inferPreviousStatusFromLevel(nextLevel, "pending_approval");
    case "evaluating":
      return inferPreviousStatusFromLevel(nextLevel, "evaluation_enabled");
    case "shadow_running":
      return inferPreviousStatusFromLevel(nextLevel, "evaluation_enabled");
    case "rejected":
      return "rejected";
    case "rolled_back":
      return "rolled_back";
    default:
      return "candidate_created";
  }
}

function inferStatusFromLevel(level: RolloutLevel, currentStatus: RolloutStatus): RolloutStatus {
  switch (level) {
    case "off":
      return currentStatus === "candidate_created"
        || currentStatus === "under_review"
        || currentStatus === "draft"
        || currentStatus === "pending_approval"
        ? "rejected"
        : "rolled_back";
    case "evaluate_0":
      return "evaluation_enabled";
    case "suggest":
      return "pending_approval";
    case "shadow":
      return "shadow";
    case "canary_5":
      return "canary_5";
    case "canary_20":
      return "canary_20";
    case "canary_50":
      return "canary_50";
    case "partial_25":
      return "partial_25";
    case "partial_50":
      return "partial_50";
    case "partial_75":
      return "partial_75";
    case "stable":
      return "stable";
    case "stable_100":
      return "stable_100";
    default:
      return currentStatus === "candidate_created" || currentStatus === "under_review" || currentStatus === "draft" || currentStatus === "pending_approval"
        ? "rejected"
        : "rolled_back";
  }
}

function inferPreviousStatusFromLevel(level: RolloutLevel, fallback: RolloutStatus): RolloutStatus {
  switch (level) {
    case "off":
      return fallback;
    case "evaluate_0":
      return fallback;
    case "suggest":
      return fallback;
    case "shadow":
      return "evaluation_enabled";
    case "canary_5":
      return "shadow";
    case "canary_20":
      return "canary_5";
    case "canary_50":
      return "canary_20";
    case "partial_25":
      return "canary_5";
    case "partial_50":
      return "partial_25";
    case "partial_75":
      return "partial_50";
    case "stable":
      return "partial_75";
    case "stable_100":
      return "stable";
    default:
      return fallback;
  }
}

function inferLevelFromStatus(status: RolloutStatus): RolloutLevel {
  switch (status) {
    case "candidate_created":
    case "under_review":
    case "draft":
    case "pending_approval":
    case "rejected":
    case "rolled_back":
    case "paused":
      return "off";
    case "evaluation_enabled":
      return "suggest";
    case "suggest":
      return "suggest";
    case "shadow":
      return "shadow";
    case "canary_5":
      return "canary_5";
    case "canary_20":
      return "canary_20";
    case "canary_50":
      return "canary_50";
    case "partial_25":
      return "partial_25";
    case "partial_50":
      return "partial_50";
    case "partial_75":
      return "partial_75";
    case "stable":
    case "stable_100":
    case "released":
      return "stable_100";
    default:
      return "off";
  }
}
