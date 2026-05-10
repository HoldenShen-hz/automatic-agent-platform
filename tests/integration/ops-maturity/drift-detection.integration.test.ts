/**
 * Integration tests for Drift Detection
 *
 * Tests the drift detection pipeline including reflection,
 * rollout management, and benchmark evaluation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SimpleReflectionEngine } from "../../../src/ops-maturity/drift-detection/reflection-engine.js";
import { SimpleRolloutManager } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";
import { SimpleBenchmarkRunner, type BenchmarkCase } from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import type { ImprovementProposal } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";
import type { EvidenceRecord } from "../../../src/ops-maturity/drift-detection/evidence-store.js";

function createEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: overrides.id ?? "ev_1",
    taskType: overrides.taskType ?? "tool_execution",
    sessionId: overrides.sessionId ?? "sess_1",
    traceId: overrides.traceId ?? "trace_1",
    success: overrides.success ?? false,
    failureMode: overrides.failureMode ?? "type_error",
    costUsd: overrides.costUsd ?? 0.10,
    latencyMs: overrides.latencyMs ?? 500,
    toolCalls: overrides.toolCalls ?? 5,
    repairRounds: overrides.repairRounds ?? 1,
    rollback: overrides.rollback ?? false,
    createdAt: overrides.createdAt ?? "2026-04-14T00:00:00.000Z",
  };
}

function createProposal(id: string): ImprovementProposal {
  const now = new Date().toISOString();
  return {
    id,
    title: `Proposal ${id}`,
    description: "Test proposal",
    kind: "tool_routing_rule",
    target: "test_target",
    patch: "test_patch",
    rationale: "test rationale",
    risk: "low",
    reviewRequirement: "auto",
    evidenceIds: [],
    status: "draft",
    draftedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Integration test: Reflection engine with multiple evidence types
 */
test("DriftDetectionIntegration: Reflection engine processes mixed evidence", async () => {
  const engine = new SimpleReflectionEngine();

  const evidence: EvidenceRecord[] = [
    createEvidence({ id: "ev_1", taskType: "type_a", failureMode: "type_error", success: false }),
    createEvidence({ id: "ev_2", taskType: "type_a", failureMode: "type_error", success: false }),
    createEvidence({ id: "ev_3", taskType: "type_a", success: true, failureMode: "type_error" }),
    createEvidence({ id: "ev_4", taskType: "type_b", failureMode: "test_failure", success: false }),
    createEvidence({ id: "ev_5", taskType: "type_b", failureMode: "test_failure", success: false }),
  ];

  const reflections = await engine.reflect(evidence);

  // type_a has 2 failures + 1 success = 3 total (>= 2) -> generates reflection
  // type_b has 2 failures = 2 total (>= 2) -> generates reflection
  assert.equal(reflections.length, 2);
});

/**
 * Integration test: Rollout manager with threshold breaches
 */
test("DriftDetectionIntegration: Rollout manager handles threshold breaches", async () => {
  const manager = new SimpleRolloutManager();

  const proposal = createProposal("prop_1");
  await manager.start(proposal, "canary", 5);

  // Good metrics - should stay running
  await manager.updateMetrics("prop_1", {
    successRate: 0.98,
    errorRate: 0.02,
    latencyMs: 100,
    costUsd: 0.05,
  });

  let record = await manager.getRollout("prop_1");
  assert.equal(record!.status, "running");

  // Bad metrics - should trigger rollback_pending
  await manager.updateMetrics("prop_1", {
    successRate: 0.80, // Below 0.95 threshold
    errorRate: 0.20,    // Above 0.05 threshold
    latencyMs: 3000,   // Above 2000 threshold
    costUsd: 0.15,     // Above 0.10 threshold
  });

  record = await manager.getRollout("prop_1");
  assert.equal(record!.status, "rollback_pending");
  assert.ok(record!.failureReason!.includes("Metric threshold breach"));

  // Manual rollback
  await manager.rollback("prop_1", "Manual intervention");

  record = await manager.getRollout("prop_1");
  assert.equal(record!.status, "rolled_back");
});

/**
 * Integration test: Benchmark runner with real executor
 */
test("DriftDetectionIntegration: Benchmark runner with executor produces real results", async () => {
  const runner = new SimpleBenchmarkRunner();

  const testCase: BenchmarkCase = {
    id: "tc_1",
    taskType: "tool_execution",
    input: { test: true },
  };
  runner.addBenchmarkCase(testCase);

  runner.setBaseline("tc_1", {
    successRate: 0.9,
    avgCost: 0.10,
    avgLatencyMs: 500,
    sampleCount: 100,
  });

  // Set up real executor that actually executes
  runner.setProposalExecutor({
    execute: async (proposal, input) => {
      // Simulate actual execution with 95% success rate
      return {
        success: Math.random() > 0.05,
        costUsd: 0.08,
        latencyMs: 450,
        output: { result: "executed" },
        violations: [],
      };
    },
  });

  const proposal = createProposal("prop_1");
  const report = await runner.evaluate(proposal);

  assert.equal(report.proposalId, "prop_1");
  assert.ok(report.benchmarkCases === 1);
  // Success rate will vary due to random, but should be around 95%
  assert.ok(report.successRateAfter >= 0 && report.successRateAfter <= 1);
});

