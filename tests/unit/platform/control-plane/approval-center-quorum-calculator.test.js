import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateQuorumStatus,
  createInitialQuorumStatus,
  isQuorumMet,
  isDenied,
  getRemainingVotes,
  mergeVotes,
  createVote,
  VoteType,
  determineFinalStatus,
  calculateWithVote,
  validateVote,
  countEffectiveVotes,
  hasApproverVoted,
  getApproverVote,
  QuorumCalculator,
} from "../../../../../../src/platform/control-plane/approval-center/quorum-calculator.js";

test("quorum-calculator createInitialQuorumStatus returns correct structure", () => {
  const status = createInitialQuorumStatus();
  assert.equal(status.isQuorumMet, false);
  assert.equal(status.isDenied, false);
  assert.equal(status.approvalsReceived, 0);
  assert.equal(status.rejectionsReceived, 0);
  assert.equal(status.abstentionsReceived, 0);
});

test("quorum-calculator calculateQuorumStatus with no votes", () => {
  const config = { minApprovals: 2, minRejectionsToDeny: 3 };
  const status = calculateQuorumStatus([], config, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
  assert.equal(status.isQuorumMet, false);
  assert.equal(status.isDenied, false);
  assert.equal(status.approvalsReceived, 0);
  assert.equal(status.remainingApprovalsNeeded, 2);
});

test("quorum-calculator calculateQuorumStatus with enough approvals", () => {
  const votes = [
    createVote("user1", VoteType.APPROVE),
    createVote("user2", VoteType.APPROVE),
  ];
  const config = { minApprovals: 2, minRejectionsToDeny: 3 };
  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);
  assert.equal(status.isQuorumMet, true);
  assert.equal(status.remainingApprovalsNeeded, 0);
});

test("quorum-calculator calculateQuorumStatus with enough rejections", () => {
  const votes = [
    createVote("user1", VoteType.REJECT),
    createVote("user2", VoteType.REJECT),
    createVote("user3", VoteType.REJECT),
  ];
  const config = { minApprovals: 2, minRejectionsToDeny: 3 };
  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[2]!.votedAt);
  assert.equal(status.isDenied, true);
});

test("quorum-calculator calculateQuorumStatus with abstentions", () => {
  const votes = [
    createVote("user1", VoteType.APPROVE),
    createVote("user2", VoteType.ABSTAIN),
  ];
  const config = { minApprovals: 2, minRejectionsToDeny: 3 };
  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);
  assert.equal(status.approvalsReceived, 1);
  assert.equal(status.abstentionsReceived, 1);
  assert.equal(status.isQuorumMet, false);
});

test("quorum-calculator calculateQuorumStatus with voting window", () => {
  const votes = [createVote("user1", VoteType.APPROVE)];
  const config = { minApprovals: 2, minRejectionsToDeny: 3, votingWindowMs: 100 };
  const startTime = "2026-01-01T00:00:00Z";
  const expiredTime = "2026-01-01T00:00:01Z";
  const status = calculateQuorumStatus(votes, config, startTime, expiredTime);
  assert.equal(status.isVotingWindowExpired, true);
});

test("quorum-calculator isQuorumMet returns correct boolean", () => {
  const status = { ...createInitialQuorumStatus(), isQuorumMet: true };
  assert.equal(isQuorumMet(status), true);
  assert.equal(isQuorumMet({ ...createInitialQuorumStatus(), isQuorumMet: false }), false);
});

test("quorum-calculator isDenied returns correct boolean", () => {
  const status = { ...createInitialQuorumStatus(), isDenied: true };
  assert.equal(isDenied(status), true);
  assert.equal(isDenied({ ...createInitialQuorumStatus(), isDenied: false }), false);
});

test("quorum-calculator getRemainingVotes returns correct values", () => {
  const status = { ...createInitialQuorumStatus(), remainingApprovalsNeeded: 2, remainingRejectionsNeeded: 1 };
  const remaining = getRemainingVotes(status);
  assert.equal(remaining.approvals, 2);
  assert.equal(remaining.rejections, 1);
});

test("quorum-calculator mergeVotes adds new vote", () => {
  const existing: ReturnType<typeof createVote>[] = [];
  const newVote = createVote("user1", VoteType.APPROVE);
  const merged = mergeVotes(existing, newVote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.approverId, "user1");
});

test("quorum-calculator mergeVotes updates existing vote", () => {
  const existing = [createVote("user1", VoteType.APPROVE)];
  const updatedVote = { ...createVote("user1", VoteType.REJECT), votedAt: existing[0]!.votedAt };
  const merged = mergeVotes(existing, updatedVote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.voteType, VoteType.REJECT);
});

