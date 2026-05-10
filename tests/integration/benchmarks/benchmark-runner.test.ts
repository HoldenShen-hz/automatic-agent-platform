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
  const now = new Date().toISOString();
  return {
    id: "prop_integration_1",
    title: "Integration Test Proposal",
    description: "An integration test improvement proposal",
    kind: "tool_routing_rule",
    target: "type_validation",
    patch: '{"rules": []}',
    rationale: "Integration testing",
    risk: "low",
    reviewRequirement: "auto",
    evidenceIds: ["evidence_1", "evidence_2"],
    status: "draft",
    createdAt: now,
    updatedAt: now,
    draftedAt: now,
    ...overrides,
  };
}

test("SimpleBenchmarkRunner end-to-end: evaluate a complete proposal lifecycle", async () => {
  const runner = new SimpleBenchmarkRunner();

  // Add multiple benchmark cases
  const cases: BenchmarkCase[] = [
    { id: "e2e_case_1", taskType: "tool_use", input: { operation: "validate" }, critical: true },
    { id: "e2e_case_2", taskType: "tool_validation", input: { schema: "strict" } },
    { id: "e2e_case_3", taskType: "tool_routing", input: { priority: "high" } },
  ];

  for (const c of cases) {
    runner.addBenchmarkCase(c);
  }

  const proposal = createMockProposal({ id: "prop_e2e_1", kind: "tool_routing_rule" });

  // Run evaluation
  const report = await runner.evaluate(proposal);

  // Verify complete report structure
  assert.strictEqual(report.proposalId, "prop_e2e_1");
  assert.strictEqual(report.benchmarkCases, 3);
  assert.ok(report.successRateBefore >= 0 && report.successRateBefore <= 1);
  assert.ok(report.successRateAfter >= 0 && report.successRateAfter <= 1);
  assert.ok(report.regressionRate >= 0);
  assert.ok(typeof report.decision === "string");
  assert.ok(report.createdAt);
});

test("SimpleBenchmarkRunner end-to-end: workflow proposal evaluation", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "wf_case_1", taskType: "workflow_planning", input: { steps: 5 } },
    { id: "wf_case_2", taskType: "workflow_execution", input: { timeout: 30000 } },
  ];

  for (const c of cases) {
    runner.addBenchmarkCase(c);
  }

  const proposal = createMockProposal({
    id: "prop_wf_1",
    kind: "workflow_template",
    target: "complex_task_template",
    risk: "medium",
  });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop_wf_1");
  assert.strictEqual(report.benchmarkCases, 2);
  assert.ok(typeof report.decision === "string");
});

test("SimpleBenchmarkRunner end-to-end: skill proposal evaluation", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "skill_case_1", taskType: "skill_discovery", input: { domain: "testing" } },
    { id: "skill_case_2", taskType: "skill_execution", input: { retry: true } },
    { id: "skill_case_3", taskType: "skill_composition", input: { parallel: false } },
  ];

  for (const c of cases) {
    runner.addBenchmarkCase(c);
  }

  const proposal = createMockProposal({
    id: "prop_skill_1",
    kind: "skill_doc",
    target: "testing_guidelines",
    risk: "low",
  });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop_skill_1");
  assert.ok(report.avgLatencyDelta !== undefined);
});

test("SimpleBenchmarkRunner end-to-end: multiple proposals in sequence", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "seq_case_1", taskType: "tool_use", input: {} },
  ];
  const firstCase = cases[0];
  if (firstCase) runner.addBenchmarkCase(firstCase);

  const proposal1 = createMockProposal({ id: "prop_seq_1" });
  const proposal2 = createMockProposal({ id: "prop_seq_2", kind: "workflow_template" });
  const proposal3 = createMockProposal({ id: "prop_seq_3", kind: "prompt_patch" });

  const report1 = await runner.evaluate(proposal1);
  const report2 = await runner.evaluate(proposal2);
  const report3 = await runner.evaluate(proposal3);

  assert.strictEqual(report1.proposalId, "prop_seq_1");
  assert.strictEqual(report2.proposalId, "prop_seq_2");
  assert.strictEqual(report3.proposalId, "prop_seq_3");
  // Verify all reports have valid createdAt timestamps
  assert.ok(report1.createdAt);
  assert.ok(report2.createdAt);
  assert.ok(report3.createdAt);
});

