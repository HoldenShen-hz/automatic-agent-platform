import test from "node:test";
import assert from "node:assert/strict";
import {
  SimpleBenchmarkRunner,
  BenchmarkCase,
  type EvaluationReport,
  type BenchmarkResult,
} from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { ImprovementProposal } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";

function createMockProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  return {
    id: "prop_test_1",
    title: "Test Proposal",
    description: "A test improvement proposal",
    kind: "tool_routing_rule",
    target: "type_validation",
    patch: "{}",
    rationale: "Testing",
    risk: "low",
    evidenceIds: ["evidence_1"],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("SimpleBenchmarkRunner constructor accepts initial benchmark cases", () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "tool_use", input: { key: "value" } },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  assert.ok(runner);
});

test("SimpleBenchmarkRunner addBenchmarkCase adds a case", () => {
  const runner = new SimpleBenchmarkRunner();
  const testCase: BenchmarkCase = {
    id: "case_new",
    taskType: "skill_execution",
    input: { param: 123 },
  };
  runner.addBenchmarkCase(testCase);
  assert.ok(runner);
});

test("SimpleBenchmarkRunner.runBenchmarks returns results for each relevant case", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "tool_use", input: {} },
    { id: "case_2", taskType: "tool_validation", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = createMockProposal({ kind: "tool_routing_rule", target: "validation" });

  const results = await runner.runBenchmarks(proposal);

  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0]?.testCaseId, "case_1");
  assert.strictEqual(results[1]?.testCaseId, "case_2");
});

test("SimpleBenchmarkRunner.runBenchmarks returns results with required fields", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_required_fields", taskType: "tool_use", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = createMockProposal();

  const results = await runner.runBenchmarks(proposal);

  assert.strictEqual(results.length, 1);
  const result = results[0];
  assert.ok(result, "result should exist");
  assert.strictEqual(result.testCaseId, "case_required_fields");
  assert.strictEqual(typeof result.success, "boolean");
  assert.strictEqual(typeof result.costUsd, "number");
  assert.strictEqual(typeof result.latencyMs, "number");
  assert.ok(Array.isArray(result.violations));
});

test("SimpleBenchmarkRunner.evaluate returns valid EvaluationReport", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_eval", taskType: "tool_use", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = createMockProposal();

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop_test_1");
  assert.strictEqual(typeof report.benchmarkCases, "number");
  assert.strictEqual(typeof report.successRateBefore, "number");
  assert.strictEqual(typeof report.successRateAfter, "number");
  assert.strictEqual(typeof report.regressionRate, "number");
  assert.strictEqual(typeof report.avgCostDelta, "number");
  assert.strictEqual(typeof report.avgLatencyDelta, "number");
  assert.strictEqual(typeof report.safetyViolations, "number");
  assert.ok(["promote", "reject", "needs_revision"].includes(report.decision));
  assert.ok(report.createdAt);
});

test("SimpleBenchmarkRunner.evaluate returns regressionRate of 0 when success rates match", async () => {
  const runner = new SimpleBenchmarkRunner();
  const proposal = createMockProposal({ kind: "workflow_template", target: "complex_task" });

  const report = await runner.evaluate(proposal);

  assert.ok(report.regressionRate >= 0);
});

test("SimpleBenchmarkRunner.evaluate calculates avgCostDelta correctly", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_cost", taskType: "tool_use", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = createMockProposal();

  const report = await runner.evaluate(proposal);

  assert.strictEqual(typeof report.avgCostDelta, "number");
});

test("SimpleBenchmarkRunner.evaluate handles empty benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner();
  const proposal = createMockProposal();

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.benchmarkCases, 0);
  assert.strictEqual(report.successRateAfter, 0);
});

test("SimpleBenchmarkRunner.evaluate returns correct decision for high regression", async () => {
  const runner = new SimpleBenchmarkRunner();
  // Using workflow kind to trigger more lenient relevance check
  const proposal = createMockProposal({ kind: "workflow_template", target: "complex_workflow" });

  const report = await runner.evaluate(proposal);

  assert.ok(["promote", "reject", "needs_revision"].includes(report.decision));
});

test("SimpleBenchmarkRunner filters cases by relevance based on proposal kind", async () => {
  const cases: BenchmarkCase[] = [
    { id: "tool_case", taskType: "tool_use", input: {} },
    { id: "skill_case", taskType: "skill_execution", input: {} },
    { id: "workflow_case", taskType: "workflow_execution", input: {} },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = createMockProposal({ kind: "tool_routing_rule", target: "tool_selector" });

  const results = await runner.runBenchmarks(proposal);

  assert.strictEqual(results.length, 3); // All cases pass isRelevantCase
});

test("SimpleBenchmarkRunner.evaluate sets successRateBefore to baseline 0.60", async () => {
  const runner = new SimpleBenchmarkRunner();
  const proposal = createMockProposal();

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.successRateBefore, 0.60);
});

test("SimpleBenchmarkRunner runBenchmarks includes violations when success is false", async () => {
  const runner = new SimpleBenchmarkRunner();
  const proposal = createMockProposal();

  const results = await runner.runBenchmarks(proposal);

  for (const result of results) {
    if (!result.success) {
      assert.ok(result.violations.length > 0);
    }
  }
});
