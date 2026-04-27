/**
 * Unit tests for evolution-mvp-support.ts - parseProposalPayload, parsePolicyValue, and assertEvolutionScope
 * These functions were not covered by the existing evolution-mvp-support.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseProposalPayload,
  parsePolicyValue,
  assertEvolutionScope,
  type BudgetAdjustmentProposalPayload,
  type ExperiencePromotionProposalPayload,
} from "../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";
import type { EvolutionProposalRecord, EvolutionPolicyRecord } from "../../../../src/platform/contracts/types/domain/evolution-types.js";

function createProposalRecord(overrides: Partial<EvolutionProposalRecord> = {}): EvolutionProposalRecord {
  return {
    id: "proposal_001",
    taskId: "task_001",
    executionId: null,
    sourceAgentId: "agent_001",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div-001",
    status: "proposed",
    approvalId: null,
    summary: "Test proposal",
    proposalJson: JSON.stringify({
      kind: "budget_adjustment",
      recommendedPolicy: {
        maxTaskCostUsd: 0.12,
        maxDailyCostUsd: 1.2,
        maxMonthlyCostUsd: 12.0,
        warnAtRatio: 0.85,
        mode: "supervised" as const,
      },
      baselinePolicy: {
        maxTaskCostUsd: 0.10,
        maxDailyCostUsd: 1.0,
        maxMonthlyCostUsd: 10.0,
        warnAtRatio: 0.8,
        mode: "supervised" as const,
      },
      observedAverageCostUsd: 0.09,
      sampleSize: 10,
      successRate: 0.85,
      proposalReason: "Near limit",
    }),
    evidenceJson: "{}",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
    ...overrides,
  };
}

function createPolicyRecord(overrides: Partial<EvolutionPolicyRecord> = {}): EvolutionPolicyRecord {
  return {
    id: "policy_001",
    proposalId: "proposal_001",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div-001",
    status: "active",
    valueJson: JSON.stringify({
      maxTaskCostUsd: 0.12,
      maxDailyCostUsd: 1.2,
      maxMonthlyCostUsd: 12.0,
      warnAtRatio: 0.85,
      mode: "supervised",
    }),
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    rolledBackAt: null,
    ...overrides,
  };
}

test("parseProposalPayload parses budget_adjustment payload correctly", () => {
  const record = createProposalRecord({
    proposalJson: JSON.stringify({
      kind: "budget_adjustment",
      recommendedPolicy: {
        maxTaskCostUsd: 0.15,
        maxDailyCostUsd: 1.5,
        maxMonthlyCostUsd: 15.0,
        warnAtRatio: 0.9,
        mode: "supervised" as const,
      },
      baselinePolicy: {
        maxTaskCostUsd: 0.10,
        maxDailyCostUsd: 1.0,
        maxMonthlyCostUsd: 10.0,
        warnAtRatio: 0.8,
        mode: "supervised" as const,
      },
      observedAverageCostUsd: 0.12,
      sampleSize: 20,
      successRate: 0.9,
      proposalReason: "Spending increased",
    }),
  });

  const payload = parseProposalPayload(record);

  assert.equal(payload.kind, "budget_adjustment");
  assert.ok("recommendedPolicy" in payload);
  assert.equal(payload.recommendedPolicy.maxTaskCostUsd, 0.15);
  assert.equal(payload.observedAverageCostUsd, 0.12);
  assert.equal(payload.sampleSize, 20);
  assert.equal(payload.successRate, 0.9);
});

test("parseProposalPayload parses experience_promotion payload correctly", () => {
  const record = createProposalRecord({
    proposalJson: JSON.stringify({
      kind: "experience_promotion",
      sourceExperienceId: "exp_001",
      sourceTaskContext: "code refactoring",
      sourceTaskIntent: "improve code quality",
      targetScope: "division:div-001",
      promotedSummary: "Use structured error handling",
      qualityScore: 0.92,
      matchedKeywords: ["error", "refactor", "quality"],
    }),
    kind: "experience_promotion",
  });

  const payload = parseProposalPayload(record);

  assert.equal(payload.kind, "experience_promotion");
  assert.ok("sourceExperienceId" in payload);
  assert.equal(payload.sourceExperienceId, "exp_001");
  assert.equal(payload.targetScope, "division:div-001");
  assert.equal(payload.qualityScore, 0.92);
  assert.deepEqual(payload.matchedKeywords, ["error", "refactor", "quality"]);
});

test("parseProposalPayload throws on invalid JSON", () => {
  const record = createProposalRecord({
    proposalJson: "not valid json {{{",
  });

  assert.throws(
    () => parseProposalPayload(record),
    (e: unknown) => e instanceof SyntaxError
  );
});

test("parsePolicyValue parses budget policy correctly", () => {
  const record = createPolicyRecord({
    valueJson: JSON.stringify({
      maxTaskCostUsd: 0.18,
      maxDailyCostUsd: 1.8,
      maxMonthlyCostUsd: 18.0,
      warnAtRatio: 0.88,
      mode: "supervised",
    }),
  });

  const policy = parsePolicyValue<{ maxTaskCostUsd: number }>(record);

  assert.equal(policy.maxTaskCostUsd, 0.18);
});

test("parsePolicyValue parses experience promotion payload correctly", () => {
  const record = createPolicyRecord({
    valueJson: JSON.stringify({
      sourceExperienceId: "exp_002",
      promotedSummary: "Optimize database queries",
      qualityScore: 0.95,
    }),
  });

  const data = parsePolicyValue<{ sourceExperienceId: string; qualityScore: number }>(record);

  assert.equal(data.sourceExperienceId, "exp_002");
  assert.equal(data.qualityScore, 0.95);
});

test("parsePolicyValue throws on invalid JSON", () => {
  const record = createPolicyRecord({
    valueJson: "broken json ---",
  });

  assert.throws(
    () => parsePolicyValue(record),
    (e: unknown) => e instanceof SyntaxError
  );
});

test("assertEvolutionScope accepts valid division scope", () => {
  assert.doesNotThrow(() => assertEvolutionScope("division", "div-001"));
});

test("assertEvolutionScope accepts valid role scope", () => {
  assert.doesNotThrow(() => assertEvolutionScope("role", "role:engineer"));
});

test("assertEvolutionScope accepts valid task_intent scope", () => {
  assert.doesNotThrow(() => assertEvolutionScope("task_intent", "intent.refactor"));
});

test("assertEvolutionScope accepts scope with underscores and dots", () => {
  assert.doesNotThrow(() => assertEvolutionScope("division", "my_division.123:v2"));
});

test("assertEvolutionScope rejects scope that is too short", () => {
  assert.throws(
    () => assertEvolutionScope("division", "a"),
    (e: unknown) => (e as Error)?.message?.includes("evolution.invalid_scope_ref")
  );
});

test("assertEvolutionScope rejects scope with invalid characters", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div@001!"),
    (e: unknown) => (e as Error)?.message?.includes("evolution.invalid_scope_ref")
  );
});

test("assertEvolutionScope rejects scope with spaces", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div 001"),
    (e: unknown) => (e as Error)?.message?.includes("evolution.invalid_scope_ref")
  );
});

test("assertEvolutionScope rejects empty scope", () => {
  assert.throws(
    () => assertEvolutionScope("division", ""),
    (e: unknown) => (e as Error)?.message?.includes("evolution.invalid_scope_ref")
  );
});

test("assertEvolutionScope includes scopeType in error details", () => {
  try {
    assertEvolutionScope("role", "invalid!");
    assert.fail("Should have thrown");
  } catch (e) {
    const error = e as { details?: unknown };
    assert.ok(error.details !== undefined);
    assert.ok(JSON.stringify(error.details).includes("role"));
  }
});
