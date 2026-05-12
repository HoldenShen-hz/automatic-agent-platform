import assert from "node:assert/strict";
import test from "node:test";

import type { BudgetPolicy } from "../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import {
  roundCurrency,
  roundRatio,
  clamp,
  assertEvolutionScope,
  summarizeBudgetProposal,
  buildRecommendedBudgetPolicy,
  parseProposalPayload,
  parsePolicyValue,
  type BudgetAdjustmentEvidence,
  type ProposeBudgetAdjustmentInput,
} from "../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";
import type { EvolutionProposalRecord } from "../../../src/platform/contracts/types/domain.js";
import type { ImprovementProposal } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type { EvaluationReport } from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { RolloutRecord } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";
import type { ReflectionRecord } from "../../../src/ops-maturity/drift-detection/reflection-engine.js";
import { InMemoryEvolutionRegistry } from "../../../src/ops-maturity/drift-detection/evolution-registry.js";
import { PromotionGate, DEFAULT_PROMOTION_GATE_CONFIG } from "../../../src/ops-maturity/drift-detection/promotion-gate.js";
import { SimpleRolloutManager } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";

function createMockBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxTaskCostUsd: 10.0,
    maxDailyCostUsd: 100.0,
    maxMonthlyCostUsd: 1000.0,
    warnAtRatio: 0.8,
    mode: "supervised",
    ...overrides,
  };
}

function createMockProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  const now = "2026-04-24T00:00:00.000Z";
  return {
    id: "prop_test_1",
    title: "Test Proposal",
    description: "A test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    patch: '{"test": true}',
    rationale: "Testing",
    risk: "low",
    evidenceIds: ["ev_1"],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockEvaluationReport(proposalId: string): EvaluationReport {
  return {
    proposalId,
    benchmarkCases: 10,
    successRateBefore: 0.60,
    successRateAfter: 0.70,
    regressionRate: 0.0,
    avgCostDelta: 0.05,
    avgLatencyDelta: 0.10,
    safetyViolations: 0,
    decision: "promote",
    createdAt: "2026-04-24T00:00:00.000Z",
  };
}

function createMockReflectionRecord(overrides: Partial<ReflectionRecord> = {}): ReflectionRecord {
  return {
    id: "refl_test_1",
    evidenceIds: ["ev_1", "ev_2"],
    taskType: "code_generation",
    rootCause: "Type error in interface definition",
    recommendation: "Add explicit type annotations",
    confidence: 0.75,
    createdAt: "2026-04-24T00:00:00.000Z",
    ...overrides,
  };
}

function createMockRolloutRecord(proposalId: string): RolloutRecord {
  return {
    proposalId,
    stage: "canary",
    percentage: 5,
    startedAt: "2026-04-24T00:00:00.000Z",
    status: "running",
  };
}

function createMockEvolutionProposalRecord(id: string): EvolutionProposalRecord {
  const now = "2026-04-24T00:00:00.000Z";
  return {
    id,
    taskId: "task_1",
    executionId: "exec_1",
    sourceAgentId: "agent_1",
    kind: "budget_adjustment",
    scopeType: "task_intent",
    scopeRef: "code_generation:v1",
    status: "pending_approval",
    approvalId: "approval_1",
    summary: "Test proposal summary",
    proposalJson: JSON.stringify({
      kind: "budget_adjustment",
      recommendedPolicy: createMockBudgetPolicy(),
      baselinePolicy: createMockBudgetPolicy(),
      observedAverageCostUsd: 8.5,
      sampleSize: 10,
      successRate: 0.85,
      proposalReason: "Observed spending near limit with high success",
    }),
    evidenceJson: JSON.stringify({}),
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };
}

// roundCurrency tests
test("roundCurrency rounds to 4 decimal places", () => {
  assert.equal(roundCurrency(1.12345), 1.1235);
  assert.equal(roundCurrency(1.1234), 1.1234);
  assert.equal(roundCurrency(1.12345), 1.1235);
  assert.equal(roundCurrency(0.0001), 0.0001);
});

test("roundCurrency handles whole numbers", () => {
  assert.equal(roundCurrency(100), 100);
  assert.equal(roundCurrency(0), 0);
});

// roundRatio tests
test("roundRatio rounds to 3 decimal places", () => {
  assert.equal(roundRatio(0.12345), 0.123);
  assert.equal(roundRatio(0.1235), 0.124);
  assert.equal(roundRatio(0.99999), 1);
});

test("roundRatio handles edge cases", () => {
  assert.equal(roundRatio(0), 0);
  assert.equal(roundRatio(1), 1);
  assert.equal(roundRatio(0.5555), 0.556);
});

// clamp tests
test("clamp keeps value within bounds", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test("clamp clamps values outside bounds", () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(100, 0, 10), 10);
});

