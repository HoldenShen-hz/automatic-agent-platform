import test from "node:test";
import { strict as assert } from "node:assert/strict";

import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
  type ProposalExecutor,
} from "../../../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { ImprovementProposal } from "../../../../../src/ops-maturity/drift-detection/proposal-engine.js";

const mockProposal = (overrides: Partial<ImprovementProposal> = {}): ImprovementProposal => ({
  id: "prop-1",
  title: "Test Proposal",
  description: "A test proposal",
  kind: "tool_routing_rule",
  target: "type_validation",
  patch: "{}",
  rationale: "Testing",
  risk: "low",
  evidenceIds: ["evidence-1"],
  status: "proposed",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

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

test("SimpleBenchmarkRunner evaluates proposal with no benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setProposalExecutor(createExecutor(new Map()));

  const report = await runner.evaluate(mockProposal());

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 0);
  assert.strictEqual(report.successRateBefore, 0);
  assert.strictEqual(report.successRateAfter, 0);
  assert.strictEqual(report.regressionRate, 0);
  assert.strictEqual(report.decision, "promote");
});

test("SimpleBenchmarkRunner evaluates proposal with benchmark cases", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case-1", taskType: "tool_operation", input: { testCaseId: "case-1" } },
    { id: "case-2", taskType: "tool_operation", input: { testCaseId: "case-2" } },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.01, latencyMs: 50, violations: [] }],
    ["case-2", { success: false, costUsd: 0.03, latencyMs: 150, violations: ["validation_failed"] }],
  ])));
  runner.setBaseline("case-1", { successRate: 1, avgCost: 0.01, avgLatencyMs: 50, sampleCount: 10 });
  runner.setBaseline("case-2", { successRate: 1, avgCost: 0.02, avgLatencyMs: 100, sampleCount: 10 });

  const report = await runner.evaluate(mockProposal({ kind: "tool_routing_rule", target: "type_validation" }));

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 2);
  assert.strictEqual(report.successRateBefore, 1);
  assert.strictEqual(report.successRateAfter, 0.5);
  assert.ok(report.regressionRate > 0.05);
  assert.strictEqual(report.decision, "reject");
});

test("SimpleBenchmarkRunner adds benchmark case dynamically", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setProposalExecutor(createExecutor(new Map()));
  const newCase: BenchmarkCase = { id: "case-1", taskType: "skill_task", input: { testCaseId: "case-1" } };

  runner.addBenchmarkCase(newCase);

  const results = await runner.runBenchmarks(mockProposal({ kind: "skill_doc", target: "testing_guidelines" }));
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0]?.testCaseId, "case-1");
});

test("SimpleBenchmarkRunner runBenchmarks requires ProposalExecutor when cases exist", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "tool_operation", input: { testCaseId: "case-1" } },
  ]);

  await assert.rejects(
    () => runner.runBenchmarks(mockProposal()),
    /ProposalExecutor required/,
  );
});

test("SimpleBenchmarkRunner returns evaluation report with correct structure", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  runner.setProposalExecutor(createExecutor(new Map()));
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.ok(typeof report.proposalId === "string");
  assert.ok(typeof report.benchmarkCases === "number");
  assert.ok(typeof report.successRateBefore === "number");
  assert.ok(typeof report.successRateAfter === "number");
  assert.ok(typeof report.regressionRate === "number");
  assert.ok(typeof report.avgCostDelta === "number");
  assert.ok(typeof report.avgLatencyDelta === "number");
  assert.ok(typeof report.safetyViolations === "number");
  assert.ok(typeof report.decision === "string");
  assert.ok(typeof report.createdAt === "string");
});
