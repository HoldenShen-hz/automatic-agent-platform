/**
 * Integration Test: Quorum Calculator
 *
 * Verifies quorum calculation for multi-party approval workflows.
 * Tests N-of-M voting, vote merging, and quorum status determination.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  VoteType,
  createInitialQuorumStatus,
  calculateQuorumStatus,
  isQuorumMet,
  isDenied,
  getRemainingVotes,
  mergeVotes,
  createVote,
  determineFinalStatus,
  calculateWithVote,
  validateVote,
  countEffectiveVotes,
  hasApproverVoted,
  getApproverVote,
  type QuorumConfig,
  type QuorumVote,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/quorum-calculator.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("quorum calculator: initial status shows zero votes", () => {
  const status = createInitialQuorumStatus();

  assert.strictEqual(status.approvalsReceived, 0);
  assert.strictEqual(status.rejectionsReceived, 0);
  assert.strictEqual(status.abstentionsReceived, 0);
  assert.strictEqual(status.isQuorumMet, false);
  assert.strictEqual(status.isDenied, false);
  assert.strictEqual(status.isVotingWindowExpired, false);
  assert.strictEqual(status.remainingApprovalsNeeded, 0);
  assert.strictEqual(status.remainingRejectionsNeeded, 0);
});

test("quorum calculator: single approval meets quorum of 1", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1 };
  const status = calculateQuorumStatus(votes, config, nowIso(), nowIso());

  assert.strictEqual(status.approvalsReceived, 1);
  assert.strictEqual(status.isQuorumMet, true);
  assert.strictEqual(status.isDenied, false);
  assert.strictEqual(status.remainingApprovalsNeeded, 0);
});

test("quorum calculator: two-of-three quorum requires two approvals", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
    createVote("approver-2", VoteType.APPROVE),
  ];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const status = calculateQuorumStatus(votes, config, nowIso(), nowIso());

  assert.strictEqual(status.approvalsReceived, 2);
  assert.strictEqual(status.isQuorumMet, true);
  assert.strictEqual(status.remainingApprovalsNeeded, 0);
});

test("quorum calculator: partial approvals show remaining needed", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 3 };
  const status = calculateQuorumStatus(votes, config, nowIso(), nowIso());

  assert.strictEqual(status.approvalsReceived, 1);
  assert.strictEqual(status.isQuorumMet, false);
  assert.strictEqual(status.remainingApprovalsNeeded, 2);
});

test("quorum calculator: rejections trigger denial", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.REJECT),
    createVote("approver-2", VoteType.REJECT),
  ];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const status = calculateQuorumStatus(votes, config, nowIso(), nowIso());

  assert.strictEqual(status.rejectionsReceived, 2);
  assert.strictEqual(status.isDenied, true);
  assert.strictEqual(status.remainingRejectionsNeeded, 0);
});

test("quorum calculator: abstentions do not count toward approvals", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
    createVote("approver-2", VoteType.ABSTAIN),
  ];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const status = calculateQuorumStatus(votes, config, nowIso(), nowIso());

  assert.strictEqual(status.approvalsReceived, 1);
  assert.strictEqual(status.abstentionsReceived, 1);
  assert.strictEqual(status.isQuorumMet, false);
});

test("quorum calculator: voting window expiration", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1, votingWindowMs: 1000 };
  const startTime = new Date(Date.now() - 2000).toISOString();
  const endTime = nowIso();
  const status = calculateQuorumStatus(votes, config, startTime, endTime);

  assert.strictEqual(status.isVotingWindowExpired, true);
});

test("quorum calculator: voting window not expired within window", () => {
  const votes: QuorumVote[] = [];
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1, votingWindowMs: 60000 };
  const startTime = new Date(Date.now() - 30000).toISOString();
  const endTime = nowIso();
  const status = calculateQuorumStatus(votes, config, startTime, endTime);

  assert.strictEqual(status.isVotingWindowExpired, false);
});

test("quorum calculator: mergeVotes updates existing approver vote", () => {
  const existing: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const newVote = createVote("approver-1", VoteType.REJECT);
  const merged = mergeVotes(existing, newVote);

  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0]!.voteType, VoteType.REJECT);
});

test("quorum calculator: mergeVotes adds new approver vote", () => {
  const existing: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const newVote = createVote("approver-2", VoteType.APPROVE);
  const merged = mergeVotes(existing, newVote);

  assert.strictEqual(merged.length, 2);
});

test("quorum calculator: determineFinalStatus returns approved when quorum met", () => {
  const status = createInitialQuorumStatus();
  status.isQuorumMet = true;
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1 };
  const finalStatus = determineFinalStatus(status, config);

  assert.strictEqual(finalStatus, "approved");
});

test("quorum calculator: determineFinalStatus returns rejected when denied", () => {
  const status = createInitialQuorumStatus();
  status.isDenied = true;
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1 };
  const finalStatus = determineFinalStatus(status, config);

  assert.strictEqual(finalStatus, "rejected");
});

test("quorum calculator: determineFinalStatus returns pending when neither met", () => {
  const status = createInitialQuorumStatus();
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1 };
  const finalStatus = determineFinalStatus(status, config);

  assert.strictEqual(finalStatus, "pending");
});

test("quorum calculator: calculateWithVote merges and calculates status", () => {
  const existing: QuorumVote[] = [];
  const newVote = createVote("approver-1", VoteType.APPROVE);
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 1 };
  const result = calculateWithVote(existing, newVote, config, nowIso(), nowIso());

  assert.strictEqual(result.votes.length, 1);
  assert.strictEqual(result.status.approvalsReceived, 1);
  assert.strictEqual(result.status.isQuorumMet, true);
});

test("quorum calculator: validateVote throws for empty approverId", () => {
  const invalidVote: QuorumVote = {
    approverId: "",
    voteType: VoteType.APPROVE,
    votedAt: nowIso(),
  };

  assert.throws(() => validateVote(invalidVote), /approverId/);
});

test("quorum calculator: validateVote throws for invalid vote type", () => {
  const invalidVote: QuorumVote = {
    approverId: "approver-1",
    voteType: "invalid" as VoteType,
    votedAt: nowIso(),
  };

  assert.throws(() => validateVote(invalidVote), /vote type/);
});

test("quorum calculator: countEffectiveVotes excludes abstentions", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
    createVote("approver-2", VoteType.REJECT),
    createVote("approver-3", VoteType.ABSTAIN),
  ];
  const counts = countEffectiveVotes(votes);

  assert.strictEqual(counts.approvals, 1);
  assert.strictEqual(counts.rejections, 1);
});

test("quorum calculator: hasApproverVoted detects existing approver", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const result = hasApproverVoted(votes, "approver-1");

  assert.strictEqual(result, true);
});

test("quorum calculator: hasApproverVoted returns false for unknown approver", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const result = hasApproverVoted(votes, "approver-2");

  assert.strictEqual(result, false);
});

test("quorum calculator: getApproverVote returns vote for existing approver", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const vote = getApproverVote(votes, "approver-1");

  assert.ok(vote);
  assert.strictEqual(vote!.approverId, "approver-1");
});

test("quorum calculator: getApproverVote returns undefined for unknown approver", () => {
  const votes: QuorumVote[] = [
    createVote("approver-1", VoteType.APPROVE),
  ];
  const vote = getApproverVote(votes, "approver-2");

  assert.strictEqual(vote, undefined);
});

test("quorum calculator: createVote includes delegation source when provided", () => {
  const vote = createVote("delegate-1", VoteType.APPROVE, "original-approver");

  assert.strictEqual(vote.approverId, "delegate-1");
  assert.strictEqual(vote.delegationSource, "original-approver");
});

test("quorum calculator: uniqueApprovers counts delegation sources correctly", () => {
  const votes: QuorumVote[] = [
    createVote("delegate-1", VoteType.APPROVE, "original-approver"),
    createVote("delegate-2", VoteType.APPROVE, "original-approver"),
  ];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const status = calculateQuorumStatus(votes, config, nowIso(), nowIso());

  // Both delegate-1 and delegate-2 map to their delegationSource "original-approver"
  // So we should have 1 unique approver (original-approver via delegation)
  assert.strictEqual(status.uniqueApprovers.size, 1);
  assert.ok(status.uniqueApprovers.has("original-approver"));
});