// assertEvolutionScope tests
test("assertEvolutionScope accepts valid scope refs", () => {
  assert.doesNotThrow(() => assertEvolutionScope("division", "acme_corp"));
  assert.doesNotThrow(() => assertEvolutionScope("role", "admin:v2"));
  assert.doesNotThrow(() => assertEvolutionScope("task_intent", "code_generation:v1.2.3"));
});

test("assertEvolutionScope throws on empty scope ref", () => {
  assert.throws(
    () => assertEvolutionScope("division", ""),
    { name: "ValidationError" }
  );
});

test("assertEvolutionScope throws on scope ref with invalid characters", () => {
  assert.throws(
    () => assertEvolutionScope("task_intent", "invalid ref!"),
    { name: "ValidationError" }
  );
});

test("assertEvolutionScope throws on scope ref with spaces", () => {
  assert.throws(
    () => assertEvolutionScope("role", "has space"),
    { name: "ValidationError" }
  );
});

// summarizeBudgetProposal tests
test("summarizeBudgetProposal generates human-readable summary", () => {
  const evidence: BudgetAdjustmentEvidence = {
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 10.0 }),
    recommendedPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 12.0 }),
    observedAverageCostUsd: 8.5,
    sampleSize: 10,
    successRate: 0.85,
    proposalReason: "Near limit with high success",
  };

  const summary = summarizeBudgetProposal("task_intent", "code_generation:v1", evidence);

  assert.ok(summary.includes("budget adjustment"));
  assert.ok(summary.includes("task_intent"));
  assert.ok(summary.includes("code_generation:v1"));
  assert.ok(summary.includes("8.5000"));
  assert.ok(summary.includes("10.0000"));
  assert.ok(summary.includes("12.0000"));
});

// buildRecommendedBudgetPolicy tests
test("buildRecommendedBudgetPolicy increases limit when near capacity with high success", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task_1",
    sourceAgentId: "agent_1",
    scopeType: "task_intent",
    scopeRef: "code_generation:v1",
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 10.0 }),
    observedAverageCostUsd: 9.0,
    sampleSize: 5,
    successRate: 0.8,
    proposalReason: "Near limit",
  };

  const result = buildRecommendedBudgetPolicy(input);

  assert.ok(result.maxTaskCostUsd >= input.currentPolicy.maxTaskCostUsd);
});

test("buildRecommendedBudgetPolicy decreases limit when well below capacity", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task_1",
    sourceAgentId: "agent_1",
    scopeType: "task_intent",
    scopeRef: "code_generation:v1",
    currentPolicy: createMockBudgetPolicy({ maxTaskCostUsd: 10.0 }),
    observedAverageCostUsd: 3.0,
    sampleSize: 10,
    successRate: 0.95,
    proposalReason: "Well below limit",
  };

  const result = buildRecommendedBudgetPolicy(input);

  assert.ok(result.maxTaskCostUsd <= input.currentPolicy.maxTaskCostUsd);
});

test("buildRecommendedBudgetPolicy throws on insufficient samples", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task_1",
    sourceAgentId: "agent_1",
    scopeType: "task_intent",
    scopeRef: "code_generation:v1",
    currentPolicy: createMockBudgetPolicy(),
    observedAverageCostUsd: 5.0,
    sampleSize: 2, // Below minimum of 3
    successRate: 0.8,
    proposalReason: "Test",
  };

  assert.throws(
    () => buildRecommendedBudgetPolicy(input),
    { name: "ValidationError", message: /insufficient_budget_samples/ }
  );
});

