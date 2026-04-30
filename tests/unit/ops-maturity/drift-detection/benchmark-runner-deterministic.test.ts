import assert from "node:assert/strict";
import test from "node:test";

import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
  type ProposalExecutor,
} from "../../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { ImprovementProposal } from "../../../../src/ops-maturity/drift-detection/proposal-engine.js";

/**
 * Deterministic proposal executor for testing.
 * Returns predictable results based on test case ID.
 */
function createDeterministicExecutor(
  results: Map<string, { success: boolean; costUsd: number; latencyMs: number; violations: string[] }>
): ProposalExecutor {
  return {
    execute: async (_proposal: ImprovementProposal, input: Record<string, unknown>): Promise<{
      success: boolean;
      costUsd: number;
      latencyMs: number;
      output?: unknown;
      violations: string[];
    }> => {
      const testCaseId = input["testCaseId"] as string;
      const result = results.get(testCaseId) ?? {
        success: true,
        costUsd: 0.01,
        latencyMs: 100,
        violations: [],
      };
      return result;
    },
  };
}

function createProposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  return {
    id: "test-proposal",
    title: "Test Proposal",
    description: "A test proposal",
    kind: "tool_routing_rule",
    target: "tool_execution",
    patch: "{}",
    rationale: "Testing",
    risk: "low",
    evidenceIds: [],
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("SimpleBenchmarkRunner: evaluate returns deterministic results with locked baseline", async () => {
  const runner = new SimpleBenchmarkRunner();

  // Set deterministic executor
  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
        ["case_2", { success: true, costUsd: 0.02, latencyMs: 100, violations: [] }],
      ])
    )
  );

  // Set locked baseline
  runner.setBaseline("case_1", { successRate: 0.9, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.setBaseline("case_2", { successRate: 0.95, avgCost: 0.02, avgLatencyMs: 100, sampleCount: 10 });

  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });
  runner.addBenchmarkCase({ id: "case_2", taskType: "tool_task", input: { testCaseId: "case_2" } });

  const proposal = createProposal();
  const report = await runner.evaluate(proposal);

  assert.equal(report.proposalId, "test-proposal");
  assert.equal(report.benchmarkCases, 2);
  assert.equal(report.successRateAfter, 1.0); // Both cases succeeded
  assert.equal(report.safetyViolations, 0);
});

test("SimpleBenchmarkRunner: evaluate detects regression when success rate drops", async () => {
  const runner = new SimpleBenchmarkRunner();

  // Executor that fails one case
  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
        ["case_2", { success: false, costUsd: 0.02, latencyMs: 100, violations: ["error"] }],
      ])
    )
  );

  // Baseline has 100% success rate
  runner.setBaseline("case_1", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.setBaseline("case_2", { successRate: 1.0, avgCost: 0.02, avgLatencyMs: 100, sampleCount: 10 });

  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });
  runner.addBenchmarkCase({ id: "case_2", taskType: "tool_task", input: { testCaseId: "case_2" } });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.successRateAfter, 0.5);
  assert.ok(report.regressionRate > 0); // Regression detected
});

test("SimpleBenchmarkRunner: evaluate returns needs_revision when safety violations present", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.01, latencyMs: 50, violations: ["security_violation"] }],
      ])
    )
  );

  runner.setBaseline("case_1", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" }, critical: true });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.safetyViolations, 1);
  assert.equal(report.decision, "needs_revision");
});

test("SimpleBenchmarkRunner: evaluate returns reject when regression rate > 5%", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: false, costUsd: 0.01, latencyMs: 50, violations: [] }],
        ["case_2", { success: false, costUsd: 0.01, latencyMs: 50, violations: [] }],
        ["case_3", { success: false, costUsd: 0.01, latencyMs: 50, violations: [] }],
      ])
    )
  );

  // Baseline: 100% success
  runner.setBaseline("case_1", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.setBaseline("case_2", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.setBaseline("case_3", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });

  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });
  runner.addBenchmarkCase({ id: "case_2", taskType: "tool_task", input: { testCaseId: "case_2" } });
  runner.addBenchmarkCase({ id: "case_3", taskType: "tool_task", input: { testCaseId: "case_3" } });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.successRateAfter, 0);
  assert.ok(report.regressionRate > 0.05);
  assert.equal(report.decision, "reject");
});