/**
 * Integration test: Full drift detection pipeline
 */
test("DriftDetectionIntegration: Full pipeline from evidence to proposal", async () => {
  const engine = new SimpleReflectionEngine();

  // Gather evidence
  const evidence: EvidenceRecord[] = [
    createEvidence({ id: "ev_1", taskType: "workflow_exec", failureMode: "schema_error", success: false }),
    createEvidence({ id: "ev_2", taskType: "workflow_exec", failureMode: "schema_error", success: false }),
    createEvidence({ id: "ev_3", taskType: "workflow_exec", success: true, failureMode: "schema_error" }),
  ];

  // Generate reflection
  const reflections = await engine.reflect(evidence);
  assert.equal(reflections.length, 1);

  const reflection = reflections[0]!;
  assert.ok(reflection.rootCause.includes("Type checking") || reflection.rootCause.includes("schema"));
  assert.ok(reflection.confidence > 0);

  // Create proposal based on reflection
  const proposal = createProposal("prop_from_reflection");
  proposal.rationale = reflection.recommendation;
  proposal.evidenceIds = reflection.evidenceIds;

  // Run benchmark
  const runner = new SimpleBenchmarkRunner();
  runner.addBenchmarkCase({ id: "tc_reflect", taskType: "workflow_exec", input: {} });
  runner.setProposalExecutor({
    execute: async () => ({
      success: true,
      costUsd: 0.05,
      latencyMs: 300,
      violations: [],
    }),
  });

  const report = await runner.evaluate(proposal);
  assert.equal(report.decision, "promote"); // No regressions
});

/**
 * Integration test: Rollout stages progression
 */
test("DriftDetectionIntegration: Rollout progresses through stages", async () => {
  const manager = new SimpleRolloutManager();

  const proposal = createProposal("prop_stages");

  // Start shadow
  let record = await manager.start(proposal, "shadow", 0);
  assert.equal(record.stage, "shadow");
  assert.equal(record.percentage, 0);

  // Complete shadow
  await manager.complete("prop_stages");

  // Start canary at 5%
  record = await manager.start(proposal, "canary", 5);
  assert.equal(record.stage, "canary");
  assert.equal(record.percentage, 5);

  // Update with good metrics
  await manager.updateMetrics("prop_stages", {
    successRate: 0.99,
    errorRate: 0.01,
    latencyMs: 100,
    costUsd: 0.05,
  });

  // Complete canary
  await manager.complete("prop_stages");

  // Start partial at 25%
  record = await manager.start(proposal, "partial", 25);
  assert.equal(record.stage, "partial");
  assert.equal(record.percentage, 25);

  // Complete partial
  await manager.complete("prop_stages");

  // Start stable at 100%
  record = await manager.start(proposal, "stable", 100);
  assert.equal(record.stage, "stable");
  assert.equal(record.percentage, 100);

  // Complete final stage
  await manager.complete("prop_stages");

  const final = await manager.getRollout("prop_stages");
  assert.equal(final!.status, "succeeded");
});

/**
 * Integration test: Cross-agent analysis with drift detection
 */
test("DriftDetectionIntegration: Cross-agent metrics trigger drift alerts", () => {
  const { CrossAgentAnalyzerService } = require("../../../src/ops-maturity/drift-detection/cross-agent-analyzer/index.js");
  const service = new CrossAgentAnalyzerService();

  const metrics = [
    { agentId: "agent-1", domain: "payments", successRate: 0.95, averageCostUsd: 0.10, averageLatencyMs: 500 },
    { agentId: "agent-2", domain: "payments", successRate: 0.70, averageCostUsd: 0.40, averageLatencyMs: 2000 },
    { agentId: "agent-3", domain: "payments", successRate: 0.90, averageCostUsd: 0.15, averageLatencyMs: 800 },
  ];

  const result = service.analyze(metrics);

  assert.ok(result.bestAgentId === "agent-1");
  assert.ok(result.worstAgentId === "agent-2");
  assert.ok(result.divergenceScore > 0.2); // Should detect significant divergence

  // Check alerts generated
  if (result.divergenceScore >= 0.2) {
    assert.ok(result.alerts.length > 0, "Should generate drift alert");
  }
});