test("quorum-calculator createVote creates valid vote", () => {
  const vote = createVote("user1", VoteType.APPROVE);
  assert.equal(vote.approverId, "user1");
  assert.equal(vote.voteType, VoteType.APPROVE);
  assert.ok(vote.votedAt);
});

test("quorum-calculator createVote with delegation source", () => {
  const vote = createVote("user2", VoteType.APPROVE, "user1");
  assert.equal(vote.approverId, "user2");
  assert.equal(vote.delegationSource, "user1");
});

test("quorum-calculator createVote with metadata", () => {
  const vote = createVote("user1", VoteType.APPROVE, undefined, { reason: "looks good" });
  assert.deepEqual(vote.metadata, { reason: "looks good" });
});

test("quorum-calculator determineFinalStatus returns correct status", () => {
  assert.equal(determineFinalStatus({ ...createInitialQuorumStatus(), isQuorumMet: true }, { minApprovals: 1, minRejectionsToDeny: 1 }), "approved");
  assert.equal(determineFinalStatus({ ...createInitialQuorumStatus(), isDenied: true }, { minApprovals: 1, minRejectionsToDeny: 1 }), "rejected");
  assert.equal(determineFinalStatus(createInitialQuorumStatus(), { minApprovals: 1, minRejectionsToDeny: 1 }), "pending");
});

test("quorum-calculator calculateWithVote merges and calculates", () => {
  const existing: ReturnType<typeof createVote>[] = [];
  const newVote = createVote("user1", VoteType.APPROVE);
  const config = { minApprovals: 1, minRejectionsToDeny: 2 };
  const startTime = "2026-01-01T00:00:00Z";
  const currentTime = "2026-01-01T00:00:00Z";

  const result = calculateWithVote(existing, newVote, config, startTime, currentTime);
  assert.equal(result.votes.length, 1);
  assert.equal(result.status.isQuorumMet, true);
});

test("quorum-calculator validateVote throws for invalid vote", () => {
  assert.throws(
    () => validateVote({ approverId: "", voteType: VoteType.APPROVE, votedAt: nowIso() } as any),
    Error,
    "must have a valid approverId",
  );
  assert.throws(
    () => validateVote({ approverId: "user1", voteType: "invalid" as any, votedAt: nowIso() } as any),
    Error,
    "Invalid vote type",
  );
  assert.throws(
    () => validateVote({ approverId: "user1", voteType: VoteType.APPROVE, votedAt: "" } as any),
    Error,
    "must have a votedAt timestamp",
  );
});

test("quorum-calculator countEffectiveVotes counts only approve/reject", () => {
  const votes = [
    createVote("user1", VoteType.APPROVE),
    createVote("user2", VoteType.REJECT),
    createVote("user3", VoteType.ABSTAIN),
  ];
  const counts = countEffectiveVotes(votes);
  assert.equal(counts.approvals, 1);
  assert.equal(counts.rejections, 1);
});

test("quorum-calculator hasApproverVoted checks correctly", () => {
  const votes = [createVote("user1", VoteType.APPROVE)];
  assert.equal(hasApproverVoted(votes, "user1"), true);
  assert.equal(hasApproverVoted(votes, "user2"), false);
});

test("quorum-calculator getApproverVote returns vote or undefined", () => {
  const votes = [createVote("user1", VoteType.APPROVE)];
  assert.ok(getApproverVote(votes, "user1"));
  assert.equal(getApproverVote(votes, "user2"), undefined);
});

test("quorum-calculator QuorumCalculator class methods", () => {
  const calculator = new QuorumCalculator();
  assert.equal(calculator.calculateQuorum(2, 5), 2);
  assert.equal(calculator.isQuorumMet(3, 2), true);
  assert.equal(calculator.isQuorumMet(1, 2), false);
  assert.equal(calculator.calculatePercentage(50, 100), 50);
  assert.equal(calculator.calculatePercentage(1, 3), 33.33);
  assert.equal(calculator.calculatePercentage(0, 0), 0);
});

test("quorum-calculator uniqueApprovers counts delegation sources", () => {
  const votes = [
    createVote("user1", VoteType.APPROVE),
    createVote("user2", VoteType.APPROVE, "user1"),
  ];
  const config = { minApprovals: 2, minRejectionsToDeny: 3 };
  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);
  assert.equal(status.uniqueApprovers.size, 2);
});

// Helper
function nowIso() {
  return new Date().toISOString();
}