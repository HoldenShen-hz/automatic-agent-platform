import assert from "node:assert/strict";
import test from "node:test";
import {
  VoteType,
  QuorumConfig,
  QuorumVote,
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
  QuorumCalculator,
} from "../../../../../../src/platform/five-plane-control-plane/approval-center/quorum-calculator.js";

test("createInitialQuorumStatus returns correct initial state", () => {
  const status = createInitialQuorumStatus();
  assert.equal(status.isQuorumMet, false);
  assert.equal(status.isDenied, false);
  assert.equal(status.approvalsReceived, 0);
  assert.equal(status.rejectionsReceived, 0);
  assert.equal(status.abstentionsReceived, 0);
  assert.equal(status.remainingApprovalsNeeded, 0);
  assert.equal(status.remainingRejectionsNeeded, 0);
  assert.equal(status.isVotingWindowExpired, false);
  assert.ok(status.uniqueApprovers instanceof Set);
  assert.equal(status.uniqueApprovers.size, 0);
});

test("calculateQuorumStatus with no votes returns zeros", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:05:00.000Z";
  const status = calculateQuorumStatus([], config, startTime, currentTime);
  assert.equal(status.approvalsReceived, 0);
  assert.equal(status.rejectionsReceived, 0);
  assert.equal(status.isQuorumMet, false);
  assert.equal(status.isDenied, false);
  assert.equal(status.remainingApprovalsNeeded, 2);
  assert.equal(status.remainingRejectionsNeeded, 3);
});

test("calculateQuorumStatus meets quorum with enough approvals", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:05:00.000Z";
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: startTime },
    { approverId: "user2", voteType: VoteType.APPROVE, votedAt: startTime },
  ];
  const status = calculateQuorumStatus(votes, config, startTime, currentTime);
  assert.equal(status.isQuorumMet, true);
  assert.equal(status.approvalsReceived, 2);
  assert.equal(status.remainingApprovalsNeeded, 0);
});

test("calculateQuorumStatus denies with enough rejections", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:05:00.000Z";
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.REJECT, votedAt: startTime },
    { approverId: "user2", voteType: VoteType.REJECT, votedAt: startTime },
  ];
  const status = calculateQuorumStatus(votes, config, startTime, currentTime);
  assert.equal(status.isDenied, true);
  assert.equal(status.rejectionsReceived, 2);
  assert.equal(status.remainingRejectionsNeeded, 0);
});

test("calculateQuorumStatus counts abstentions correctly", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:05:00.000Z";
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: startTime },
    { approverId: "user2", voteType: VoteType.ABSTAIN, votedAt: startTime },
  ];
  const status = calculateQuorumStatus(votes, config, startTime, currentTime);
  assert.equal(status.abstentionsReceived, 1);
  assert.equal(status.approvalsReceived, 1);
  assert.equal(status.isQuorumMet, false);
});

test("calculateQuorumStatus detects expired voting window", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3, votingWindowMs: 60000 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:02:00.000Z"; // 2 minutes later
  const status = calculateQuorumStatus([], config, startTime, currentTime);
  assert.equal(status.isVotingWindowExpired, true);
});

test("calculateQuorumStatus with active window", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3, votingWindowMs: 600000 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:01:00.000Z"; // 1 minute later
  const status = calculateQuorumStatus([], config, startTime, currentTime);
  assert.equal(status.isVotingWindowExpired, false);
});

test("calculateQuorumStatus counts unique approvers", () => {
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 3 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:05:00.000Z";
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: startTime },
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: startTime }, // duplicate
    { approverId: "user2", voteType: VoteType.APPROVE, votedAt: startTime },
  ];
  const status = calculateQuorumStatus(votes, config, startTime, currentTime);
  assert.equal(status.uniqueApprovers.size, 2);
});

test("calculateQuorumStatus handles delegation sources", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  const startTime = "2026-04-26T00:00:00.000Z";
  const currentTime = "2026-04-26T00:05:00.000Z";
  const votes: QuorumVote[] = [
    { approverId: "delegate1", voteType: VoteType.APPROVE, votedAt: startTime, delegationSource: "original1" },
    { approverId: "delegate2", voteType: VoteType.APPROVE, votedAt: startTime, delegationSource: "original1" },
  ];
  const status = calculateQuorumStatus(votes, config, startTime, currentTime);
  // Both should count toward original1 (delegation source)
  assert.equal(status.uniqueApprovers.size, 1);
  assert.ok(status.uniqueApprovers.has("original1"));
});

test("isQuorumMet returns correct value", () => {
  const status = { ...createInitialQuorumStatus(), isQuorumMet: true };
  assert.equal(isQuorumMet(status), true);
  const status2 = { ...createInitialQuorumStatus(), isQuorumMet: false };
  assert.equal(isQuorumMet(status2), false);
});

test("isDenied returns correct value", () => {
  const status = { ...createInitialQuorumStatus(), isDenied: true };
  assert.equal(isDenied(status), true);
  const status2 = { ...createInitialQuorumStatus(), isDenied: false };
  assert.equal(isDenied(status2), false);
});

test("getRemainingVotes returns correct values", () => {
  const status = { ...createInitialQuorumStatus(), remainingApprovalsNeeded: 2, remainingRejectionsNeeded: 1 };
  const remaining = getRemainingVotes(status);
  assert.equal(remaining.approvals, 2);
  assert.equal(remaining.rejections, 1);
});

test("mergeVotes adds new vote when not exists", () => {
  const existing: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" },
  ];
  const newVote: QuorumVote = { approverId: "user2", voteType: VoteType.REJECT, votedAt: "2026-04-26T00:01:00.000Z" };
  const merged = mergeVotes(existing, newVote);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].approverId, "user2");
});

