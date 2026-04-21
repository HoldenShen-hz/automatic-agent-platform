/**
 * @fileoverview Quorum Calculator
 *
 * Calculates quorum status for multi-party approval decisions.
 * Supports N-of-M voting where N approvals are required and
 * M rejections trigger a denial.
 *
 * @see §21 HITL Architecture - Quorum-based approval
 */
/**
 * Vote types in quorum voting.
 */
export declare enum VoteType {
    APPROVE = "approve",
    REJECT = "reject",
    ABSTAIN = "abstain"
}
/**
 * Configuration for quorum calculation.
 */
export interface QuorumConfig {
    /** Number of approvals required (N-of-M) */
    minApprovals: number;
    /** Number of rejections that trigger denial */
    minRejectionsToDeny: number;
    /** Time window for voting in milliseconds (optional) */
    votingWindowMs?: number;
}
/**
 * A single vote in the quorum.
 */
export interface QuorumVote {
    approverId: string;
    voteType: VoteType;
    votedAt: string;
    /** If delegated, the original approver who delegated */
    delegationSource?: string;
    /** Optional metadata about the vote */
    metadata?: Record<string, unknown>;
}
/**
 * Status of quorum calculation.
 */
export interface QuorumStatus {
    /** Whether quorum has been met (enough approvals) */
    isQuorumMet: boolean;
    /** Whether the approval is denied (enough rejections) */
    isDenied: boolean;
    /** Number of approvals received */
    approvalsReceived: number;
    /** Number of rejections received */
    rejectionsReceived: number;
    /** Number of abstentions received */
    abstentionsReceived: number;
    /** Approvals still needed to meet quorum */
    remainingApprovalsNeeded: number;
    /** Additional rejections needed to deny */
    remainingRejectionsNeeded: number;
    /** Whether the voting window has expired */
    isVotingWindowExpired: boolean;
    /** Unique approvers who have voted */
    uniqueApprovers: Set<string>;
}
/**
 * Result of merging a new vote with existing votes.
 */
export interface MergeResult {
    votes: QuorumVote[];
    status: QuorumStatus;
}
/**
 * Creates an initial quorum status.
 */
export declare function createInitialQuorumStatus(): QuorumStatus;
/**
 * Calculates the quorum status based on current votes and configuration.
 *
 * @param votes - Array of votes to evaluate
 * @param config - Quorum configuration
 * @param votingStartTime - When voting started (for window calculation)
 * @param currentTime - Current time (for window expiration check)
 * @returns The calculated quorum status
 */
export declare function calculateQuorumStatus(votes: QuorumVote[], config: QuorumConfig, votingStartTime: string, currentTime: string): QuorumStatus;
/**
 * Checks if quorum has been met.
 *
 * @param status - Quorum status to check
 * @returns True if enough approvals have been received
 */
export declare function isQuorumMet(status: QuorumStatus): boolean;
/**
 * Checks if the approval should be denied.
 *
 * @param status - Quorum status to check
 * @returns True if enough rejections have been received
 */
export declare function isDenied(status: QuorumStatus): boolean;
/**
 * Gets the number of remaining votes needed.
 *
 * @param status - Quorum status
 * @returns Object with remaining approvals and rejections needed
 */
export declare function getRemainingVotes(status: QuorumStatus): {
    approvals: number;
    rejections: number;
};
/**
 * Merges a new vote with existing votes.
 * If the approver has already voted, updates their vote instead of adding.
 *
 * @param existing - Existing votes
 * @param newVote - New vote to add
 * @returns Merged vote array
 */
export declare function mergeVotes(existing: QuorumVote[], newVote: QuorumVote): QuorumVote[];
/**
 * Creates a new quorum vote.
 *
 * @param approverId - ID of the approver
 * @param voteType - Type of vote
 * @param delegationSource - Optional original approver if delegated
 * @param metadata - Optional metadata
 * @returns New quorum vote
 */
export declare function createVote(approverId: string, voteType: VoteType, delegationSource?: string, metadata?: Record<string, unknown>): QuorumVote;
/**
 * Determines the final flow status based on quorum status.
 *
 * @param status - Quorum status
 * @param config - Quorum config
 * @returns Final status: "approved", "rejected", or "pending"
 */
export declare function determineFinalStatus(status: QuorumStatus, config: QuorumConfig): "approved" | "rejected" | "pending";
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
export declare function calculateWithVote(existingVotes: QuorumVote[], newVote: QuorumVote, config: QuorumConfig, votingStartTime: string, currentTime: string): MergeResult;
/**
 * Validates that a vote is properly formed.
 *
 * @param vote - Vote to validate
 * @throws Error if vote is invalid
 */
export declare function validateVote(vote: QuorumVote): void;
/**
 * Counts effective votes (excluding abstentions for approval count).
 *
 * @param votes - Votes to count
 * @returns Object with approval and rejection counts
 */
export declare function countEffectiveVotes(votes: QuorumVote[]): {
    approvals: number;
    rejections: number;
};
/**
 * Checks if a specific approver has voted.
 *
 * @param votes - Current votes
 * @param approverId - Approver to check
 * @returns True if the approver has voted
 */
export declare function hasApproverVoted(votes: QuorumVote[], approverId: string): boolean;
/**
 * Gets the vote by a specific approver.
 *
 * @param votes - Current votes
 * @param approverId - Approver to find
 * @returns The vote or undefined if not found
 */
export declare function getApproverVote(votes: QuorumVote[], approverId: string): QuorumVote | undefined;
