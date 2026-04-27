/**
 * Unit tests for parseProposalPayload function.
 *
 * Tests parsing of evolution proposal records.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseProposalPayload } from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";

test("parseProposalPayload parses budget_adjustment payload", () => {
  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: null,
    sourceAgentId: "agent_456",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "pending_approval" as const,
    approvalId: "approval_123",
    summary: "Budget increase",
    proposalJson: JSON.stringify({
      kind: "budget_adjustment",
      recommendedPolicy: {
        maxTaskCostUsd: 0.12,
        maxDailyCostUsd: 1.2,
        maxMonthlyCostUsd: 12.0,
        warnAtRatio: 0.85,
        mode: "supervised",
      },
      baselinePolicy: {
        maxTaskCostUsd: 0.10,
        maxDailyCostUsd: 1.0,
        maxMonthlyCostUsd: 10.0,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      observedAverageCostUsd: 0.09,
      sampleSize: 10,
      successRate: 0.95,
      proposalReason: "Normal increase",
    }),
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  const payload = parseProposalPayload(record);

  assert.strictEqual(payload.kind, "budget_adjustment");
  assert.deepEqual(payload.recommendedPolicy, {
    maxTaskCostUsd: 0.12,
    maxDailyCostUsd: 1.2,
    maxMonthlyCostUsd: 12.0,
    warnAtRatio: 0.85,
    mode: "supervised",
  });
  assert.strictEqual(payload.observedAverageCostUsd, 0.09);
  assert.strictEqual(payload.sampleSize, 10);
  assert.strictEqual(payload.successRate, 0.95);
});

test("parseProposalPayload parses experience_promotion payload", () => {
  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: null,
    sourceAgentId: "agent_456",
    kind: "experience_promotion" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "pending_approval" as const,
    approvalId: "approval_123",
    summary: "Promote experience",
    proposalJson: JSON.stringify({
      kind: "experience_promotion",
      sourceExperienceId: "exp_abc",
      sourceTaskContext: "context here",
      sourceTaskIntent: "intent here",
      targetScope: "project",
      promotedSummary: "Reuse successful pattern",
      qualityScore: 0.85,
      matchedKeywords: ["keyword1", "keyword2"],
    }),
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  const payload = parseProposalPayload(record);

  assert.strictEqual(payload.kind, "experience_promotion");
  assert.strictEqual(payload.sourceExperienceId, "exp_abc");
  assert.strictEqual(payload.targetScope, "project");
  assert.strictEqual(payload.qualityScore, 0.85);
  assert.deepEqual(payload.matchedKeywords, ["keyword1", "keyword2"]);
});

test("parseProposalPayload handles malformed JSON gracefully", () => {
  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: null,
    sourceAgentId: "agent_456",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "pending_approval" as const,
    approvalId: "approval_123",
    summary: "Test",
    proposalJson: "{ invalid json }",
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  assert.throws(
    () => parseProposalPayload(record),
    SyntaxError,
  );
});

test("parseProposalPayload handles empty proposalJson", () => {
  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: null,
    sourceAgentId: "agent_456",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "pending_approval" as const,
    approvalId: "approval_123",
    summary: "Test",
    proposalJson: "",
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  assert.throws(
    () => parseProposalPayload(record),
    SyntaxError,
  );
});