test("SimpleBenchmarkRunner end-to-end: runBenchmarks returns consistent results structure", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "struct_1", taskType: "tool_use", input: { test: true } },
    { id: "struct_2", taskType: "tool_validation", input: { strict: false } },
  ];
  for (const c of cases) {
    runner.addBenchmarkCase(c);
  }

  const proposal = createMockProposal();
  const results = await runner.runBenchmarks(proposal);

  for (const result of results) {
    assert.ok(typeof result.testCaseId === "string");
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.costUsd === "number");
    assert.ok(typeof result.latencyMs === "number");
    assert.ok(Array.isArray(result.violations));
  }
});

test("SimpleBenchmarkRunner end-to-end: critical cases are included in evaluation", async () => {
  const runner = new SimpleBenchmarkRunner();

  const criticalCase: BenchmarkCase = {
    id: "critical_case",
    taskType: "tool_use",
    input: {},
    critical: true,
  };
  runner.addBenchmarkCase(criticalCase);

  const proposal = createMockProposal();
  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.benchmarkCases, 1);
});

test("SimpleBenchmarkRunner end-to-end: evaluate with expected benefit in proposal", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "benefit_case", taskType: "tool_use", input: {} },
  ];
  const firstCase = cases[0];
  if (firstCase) runner.addBenchmarkCase(firstCase);

  const proposal = createMockProposal({
    id: "prop_benefit_1",
    expectedBenefit: {
      quality: 0.15,
      latency: -0.10,
      cost: 0.05,
      stability: 0.20,
    },
  });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop_benefit_1");
  assert.ok(typeof report.avgCostDelta === "number");
});

test("SimpleBenchmarkRunner end-to-end: large number of benchmark cases", async () => {
  const runner = new SimpleBenchmarkRunner();

  // Add 50 benchmark cases
  for (let i = 0; i < 50; i++) {
    runner.addBenchmarkCase({
      id: `bulk_case_${i}`,
      taskType: "tool_use",
      input: { index: i },
    });
  }

  const proposal = createMockProposal({ id: "prop_bulk_1" });
  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.benchmarkCases, 50);
});

test("SimpleBenchmarkRunner end-to-end: proposal with high risk is evaluated", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "high_risk_case", taskType: "tool_use", input: {} },
  ];
  const firstCase = cases[0];
  if (firstCase) runner.addBenchmarkCase(firstCase);

  const proposal = createMockProposal({
    id: "prop_high_risk",
    risk: "high",
    kind: "prompt_patch",
    target: "security_guidelines",
  });

  const report = await runner.evaluate(proposal);

  assert.strictEqual(report.proposalId, "prop_high_risk");
  assert.ok(typeof report.decision === "string");
});

test("SimpleBenchmarkRunner end-to-end: verify latency and cost calculations", async () => {
  const runner = new SimpleBenchmarkRunner();

  const cases: BenchmarkCase[] = [
    { id: "calc_case_1", taskType: "tool_use", input: {} },
    { id: "calc_case_2", taskType: "tool_validation", input: {} },
  ];
  for (const c of cases) {
    runner.addBenchmarkCase(c);
  }

  const proposal = createMockProposal();
  const results = await runner.runBenchmarks(proposal);

  // Each result should have realistic cost and latency values
  for (const result of results) {
    assert.ok(result.costUsd >= 0);
    assert.ok(result.latencyMs >= 0);
  }

  // Verify report calculations
  const report = await runner.evaluate(proposal);
  assert.ok(typeof report.avgCostDelta === "number");
  assert.ok(typeof report.avgLatencyDelta === "number");
});
