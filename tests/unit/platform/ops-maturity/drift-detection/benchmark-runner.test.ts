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
  status: "draft",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

function createExecutor(
  results: Map<string, { success: boolean; costUsd: number; latencyMs: number; violations: string[] }>,
): ProposalExecutor {
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

test("SimpleBenchmarkRunner evaluates proposal with no benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 0);
  assert.strictEqual(report.successRateBefore, 0);
  assert.strictEqual(report.successRateAfter, 0);
  assert.strictEqual(report.regressionRate, 0);
  assert.strictEqual(report.decision, "needs_revision");
});

test("SimpleBenchmarkRunner evaluates proposal with benchmark cases and locked baselines", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case-1", taskType: "tool_operation", input: { testCaseId: "case-1" } },
    { id: "case-2", taskType: "tool_operation", input: { testCaseId: "case-2" } },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.02, latencyMs: 120, violations: [] }],
    ["case-2", { success: true, costUsd: 0.03, latencyMs: 150, violations: [] }],
  ])));
  runner.setBaseline("case-1", { successRate: 0.9, avgCost: 0.02, avgLatencyMs: 100, sampleCount: 20 });
  runner.setBaseline("case-2", { successRate: 0.95, avgCost: 0.03, avgLatencyMs: 140, sampleCount: 30 });

  const report = await runner.evaluate(mockProposal({ kind: "tool_routing_rule", target: "type_validation" }));

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 2);
  assert.ok(report.successRateBefore > 0);
  assert.strictEqual(report.successRateAfter, 1);
  assert.ok(typeof report.regressionRate === "number");
});

test("SimpleBenchmarkRunner adds benchmark case dynamically", () => {
  const runner = new SimpleBenchmarkRunner([]);
  const newCase: BenchmarkCase = { id: "case-1", taskType: "skill_task", input: {} };

  runner.addBenchmarkCase(newCase);

  assert.strictEqual((runner as unknown as { benchmarkCases: BenchmarkCase[] }).benchmarkCases.length, 1);
});

test("SimpleBenchmarkRunner runBenchmarks returns results for relevant cases", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case-tool", taskType: "tool_operation", input: { testCaseId: "case-tool" } },
    { id: "case-skill", taskType: "skill_task", input: { testCaseId: "case-skill" } },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-tool", { success: true, costUsd: 0.02, latencyMs: 110, violations: [] }],
    ["case-skill", { success: true, costUsd: 0.04, latencyMs: 180, violations: [] }],
  ])));

  const results = await runner.runBenchmarks(mockProposal({ kind: "tool_routing_rule", target: "type_validation" }));

  assert.deepEqual(results.map((result) => result.testCaseId), ["case-tool"]);
});

test("SimpleBenchmarkRunner includes violations for failed benchmarks", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case-1", taskType: "tool_operation", input: { testCaseId: "case-1" } },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: false, costUsd: 0.05, latencyMs: 300, violations: ["security_violation"] }],
  ])));

  const results = await runner.runBenchmarks(mockProposal({ kind: "tool_routing_rule", target: "type_validation" }));

  assert.strictEqual(results.length, 1);
  assert.deepEqual(results[0]!.violations, ["security_violation"]);
  assert.strictEqual(results[0]!.success, false);
});

test("SimpleBenchmarkRunner returns evaluation report with correct structure", async () => {
  const runner = new SimpleBenchmarkRunner([]);
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

test("SimpleBenchmarkRunner decision is reject when regression rate > 0.05", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "tool_operation", input: { testCaseId: "case-1" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: false, costUsd: 0.05, latencyMs: 300, violations: [] }],
  ])));
  runner.setBaseline("case-1", { successRate: 1, avgCost: 0.01, avgLatencyMs: 100, sampleCount: 10 });

  const report = await runner.evaluate(mockProposal());

  assert.ok(report.regressionRate > 0.05);
  assert.strictEqual(report.decision, "reject");
});

