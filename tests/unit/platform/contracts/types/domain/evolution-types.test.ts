import assert from "node:assert/strict";
import test from "node:test";

import type {
  EvolutionProposalRecord,
  EvolutionPolicyRecord,
  EvolutionLogRecord,
  PmfValidationReportRecord,
} from "../../../../../../src/platform/contracts/types/domain/evolution-types.js";
import type {
  EvolutionProposalKind,
  EvolutionProposalStatus,
  EvolutionScopeType,
  EvolutionPolicyStatus,
  EvolutionLogEventType,
  PmfValidationVerdict,
} from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("EvolutionProposalRecord structure is correct", () => {
  const record: EvolutionProposalRecord = {
    id: "proposal_123",
    taskId: "task_456",
    executionId: "exec_789",
    sourceAgentId: "agent_abc",
    kind: "budget_adjustment",
    scopeType: "task_intent",
    scopeRef: "intent_high_value_task",
    status: "pending_approval",
    approvalId: "approval_def",
    summary: "Increase budget for high-value tasks",
    proposalJson: '{"budgetIncrease":1.5}',
    evidenceJson: '{"successRate":0.85}',
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:01:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };
  assert.equal(record.id, "proposal_123");
  assert.equal(record.kind, "budget_adjustment");
  assert.equal(record.status, "pending_approval");
  assert.equal(record.approvalId, "approval_def");
});

test("EvolutionProposalRecord allows experience_promotion kind", () => {
  const record: EvolutionProposalRecord = {
    id: "proposal_exp",
    taskId: "task_exp",
    executionId: null,
    sourceAgentId: "agent_exp",
    kind: "experience_promotion",
    scopeType: "role",
    scopeRef: "role_senior_dev",
    status: "approved",
    approvalId: "approval_exp",
    summary: "Promote to senior role",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:01:00.000Z",
    approvedAt: "2026-04-14T00:02:00.000Z",
    appliedAt: null,
    rolledBackAt: null,
  };
  assert.equal(record.kind, "experience_promotion");
  assert.equal(record.status, "approved");
  assert.ok(record.approvedAt !== null);
});

test("EvolutionProposalRecord allows applied status with appliedAt", () => {
  const record: EvolutionProposalRecord = {
    id: "proposal_applied",
    taskId: "task_applied",
    executionId: "exec_applied",
    sourceAgentId: "agent_applied",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div_123",
    status: "applied",
    approvalId: "approval_applied",
    summary: "Applied proposal",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:03:00.000Z",
    approvedAt: "2026-04-14T00:01:00.000Z",
    appliedAt: "2026-04-14T00:02:00.000Z",
    rolledBackAt: null,
  };
  assert.equal(record.status, "applied");
  assert.ok(record.appliedAt !== null);
});

test("EvolutionProposalRecord allows rolled_back status", () => {
  const record: EvolutionProposalRecord = {
    id: "proposal_rb",
    taskId: "task_rb",
    executionId: "exec_rb",
    sourceAgentId: "agent_rb",
    kind: "budget_adjustment",
    scopeType: "task_intent",
    scopeRef: "intent_rb",
    status: "rolled_back",
    approvalId: "approval_rb",
    summary: "Rolled back proposal",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:05:00.000Z",
    approvedAt: "2026-04-14T00:01:00.000Z",
    appliedAt: "2026-04-14T00:02:00.000Z",
    rolledBackAt: "2026-04-14T00:04:00.000Z",
  };
  assert.equal(record.status, "rolled_back");
  assert.ok(record.rolledBackAt !== null);
});

test("EvolutionProposalRecord allows null executionId and approvalId", () => {
  const record: EvolutionProposalRecord = {
    id: "proposal_min",
    taskId: "task_min",
    executionId: null,
    sourceAgentId: "agent_min",
    kind: "budget_adjustment",
    scopeType: "task_intent",
    scopeRef: "intent_min",
    status: "pending_approval",
    approvalId: null,
    summary: "Minimal proposal",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };
  assert.equal(record.executionId, null);
  assert.equal(record.approvalId, null);
});

