import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
  type ProposalExecutor,
} from "../../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { ImprovementProposal } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";

function createProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  return {
    id: "proposal-test",
    title: "Test Proposal",
    description: "Test description",
    kind: "tool_routing_rule",
    target: "tool_execution",
    patch: "{}",
    rationale: "Testing benchmark execution",
    risk: "low",
    evidenceIds: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createExecutor(results: Map<string, { success: boolean; costUsd: number; latencyMs: number; violations: string[] }>): ProposalExecutor {
  return {
    async execute(_proposal, input) {
      const testCaseId = String(input.testCaseId);
      return results.get(testCaseId) ?? {
        success: true,
        costUsd: 0.01,
        latencyMs: 100,
        violations: [],
      };
    },
  };
}

test("SimpleBenchmarkRunner evaluates locked benchmark cases with evaluation metadata", async () => {
  const runner = new SimpleBenchmarkRunner({
    evaluationVersion: "eval-2026-05-09",
    benchmarkSetId: "locked-set/v2",
  });
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.02, latencyMs: 120, violations: [] }],
    ["case-2", { success: true, costUsd: 0.03, latencyMs: 150, violations: [] }],
  ])));
  runner.setBaseline("case-1", { successRate: 0.9, avgCost: 0.02, avgLatencyMs: 100, sampleCount: 20, snapshotRef: "baseline:case-1" });
  runner.setBaseline("case-2", { successRate: 0.95, avgCost: 0.03, avgLatencyMs: 140, sampleCount: 30, snapshotRef: "baseline:case-2" });
  runner.addBenchmarkCase({ id: "case-1", taskType: "tool_task", input: { testCaseId: "case-1" } });
  runner.addBenchmarkCase({ id: "case-2", taskType: "tool_task", input: { testCaseId: "case-2" } });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.benchmarkCases, 2);
  assert.equal(report.successRateAfter, 1);
  assert.equal(report.evaluationVersion, "eval-2026-05-09");
  assert.equal(report.benchmarkSetId, "locked-set/v2");
  assert.deepEqual(report.lockedCaseIds, ["case-1", "case-2"]);
  assert.ok(report.baselineSnapshotRef.includes("baseline:case-1"));
});

test("SimpleBenchmarkRunner rejects evaluation when locked baseline is missing", async () => {
  const runner = new SimpleBenchmarkRunner();
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.01, latencyMs: 100, violations: [] }],
  ])));
  runner.addBenchmarkCase({ id: "case-1", taskType: "tool_task", input: { testCaseId: "case-1" } });

  await assert.rejects(
    () => runner.evaluate(createProposal()),
    /benchmark_runner\.baseline_required/,
  );
});

test("SimpleBenchmarkRunner runBenchmarks requires a proposal executor when cases exist", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "tool_task", input: { testCaseId: "case-1" } } satisfies BenchmarkCase,
  ]);

  await assert.rejects(
    () => runner.runBenchmarks(createProposal()),
    /ProposalExecutor required/,
  );
});

test("SimpleBenchmarkRunner flags regressions and safety violations", async () => {
  const runner = new SimpleBenchmarkRunner();
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: false, costUsd: 0.05, latencyMs: 300, violations: ["security_violation"] }],
    ["case-2", { success: false, costUsd: 0.05, latencyMs: 300, violations: [] }],
  ])));
  runner.setBaseline("case-1", { successRate: 1, avgCost: 0.01, avgLatencyMs: 100, sampleCount: 10 });
  runner.setBaseline("case-2", { successRate: 1, avgCost: 0.01, avgLatencyMs: 100, sampleCount: 10 });
  runner.addBenchmarkCase({ id: "case-1", taskType: "tool_task", input: { testCaseId: "case-1" } });
  runner.addBenchmarkCase({ id: "case-2", taskType: "tool_task", input: { testCaseId: "case-2" } });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.successRateAfter, 0);
  assert.ok(report.regressionRate > 0.05);
  assert.equal(report.safetyViolations, 1);
  assert.equal(report.decision, "reject");
});
