import { newId } from "../../../../contracts/types/ids.js";
import { parseRolloutRecord, } from "../../types/rollout-record.js";
const ROLLOUT_TRANSITIONS = {
    draft: ["pending_approval", "shadow", "rejected", "rolled_back", "paused"],
    pending_approval: ["pending_approval", "shadow", "rejected", "paused"],
    shadow: ["shadow", "canary_5", "rolled_back", "paused"],
    canary_5: ["canary_5", "partial_25", "rolled_back", "paused"],
    partial_25: ["partial_25", "partial_50", "rolled_back", "paused"],
    partial_50: ["partial_50", "partial_75", "rolled_back", "paused"],
    partial_75: ["partial_75", "stable", "rolled_back", "paused"],
    stable: ["stable", "rolled_back", "paused"],
    rejected: ["rejected"],
    rolled_back: ["rolled_back"],
    paused: ["pending_approval", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable", "rolled_back", "paused"],
};
export class RolloutStateMachine {
    transition(candidate, nextLevel, options = {}) {
        const currentStatus = options.currentStatus ?? inferCurrentStatus(candidate);
        const targetStatus = options.targetStatus ?? inferStatusFromLevel(nextLevel);
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
function inferCurrentStatus(candidate) {
    switch (candidate.status) {
        case "approved":
            return "pending_approval";
        case "shadow_running":
            return "shadow";
        case "rejected":
            return "rejected";
        case "rolled_back":
            return "rolled_back";
        default:
            return "draft";
    }
}
function inferStatusFromLevel(level) {
    switch (level) {
        case "off":
            return "draft";
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
function inferLevelFromStatus(status) {
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
    }
}
//# sourceMappingURL=rollout-state-machine.js.map