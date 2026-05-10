/**
 * Integration Tests: Approval Center
 *
 * NOTE: These tests validate type definitions and API contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  VoteType,
  QuorumConfig,
  QuorumVote,
  QuorumStatus,
  createInitialQuorumStatus,
  calculateQuorumStatus,
  isQuorumMet,
  mergeVotes,
  createVote,
  determineFinalStatus,
  type FlowType,
  type FlowStatus,
  type NotificationPriority,
  type DelegationStatus,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

// ============================================================================
// Type Validation Tests
// ============================================================================

test("integration: ApprovalDecision structure via direct property check", () => {
  // Test that enum values exist and are valid
  const approveVote = VoteType.APPROVE;
  const rejectVote = VoteType.REJECT;
  const abstainVote = VoteType.ABSTAIN;

  assert.equal(approveVote, "approve");
  assert.equal(rejectVote, "reject");
  assert.equal(abstainVote, "abstain");
});

test("integration: QuorumConfig type structure", () => {
  const config: QuorumConfig = {
    minApprovals: 2,
    minRejectionsToDeny: 2,
    votingWindowMs: 3600000,
  };

  assert.equal(config.minApprovals, 2);
  assert.equal(config.minRejectionsToDeny, 2);
  assert.ok(config.votingWindowMs !== undefined);
});

test("integration: QuorumVote structure", () => {
  const vote: QuorumVote = {
    approverId: "approver_001",
    voteType: VoteType.APPROVE,
    votedAt: "2026-04-29T00:00:00.000Z",
  };

  assert.equal(vote.approverId, "approver_001");
  assert.equal(vote.voteType, VoteType.APPROVE);
});

test("integration: QuorumStatus structure", () => {
  const status: QuorumStatus = {
    isQuorumMet: false,
    isDenied: false,
    approvalsReceived: 1,
    rejectionsReceived: 0,
    abstentionsReceived: 0,
    remainingApprovalsNeeded: 1,
    remainingRejectionsNeeded: 2,
    isVotingWindowExpired: false,
    uniqueApprovers: new Set(["approver_001"]),
  };

  assert.equal(status.isQuorumMet, false);
  assert.equal(status.approvalsReceived, 1);
  assert.ok(status.uniqueApprovers instanceof Set);
});

test("integration: initial quorum status", () => {
  const status = createInitialQuorumStatus();

  assert.equal(status.isQuorumMet, false);
  assert.equal(status.isDenied, false);
  assert.equal(status.approvalsReceived, 0);
  assert.equal(status.uniqueApprovers.size, 0);
});

test("integration: calculate quorum with enough approvals", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const votes: QuorumVote[] = [
    { approverId: "approver_001", voteType: VoteType.APPROVE, votedAt: "2026-04-29T00:00:00.000Z" },
    { approverId: "approver_002", voteType: VoteType.APPROVE, votedAt: "2026-04-29T00:01:00.000Z" },
  ];

  const status = calculateQuorumStatus(votes, config, "2026-04-29T00:00:00.000Z", "2026-04-29T00:05:00.000Z");

  assert.equal(isQuorumMet(status), true);
});

test("integration: calculate quorum not met", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const votes: QuorumVote[] = [
    { approverId: "approver_001", voteType: VoteType.APPROVE, votedAt: "2026-04-29T00:00:00.000Z" },
  ];

  const status = calculateQuorumStatus(votes, config, "2026-04-29T00:00:00.000Z", "2026-04-29T00:05:00.000Z");

  assert.equal(isQuorumMet(status), false);
  assert.equal(status.remainingApprovalsNeeded, 1);
});

test("integration: merge votes", () => {
  const existing: QuorumVote[] = [
    { approverId: "approver_001", voteType: VoteType.APPROVE, votedAt: "2026-04-29T00:00:00.000Z" },
  ];
  const newVote: QuorumVote = {
    approverId: "approver_002",
    voteType: VoteType.APPROVE,
    votedAt: "2026-04-29T00:01:00.000Z",
  };

  const merged = mergeVotes(existing, newVote);
  assert.equal(merged.length, 2);
});

test("integration: create vote", () => {
  const vote = createVote("approver_001", VoteType.APPROVE);
  assert.equal(vote.approverId, "approver_001");
  assert.equal(vote.voteType, VoteType.APPROVE);
  assert.ok(vote.votedAt.length > 0);
});

test("integration: determine final status - approved", () => {
  const status: QuorumStatus = {
    isQuorumMet: true,
    isDenied: false,
    approvalsReceived: 2,
    rejectionsReceived: 0,
    abstentionsReceived: 0,
    remainingApprovalsNeeded: 0,
    remainingRejectionsNeeded: 2,
    isVotingWindowExpired: false,
    uniqueApprovers: new Set(),
  };
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };

  const finalStatus = determineFinalStatus(status, config);
  assert.equal(finalStatus, "approved");
});

test("integration: FlowType enum values", () => {
  // These are exported from approval-flow-engine
  const flowTypes: FlowType[] = ["SINGLE_APPROVER", "MULTI_PARTY", "HUMAN_REVIEW", "AUTO_APPROVE"];
  assert.equal(flowTypes.length, 4);
});

test("integration: FlowStatus enum values", () => {
  const statuses: FlowStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "EXPIRED", "CANCELLED"];
  assert.equal(statuses.length, 5);
});

test("integration: NotificationPriority values", () => {
  const priorities: NotificationPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
  assert.equal(priorities.length, 4);
});

test("integration: DelegationStatus values", () => {
  const statuses: DelegationStatus[] = ["ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"];
  assert.equal(statuses.length, 4);
});