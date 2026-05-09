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
  released: ["released", "rolled_back", "paused"],
  rejected: ["rejected"],
  rolled_back: ["rolled_back"],
  paused: ["under_review", "approved", "evaluation_enabled", "canary_5", "partial_25", "stable_75", "stable_100", "released", "rolled_back", "paused"],
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
  switch (level) {
    case "off":
      return currentStatus === "candidate_created" || currentStatus === "under_review" || currentStatus === "approved"
        ? "rejected"
        : "rolled_back";
    case "evaluate_0":
      return "evaluation_enabled";
    case "canary_5":
      return "canary_5";
    case "partial_25":
      return "partial_25";
    case "stable_75":
      return "stable_75";
    case "stable_100":
      return currentStatus === "stable_100" ? "released" : "stable_100";
  }
}

function inferLevelFromStatus(status: RolloutStatus): RolloutLevel {
  switch (status) {
    case "candidate_created":
    case "under_review":
    case "approved":
    case "rejected":
    case "rolled_back":
      return "off";
    case "evaluation_enabled":
      return "evaluate_0";
    case "canary_5":
      return "canary_5";
    case "partial_25":
      return "partial_25";
    case "stable_75":
      return "stable_75";
    case "stable_100":
    case "released":
      return "stable_100";
    case "paused":
      return "off";
  }
}