test("buildRecommendedBudgetPolicy throws on invalid success rate", () => {
  const input: ProposeBudgetAdjustmentInput = {
    taskId: "task_1",
    sourceAgentId: "agent_1",
    scopeType: "task_intent",
    scopeRef: "code_generation:v1",
    currentPolicy: createMockBudgetPolicy(),
    observedAverageCostUsd: 5.0,
    sampleSize: 5,
    successRate: 1.5, // Invalid: > 1
    proposalReason: "Test",
  };

  assert.throws(
    () => buildRecommendedBudgetPolicy(input),
    { name: "ValidationError", message: /invalid_success_rate/ }
  );
});

// parseProposalPayload tests
test("parseProposalPayload parses budget adjustment payload", () => {
  const proposal = createMockEvolutionProposalRecord("evo_1");

  const payload = parseProposalPayload(proposal);

  assert.equal(payload.kind, "budget_adjustment");
  assert.ok("recommendedPolicy" in payload);
  assert.ok("baselinePolicy" in payload);
});

test("parsePolicyValue parses JSON value", () => {
  const policyRecord = {
    id: "policy_1",
    proposalId: "prop_1",
    kind: "budget_adjustment" as const,
    scopeType: "task_intent" as const,
    scopeRef: "test:v1",
    status: "active" as const,
    valueJson: JSON.stringify({ recommendedPolicy: createMockBudgetPolicy(), appliedBy: "agent_1" }),
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:00:00.000Z",
    rolledBackAt: null,
  };

  const value = parsePolicyValue<{ recommendedPolicy: BudgetPolicy; appliedBy: string }>(policyRecord);

  assert.ok(value.recommendedPolicy);
  assert.equal(value.appliedBy, "agent_1");
});

// PromotionGate tests
test("PromotionGate decide allows valid low-risk proposal", () => {
  const gate = new PromotionGate();
  const proposal = createMockProposal({ risk: "low" });
  const report = createMockEvaluationReport(proposal.id);

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasons.length, 0);
});

test("PromotionGate decide rejects when frozen", () => {
  const gate = new PromotionGate();
  const proposal = createMockProposal();
  const report = createMockEvaluationReport(proposal.id);

  const decision = gate.decide(proposal, report, true);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("frozen")));
});

test("PromotionGate decide rejects high-risk proposals regardless of metrics", () => {
  const gate = new PromotionGate();
  const proposal = createMockProposal({ risk: "high" });
  const report = createMockEvaluationReport(proposal.id);
  report.successRateAfter = 0.95; // Excellent metrics

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("High-risk")));
});

test("PromotionGate decide rejects on insufficient success lift", () => {
  const gate = new PromotionGate();
  const proposal = createMockProposal({ risk: "low" });
  const report = createMockEvaluationReport(proposal.id);
  report.successRateAfter = 0.62; // Only 2% lift, below 3% threshold

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("success lift")));
});

test("PromotionGate decide rejects on high regression rate", () => {
  const gate = new PromotionGate();
  const proposal = createMockProposal({ risk: "low" });
  const report = createMockEvaluationReport(proposal.id);
  report.regressionRate = 0.05; // Above 1% threshold

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("Regression")));
});

test("PromotionGate decide rejects on safety violations", () => {
  const gate = new PromotionGate();
  const proposal = createMockProposal({ risk: "low" });
  const report = createMockEvaluationReport(proposal.id);
  report.safetyViolations = 1;

  const decision = gate.decide(proposal, report, false);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("Safety")));
});

test("PromotionGate requiresManualGate returns true for certain kinds", () => {
  const gate = new PromotionGate();

  assert.equal(gate.requiresManualGate(createMockProposal({ kind: "prompt_patch" })), true);
  assert.equal(gate.requiresManualGate(createMockProposal({ kind: "workflow_template" })), true);
  assert.equal(gate.requiresManualGate(createMockProposal({ kind: "threshold_tuning" })), true);
  assert.equal(gate.requiresManualGate(createMockProposal({ kind: "tool_routing_rule" })), false);
});

// InMemoryEvolutionRegistry tests
test("InMemoryEvolutionRegistry saveProposal and getProposal roundtrip", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const proposal = createMockProposal();

  await registry.saveProposal(proposal);
  const retrieved = await registry.getProposal(proposal.id);

  assert.deepEqual(retrieved, proposal);
});

test("InMemoryEvolutionRegistry updateProposalStatus changes status", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const proposal = createMockProposal();

  await registry.saveProposal(proposal);
  await registry.updateProposalStatus(proposal.id, "testing");

  const updated = await registry.getProposal(proposal.id);
  assert.equal(updated?.status, "testing");
});