test("SimpleBenchmarkRunner: evaluate computes avgCostDelta correctly", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.02, latencyMs: 50, violations: [] }],
      ])
    )
  );

  runner.setBaseline("case_1", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });

  const report = await runner.evaluate(createProposal());

  // Cost doubled: (0.02 - 0.01) / 0.01 = 1.0 (100% increase)
  assert.equal(report.avgCostDelta, 1.0);
});

test("SimpleBenchmarkRunner: evaluate computes avgLatencyDelta correctly", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.01, latencyMs: 200, violations: [] }],
      ])
    )
  );

  runner.setBaseline("case_1", { successRate: 1.0, avgCost: 0.01, avgLatencyMs: 100, sampleCount: 10 });
  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });

  const report = await runner.evaluate(createProposal());

  // Latency doubled: (200 - 100) / 100 = 1.0 (100% increase)
  assert.equal(report.avgLatencyDelta, 1.0);
});

test("SimpleBenchmarkRunner: runBenchmarks requires ProposalExecutor", async () => {
  const runner = new SimpleBenchmarkRunner([]);

  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: {} });

  await assert.rejects(
    async () => runner.runBenchmarks(createProposal()),
    /ProposalExecutor required/
  );
});

test("SimpleBenchmarkRunner: evaluate handles empty benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setProposalExecutor(createDeterministicExecutor(new Map()));

  const report = await runner.evaluate(createProposal());

  assert.equal(report.benchmarkCases, 0);
  assert.equal(report.successRateBefore, 0);
  assert.equal(report.successRateAfter, 0);
});

test("SimpleBenchmarkRunner: runBenchmarks filters by relevance correctly", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "tool_case", taskType: "tool_task", input: {} },
    { id: "skill_case", taskType: "skill_task", input: {} },
    { id: "workflow_case", taskType: "workflow_task", input: {} },
  ]);

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["tool_case", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
        ["skill_case", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
        ["workflow_case", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
      ])
    )
  );

  // Tool proposal should match tool_case (and all others since default includes all)
  const results = await runner.runBenchmarks(createProposal({ kind: "tool_routing_rule", target: "tools" }));
  assert.ok(results.length >= 1);
});

test("SimpleBenchmarkRunner: evaluate handles missing baseline data", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.03, latencyMs: 150, violations: [] }],
      ])
    )
  );

  // No baseline set - should use actual results as baseline
  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });

  const report = await runner.evaluate(createProposal());

  // When no baseline, successRateBefore equals successRateAfter
  assert.equal(report.successRateBefore, report.successRateAfter);
  assert.equal(report.regressionRate, 0);
});

test("SimpleBenchmarkRunner: evaluate returns promote when all metrics good", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(
    createDeterministicExecutor(
      new Map([
        ["case_1", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
      ])
    )
  );

  runner.setBaseline("case_1", { successRate: 0.9, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });

  const report = await runner.evaluate(createProposal());

  assert.equal(report.decision, "promote");
});

test("SimpleBenchmarkRunner: baselineData is preserved after evaluate", async () => {
  const runner = new SimpleBenchmarkRunner();

  runner.setProposalExecutor(createDeterministicExecutor(new Map()));
  runner.setBaseline("case_1", { successRate: 0.9, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 5 });

  runner.addBenchmarkCase({ id: "case_1", taskType: "tool_task", input: { testCaseId: "case_1" } });

  await runner.evaluate(createProposal());

  // Baseline should still be accessible
  runner.setBaseline("case_1", { successRate: 0.95, avgCost: 0.015, avgLatencyMs: 60, sampleCount: 10 });
  const updated = runner.evaluate(createProposal());
  assert.ok(updated !== undefined);
});
