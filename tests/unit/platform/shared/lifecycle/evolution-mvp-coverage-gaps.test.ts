/**
 * Unit tests for EvolutionMvpService - additional coverage for edge cases
 * and helper functions not fully covered by existing tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  clamp,
  roundCurrency,
  roundRatio,
  buildRecommendedBudgetPolicy,
  assertEvolutionScope,
  parseProposalPayload,
  parsePolicyValue,
} from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";

// ─────────────────────────────────────────────────────────────────────────────
// Additional clamp edge case tests
// ─────────────────────────────────────────────────────────────────────────────

test("clamp handles zero as value with positive bounds", () => {
  assert.strictEqual(clamp(0, 0, 10), 0);
  assert.strictEqual(clamp(0, 1, 10), 1);
});

test("clamp handles exact boundary values", () => {
  assert.strictEqual(clamp(0, 0, 0), 0);
  assert.strictEqual(clamp(10, 0, 10), 10);
  assert.strictEqual(clamp(-5, -5, 5), -5);
  assert.strictEqual(clamp(5, -5, 5), 5);
});

test("clamp handles values extremely close to boundaries", () => {
  const epsilon = 1e-10;
  assert.strictEqual(clamp(0 + epsilon, 0, 10), 0 + epsilon);
  assert.strictEqual(clamp(10 - epsilon, 0, 10), 10 - epsilon);
});

test("clamp handles negative bounds with positive value", () => {
  // clamp(value, min, max) = Math.min(max, Math.max(min, value))
  // 0 > -5 (max), so result is -5
  assert.strictEqual(clamp(0, -10, -5), -5);
  // -6 is between -10 and -5, so Math.max(-10, -6) = -6, Math.min(-5, -6) = -6
  assert.strictEqual(clamp(-6, -10, -5), -6);
  // -11 < -10 (min), so Math.max(-10, -11) = -10, Math.min(-5, -10) = -10
  assert.strictEqual(clamp(-11, -10, -5), -10);
});

test("clamp handles when value equals min which equals max", () => {
  assert.strictEqual(clamp(5, 5, 5), 5);
  assert.strictEqual(clamp(0, 0, 0), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional roundCurrency edge case tests
// ─────────────────────────────────────────────────────────────────────────────

test("roundCurrency handles very large numbers without overflow", () => {
  const largeNum = 999999999999.9999;
  const result = roundCurrency(largeNum);
  assert.ok(isFinite(result), "Result should be finite");
  // JavaScript floating point precision means 999999999999.9999 * 10000 has precision issues
  assert.strictEqual(result, 999999999999.9998);
});

test("roundCurrency handles decimal precision edge cases", () => {
  // Test at the rounding boundary
  assert.strictEqual(roundCurrency(1.12344444), 1.1234);
  assert.strictEqual(roundCurrency(1.12344445), 1.1234);
  assert.strictEqual(roundCurrency(1.1234445), 1.1234);
  assert.strictEqual(roundCurrency(1.12344451), 1.1234);
});

test("roundCurrency handles very small decimals", () => {
  // 0.00001 * 10000 = 0.1, Math.round(0.1) = 0, 0/10000 = 0
  assert.strictEqual(roundCurrency(0.00001), 0);
  // 0.000009 * 10000 = 0.09, Math.round(0.09) = 0, 0/10000 = 0
  assert.strictEqual(roundCurrency(0.000009), 0);
  // 0.0001 * 10000 = 1, Math.round(1) = 1, 1/10000 = 0.0001
  assert.strictEqual(roundCurrency(0.0001), 0.0001);
  // 0.0002 * 10000 = 2, Math.round(2) = 2, 2/10000 = 0.0002
  assert.strictEqual(roundCurrency(0.0002), 0.0002);
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional roundRatio edge case tests
// ─────────────────────────────────────────────────────────────────────────────

test("roundRatio handles ratio at 1.0 boundary", () => {
  // 0.9994 * 1000 = 999.4, Math.round(999.4) = 999, 999/1000 = 0.999
  assert.strictEqual(roundRatio(0.9994), 0.999);
  // 0.9995 * 1000 = 999.5, Math.round(999.5) = 1000 (banker's rounding to even), 1000/1000 = 1
  assert.strictEqual(roundRatio(0.9995), 1);
  // 0.9996 * 1000 = 999.6, Math.round(999.6) = 1000, 1000/1000 = 1
  assert.strictEqual(roundRatio(0.9996), 1);
  assert.strictEqual(roundRatio(1.0), 1);
});

test("roundRatio handles very small positive ratios", () => {
  assert.strictEqual(roundRatio(0.0001), 0);
  assert.strictEqual(roundRatio(0.0009), 0.001);
  assert.strictEqual(roundRatio(0.0012), 0.001);
});

test("roundRatio handles ratio at 3 decimal place boundary", () => {
  assert.strictEqual(roundRatio(0.1234), 0.123);
  assert.strictEqual(roundRatio(0.1235), 0.124);
  assert.strictEqual(roundRatio(0.12344), 0.123);
  assert.strictEqual(roundRatio(0.12345), 0.123);
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional buildRecommendedBudgetPolicy edge case tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildRecommendedBudgetPolicy uses increaseTarget when observed exceeds 85% of limit with high success", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Near limit",
    sampleSize: 10,
    observedAverageCostUsd: 0.09, // 90% of 0.10 limit
    successRate: 0.7, // above threshold
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // 0.09 > 0.10 * 0.85 = 0.085, so increaseTarget = 0.09 * 1.15 = 0.1035
  // nextMaxTaskCostUsd = min(0.10 * 1.25, 0.1035) = 0.1035
  // After roundCurrency: Math.round(0.1035 * 10000) / 10000 = 0.1035
  assert.strictEqual(result.maxTaskCostUsd, 0.1035);
});

test("buildRecommendedBudgetPolicy uses decreaseTarget when observed below 45% with sufficient samples", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Well below limit",
    sampleSize: 5, // exactly at minimum for decrease
    observedAverageCostUsd: 0.044, // 44% of 0.10 limit
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // decreaseTarget = 0.044 * 1.2 = 0.0528
  // nextMaxTaskCostUsd = max(0.10 * 0.8, 0.0528) = 0.08
  assert.ok(result.maxTaskCostUsd < 0.10);
  assert.strictEqual(result.maxTaskCostUsd, 0.08);
});

test("buildRecommendedBudgetPolicy respects 1.25x upper clamp on increase", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Very high observed",
    sampleSize: 100,
    observedAverageCostUsd: 1.0, // Very high
    successRate: 0.95,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // increaseTarget = 1.0 * 1.15 = 1.15
  // nextMaxTaskCostUsd = min(0.10 * 1.25, 1.15) = 0.125
  assert.strictEqual(result.maxTaskCostUsd, 0.125);
});

test("buildRecommendedBudgetPolicy respects 0.8x lower clamp on decrease", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Very low observed",
    sampleSize: 100,
    observedAverageCostUsd: 0.001, // Very low
    successRate: 0.95,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // decreaseTarget = 0.001 * 1.2 = 0.0012
  // nextMaxTaskCostUsd = max(0.10 * 0.8, 0.0012) = 0.08
  assert.strictEqual(result.maxTaskCostUsd, 0.08);
});

test("buildRecommendedBudgetPolicy does not increase when success rate below 0.6", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Near limit but low success",
    sampleSize: 10,
    observedAverageCostUsd: 0.09, // 90% of limit
    successRate: 0.5, // below 0.6 threshold
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should not increase despite being near limit
  assert.strictEqual(result.maxTaskCostUsd, 0.10);
});

test("buildRecommendedBudgetPolicy does not decrease when sampleSize below 5", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Well below limit but small samples",
    sampleSize: 4, // below 5
    observedAverageCostUsd: 0.03, // 30% of limit
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  // Should not decrease despite being well below limit
  assert.strictEqual(result.maxTaskCostUsd, 0.10);
});

test("buildRecommendedBudgetPolicy handles warnAtRatio at upper clamp boundary", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.99, // Above 0.95 clamp
      mode: "supervised",
    },
  });

  assert.strictEqual(result.warnAtRatio, 0.95);
});

test("buildRecommendedBudgetPolicy handles warnAtRatio at lower clamp boundary", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.50, // Below 0.65 clamp
      mode: "supervised",
    },
  });

  assert.strictEqual(result.warnAtRatio, 0.65);
});

test("buildRecommendedBudgetPolicy preserves mode from baseline", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "autonomous",
    },
  });

  assert.strictEqual(result.mode, "autonomous");
});

test("buildRecommendedBudgetPolicy preserves other budget fields", () => {
  const result = buildRecommendedBudgetPolicy({
    taskId: "task_123",
    sourceAgentId: "agent_456",
    scopeType: "division",
    scopeRef: "div-123",
    proposalReason: "Test",
    sampleSize: 10,
    observedAverageCostUsd: 0.05,
    successRate: 0.9,
    currentPolicy: {
      maxTaskCostUsd: 0.10,
      maxDailyCostUsd: 1.0,
      maxMonthlyCostUsd: 10.0,
      warnAtRatio: 0.8,
      mode: "supervised",
    },
  });

  assert.strictEqual(result.maxDailyCostUsd, 1.0);
  assert.strictEqual(result.maxMonthlyCostUsd, 10.0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional assertEvolutionScope edge case tests
// ─────────────────────────────────────────────────────────────────────────────

test("assertEvolutionScope accepts valid scope with all allowed characters", () => {
  // Mix of alphanumeric, dots, underscores, hyphens, colons
  assert.doesNotThrow(() => assertEvolutionScope("division", "div_123.abc:xyz-789"));
});

test("assertEvolutionScope rejects scope ref with spaces at boundaries", () => {
  assert.throws(() => assertEvolutionScope("division", " div123"), /evolution\.invalid_scope_ref/);
  assert.throws(() => assertEvolutionScope("division", "div123 "), /evolution\.invalid_scope_ref/);
  assert.throws(() => assertEvolutionScope("division", " div123 "), /evolution\.invalid_scope_ref/);
});

test("assertEvolutionScope rejects scope ref with newline", () => {
  assert.throws(() => assertEvolutionScope("division", "div\n123"), /evolution\.invalid_scope_ref/);
});

test("assertEvolutionScope rejects scope ref with tab", () => {
  assert.throws(() => assertEvolutionScope("division", "div\t123"), /evolution\.invalid_scope_ref/);
});

// ─────────────────────────────────────────────────────────────────────────────
// parseProposalPayload additional tests
// ─────────────────────────────────────────────────────────────────────────────

test("parseProposalPayload handles budget adjustment with all fields", () => {
  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: "exec_123",
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
  assert.strictEqual((payload as any).observedAverageCostUsd, 0.09);
  assert.strictEqual((payload as any).sampleSize, 10);
  assert.strictEqual((payload as any).successRate, 0.95);
  assert.strictEqual((payload as any).proposalReason, "Normal increase");
});

test("parseProposalPayload handles experience promotion with empty keywords", () => {
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
      sourceTaskContext: "context",
      sourceTaskIntent: "intent",
      targetScope: "project",
      promotedSummary: "summary",
      qualityScore: 0.85,
      matchedKeywords: [],
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
  assert.deepEqual((payload as any).matchedKeywords, []);
});

test("parseProposalPayload handles experience promotion with all fields", () => {
  const record = {
    id: "proposal_123",
    taskId: "task_123",
    executionId: "exec_123",
    sourceAgentId: "agent_456",
    kind: "experience_promotion" as const,
    scopeType: "role" as const,
    scopeRef: "role-789",
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
      qualityScore: 0.95,
      matchedKeywords: ["kw1", "kw2", "kw3"],
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
  assert.strictEqual((payload as any).sourceExperienceId, "exp_abc");
  assert.strictEqual((payload as any).sourceTaskContext, "context here");
  assert.strictEqual((payload as any).sourceTaskIntent, "intent here");
  assert.strictEqual((payload as any).targetScope, "project");
  assert.strictEqual((payload as any).promotedSummary, "Reuse successful pattern");
  assert.strictEqual((payload as any).qualityScore, 0.95);
  assert.deepEqual((payload as any).matchedKeywords, ["kw1", "kw2", "kw3"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// parsePolicyValue additional tests
// ─────────────────────────────────────────────────────────────────────────────

test("parsePolicyValue parses experience promotion policy value", () => {
  const record = {
    id: "policy_123",
    proposalId: "proposal_123",
    kind: "experience_promotion" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "active" as const,
    valueJson: JSON.stringify({
      memoryId: "mem_abc123",
      sourceExperienceId: "exp_xyz",
      targetScope: "project",
      appliedBy: "agent_001",
    }),
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const value = parsePolicyValue<{
    memoryId: string;
    sourceExperienceId: string;
    targetScope: string;
    appliedBy: string;
  }>(record);

  assert.strictEqual(value.memoryId, "mem_abc123");
  assert.strictEqual(value.sourceExperienceId, "exp_xyz");
  assert.strictEqual(value.targetScope, "project");
  assert.strictEqual(value.appliedBy, "agent_001");
});

test("parsePolicyValue parses numeric value", () => {
  const record = {
    id: "policy_123",
    proposalId: "proposal_123",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "active" as const,
    valueJson: "0.12345",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const value = parsePolicyValue<number>(record);

  assert.strictEqual(value, 0.12345);
});

test("parsePolicyValue parses null value", () => {
  const record = {
    id: "policy_123",
    proposalId: "proposal_123",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "active" as const,
    valueJson: "null",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const value = parsePolicyValue<null>(record);

  assert.strictEqual(value, null);
});

test("parsePolicyValue parses boolean values", () => {
  const record = {
    id: "policy_123",
    proposalId: "proposal_123",
    kind: "budget_adjustment" as const,
    scopeType: "division" as const,
    scopeRef: "div-789",
    status: "active" as const,
    valueJson: JSON.stringify({ enabled: true, disabled: false }),
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const value = parsePolicyValue<{ enabled: boolean; disabled: boolean }>(record);

  assert.strictEqual(value.enabled, true);
  assert.strictEqual(value.disabled, false);
});
