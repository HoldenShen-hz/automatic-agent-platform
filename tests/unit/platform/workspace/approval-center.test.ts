/**
 * Unit Tests: Approval Center
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateApprovalDecision,
  type ApprovalDecision,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  QuorumConfig,
  QuorumVote,
  VoteType,
  createInitialQuorumStatus,
  calculateQuorumStatus,
  isQuorumMet,
  isDenied,
  mergeVotes,
  createVote,
  determineFinalStatus,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

// ============================================================================
// Approval Decision Validation Tests
// ============================================================================

test("validateApprovalDecision passes for valid option_selected decision", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_123",
    decisionType: "option_selected",
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for valid confirmed decision", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_123",
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for valid text_input decision", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_123",
    decisionType: "text_input",
    inputText: "User typed this response",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for option_selected without selectedOptionId", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "option_selected" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as ApprovalDecision),
    /Option selected/i,
  );
});

test("validateApprovalDecision throws for confirmed without confirmed flag", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "confirmed" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as ApprovalDecision),
    /Confirmed/i,
  );
});

test("validateApprovalDecision throws for rejected with extra fields", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "rejected" as const,
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as ApprovalDecision),
    /terminal/i,
  );
});

// ============================================================================
// Quorum Calculator Tests
// ============================================================================

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
});

test("calculateQuorumStatus detects quorum met", () => {
  const config: QuorumConfig = {
    minApprovals: 2,
    minRejectionsToDeny: 2,
  };
  const votes: QuorumVote[] = [
    createVote("user_1", VoteType.APPROVE),
    createVote("user_2", VoteType.APPROVE),
  ];

  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);

  assert.equal(isQuorumMet(status), true);
  assert.equal(isDenied(status), false);
  assert.equal(status.approvalsReceived, 2);
});

test("calculateQuorumStatus detects denial", () => {
  const config: QuorumConfig = {
    minApprovals: 2,
    minRejectionsToDeny: 2,
  };
  const votes: QuorumVote[] = [
    createVote("user_1", VoteType.REJECT),
    createVote("user_2", VoteType.REJECT),
  ];

  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);

  assert.equal(isQuorumMet(status), false);
  assert.equal(isDenied(status), true);
  assert.equal(status.rejectionsReceived, 2);
});

test("calculateQuorumStatus handles voting window expiry", () => {
  const config: QuorumConfig = {
    minApprovals: 1,
    minRejectionsToDeny: 2,
    votingWindowMs: 1000,
  };
  const startTime = "2026-04-14T00:00:00.000Z";
  const expiredTime = "2026-04-14T00:00:02.000Z";
  const votes: QuorumVote[] = [createVote("user_1", VoteType.APPROVE)];

  const status = calculateQuorumStatus(votes, config, startTime, expiredTime);

  assert.equal(status.isVotingWindowExpired, true);
});

test("mergeVotes rejects updates to an immutable approver vote", () => {
  const existing: QuorumVote[] = [
    createVote("user_1", VoteType.APPROVE),
  ];
  const newVote: QuorumVote = {
    approverId: "user_1",
    voteType: VoteType.REJECT,
    votedAt: "2026-04-14T00:01:00.000Z",
  };

  assert.throws(
    () => mergeVotes(existing, newVote),
    /immutable vote/,
  );
});

test("mergeVotes adds new approver vote", () => {
  const existing: QuorumVote[] = [
    createVote("user_1", VoteType.APPROVE),
  ];
  const newVote: QuorumVote = {
    approverId: "user_2",
    voteType: VoteType.APPROVE,
    votedAt: "2026-04-14T00:01:00.000Z",
  };

  const merged = mergeVotes(existing, newVote);

  assert.equal(merged.length, 2);
});

test("determineFinalStatus returns approved when quorum met", () => {
  const status = createInitialQuorumStatus();
  status.isQuorumMet = true;
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };

  const finalStatus = determineFinalStatus(status, config);

  assert.equal(finalStatus, "approved");
});

test("determineFinalStatus returns rejected when denied", () => {
  const status = createInitialQuorumStatus();
  status.isDenied = true;
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };

  const finalStatus = determineFinalStatus(status, config);

  assert.equal(finalStatus, "rejected");
});

test("determineFinalStatus returns pending when neither met nor denied", () => {
  const status = createInitialQuorumStatus();
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };

  const finalStatus = determineFinalStatus(status, config);

  assert.equal(finalStatus, "pending");
});