test("InMemoryEvolutionRegistry listProposals filters by status", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal(createMockProposal({ id: "p1", status: "proposed" }));
  await registry.saveProposal(createMockProposal({ id: "p2", status: "testing" }));

  const proposed = await registry.listProposals("proposed");
  const testing = await registry.listProposals("testing");

  assert.equal(proposed.length, 1);
  assert.equal(proposed[0]?.id, "p1");
  assert.equal(testing.length, 1);
  assert.equal(testing[0]?.id, "p2");
});

test("InMemoryEvolutionRegistry saveEvaluation and getEvaluation roundtrip", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const proposal = createMockProposal();
  const report = createMockEvaluationReport(proposal.id);

  await registry.saveProposal(proposal);
  await registry.saveEvaluation(report);
  const retrieved = await registry.getEvaluation(proposal.id);

  assert.deepEqual(retrieved, report);
});

test("InMemoryEvolutionRegistry saveRollout and getRollout roundtrip", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const rollout = createMockRolloutRecord("prop_1");

  await registry.saveRollout(rollout);
  const retrieved = await registry.getRollout("prop_1");

  assert.deepEqual(retrieved, rollout);
});

test("InMemoryEvolutionRegistry listActiveRollouts returns only running", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveRollout(createMockRolloutRecord("prop_1"));
  await registry.saveRollout({ ...createMockRolloutRecord("prop_2"), status: "succeeded" });

  const active = await registry.listActiveRollouts();

  assert.equal(active.length, 1);
  assert.equal(active[0]?.proposalId, "prop_1");
});

test("InMemoryEvolutionRegistry saveReflection and listReflections", async () => {
  const registry = new InMemoryEvolutionRegistry();
  const reflection = createMockReflectionRecord();

  await registry.saveReflection(reflection);
  const reflections = await registry.listReflections();

  assert.equal(reflections.length, 1);
  assert.equal(reflections[0]?.id, "refl_test_1");
});

test("InMemoryEvolutionRegistry listReflections filters by taskType", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveReflection(createMockReflectionRecord({ id: "r1", taskType: "code_generation" }));
  await registry.saveReflection(createMockReflectionRecord({ id: "r2", taskType: "refactoring" }));

  const codeReflections = await registry.listReflections("code_generation");
  const refactorReflections = await registry.listReflections("refactoring");

  assert.equal(codeReflections.length, 1);
  assert.equal(refactorReflections.length, 1);
});

test("InMemoryEvolutionRegistry getStatistics calculates correct aggregates", async () => {
  const registry = new InMemoryEvolutionRegistry();
  await registry.saveProposal(createMockProposal({ id: "p1", status: "reviewed" }));
  await registry.saveProposal(createMockProposal({ id: "p2", status: "rejected" }));
  await registry.saveProposal(createMockProposal({ id: "p3", status: "draft" }));
  await registry.saveEvaluation(createMockEvaluationReport("p1"));

  const stats = await registry.getStatistics();

  assert.equal(stats.totalProposals, 3);
  assert.equal(stats.activeCount, 1);
  assert.equal(stats.rejectedCount, 1);
  assert.ok("averageSuccessLift" in stats);
});

// SimpleRolloutManager tests
test("SimpleRolloutManager start creates rollout with correct stage", async () => {
  const manager = new SimpleRolloutManager();
  const proposal = createMockProposal();

  const record = await manager.start(proposal, "canary", 5);

  assert.equal(record.stage, "canary");
  assert.equal(record.percentage, 5);
  assert.equal(record.status, "running");
});

test("SimpleRolloutManager getDefaultStageSequence returns all stages", () => {
  const manager = new SimpleRolloutManager();
  const sequence = manager.getDefaultStageSequence();

  assert.deepEqual(sequence, ["shadow", "canary", "partial", "stable"]);
});

test("SimpleRolloutManager getStagePercentage returns correct percentages", () => {
  const manager = new SimpleRolloutManager();

  assert.equal(manager.getStagePercentage("shadow"), 0);
  assert.equal(manager.getStagePercentage("canary"), 5);
  assert.equal(manager.getStagePercentage("partial"), 25);
  assert.equal(manager.getStagePercentage("stable"), 100);
});