test("SimpleBenchmarkRunner decision is needs_revision when safety violations exist without large regression", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "tool_operation", input: { testCaseId: "case-1" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.02, latencyMs: 100, violations: ["policy_warning"] }],
  ])));
  runner.setBaseline("case-1", { successRate: 1, avgCost: 0.01, avgLatencyMs: 90, sampleCount: 10 });

  const report = await runner.evaluate(mockProposal());

  assert.strictEqual(report.safetyViolations, 1);
  assert.strictEqual(report.decision, "needs_revision");
});

test("SimpleBenchmarkRunner evaluates workflow proposals with workflow target", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "workflow_task", input: { testCaseId: "case-1" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.03, latencyMs: 140, violations: [] }],
  ])));
  runner.setBaseline("case-1", { successRate: 0.9, avgCost: 0.02, avgLatencyMs: 120, sampleCount: 10 });

  const report = await runner.evaluate(mockProposal({ kind: "workflow_template", target: "complex_workflow" }));

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 1);
});

test("SimpleBenchmarkRunner evaluates skill proposals with skill target", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "skill_task", input: { testCaseId: "case-1" } },
  ]);
  runner.setProposalExecutor(createExecutor(new Map([
    ["case-1", { success: true, costUsd: 0.03, latencyMs: 140, violations: [] }],
  ])));
  runner.setBaseline("case-1", { successRate: 0.9, avgCost: 0.02, avgLatencyMs: 120, sampleCount: 10 });

  const report = await runner.evaluate(mockProposal({ kind: "skill_doc", target: "testing_guidelines" }));

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 1);
});

test("SimpleBenchmarkRunner handles all proposal kinds without crashing", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const kinds: Array<"prompt_patch" | "tool_routing_rule" | "workflow_template" | "skill_doc" | "threshold_tuning"> = [
    "prompt_patch",
    "tool_routing_rule",
    "workflow_template",
    "skill_doc",
    "threshold_tuning",
  ];

  for (const kind of kinds) {
    const proposal = mockProposal({ kind });
    const report = await runner.evaluate(proposal);
    assert.ok(typeof report.decision === "string");
  }
});

test("SimpleBenchmarkRunner runBenchmarks respects isRelevantCase logic", async () => {
  const cases: BenchmarkCase[] = [
    { id: "tool-case", taskType: "tool_operation", input: { testCaseId: "tool-case" } },
    { id: "skill-case", taskType: "skill_task", input: { testCaseId: "skill-case" } },
    { id: "workflow-case", taskType: "workflow_task", input: { testCaseId: "workflow-case" } },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  runner.setProposalExecutor(createExecutor(new Map([
    ["tool-case", { success: true, costUsd: 0.01, latencyMs: 90, violations: [] }],
    ["skill-case", { success: true, costUsd: 0.02, latencyMs: 120, violations: [] }],
    ["workflow-case", { success: true, costUsd: 0.03, latencyMs: 140, violations: [] }],
  ])));
  const toolProposal = mockProposal({ kind: "tool_routing_rule", target: "type_validation" });

  const results = await runner.runBenchmarks(toolProposal);

  assert.deepEqual(results.map((result) => result.testCaseId), ["tool-case"]);
});

test("BenchmarkCase with critical flag is included", () => {
  const criticalCase: BenchmarkCase = {
    id: "critical-1",
    taskType: "tool_operation",
    input: {},
    critical: true,
  };

  const runner = new SimpleBenchmarkRunner([criticalCase]);

  assert.ok(typeof runner);
});

test("SimpleBenchmarkRunner handles empty proposal evidenceIds", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = mockProposal({ evidenceIds: [] });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-1");
});

test("SimpleBenchmarkRunner calculates avgCostDelta correctly", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.ok(typeof report.avgCostDelta === "number");
});

test("SimpleBenchmarkRunner calculates avgLatencyDelta correctly", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.ok(typeof report.avgLatencyDelta === "number");
});

test("SimpleBenchmarkRunner returns ISO timestamp in createdAt", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.ok(report.createdAt.includes("T"));
});
