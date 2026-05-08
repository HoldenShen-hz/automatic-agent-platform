import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
} from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { ImprovementProposal } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";

function createProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
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

function withMockedRandom<T>(value: number, fn: () => Promise<T> | T): Promise<T> | T {
  const originalRandom = Math.random;
  Math.random = () => value;

  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

test("SimpleBenchmarkRunner constructor accepts initial benchmark cases", () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "tool_use", input: { testCaseId: "case_1" } },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  assert.ok(runner);
});

test("SimpleBenchmarkRunner addBenchmarkCase adds a case", async () => {
  const runner = new SimpleBenchmarkRunner();
  runner.addBenchmarkCase({ id: "case_new", taskType: "tool_use", input: { testCaseId: "case_new" } });

  const results = await withMockedRandom(0.9, () => runner.runBenchmarks(createProposal()));
  assert.equal(results.length, 1);
  assert.equal(results[0]?.testCaseId, "case_new");
});

test("SimpleBenchmarkRunner runBenchmarks handles cases without executor wiring", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_1", taskType: "tool_use", input: { testCaseId: "case_1" } },
  ]);

  const results = await withMockedRandom(0.9, () => runner.runBenchmarks(createProposal()));
  assert.equal(results.length, 1);
  assert.equal(results[0]?.success, true);
});

test("SimpleBenchmarkRunner runBenchmarks returns results for relevant cases", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "tool_use", input: { testCaseId: "case_1" } },
    { id: "case_2", taskType: "tool_validation", input: { testCaseId: "case_2" } },
  ];
  const runner = new SimpleBenchmarkRunner(cases);

  const results = await withMockedRandom(0.1, () => runner.runBenchmarks(createProposal({
    kind: "tool_routing_rule",
    target: "validation",
  })));

  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.testCaseId), ["case_1", "case_2"]);
  assert.deepEqual(results[0]?.violations, ["minor_issue"]);
  assert.equal(results[1]?.latencyMs, 8000);
});

test("SimpleBenchmarkRunner evaluate returns a valid EvaluationReport", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_eval", taskType: "tool_use", input: { testCaseId: "case_eval" } },
  ]);

  const report = await withMockedRandom(0.9, () => runner.evaluate(createProposal()));

  assert.equal(report.proposalId, "prop_test_1");
  assert.equal(report.benchmarkCases, 1);
  assert.equal(report.successRateBefore, 0.6);
  assert.equal(report.successRateAfter, 1);
  assert.equal(report.regressionRate, 0);
  assert.equal(report.avgCostDelta, (0.25 - 0.3) / 0.3);
  assert.equal(report.avgLatencyDelta, (4000 - 5000) / 5000);
  assert.equal(report.safetyViolations, 0);
  assert.equal(report.decision, "promote");
  assert.ok(report.createdAt.length > 0);
});

test("SimpleBenchmarkRunner evaluate handles empty benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);

  const report = await runner.evaluate(createProposal());

  assert.equal(report.benchmarkCases, 0);
  assert.equal(report.successRateBefore, 0.6);
  assert.equal(report.successRateAfter, 0);
  assert.equal(report.regressionRate, 0.6);
  assert.equal(report.decision, "reject");
});

test("SimpleBenchmarkRunner evaluate rejects when regression exceeds threshold", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_regression", taskType: "tool_use", input: { testCaseId: "case_regression" } },
  ]);

  const report = await withMockedRandom(0.1, () => runner.evaluate(createProposal()));

  assert.ok(report.regressionRate > 0.05);
  assert.equal(report.decision, "reject");
});
