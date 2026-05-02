import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
  type ProposalExecutor,
} from "../../../../src/ops-maturity/drift-detection/benchmark-runner.js";

function createExecutor(
  results: Map<string, { success: boolean; costUsd: number; latencyMs: number; violations: string[] }>,
): ProposalExecutor {
  return {
    execute: async (_proposal, input) => {
      const testCaseId = String(input["testCaseId"] ?? "default");
      return results.get(testCaseId) ?? {
        success: true,
        costUsd: 0.01,
        latencyMs: 100,
        violations: [],
      };
    },
  };
}

function createProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "proposal_test",
    target: "planning_policy",
    kind: "workflow",
    description: "test proposal",
    expectedBenefit: "test benefit",
    createdAt: Date.now(),
    signalIds: [],
    ...overrides,
  };
}

test("SimpleBenchmarkRunner type exports are correct", () => {
  const runner = new SimpleBenchmarkRunner();
  assert.ok(runner instanceof SimpleBenchmarkRunner);
});

test("SimpleBenchmarkRunner constructor accepts initial benchmark cases", () => {
  const initialCases: BenchmarkCase[] = [
    { id: "case_1", taskType: "tool", input: { testCaseId: "case_1" }, critical: true },
    { id: "case_2", taskType: "skill", input: { testCaseId: "case_2" } },
  ];
  const runner = new SimpleBenchmarkRunner(initialCases);
  assert.ok(runner instanceof SimpleBenchmarkRunner);
});

test("SimpleBenchmarkRunner runBenchmarks requires ProposalExecutor", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } },
  ]);

  await assert.rejects(
    () => runner.runBenchmarks(createProposal() as any),
    /ProposalExecutor required/,
  );
});

test("SimpleBenchmarkRunner runBenchmarks matches skill proposals to skill cases", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "skill_case", taskType: "skill_task", input: { testCaseId: "skill_case" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["skill_case", { success: true, costUsd: 0.02, latencyMs: 90, violations: [] }],
  ])));

  const results = await runner.runBenchmarks(createProposal({
    kind: "skill_upgrade",
    target: "skill_library",
  }) as any);

  assert.equal(results.length, 1);
  assert.equal(results[0]?.testCaseId, "skill_case");
  assert.equal(results[0]?.success, true);
});

test("SimpleBenchmarkRunner evaluate returns EvaluationReport structure", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_1", taskType: "tool", input: { testCaseId: "case_1" }, critical: true },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case_1", { success: true, costUsd: 0.01, latencyMs: 80, violations: [] }],
  ])));
  runner.setBaseline("case_1", {
    successRate: 1,
    avgCost: 0.01,
    avgLatencyMs: 80,
    sampleCount: 10,
  });

  const report = await runner.evaluate(createProposal({
    id: "proposal_eval",
    target: "test_policy",
    kind: "tool",
  }) as any);

  assert.equal(report.proposalId, "proposal_eval");
  assert.equal(report.benchmarkCases, 1);
  assert.equal(report.successRateBefore, 1);
  assert.equal(report.successRateAfter, 1);
  assert.equal(report.regressionRate, 0);
  assert.equal(report.decision, "promote");
});

test("SimpleBenchmarkRunner evaluate returns needs_revision when safety violations are present", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case_1", taskType: "tool", input: { testCaseId: "case_1" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case_1", { success: true, costUsd: 0.25, latencyMs: 4000, violations: ["policy_warning"] }],
  ])));
  runner.setBaseline("case_1", {
    successRate: 1,
    avgCost: 0.2,
    avgLatencyMs: 3500,
    sampleCount: 10,
  });

  const report = await runner.evaluate(createProposal({
    id: "proposal_needs_revision",
    target: "tool_policy",
    kind: "tool",
  }) as any);

  assert.equal(report.decision, "needs_revision");
  assert.equal(report.safetyViolations, 1);
});