test("mergeVotes rejects duplicate immutable vote", () => {
  const existing: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" },
  ];
  const newVote: QuorumVote = { approverId: "user1", voteType: VoteType.REJECT, votedAt: "2026-04-26T00:01:00.000Z" };
  assert.throws(() => mergeVotes(existing, newVote), /immutable vote/);
});

test("createVote creates approve vote", () => {
  const vote = createVote("user1", VoteType.APPROVE);
  assert.equal(vote.approverId, "user1");
  assert.equal(vote.voteType, VoteType.APPROVE);
  assert.ok(vote.votedAt.length > 0);
});

test("createVote with delegation source", () => {
  const vote = createVote("delegate1", VoteType.APPROVE, "original1");
  assert.equal(vote.approverId, "delegate1");
  assert.equal(vote.delegationSource, "original1");
});

test("createVote with metadata", () => {
  const vote = createVote("user1", VoteType.APPROVE, undefined, { reason: "looks good" });
  assert.deepEqual(vote.metadata, { reason: "looks good" });
});

test("determineFinalStatus returns approved when quorum met", () => {
  const status = { ...createInitialQuorumStatus(), isQuorumMet: true };
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  assert.equal(determineFinalStatus(status, config), "approved");
});

test("determineFinalStatus returns rejected when denied", () => {
  const status = { ...createInitialQuorumStatus(), isDenied: true };
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  assert.equal(determineFinalStatus(status, config), "rejected");
});

test("determineFinalStatus returns pending when neither met", () => {
  const status = createInitialQuorumStatus();
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 3 };
  assert.equal(determineFinalStatus(status, config), "pending");
});

test("calculateWithVote combines merge and status calculation", () => {
  const existing: QuorumVote[] = [];
  const newVote: QuorumVote = { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" };
  const config: QuorumConfig = { minApprovals: 1, minRejectionsToDeny: 2 };
  const result = calculateWithVote(existing, newVote, config, "2026-04-26T00:00:00.000Z", "2026-04-26T00:01:00.000Z");
  assert.equal(result.votes.length, 1);
  assert.equal(result.status.approvalsReceived, 1);
  assert.equal(result.status.isQuorumMet, true);
});

test("validateVote throws on empty approverId", () => {
  const vote: QuorumVote = { approverId: "", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" };
  assert.throws(() => validateVote(vote), /approval\.invalid_approver_id/);
});

test("validateVote throws on whitespace approverId", () => {
  const vote: QuorumVote = { approverId: "   ", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" };
  assert.throws(() => validateVote(vote), /approval\.invalid_approver_id/);
});

test("validateVote throws on invalid vote type", () => {
  const vote = { approverId: "user1", voteType: "invalid" as unknown as VoteType, votedAt: "2026-04-26T00:00:00.000Z" };
  assert.throws(() => validateVote(vote), /approval\.invalid_vote_type/);
});

test("validateVote throws on missing votedAt", () => {
  const vote = { approverId: "user1", voteType: VoteType.APPROVE } as QuorumVote;
  assert.throws(() => validateVote(vote), /approval\.invalid_voted_at/);
});

test("validateVote does not throw for valid vote", () => {
  const vote: QuorumVote = { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" };
  assert.doesNotThrow(() => validateVote(vote));
});

test("validateVote does not throw for valid vote with delegation", () => {
  const vote: QuorumVote = { approverId: "del", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z", delegationSource: "orig" };
  assert.doesNotThrow(() => validateVote(vote));
});

test("countEffectiveVotes excludes abstentions", () => {
  const votes: QuorumVote[] = [
    { approverId: "u1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" },
    { approverId: "u2", voteType: VoteType.REJECT, votedAt: "2026-04-26T00:00:00.000Z" },
    { approverId: "u3", voteType: VoteType.ABSTAIN, votedAt: "2026-04-26T00:00:00.000Z" },
  ];
  const counts = countEffectiveVotes(votes);
  assert.equal(counts.approvals, 1);
  assert.equal(counts.rejections, 1);
});

test("hasApproverVoted returns true when voted", () => {
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" },
  ];
  assert.equal(hasApproverVoted(votes, "user1"), true);
  assert.equal(hasApproverVoted(votes, "user2"), false);
});

test("getApproverVote returns vote when found", () => {
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" },
  ];
  const vote = getApproverVote(votes, "user1");
  assert.ok(vote !== undefined);
  assert.equal(vote?.approverId, "user1");
});

test("getApproverVote returns undefined when not found", () => {
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-26T00:00:00.000Z" },
  ];
  const vote = getApproverVote(votes, "user2");
  assert.equal(vote, undefined);
});

test("QuorumCalculator.calculateQuorum returns min of required and total", () => {
  const calc = new QuorumCalculator();
  assert.equal(calc.calculateQuorum(2, 5), 2);
  assert.equal(calc.calculateQuorum(5, 2), 2);
  assert.equal(calc.calculateQuorum(0, 0), 0);
});

test("QuorumCalculator.isQuorumMet checks threshold", () => {
  const calc = new QuorumCalculator();
  assert.equal(calc.isQuorumMet(3, 3), true);
  assert.equal(calc.isQuorumMet(2, 3), false);
  assert.equal(calc.isQuorumMet(0, 3), false);
});

test("QuorumCalculator.calculatePercentage computes percentage", () => {
  const calc = new QuorumCalculator();
  assert.equal(calc.calculatePercentage(3, 4), 75);
  assert.equal(calc.calculatePercentage(1, 3), 33.33);
  assert.equal(calc.calculatePercentage(0, 4), 0);
  assert.equal(calc.calculatePercentage(5, 0), 0);
});
