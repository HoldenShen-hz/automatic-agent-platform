/**
 * Tests for learning/benchmark-runner.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { ImprovementProposal } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";
import {
  SimpleBenchmarkRunner,
  type BenchmarkRunnerConfig,
  type BenchmarkCase,
  type ProposalExecutor,
  type EvaluationReport,
} from "../../../../src/ops-maturity/drift-detection/benchmark-runner.js";

function createTestProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  const now = new Date().toISOString();
  return {
    id: "prop_test_1",
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "type_validation",
    patch: '{"rules":[]}',
    rationale: "test rationale",
    risk: "low",
    reviewRequirement: "auto",
    evidenceIds: ["ev_1", "ev_2"],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    draftedAt: now,
    ...overrides,
  };
}

test("SimpleBenchmarkRunner constructor creates runner with default config", () => {
  const runner = new SimpleBenchmarkRunner({});
  assert.ok(runner);
});

test("SimpleBenchmarkRunner constructor creates runner with array of benchmark cases", () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "type_validation", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  assert.ok(runner);
});

test("SimpleBenchmarkRunner constructor creates runner with full config", () => {
  const config: BenchmarkRunnerConfig = {
    baseline: { successRate: 0.9, avgCostUsd: 0.50, avgLatencyMs: 5000 },
    minSampleSize: 5,
    evaluationVersion: "eval-v2",
    benchmarkSetId: "custom-set",
  };
  const runner = new SimpleBenchmarkRunner(config);
  assert.ok(runner);
});

test("SimpleBenchmarkRunner addBenchmarkCase adds case to runner", () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { foo: "bar" } });
  assert.ok(runner);
});

test("SimpleBenchmarkRunner setProposalExecutor sets the executor", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const executor: ProposalExecutor = {
    execute: async () => ({ success: true, costUsd: 0.1, latencyMs: 100, violations: [] }),
  };
  runner.setProposalExecutor(executor);
  assert.ok(runner);
});

test("SimpleBenchmarkRunner setEvaluationVersion updates evaluation version", () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setEvaluationVersion("eval-v3");
  assert.ok(runner);
});

test("SimpleBenchmarkRunner setBenchmarkSetId updates benchmark set id", () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setBenchmarkSetId("custom-benchmark-set");
  assert.ok(runner);
});

test("SimpleBenchmarkRunner setBaseline sets global baseline metrics", () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setBaseline({ successRate: 0.85, avgCostUsd: 0.25, avgLatencyMs: 4500 });
  assert.ok(runner);
});

test("SimpleBenchmarkRunner setBaseline sets baseline for specific case id", () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setBaseline("case_1", { successRate: 0.90, avgCost: 0.30, avgLatencyMs: 4000, sampleCount: 10 });
  assert.ok(runner);
});

test("SimpleBenchmarkRunner setBaseline throws when setting case baseline without baseline", () => {
  const runner = new SimpleBenchmarkRunner([]);
  assert.throws(() => {
    runner.setBaseline("case_1", undefined as any);
  });
});

test("SimpleBenchmarkRunner resolveRisk returns high for prompt_patch kind", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = createTestProposal({ kind: "prompt_patch" });
  const risk = runner.resolveRisk(proposal);
  assert.strictEqual(risk, "high");
});

test("SimpleBenchmarkRunner resolveRisk returns high for threshold_tuning kind", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = createTestProposal({ kind: "threshold_tuning" });
  const risk = runner.resolveRisk(proposal);
  assert.strictEqual(risk, "high");
});

test("SimpleBenchmarkRunner resolveRisk returns high for security-related target", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = createTestProposal({ target: "security_validation" });
  const risk = runner.resolveRisk(proposal);
  assert.strictEqual(risk, "high");
});

test("SimpleBenchmarkRunner resolveRisk returns medium for workflow_template kind", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = createTestProposal({ kind: "workflow_template" });
  const risk = runner.resolveRisk(proposal);
  assert.strictEqual(risk, "medium");
});

test("SimpleBenchmarkRunner resolveRisk returns low for tool_routing_rule kind", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = createTestProposal({ kind: "tool_routing_rule", target: "type_validation" });
  const risk = runner.resolveRisk(proposal);
  assert.strictEqual(risk, "low");
});

test("SimpleBenchmarkRunner evaluate returns needs_revision when no benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = createTestProposal();
  const report = await runner.evaluate(proposal);
  assert.strictEqual(report.decision, "needs_revision");
  assert.strictEqual(report.benchmarkCases, 0);
});

test("SimpleBenchmarkRunner evaluate evaluates with relevant cases and executor", async () => {
  const executor: ProposalExecutor = {
    execute: async () => ({ success: true, costUsd: 0.1, latencyMs: 100, violations: [] }),
  };
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "type_validation", input: { test: true } },
  ];
  const runner = new SimpleBenchmarkRunner({ benchmarkCases: cases });
  runner.setProposalExecutor(executor);

  const proposal = createTestProposal({ target: "type_validation" });
  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.decision, "promote");
  assert.strictEqual(report.benchmarkCases, 1);
  assert.ok(report.createdAt);
});

test("SimpleBenchmarkRunner evaluate calculates regression when success rate drops", async () => {
  const executor: ProposalExecutor = {
    execute: async () => ({ success: false, costUsd: 0.1, latencyMs: 100, violations: [] }),
  };
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "type_validation", input: { test: true } },
  ];
  const runner = new SimpleBenchmarkRunner({
    benchmarkCases: cases,
    baseline: { successRate: 0.90, avgCostUsd: 0.10, avgLatencyMs: 100 },
  });
  runner.setProposalExecutor(executor);

  const proposal = createTestProposal({ target: "type_validation" });
  const report = await runner.evaluate(proposal);

  assert.ok(report.regressionRate > 0);
});

test("SimpleBenchmarkRunner evaluate detects safety violations", async () => {
  const executor: ProposalExecutor = {
    execute: async () => ({ success: true, costUsd: 0.1, latencyMs: 100, violations: ["security_policy_violation"] }),
  };
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "type_validation", input: { test: true } },
  ];
  const runner = new SimpleBenchmarkRunner({
    benchmarkCases: cases,
    baseline: { successRate: 0.90, avgCostUsd: 0.10, avgLatencyMs: 100 },
  });
  runner.setProposalExecutor(executor);

  const proposal = createTestProposal({ target: "type_validation" });
  const report = await runner.evaluate(proposal);

  assert.ok(report.safetyViolations > 0);
  assert.strictEqual(report.decision, "needs_revision");
});

test("SimpleBenchmarkRunner evaluate rejects on high regression rate", async () => {
  const executor: ProposalExecutor = {
    execute: async () => ({ success: false, costUsd: 0.1, latencyMs: 100, violations: [] }),
  };
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "type_validation", input: { test: true } },
    { id: "case_2", taskType: "type_validation", input: { test: false } },
    { id: "case_3", taskType: "type_validation", input: { test: true } },
  ];
  const runner = new SimpleBenchmarkRunner({
    benchmarkCases: cases,
    baseline: { successRate: 0.95, avgCostUsd: 0.10, avgLatencyMs: 100 },
  });
  runner.setProposalExecutor(executor);

  const proposal = createTestProposal({ target: "type_validation" });
  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.decision, "reject");
});

test("SimpleBenchmarkRunner runBenchmarks throws when no executor configured", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "type_validation", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner({ benchmarkCases: cases });
  const proposal = createTestProposal();

  await assert.rejects(async () => {
    await runner.runBenchmarks(proposal);
  }, /ProposalExecutor required/);
});

test("SimpleBenchmarkRunner runBenchmarks returns empty array when no relevant cases", async () => {
  const executor: ProposalExecutor = {
    execute: async () => ({ success: true, costUsd: 0.1, latencyMs: 100, violations: [] }),
  };
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "workflow_task", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner({ benchmarkCases: cases });
  runner.setProposalExecutor(executor);

  const proposal = createTestProposal({ kind: "tool_routing_rule", target: "type_validation" });
  const results = await runner.runBenchmarks(proposal);

  assert.strictEqual(results.length, 0);
});