test("EvolutionProposalKind accepts all valid values", () => {
  const kinds: EvolutionProposalKind[] = ["budget_adjustment", "experience_promotion"];
  assert.equal(kinds.length, 2);
});

test("EvolutionProposalStatus accepts all valid values", () => {
  const statuses: EvolutionProposalStatus[] = ["pending_approval", "approved", "rejected", "applied", "rolled_back"];
  assert.equal(statuses.length, 5);
});

test("EvolutionScopeType accepts all valid values", () => {
  const types: EvolutionScopeType[] = ["division", "role", "task_intent"];
  assert.equal(types.length, 3);
});

test("EvolutionPolicyRecord structure is correct", () => {
  const record: EvolutionPolicyRecord = {
    id: "policy_123",
    proposalId: "proposal_456",
    kind: "budget_adjustment",
    scopeType: "task_intent",
    scopeRef: "intent_high_value",
    status: "active",
    valueJson: '{"budgetMultiplier":1.5}',
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    rolledBackAt: null,
  };
  assert.equal(record.id, "policy_123");
  assert.equal(record.kind, "budget_adjustment");
  assert.equal(record.status, "active");
});

test("EvolutionPolicyRecord allows rolled_back status", () => {
  const record: EvolutionPolicyRecord = {
    id: "policy_rb",
    proposalId: "proposal_rb",
    kind: "experience_promotion",
    scopeType: "role",
    scopeRef: "role_senior",
    status: "rolled_back",
    valueJson: "{}",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:05:00.000Z",
    rolledBackAt: "2026-04-14T00:04:00.000Z",
  };
  assert.equal(record.status, "rolled_back");
  assert.ok(record.rolledBackAt !== null);
});

test("EvolutionPolicyStatus accepts all valid values", () => {
  const statuses: EvolutionPolicyStatus[] = ["active", "rolled_back"];
  assert.equal(statuses.length, 2);
});

test("EvolutionLogRecord structure is correct", () => {
  const record: EvolutionLogRecord = {
    id: "log_123",
    proposalId: "proposal_456",
    taskId: "task_789",
    executionId: "exec_abc",
    eventType: "proposal_created",
    reasonCode: "agent.detected_opportunity",
    beforeStateJson: null,
    afterStateJson: '{"status":"pending_approval"}',
    metadataJson: null,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "log_123");
  assert.equal(record.eventType, "proposal_created");
  assert.equal(record.beforeStateJson, null);
});

test("EvolutionLogRecord allows all event types", () => {
  const eventTypes: EvolutionLogEventType[] = [
    "proposal_created",
    "approval_synced",
    "proposal_applied",
    "proposal_rolled_back",
  ];
  assert.equal(eventTypes.length, 4);
});

test("EvolutionLogRecord allows null executionId", () => {
  const record: EvolutionLogRecord = {
    id: "log_min",
    proposalId: "proposal_min",
    taskId: "task_min",
    executionId: null,
    eventType: "proposal_created",
    reasonCode: "test",
    beforeStateJson: null,
    afterStateJson: null,
    metadataJson: null,
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.executionId, null);
});

test("PmfValidationReportRecord structure is correct", () => {
  const record: PmfValidationReportRecord = {
    id: "pmf_123",
    profileName: "default",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-14T00:00:00.000Z",
    divisionId: "div_456",
    verdict: "pass",
    summaryJson: '{"metricsChecked":10,"passed":10}',
    reportJson: '{"details":"full report"}',
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.id, "pmf_123");
  assert.equal(record.profileName, "default");
  assert.equal(record.verdict, "pass");
  assert.equal(record.divisionId, "div_456");
});

test("PmfValidationReportRecord allows null divisionId", () => {
  const record: PmfValidationReportRecord = {
    id: "pmf_no_div",
    profileName: "global",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-14T00:00:00.000Z",
    divisionId: null,
    verdict: "warn",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.divisionId, null);
  assert.equal(record.verdict, "warn");
});

test("PmfValidationVerdict accepts all valid values", () => {
  const verdicts: PmfValidationVerdict[] = ["pass", "warn", "fail"];
  assert.equal(verdicts.length, 3);
});
