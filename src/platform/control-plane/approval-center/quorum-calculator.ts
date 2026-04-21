/**
 * @fileoverview Quorum Calculator
 *
 * Calculates quorum status for multi-party approval decisions.
 * Supports N-of-M voting where N approvals are required and
 * M rejections trigger a denial.
 *
 * @see §21 HITL Architecture - Quorum-based approval
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Vote types in quorum voting.
 */
export enum VoteType {
  APPROVE = "approve",
  REJECT = "reject",
  ABSTAIN = "abstain",
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
export function createInitialQuorumStatus(): QuorumStatus {
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
export function calculateQuorumStatus(
  votes: QuorumVote[],
  config: QuorumConfig,
  votingStartTime: string,
  currentTime: string,
): QuorumStatus {
  const approvalsReceived = votes.filter((v) => v.voteType === VoteType.APPROVE).length;
  const rejectionsReceived = votes.filter((v) => v.voteType === VoteType.REJECT).length;
  const abstentionsReceived = votes.filter((v) => v.voteType === VoteType.ABSTAIN).length;

  // Count unique approvers (not counting delegation sources)
  const uniqueApprovers = new Set(
    votes.map((v) => (v.delegationSource ?? v.approverId)),
  );

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
export function isQuorumMet(status: QuorumStatus): boolean {
  return status.isQuorumMet;
}

/**
 * Checks if the approval should be denied.
 *
 * @param status - Quorum status to check
 * @returns True if enough rejections have been received
 */
export function isDenied(status: QuorumStatus): boolean {
  return status.isDenied;
}

/**
 * Gets the number of remaining votes needed.
 *
 * @param status - Quorum status
 * @returns Object with remaining approvals and rejections needed
 */
export function getRemainingVotes(status: QuorumStatus): { approvals: number; rejections: number } {
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
export function mergeVotes(existing: QuorumVote[], newVote: QuorumVote): QuorumVote[] {
  const existingIndex = existing.findIndex(
    (v) => v.approverId === newVote.approverId,
  );

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
export function createVote(
  approverId: string,
  voteType: VoteType,
  delegationSource?: string,
  metadata?: Record<string, unknown>,
): QuorumVote {
  const vote: QuorumVote = {
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
export function determineFinalStatus(
  status: QuorumStatus,
  config: QuorumConfig,
): "approved" | "rejected" | "pending" {
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
export function calculateWithVote(
  existingVotes: QuorumVote[],
  newVote: QuorumVote,
  config: QuorumConfig,
  votingStartTime: string,
  currentTime: string,
): MergeResult {
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
export function validateVote(vote: QuorumVote): void {
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
export function countEffectiveVotes(votes: QuorumVote[]): { approvals: number; rejections: number } {
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
export function hasApproverVoted(votes: QuorumVote[], approverId: string): boolean {
  return votes.some((v) => v.approverId === approverId);
}

/**
 * Gets the vote by a specific approver.
 *
 * @param votes - Current votes
 * @param approverId - Approver to find
 * @returns The vote or undefined if not found
 */
export function getApproverVote(votes: QuorumVote[], approverId: string): QuorumVote | undefined {
  return votes.find((v) => v.approverId === approverId);
}
