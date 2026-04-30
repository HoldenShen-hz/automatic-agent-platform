import assert from "node:assert/strict";
import test from "node:test";
import {
  assertEvolutionScope,
  buildRecommendedBudgetPolicy,
  clamp,
  parsePolicyValue,
  parseProposalPayload,
  roundCurrency,
  roundRatio,
  summarizeBudgetProposal,
  type BudgetAdjustmentEvidence,
  type BudgetAdjustmentProposalPayload,
  type ProposeBudgetAdjustmentInput,
} from "../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";
import { ValidationError } from "../../../src/platform/contracts/errors.js";
import type { BudgetPolicy } from "../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

function createMockBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxTaskCostUsd: 1.0,
    warnAtRatio: 0.8,
    maxRetriesPerTask: 3,
    timeoutSeconds: 300,
    ...overrides,
  };
}

test("drift: assertEvolutionScope accepts valid scope refs", () => {
  assert.doesNotThrow(() => assertEvolutionScope("domain", "valid_scope_ref"));
  assert.doesNotThrow(() => assertEvolutionScope("tenant", "tenant_123"));
  assert.doesNotThrow(() => assertEvolutionScope("agent", "agent-abc-123"));
});

test("drift: assertEvolutionScope rejects invalid scope refs", () => {
  assert.throws(() => assertEvolutionScope("domain", ""), ValidationError);
  assert.throws(() => assertEvolutionScope("domain", "123invalid"), ValidationError);
  assert.throws(() => assertEvolutionScope("domain", "has space"), ValidationError);
  assert.throws(() => assertEvolutionScope("domain", "has/slash"), ValidationError);
});

test("drift: roundCurrency preserves 4 decimal places", () => {
  assert.strictEqual(roundCurrency(1.12345), 1.1235);
  assert.strictEqual(roundCurrency(1.1234), 1.1234);
  assert.strictEqual(roundCurrency(0.0001), 0.0001);
  assert.strictEqual(roundCurrency(1.99995), 2.0);
  assert.strictEqual(roundCurrency(100.99995), 101.0);
});

test("drift: roundRatio preserves 3 decimal places", () => {
  assert.strictEqual(roundRatio(0.12345), 0.123);
  assert.strictEqual(roundRatio(0.5), 0.5);
  assert.strictEqual(roundRatio(1.0), 1.0);
});

test("drift: clamp constrains value within bounds", () => {
  assert.strictEqual(clamp(5, 0, 10), 5);
  assert.strictEqual(clamp(-5, 0, 10), 0);
  assert.strictEqual(clamp(15, 0, 10), 10);
});

test("drift: buildRecommendedBudgetPolicy requires minimum samples", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy(),
    observedAverageCostUsd: 0.8,
    sampleSize: 2,
    successRate: 0.9,
    proposalReason: "test",
  };

  assert.throws(() => buildRecommendedBudgetPolicy(input), /evolution.insufficient_budget_samples/);
});

test("drift: buildRecommendedBudgetPolicy validates success rate", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy(),
    observedAverageCostUsd: 0.8,
    sampleSize: 5,
    successRate: 1.5,
    proposalReason: "test",
  };

  assert.throws(() => buildRecommendedBudgetPolicy(input), /evolution.invalid_success_rate/);
});

test("drift: buildRecommendedBudgetPolicy validates observed cost", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy(),
    observedAverageCostUsd: -1,
    sampleSize: 5,
    successRate: 0.9,
    proposalReason: "test",
  };

  assert.throws(() => buildRecommendedBudgetPolicy(input), /evolution.invalid_observed_cost/);
});

test("drift: buildRecommendedBudgetPolicy increases limit when near capacity", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 1.0 }),
    observedAverageCostUsd: 0.9,
    sampleSize: 5,
    successRate: 0.8,
    proposalReason: "near limit",
  };

  const recommended = buildRecommendedBudgetPolicy(input);

  assert.ok(recommended.maxTaskCostUsd > 1.0);
});

test("drift: buildRecommendedBudgetPolicy decreases limit when underutilized", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 1.0 }),
    observedAverageCostUsd: 0.3,
    sampleSize: 10,
    successRate: 0.95,
    proposalReason: "underutilized",
  };

  const recommended = buildRecommendedBudgetPolicy(input);

  assert.ok(recommended.maxTaskCostUsd < 1.0);
});

