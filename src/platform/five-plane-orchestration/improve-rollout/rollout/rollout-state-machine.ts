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
  triggeredBy?: "scheduler" | "human" | "auto_rollback" | undefined;
  triggerReason?: string | undefined;
  metrics?: RolloutRecord["metrics"] | undefined;
}

const ROLLOUT_TRANSITIONS: Readonly<Record<RolloutStatus, readonly RolloutStatus[]>> = {
  candidate_created: ["under_review", "rejected", "paused"],
  under_review: ["approved", "rejected", "paused"],
  approved: ["evaluation_enabled", "rejected", "paused"],
  evaluation_enabled: ["canary_5", "rolled_back", "paused"],
  canary_5: ["partial_25", "rolled_back", "paused"],
  partial_25: ["stable_75", "rolled_back", "paused"],
  stable_75: ["stable_100", "rolled_back", "paused"],
  stable_100: ["released", "rolled_back", "paused"],
  released: ["rolled_back", "paused"],
  rejected: [],
  rolled_back: [],
  paused: ["under_review", "approved", "evaluation_enabled", "canary_5", "partial_25", "stable_75", "stable_100", "released"],
};

export class RolloutStateMachine {
  public transition(
    candidate: ImprovementCandidate,
    nextLevel: RolloutLevel,
    options: RolloutTransitionOptions = {},
  ): RolloutRecord {
    const currentStatus = options.currentStatus ?? inferCurrentStatus(candidate);
    const targetStatus = options.targetStatus ?? inferStatusFromLevel(nextLevel, currentStatus);
    const allowedTransitions = ROLLOUT_TRANSITIONS[currentStatus] ?? [];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new Error(`Invalid rollout transition: ${currentStatus} -> ${targetStatus}`);
    }
    const previousLevel = inferLevelFromStatus(currentStatus);
    const guardrailReasonCodes = [...(options.guardrailReasonCodes ?? [])];
    const evidence = [...candidate.sourceSignalRefs];
    return parseRolloutRecord({
      recordId: newId("rollout"),
      candidateId: candidate.candidateId,
      level: nextLevel,
      previousLevel,
      fromLevel: previousLevel,
      toLevel: nextLevel,
      strategyVersionId: options.strategyVersionId ?? null,
      status: targetStatus,
      transitionedAt: Date.now(),
      approvedBy: options.approvedBy,
      triggeredBy: options.triggeredBy ?? (options.approvedBy == null ? "scheduler" : "human"),
      triggerReason: options.triggerReason,
      metrics: options.metrics,
      guardrailReasonCodes,
      auditContext: {
        ...(options.approvedBy == null ? {} : { approvedBy: options.approvedBy }),
        evidenceRefs: evidence,
        reasonCodes: guardrailReasonCodes,
      },
      evidence,
    });
  }
}

function inferCurrentStatus(candidate: ImprovementCandidate): RolloutStatus {
  return candidate.status;
}

function inferStatusFromLevel(level: RolloutLevel, currentStatus: RolloutStatus): RolloutStatus {
  // R23-43 fix: Use L0-L5 level naming for standardized rollout progression
  switch (level) {
    case "L0_off":
      return currentStatus === "candidate_created" || currentStatus === "under_review" || currentStatus === "approved"
        ? "rejected"
        : "rolled_back";
    case "L1_evaluate":
      return "evaluation_enabled";
    case "L2_canary":
      return "canary_5";
    case "L3_partial":
      return "partial_25";
    case "L4_stable":
      return "stable_75";
    case "L5_full":
      return currentStatus === "stable_100" ? "released" : "stable_100";
  }
}

function inferLevelFromStatus(status: RolloutStatus): RolloutLevel {
  // R23-43 fix: Use L0-L5 level naming for standardized rollout progression
  switch (status) {
    case "candidate_created":
    case "under_review":
    case "approved":
    case "rejected":
    case "rolled_back":
      return "L0_off";
    case "evaluation_enabled":
      return "L1_evaluate";
    case "canary_5":
      return "L2_canary";
    case "partial_25":
      return "L3_partial";
    case "stable_75":
      return "L4_stable";
    case "stable_100":
    case "released":
      return "L5_full";
    case "paused":
      return "L0_off";
  }
}
