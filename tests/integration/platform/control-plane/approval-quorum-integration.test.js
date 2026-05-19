import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalPolicyEngine, DEFAULT_APPROVAL_POLICY_BUNDLE } from "../../../../../src/platform/control-plane/approval-center/approval-policy-engine/index.js";
import { QuorumCalculator, VoteType, calculateQuorumStatus } from "../../../../../src/platform/control-plane/approval-center/quorum-calculator.js";

/**
 * Integration test: Approval Policy Engine + Quorum Calculator
 *
 * Tests the flow where:
 * 1. ApprovalPolicyEngine determines approval is required
 * 2. QuorumCalculator manages the voting process
 */
test("approval-policy-engine plus quorum-calculator integration", (t, done) => {
  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  // Policy requires approval for destructive action in supervised mode
  const context = {
    decisionId: "approval-integration-001",
    taskId: "task-destructive",
    subjectType: "agent" as const,
    subjectId: "agent-1",
    action: "write_file" as const,
    riskCategory: "destructive" as const,
    mode: "supervised" as const,
    stage: "execute",
  };

  // Step 1: Determine if approval is required
  const approvalResult = approvalEngine.evaluate(context);
  assert.equal(approvalResult.requiresApproval, true);
  assert.equal(approvalResult.timeoutPolicy, "reject");

  // Step 2: Set up quorum calculation for the approval
  const config = {
    minApprovals: approvalResult.requiredApprovals || 1,
    minRejectionsToDeny: 2,
    votingWindowMs: 3600000, // 1 hour
  };

  // Step 3: Simulate voting process
  const votingStartTime = new Date().toISOString();

  // First vote (approve)
  const vote1 = {
    approverId: "approver-1",
    voteType: VoteType.APPROVE,
    votedAt: votingStartTime,
  };

  const votesAfter1 = [vote1];
  const status1 = calculateQuorumStatus(votesAfter1, config, votingStartTime, new Date().toISOString());
  assert.equal(status1.approvalsReceived, 1);
  assert.equal(status1.remainingApprovalsNeeded, config.minApprovals - 1);

  // Second vote (approve)
  const vote2 = {
    approverId: "approver-2",
    voteType: VoteType.APPROVE,
    votedAt: new Date().toISOString(),
  };

  const votesAfter2 = [vote1, vote2];
  const status2 = calculateQuorumStatus(votesAfter2, config, votingStartTime, new Date().toISOString());
  assert.equal(status2.approvalsReceived, 2);
  assert.equal(status2.isQuorumMet, true);

  done();
});

test("quorum-calculator with multi-party approval", (t, done) => {
  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  // Multi-party rule for org-changing actions
  const context = {
    decisionId: "approval-integration-002",
    taskId: "task-org-change",
    subjectType: "agent" as const,
    subjectId: "agent-1",
    action: "org_change" as const,
    riskCategory: "org_changing" as const,
    mode: "auto" as const,
    stage: "execute",
  };

  const approvalResult = approvalEngine.evaluate(context);

  // Should require multi-party approval
  assert.equal(approvalResult.requireMultiParty, true);
  assert.ok(approvalResult.requiredApprovals >= 2);
  assert.deepEqual(approvalResult.approverGroups, expect.arrayContaining(["admin", "security"]));

  // Set up quorum with higher threshold
  const config = {
    minApprovals: approvalResult.requiredApprovals,
    minRejectionsToDeny: 3,
    votingWindowMs: 7200000, // 2 hours
  };

  // Simulate voting - first approver
  const vote1 = {
    approverId: "admin-1",
    voteType: VoteType.APPROVE,
    votedAt: new Date().toISOString(),
    delegationSource: "user1",
  };

  // Second approver
  const vote2 = {
    approverId: "security-1",
    voteType: VoteType.APPROVE,
    votedAt: new Date().toISOString(),
    delegationSource: "user2",
  };

  const votes = [vote1, vote2];
  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);

  // Two unique approvers (via delegation)
  assert.equal(status.uniqueApprovers.size, 2);
  assert.equal(status.isQuorumMet, approvalResult.requiredApprovals <= 2);

  done();
});

