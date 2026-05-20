/**
 * Unit tests for Quorum Calculator
 * Tests quorum calculation logic for multi-party approval decisions
 */
import assert from "node:assert/strict";
import test from "node:test";
import { VoteType, createInitialQuorumStatus, calculateQuorumStatus, isQuorumMet, isDenied, getRemainingVotes, mergeVotes, createVote, determineFinalStatus, calculateWithVote, validateVote, countEffectiveVotes, hasApproverVoted, getApproverVote, } from "../../../../../src/platform/control-plane/approval-center/quorum-calculator.js";
function makeTestConfig(minApprovals = 2, minRejectionsToDeny = 2, votingWindowMs) {
    if (votingWindowMs !== undefined) {
        return { minApprovals, minRejectionsToDeny, votingWindowMs };
    }
    return { minApprovals, minRejectionsToDeny };
}
function makeVote(approverId, voteType) {
    return {
        approverId,
        voteType,
        votedAt: new Date().toISOString(),
    };
}
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
test("calculateQuorumStatus counts approvals correctly", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.APPROVE),
        makeVote("approver-3", VoteType.REJECT),
    ];
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.approvalsReceived, 2);
    assert.equal(status.rejectionsReceived, 1);
    assert.equal(status.abstentionsReceived, 0);
    assert.equal(status.isQuorumMet, true);
    assert.equal(status.isDenied, false);
    assert.equal(status.remainingApprovalsNeeded, 0);
    assert.equal(status.remainingRejectionsNeeded, 1);
});
test("calculateQuorumStatus counts rejections correctly", () => {
    const votes = [
        makeVote("approver-1", VoteType.REJECT),
        makeVote("approver-2", VoteType.REJECT),
    ];
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.approvalsReceived, 0);
    assert.equal(status.rejectionsReceived, 2);
    assert.equal(status.isQuorumMet, false);
    assert.equal(status.isDenied, true);
    assert.equal(status.remainingApprovalsNeeded, 2);
    assert.equal(status.remainingRejectionsNeeded, 0);
});
test("calculateQuorumStatus counts abstentions correctly", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.ABSTAIN),
        makeVote("approver-3", VoteType.ABSTAIN),
    ];
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.approvalsReceived, 1);
    assert.equal(status.abstentionsReceived, 2);
    assert.equal(status.isQuorumMet, false);
});
test("calculateQuorumStatus detects voting window expiration", () => {
    const votes = [makeVote("approver-1", VoteType.APPROVE)];
    const config = makeTestConfig(2, 2, 1000); // 1 second window
    const votingStartTime = new Date(Date.now() - 2000).toISOString(); // 2 seconds ago
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.isVotingWindowExpired, true);
});
test("calculateQuorumStatus does not expire when window is active", () => {
    const votes = [makeVote("approver-1", VoteType.APPROVE)];
    const config = makeTestConfig(2, 2, 10000); // 10 second window
    const votingStartTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.isVotingWindowExpired, false);
});
test("calculateQuorumStatus tracks unique approvers", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.APPROVE),
    ];
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.uniqueApprovers.size, 2);
    assert.ok(status.uniqueApprovers.has("approver-1"));
    assert.ok(status.uniqueApprovers.has("approver-2"));
});
test("calculateQuorumStatus handles delegation source for unique count", () => {
    const votes = [
        { approverId: "delegate-1", voteType: VoteType.APPROVE, votedAt: new Date().toISOString(), delegationSource: "original-1" },
        { approverId: "delegate-2", voteType: VoteType.APPROVE, votedAt: new Date().toISOString(), delegationSource: "original-1" },
    ];
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    // Should count delegation sources, not delegate IDs
    assert.equal(status.uniqueApprovers.size, 1);
    assert.ok(status.uniqueApprovers.has("original-1"));
});
test("isQuorumMet returns true when enough approvals", () => {
    const status = {
        isQuorumMet: true,
        isDenied: false,
        approvalsReceived: 3,
        rejectionsReceived: 0,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 0,
        remainingRejectionsNeeded: 2,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b", "c"]),
    };
    assert.equal(isQuorumMet(status), true);
});
test("isQuorumMet returns false when not enough approvals", () => {
    const status = {
        isQuorumMet: false,
        isDenied: false,
        approvalsReceived: 1,
        rejectionsReceived: 0,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 2,
        remainingRejectionsNeeded: 2,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a"]),
    };
    assert.equal(isQuorumMet(status), false);
});
test("isDenied returns true when enough rejections", () => {
    const status = {
        isQuorumMet: false,
        isDenied: true,
        approvalsReceived: 0,
        rejectionsReceived: 3,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 2,
        remainingRejectionsNeeded: 0,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b", "c"]),
    };
    assert.equal(isDenied(status), true);
});
test("isDenied returns false when not enough rejections", () => {
    const status = {
        isQuorumMet: false,
        isDenied: false,
        approvalsReceived: 1,
        rejectionsReceived: 1,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 1,
        remainingRejectionsNeeded: 1,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b"]),
    };
    assert.equal(isDenied(status), false);
});
test("getRemainingVotes returns correct counts", () => {
    const status = {
        isQuorumMet: false,
        isDenied: false,
        approvalsReceived: 1,
        rejectionsReceived: 1,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 2,
        remainingRejectionsNeeded: 1,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b"]),
    };
    const remaining = getRemainingVotes(status);
    assert.equal(remaining.approvals, 2);
    assert.equal(remaining.rejections, 1);
});
test("mergeVotes adds new vote when approver not voted", () => {
    const existing = [
        makeVote("approver-1", VoteType.APPROVE),
    ];
    const newVote = makeVote("approver-2", VoteType.APPROVE);
    const merged = mergeVotes(existing, newVote);
    assert.equal(merged.length, 2);
});
test("mergeVotes rejects duplicate immutable vote when approver already voted", () => {
    const existing = [
        makeVote("approver-1", VoteType.APPROVE),
    ];
    const newVote = makeVote("approver-1", VoteType.REJECT);
    assert.throws(() => mergeVotes(existing, newVote), /immutable vote/);
});
test("createVote creates vote with correct fields", () => {
    const vote = createVote("approver-1", VoteType.APPROVE);
    assert.equal(vote.approverId, "approver-1");
    assert.equal(vote.voteType, VoteType.APPROVE);
    assert.ok(vote.votedAt);
});
test("createVote handles delegation source", () => {
    const vote = createVote("delegate-1", VoteType.APPROVE, "original-1");
    assert.equal(vote.approverId, "delegate-1");
    assert.equal(vote.delegationSource, "original-1");
});
test("createVote handles metadata", () => {
    const metadata = { reason: "sick", department: "eng" };
    const vote = createVote("approver-1", VoteType.APPROVE, undefined, metadata);
    assert.deepEqual(vote.metadata, metadata);
});
test("determineFinalStatus returns approved when quorum met", () => {
    const status = {
        isQuorumMet: true,
        isDenied: false,
        approvalsReceived: 3,
        rejectionsReceived: 0,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 0,
        remainingRejectionsNeeded: 2,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b", "c"]),
    };
    const config = makeTestConfig(2, 2);
    const result = determineFinalStatus(status, config);
    assert.equal(result, "approved");
});
test("determineFinalStatus returns rejected when denied", () => {
    const status = {
        isQuorumMet: false,
        isDenied: true,
        approvalsReceived: 0,
        rejectionsReceived: 2,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 2,
        remainingRejectionsNeeded: 0,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b"]),
    };
    const config = makeTestConfig(2, 2);
    const result = determineFinalStatus(status, config);
    assert.equal(result, "rejected");
});
test("determineFinalStatus returns pending when neither met", () => {
    const status = {
        isQuorumMet: false,
        isDenied: false,
        approvalsReceived: 1,
        rejectionsReceived: 1,
        abstentionsReceived: 0,
        remainingApprovalsNeeded: 1,
        remainingRejectionsNeeded: 1,
        isVotingWindowExpired: false,
        uniqueApprovers: new Set(["a", "b"]),
    };
    const config = makeTestConfig(2, 2);
    const result = determineFinalStatus(status, config);
    assert.equal(result, "pending");
});
test("calculateWithVote merges votes and calculates status", () => {
    const existingVotes = [
        makeVote("approver-1", VoteType.APPROVE),
    ];
    const newVote = makeVote("approver-2", VoteType.APPROVE);
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const result = calculateWithVote(existingVotes, newVote, config, votingStartTime, currentTime);
    assert.equal(result.votes.length, 2);
    assert.equal(result.status.approvalsReceived, 2);
    assert.equal(result.status.isQuorumMet, true);
});
test("validateVote throws for empty approverId", () => {
    const vote = createVote("", VoteType.APPROVE);
    assert.throws(() => validateVote(vote), /Vote must have a valid approverId/);
});
test("validateVote throws for whitespace-only approverId", () => {
    const vote = createVote("   ", VoteType.APPROVE);
    assert.throws(() => validateVote(vote), /Vote must have a valid approverId/);
});
test("validateVote throws for invalid vote type", () => {
    const vote = {
        approverId: "approver-1",
        voteType: "invalid",
        votedAt: new Date().toISOString(),
    };
    assert.throws(() => validateVote(vote), /Invalid vote type/);
});
test("validateVote throws for missing votedAt", () => {
    const vote = {
        approverId: "approver-1",
        voteType: VoteType.APPROVE,
        votedAt: "",
    };
    assert.throws(() => validateVote(vote), /Vote must have a votedAt timestamp/);
});
test("validateVote passes for valid vote", () => {
    const vote = createVote("approver-1", VoteType.APPROVE);
    // Should not throw
    validateVote(vote);
});
test("countEffectiveVotes excludes abstentions", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.REJECT),
        makeVote("approver-3", VoteType.ABSTAIN),
    ];
    const counts = countEffectiveVotes(votes);
    assert.equal(counts.approvals, 1);
    assert.equal(counts.rejections, 1);
});
test("hasApproverVoted returns true when approver has voted", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.REJECT),
    ];
    assert.equal(hasApproverVoted(votes, "approver-1"), true);
    assert.equal(hasApproverVoted(votes, "approver-2"), true);
});
test("hasApproverVoted returns false when approver has not voted", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
    ];
    assert.equal(hasApproverVoted(votes, "approver-2"), false);
});
test("getApproverVote returns vote when exists", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.REJECT),
    ];
    const vote = getApproverVote(votes, "approver-1");
    assert.ok(vote);
    assert.equal(vote.voteType, VoteType.APPROVE);
});
test("getApproverVote returns undefined when not found", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
    ];
    const vote = getApproverVote(votes, "approver-2");
    assert.equal(vote, undefined);
});
test("voting window expiration handles undefined window", () => {
    const votes = [makeVote("approver-1", VoteType.APPROVE)];
    const config = makeTestConfig(2, 2, undefined); // No voting window
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.isVotingWindowExpired, false);
});
test("calculateQuorumStatus with 3-of-5 requirement", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.APPROVE),
    ];
    const config = makeTestConfig(3, 3); // 3 approvals needed
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.approvalsReceived, 2);
    assert.equal(status.isQuorumMet, false);
    assert.equal(status.remainingApprovalsNeeded, 1);
});
test("3-of-5 with 3 approvals meets quorum", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.APPROVE),
        makeVote("approver-3", VoteType.APPROVE),
    ];
    const config = makeTestConfig(3, 3);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    assert.equal(status.approvalsReceived, 3);
    assert.equal(status.isQuorumMet, true);
    assert.equal(status.remainingApprovalsNeeded, 0);
});
test("denial happens before approval when both thresholds met", () => {
    const votes = [
        makeVote("approver-1", VoteType.APPROVE),
        makeVote("approver-2", VoteType.REJECT),
        makeVote("approver-3", VoteType.REJECT),
    ];
    const config = makeTestConfig(2, 2);
    const votingStartTime = new Date().toISOString();
    const currentTime = new Date().toISOString();
    const status = calculateQuorumStatus(votes, config, votingStartTime, currentTime);
    // Rejections (2) meet denial threshold
    assert.equal(status.isDenied, true);
    // Approvals (1) do not meet approval threshold
    assert.equal(status.isQuorumMet, false);
});
//# sourceMappingURL=quorum-calculator.test.js.map
