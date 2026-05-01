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

// §186-2187: Self-transitions are NOT allowed - they cause duplicate records and reset transitionedAt
// Each status can only transition to DIFFERENT statuses (no same-status transitions)
const ROLLOUT_TRANSITIONS: Readonly<Record<RolloutStatus, readonly RolloutStatus[]>> = {
  draft: ["pending_approval", "shadow", "rejected", "rolled_back", "paused"],
  pending_approval: ["shadow", "rejected", "paused"], // Removed self-transition
  shadow: ["canary_5", "rolled_back", "paused"],      // Removed self-transition
  canary_5: ["partial_25", "rolled_back", "paused"], // Removed self-transition
  partial_25: ["partial_50", "rolled_back", "paused"], // Removed self-transition
  partial_50: ["partial_75", "rolled_back", "paused"], // Removed self-transition
  partial_75: ["stable", "stable_75", "rolled_back", "paused"], // Removed self-transition
  stable_75: ["stable_100", "stable", "rolled_back", "paused"],
  stable_100: ["released", "stable", "rolled_back", "paused"],
  stable: ["rolled_back", "paused"],                  // Removed self-transition
  released: [],                                        // Terminal state - no transitions
  rejected: [],                                        // Terminal state - no transitions
  rolled_back: [],                                     // Terminal state - no transitions
  paused: ["pending_approval", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable", "stable_75", "stable_100", "rolled_back"], // Removed self-transition
  candidate_created: ["under_review", "draft", "rejected"],
  under_review: ["draft", "pending_approval", "rejected"],
  evaluation_enabled: ["canary_5", "partial_25", "stable_75", "stable_100", "rolled_back", "paused"],
  // Additional states from RolloutStatus that may not have explicit transitions defined
  // they fall back to the default behavior via the switch statement in inferStatusFromLevel
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
    if (!allowedTransitions.includes(targetStatus)) {
      throw new Error(`Invalid rollout transition: ${currentStatus} -> ${targetStatus}`);
    }
    const previousLevel = inferLevelFromStatus(currentStatus);
    return parseRolloutRecord({
      recordId: newId("rollout"),
      candidateId: candidate.candidateId,
      level: nextLevel,
      previousLevel,
      strategyVersionId: options.strategyVersionId ?? null,
      status: targetStatus,
      transitionedAt: Date.now(),
      approvedBy: options.approvedBy,
      guardrailReasonCodes: options.guardrailReasonCodes ?? [],
      evidence: [...candidate.sourceSignalRefs],
    });
  }
}

function inferCurrentStatus(candidate: ImprovementCandidate, nextLevel: RolloutLevel): RolloutStatus {
  switch (candidate.status) {
    case "approved":
      if (nextLevel === "off") {
        return "stable";
      }
      return inferPreviousStatusFromLevel(nextLevel, "pending_approval");
    case "shadow_running":
      return inferPreviousStatusFromLevel(nextLevel, "shadow");
    case "rejected":
      return "rejected";
    case "rolled_back":
      return "rolled_back";
    default:
      return "draft";
  }
}

function inferStatusFromLevel(level: RolloutLevel, currentStatus: RolloutStatus): RolloutStatus {
  switch (level) {
    case "off":
      return currentStatus === "draft" ? "rejected" : "rolled_back";
    case "suggest":
      return "pending_approval";
    case "shadow":
      return "shadow";
    case "canary_5":
      return "canary_5";
    case "partial_25":
      return "partial_25";
    case "partial_50":
      return "partial_50";
    case "partial_75":
      return "partial_75";
    case "stable":
      return "stable";
  }
}

function inferPreviousStatusFromLevel(level: RolloutLevel, fallback: RolloutStatus): RolloutStatus {
  switch (level) {
    case "off":
      return fallback;
    case "suggest":
      return "draft";
    case "shadow":
      return fallback === "pending_approval" ? "pending_approval" : "draft";
    case "canary_5":
      return "shadow";
    case "partial_25":
      return "canary_5";
    case "partial_50":
      return "partial_25";
    case "partial_75":
      return "partial_50";
    case "stable":
      return "partial_75";
  }
}

function inferLevelFromStatus(status: RolloutStatus): RolloutLevel {
  switch (status) {
    case "draft":
    case "rejected":
    case "rolled_back":
      return "off";
    case "pending_approval":
      return "suggest";
    case "shadow":
      return "shadow";
    case "canary_5":
      return "canary_5";
    case "partial_25":
      return "partial_25";
    case "partial_50":
      return "partial_50";
    case "partial_75":
      return "partial_75";
    case "stable":
      return "stable";
    case "paused":
      return "suggest";
    case "candidate_created":
    case "under_review":
    case "evaluation_enabled":
      return "off";
    case "stable_75":
      return "partial_75";
    case "stable_100":
    case "released":
      return "stable";
  }
}
