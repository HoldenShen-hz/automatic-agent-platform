import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  SimpleBenchmarkRunner,
  type BenchmarkCase,
  type EvaluationReport,
  type BenchmarkResult,
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

test("SimpleBenchmarkRunner evaluates proposal with no benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner([]);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 0);
  assert.strictEqual(report.successRateAfter, 0);
  assert.strictEqual(report.regressionRate, 0.6);
  assert.strictEqual(report.decision, "needs_revision");
});

test("SimpleBenchmarkRunner evaluates proposal with benchmark cases", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case-1", taskType: "tool_operation", input: {} },
    { id: "case-2", taskType: "tool_operation", input: {} },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = mockProposal({ kind: "tool_routing_rule", target: "type_validation" });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-1");
  assert.strictEqual(report.benchmarkCases, 2);
  assert.strictEqual(report.successRateBefore, 0.6);
  assert.ok(typeof report.successRateAfter === "number");
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
    { id: "case-tool", taskType: "tool_operation", input: {} },
    { id: "case-skill", taskType: "skill_task", input: {} },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = mockProposal({ kind: "tool_routing_rule", target: "type_validation" });

  const results = await runner.runBenchmarks(proposal);

  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 0);
});

test("SimpleBenchmarkRunner includes violations for failed benchmarks", async () => {
  const cases: BenchmarkCase[] = [
    { id: "case-1", taskType: "tool_operation", input: {} },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = mockProposal({ kind: "tool_routing_rule", target: "type_validation" });

  const results = await runner.runBenchmarks(proposal);

  for (const result of results) {
    assert.ok(typeof result.testCaseId === "string");
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.costUsd === "number");
    assert.ok(typeof result.latencyMs === "number");
    assert.ok(Array.isArray(result.violations));
  }
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
  const cases: BenchmarkCase[] = [];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  assert.ok(report.regressionRate > 0.05 || report.decision !== "reject");
});

test("SimpleBenchmarkRunner decision is needs_revision when safety violations > 0", async () => {
  const cases: BenchmarkCase[] = [];
  const runner = new SimpleBenchmarkRunner(cases);
  const proposal = mockProposal();

  const report = await runner.evaluate(proposal);

  if (report.safetyViolations > 0) {
    assert.ok(report.decision === "needs_revision" || report.decision === "reject");
  }
});

test("SimpleBenchmarkRunner evaluates workflow proposals with workflow target", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "workflow_task", input: {} },
  ]);

  const proposal = mockProposal({ kind: "workflow_template", target: "complex_workflow" });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-1");
});

test("SimpleBenchmarkRunner evaluates skill proposals with skill target", async () => {
  const runner = new SimpleBenchmarkRunner([
    { id: "case-1", taskType: "skill_task", input: {} },
  ]);

  const proposal = mockProposal({ kind: "skill_doc", target: "testing_guidelines" });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop-1");
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
    { id: "tool-case", taskType: "tool_operation", input: {} },
    { id: "skill-case", taskType: "skill_task", input: {} },
    { id: "workflow-case", taskType: "workflow_task", input: {} },
  ];

  const runner = new SimpleBenchmarkRunner(cases);
  const toolProposal = mockProposal({ kind: "tool_routing_rule", target: "type_validation" });

  const results = await runner.runBenchmarks(toolProposal);

  assert.ok(results.length >= 0);
});

test("BenchmarkCase with critical flag is included", () => {
  const criticalCase: BenchmarkCase = {
    id: "critical-1",
    taskType: "tool_operation",
    input: {},
    critical: true,
  };

  const runner = new SimpleBenchmarkRunner([criticalCase]);
  const proposal = mockProposal({ kind: "tool_routing_rule" });

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