test("drift: buildRecommendedBudgetPolicy respects max increase bound", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 0.1 }),
    observedAverageCostUsd: 0.1,
    sampleSize: 5,
    successRate: 0.9,
    proposalReason: "high success",
  };

  const recommended = buildRecommendedBudgetPolicy(input);

  // Should not increase beyond 25% of baseline
  assert.ok(recommended.maxTaskCostUsd <= 0.125);
});

test("drift: buildRecommendedBudgetPolicy clamps warnAtRatio", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task-001",
    sourceAgentId: "agent-001",
    scopeType: "domain",
    scopeRef: "test_domain",
    currentPolicy: createMockBudgetPolicy({ warnAtRatio: 0.5 }),
    observedAverageCostUsd: 0.4,
    sampleSize: 5,
    successRate: 0.9,
    proposalReason: "test",
  };

  const recommended = buildRecommendedBudgetPolicy(input);

  // warnAtRatio should be clamped to [0.65, 0.95]
  assert.ok(recommended.warnAtRatio >= 0.65);
  assert.ok(recommended.warnAtRatio <= 0.95);
});

test("drift: summarizeBudgetProposal generates readable summary", () => {
  const evidence: BudgetAdjustmentEvidence = {
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 1.0 }),
    recommendedPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 1.2 }),
    observedAverageCostUsd: 0.9,
    sampleSize: 10,
    successRate: 0.85,
    proposalReason: "near limit usage",
  };

  const summary = summarizeBudgetProposal("domain", "payments", evidence);

  assert.ok(summary.includes("domain:payments"));
  assert.ok(summary.includes("0.9000"));
  assert.ok(summary.includes("10"));
  assert.ok(summary.includes("1.0000"));
  assert.ok(summary.includes("1.2000"));
});

test("drift: parseProposalPayload deserializes budget adjustment payload", () => {
  const payload: BudgetAdjustmentProposalPayload = {
    kind: "budget_adjustment",
    recommendedPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 1.5 }),
    baselinePolicy: createMockBudgetPolicy({ maxTaskCostUsd: 1.0 }),
    observedAverageCostUsd: 1.2,
    sampleSize: 8,
    successRate: 0.9,
    proposalReason: "test reason",
  };

  const record = {
    proposalJson: JSON.stringify(payload),
    id: "evo-001",
    taskId: "task-001",
    executionId: null,
    sourceAgentId: "agent-001",
    kind: "budget_adjustment" as const,
    scopeType: "domain" as const,
    scopeRef: "test",
    status: "pending_approval" as const,
    approvalId: "approval-001",
    summary: "test",
    evidenceJson: "{}",
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: "2026-04-29T00:00:00Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  const parsed = parseProposalPayload(record);

  assert.strictEqual(parsed.kind, "budget_adjustment");
  assert.ok(parsed.recommendedPolicy !== undefined);
  assert.strictEqual(parsed.observedAverageCostUsd, 1.2);
});

test("drift: parsePolicyValue deserializes policy value", () => {
  const policyValue = { recommendedPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 2.0 }) };

  const record = {
    id: "policy-001",
    proposalId: "evo-001",
    kind: "budget_adjustment" as const,
    scopeType: "domain" as const,
    scopeRef: "test",
    status: "active" as const,
    valueJson: JSON.stringify(policyValue),
    createdAt: "2026-04-29T00:00:00Z",
    updatedAt: "2026-04-29T00:00:00Z",
    rolledBackAt: null,
  };

  const parsed = parsePolicyValue<typeof policyValue>(record);

  assert.ok(parsed.recommendedPolicy !== undefined);
});

test("drift: evolution scope ref pattern rejects various invalid formats", () => {
  const invalidRefs = [
    "",
    "0startswithnumber",
    "_underscore",
    "-dash",
    "has\nnewline",
    "has\ttab",
    "a".repeat(130),
  ];

  for (const ref of invalidRefs) {
    assert.throws(() => assertEvolutionScope("domain", ref), ValidationError, `Should reject: ${ref}`);
  }
});

test("drift: evolution scope ref pattern accepts valid formats", () => {
  const validRefs = [
    "ab",
    "valid_ref",
    "valid.ref",
    "valid:ref",
    "Valid123",
    "a".repeat(127),
  ];

  for (const ref of validRefs) {
    assert.doesNotThrow(() => assertEvolutionScope("domain", ref), `Should accept: ${ref}`);
  }
});
