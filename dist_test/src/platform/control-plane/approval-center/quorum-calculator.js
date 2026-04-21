/**
 * @fileoverview Quorum Calculator
 *
 * Calculates quorum status for multi-party approval decisions.
 * Supports N-of-M voting where N approvals are required and
 * M rejections trigger a denial.
 *
 * @see §21 HITL Architecture - Quorum-based approval
 */
import { nowIso } from "../../contracts/types/ids.js";
/**
 * Vote types in quorum voting.
 */
export var VoteType;
(function (VoteType) {
    VoteType["APPROVE"] = "approve";
    VoteType["REJECT"] = "reject";
    VoteType["ABSTAIN"] = "abstain";
})(VoteType || (VoteType = {}));
/**
 * Creates an initial quorum status.
 */
export function createInitialQuorumStatus() {
    return {
        isQuorumMet: false,
        isDenied: false,
        approvalsReceived: 0,
        rejectionsReceived: 0,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 0,
        remainingRejectionsNeeded: 0,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(),
    };
}
/**
 * Calculates the quorum status based on current votes and configuration.
 *
 * @param votes - Array of votes to evaluate
 * @param config - Quorum configuration
 * @param votingStartTime - When voting started (for window calculation)
 * @param currentTime - Current time (for window expiration check)
 * @returns The calculated quorum status
 */
export function calculateQuorumStatus(votes, config, votingStartTime, currentTime) {
    const approvalsReceived = votes.filter((v) => v.voteType === VoteType.APPROVE).length;
    const rejectionsReceived = votes.filter((v) => v.voteType === VoteType.REJECT).length;
    const abstentionsReceived = votes.filter((v) => v.voteType === VoteType.ABSTAIN).length;
    // Count unique approvers (not counting delegation sources)
    const uniqueApprovers = new Set(votes.map((v) => (v.delegationSource ?? v.approverId)));
    // Calculate if voting window has expired
    let isVotingWindowExpired = false;
    if (config.votingWindowMs !== undefined) {
        const startMs = new Date(votingStartTime).getTime();
        const currentMs = new Date(currentTime).getTime();
        isVotingWindowExpired = currentMs - startMs > config.votingWindowMs;
    }
    // Calculate remaining needed
    const remainingApprovalsNeeded = Math.max(0, config.minApprovals - approvalsReceived);
    const remainingRejectionsNeeded = Math.max(0, config.minRejectionsToDeny - rejectionsReceived);
    // Determine quorum and denial status
    const isQuorumMet = approvalsReceived >= config.minApprovals;
    const isDenied = rejectionsReceived >= config.minRejectionsToDeny;
    return {
        isQuorumMet,
        isDenied,
        approvalsReceived,
        rejectionsReceived,
        abstentionsReceived,
        remainingApprovalsNeeded,
        remainingRejectionsNeeded,
        isVotingWindowExpired,
        uniqueApprovers,
    };
}
/**
 * Checks if quorum has been met.
 *
 * @param status - Quorum status to check
 * @returns True if enough approvals have been received
 */
export function isQuorumMet(status) {
    return status.isQuorumMet;
}
/**
 * Checks if the approval should be denied.
 *
 * @param status - Quorum status to check
 * @returns True if enough rejections have been received
 */
export function isDenied(status) {
    return status.isDenied;
}
/**
 * Gets the number of remaining votes needed.
 *
 * @param status - Quorum status
 * @returns Object with remaining approvals and rejections needed
 */
export function getRemainingVotes(status) {
    return {
        approvals: status.remainingApprovalsNeeded,
        rejections: status.remainingRejectionsNeeded,
    };
}
/**
 * Merges a new vote with existing votes.
 * If the approver has already voted, updates their vote instead of adding.
 *
 * @param existing - Existing votes
 * @param newVote - New vote to add
 * @returns Merged vote array
 */
export function mergeVotes(existing, newVote) {
    const existingIndex = existing.findIndex((v) => v.approverId === newVote.approverId);
    if (existingIndex >= 0) {
        // Update existing vote
        const updated = [...existing];
        updated[existingIndex] = newVote;
        return updated;
    }
    return [...existing, newVote];
}
/**
 * Creates a new quorum vote.
 *
 * @param approverId - ID of the approver
 * @param voteType - Type of vote
 * @param delegationSource - Optional original approver if delegated
 * @param metadata - Optional metadata
 * @returns New quorum vote
 */
export function createVote(approverId, voteType, delegationSource, metadata) {
    const vote = {
        approverId,
        voteType,
        votedAt: nowIso(),
    };
    if (delegationSource !== undefined) {
        vote.delegationSource = delegationSource;
    }
    if (metadata !== undefined) {
        vote.metadata = metadata;
    }
    return vote;
}
/**
 * Determines the final flow status based on quorum status.
 *
 * @param status - Quorum status
 * @param config - Quorum config
 * @returns Final status: "approved", "rejected", or "pending"
 */
export function determineFinalStatus(status, config) {
    if (status.isQuorumMet) {
        return "approved";
    }
    if (status.isDenied) {
        return "rejected";
    }
    return "pending";
}
/**
 * Calculates quorum status and returns detailed result.
 * Combines vote merging and status calculation.
 *
 * @param existingVotes - Current votes
 * @param newVote - New vote to add
 * @param config - Quorum configuration
 * @param votingStartTime - When voting started
 * @param currentTime - Current time
 * @returns Merge result with updated votes and status
 */
export function calculateWithVote(existingVotes, newVote, config, votingStartTime, currentTime) {
    const mergedVotes = mergeVotes(existingVotes, newVote);
    const status = calculateQuorumStatus(mergedVotes, config, votingStartTime, currentTime);
    return { votes: mergedVotes, status };
}
/**
 * Validates that a vote is properly formed.
 *
 * @param vote - Vote to validate
 * @throws Error if vote is invalid
 */
export function validateVote(vote) {
    if (!vote.approverId || vote.approverId.trim().length === 0) {
        throw new Error("Vote must have a valid approverId");
    }
    if (!Object.values(VoteType).includes(vote.voteType)) {
        throw new Error(`Invalid vote type: ${vote.voteType}`);
    }
    if (!vote.votedAt) {
        throw new Error("Vote must have a votedAt timestamp");
    }
}
/**
 * Counts effective votes (excluding abstentions for approval count).
 *
 * @param votes - Votes to count
 * @returns Object with approval and rejection counts
 */
export function countEffectiveVotes(votes) {
    return {
        approvals: votes.filter((v) => v.voteType === VoteType.APPROVE).length,
        rejections: votes.filter((v) => v.voteType === VoteType.REJECT).length,
    };
}
/**
 * Checks if a specific approver has voted.
 *
 * @param votes - Current votes
 * @param approverId - Approver to check
 * @returns True if the approver has voted
 */
export function hasApproverVoted(votes, approverId) {
    return votes.some((v) => v.approverId === approverId);
}
/**
 * Gets the vote by a specific approver.
 *
 * @param votes - Current votes
 * @param approverId - Approver to find
 * @returns The vote or undefined if not found
 */
export function getApproverVote(votes, approverId) {
    return votes.find((v) => v.approverId === approverId);
}
//# sourceMappingURL=quorum-calculator.js.map