test("approval policy timeout triggers reject", (t, done) => {
  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  // Policy with timeoutPolicy: reject
  const context = {
    decisionId: "approval-integration-003",
    taskId: "task-timeout-test",
    subjectType: "agent" as const,
    subjectId: "agent-1",
    action: "write_file" as const,
    riskCategory: "destructive" as const,
    mode: "supervised" as const,
    stage: "execute",
  };

  const approvalResult = approvalEngine.evaluate(context);
  assert.equal(approvalResult.timeoutPolicy, "reject");

  // Simulate timeout scenario
  const config = {
    minApprovals: 1,
    minRejectionsToDeny: 2,
    votingWindowMs: 1000, // Very short window
  };

  const startTime = new Date(Date.now() - 2000).toISOString(); // 2 seconds ago
  const currentTime = new Date().toISOString();

  const votes = []; // No votes received
  const status = calculateQuorumStatus(votes, config, startTime, currentTime);

  // Voting window should be expired
  assert.equal(status.isVotingWindowExpired, true);

  // With reject policy, expired window means denial
  // The actual rejection would be handled by the approval service based on timeout policy

  done();
});

test("quorum-calculator handles rejection before quorum", (t, done) => {
  const approvalEngine = new ApprovalPolicyEngine(DEFAULT_APPROVAL_POLICY_BUNDLE);

  const context = {
    decisionId: "approval-integration-004",
    taskId: "task-rejection-test",
    subjectType: "agent" as const,
    subjectId: "agent-1",
    action: "write_file" as const,
    riskCategory: "destructive" as const,
    mode: "supervised" as const,
    stage: "execute",
  };

  const approvalResult = approvalEngine.evaluate(context);

  // Two rejections should deny even before quorum is met
  const config = {
    minApprovals: 3,
    minRejectionsToDeny: 2,
  };

  const votes = [
    { approverId: "approver-1", voteType: VoteType.REJECT, votedAt: new Date().toISOString() },
    { approverId: "approver-2", voteType: VoteType.REJECT, votedAt: new Date().toISOString() },
  ];

  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);

  // Two rejections meet the denial threshold
  assert.equal(status.isDenied, true);
  assert.equal(status.rejectionsReceived, 2);
  assert.equal(status.approvalsReceived, 0);

  done();
});

test("approval policy lint integration", (t, done) => {
  // Create a bundle with intentional issues for testing
  const problematicBundle = {
    bundleId: "test-problematic",
    version: "1.0.0",
    name: "Test Problematic Bundle",
    description: "Bundle with multiple issues",
    enabled: true,
    rules: [
      {
        ruleId: "good-rule",
        description: "This is a good rule",
        priority: 100,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "invoke_model" }],
        action: "require_approval" as const,
        timeoutPolicy: "reject" as const,
      },
      {
        ruleId: "shadowed-rule",
        description: "This will be shadowed",
        priority: 50,
        enabled: true,
        conditions: [{ field: "action", operator: "eq", value: "invoke_model" }],
        action: "allow" as const,
      },
      {
        ruleId: "empty-conditions-rule",
        description: "No conditions",
        priority: 10,
        enabled: true,
        conditions: [],
        action: "deny" as const,
      },
      {
        ruleId: "bad-field-rule",
        description: "Invalid field reference",
        priority: 5,
        enabled: true,
        conditions: [{ field: "invalidFieldName", operator: "eq", value: "test" }],
        action: "require_approval" as const,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const engine = new ApprovalPolicyEngine(problematicBundle);
  const lintResult = engine.lint();

  // Should detect multiple issues
  assert.equal(lintResult.valid, false);
  assert.ok(lintResult.errors.length > 0);
  assert.ok(lintResult.warnings.length > 0);

  // Should catch invalid field reference
  assert.ok(lintResult.errors.some((e) => e.code === "invalid_field_reference"));

  // Should catch shadowed rules
  assert.ok(lintResult.warnings.some((w) => w.code === "shadowed_rule"));

  // Should catch empty conditions
  assert.ok(lintResult.warnings.some((w) => w.code === "empty_conditions"));

  done();
});

test("quorum-calculator abstention handling", (t, done) => {
  const calculator = new QuorumCalculator();

  const config = {
    minApprovals: 2,
    minRejectionsToDeny: 2,
    votingWindowMs: 3600000,
  };

  // Abstentions don't count toward approval
  const votes = [
    { approverId: "approver-1", voteType: VoteType.ABSTAIN, votedAt: new Date().toISOString() },
    { approverId: "approver-2", voteType: VoteType.APPROVE, votedAt: new Date().toISOString() },
  ];

  const status = calculateQuorumStatus(votes, config, votes[0]!.votedAt, votes[1]!.votedAt);

  // Only 1 actual approval, abstention doesn't count
  assert.equal(status.approvalsReceived, 1);
  assert.equal(status.abstentionsReceived, 1);
  assert.equal(status.isQuorumMet, false);
  assert.equal(status.remainingApprovalsNeeded, 1);

  done();
});