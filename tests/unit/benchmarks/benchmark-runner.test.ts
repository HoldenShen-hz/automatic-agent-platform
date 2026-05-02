import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
  type ProposalExecutor,
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

function createExecutor(
  results: Map<string, { success: boolean; costUsd: number; latencyMs: number; violations: string[] }>,
): ProposalExecutor {
  return {
    execute: async (_proposal, input) => {
      const testCaseId = String(input["testCaseId"] ?? "default");
      return results.get(testCaseId) ?? {
        success: true,
        costUsd: 0.02,
        latencyMs: 120,
        violations: [],
      };
    },
  };
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
  runner.setProposalExecutor(createExecutor(new Map()));
  runner.addBenchmarkCase({ id: "case_new", taskType: "tool_use", input: { testCaseId: "case_new" } });

  const results = await runner.runBenchmarks(createProposal());
  assert.equal(results.length, 1);
  assert.equal(results[0]?.testCaseId, "case_new");
});

test("SimpleBenchmarkRunner runBenchmarks requires ProposalExecutor when cases exist", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_1", taskType: "tool_use", input: { testCaseId: "case_1" } },
  ]);

  await assert.rejects(
    () => runner.runBenchmarks(createProposal()),
    /ProposalExecutor required/,
  );
});

test("SimpleBenchmarkRunner runBenchmarks returns results for relevant cases", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case_1", taskType: "tool_use", input: { testCaseId: "case_1" } },
    { id: "case_2", taskType: "tool_validation", input: { testCaseId: "case_2" } },
  ];
  const runner = new SimpleBenchmarkRunner(cases);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case_1", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
    ["case_2", { success: false, costUsd: 0.03, latencyMs: 75, violations: ["validation_failed"] }],
  ])));

  const results = await runner.runBenchmarks(createProposal({ kind: "tool_routing_rule", target: "validation" }));

  assert.equal(results.length, 2);
  assert.deepEqual(results.map((result) => result.testCaseId), ["case_1", "case_2"]);
  assert.deepEqual(results[1]?.violations, ["validation_failed"]);
});

test("SimpleBenchmarkRunner evaluate returns a valid EvaluationReport", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_eval", taskType: "tool_use", input: { testCaseId: "case_eval" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case_eval", { success: true, costUsd: 0.02, latencyMs: 200, violations: [] }],
  ])));
  runner.setBaseline("case_eval", {
    successRate: 1,
    avgCost: 0.01,
    avgLatencyMs: 100,
    sampleCount: 10,
  });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.proposalId, "prop_test_1");
  assert.equal(report.benchmarkCases, 1);
  assert.equal(report.successRateBefore, 1);
  assert.equal(report.successRateAfter, 1);
  assert.equal(report.regressionRate, 0);
  assert.equal(report.avgCostDelta, 1);
  assert.equal(report.avgLatencyDelta, 1);
  assert.equal(report.safetyViolations, 0);
  assert.equal(report.decision, "promote");
  assert.ok(report.createdAt.length > 0);
});

test("SimpleBenchmarkRunner evaluate handles empty benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setProposalExecutor(createExecutor(new Map()));

  const report = await runner.evaluate(createProposal());

  assert.equal(report.benchmarkCases, 0);
  assert.equal(report.successRateBefore, 0);
  assert.equal(report.successRateAfter, 0);
  assert.equal(report.regressionRate, 0);
  assert.equal(report.decision, "promote");
});

test("SimpleBenchmarkRunner evaluate rejects when regression exceeds threshold", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_regression", taskType: "tool_use", input: { testCaseId: "case_regression" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case_regression", { success: false, costUsd: 0.02, latencyMs: 120, violations: [] }],
  ])));
  runner.setBaseline("case_regression", {
    successRate: 1,
    avgCost: 0.02,
    avgLatencyMs: 120,
    sampleCount: 10,
  });

  const report = await runner.evaluate(createProposal());

  assert.ok(report.regressionRate > 0.05);
  assert.equal(report.decision, "reject");
});
