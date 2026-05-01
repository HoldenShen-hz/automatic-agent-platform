/**
 * Golden Test: Evaluator Service Output Structure
 *
 * Verifies evaluator service produces consistent EvaluationReport output
 * for quality gating, goal deviation detection, and risk escalation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { EvaluatorService } from "../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import { createPlanGraphBundle } from "../../src/platform/contracts/executable-contracts/index.js";
import type { FeedbackBatch, FeedbackSignal } from "../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

function createTestPlanGraphBundle() {
  return createPlanGraphBundle({
    harnessRunId: "hrn_test_001",
    planGraphBundleId: "pgb_test_001",
    graph: {
      graphId: "graph_test_001",
      nodes: [
        {
          nodeId: "node_001",
          nodeType: "llm",
          inputRefs: [],
          outputSchemaRef: "schema:test.output",
          riskClass: "medium",
          budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:test.default",
          timeoutMs: 30000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_001"],
      terminalNodeIds: ["node_001"],
      joinStrategy: "all",
      graphHash: "hash_test_001",
    },
    schedulerPolicy: { policyId: "scheduler:test.default", strategy: "deterministic_fifo" },
    budgetPlanRef: "bdl_test_001",
    riskProfile: { riskClass: "medium", reasons: ["test_risk"] },
    graphVersion: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
  });
}

function createTestFeedbackBatch(outcome: "completed" | "partial" | "failed" = "completed"): FeedbackBatch {
  // Create minimal feedback signals matching FeedbackSignal schema
  const isSuccess = outcome === "completed";
  const category: "success" | "failure" | "partial" = isSuccess ? "success" : outcome === "partial" ? "partial" : "failure";
  const severity: "info" | "error" = isSuccess ? "info" : "error";

  const signal = {
    signalId: isSuccess ? "sig_001" : "sig_002",
    taskId: "task_001",
    source: "execution",
    category,
    severity,
    payload: {},
    stepOutputRefs: [],
    timestamp: 1234567890,
    trustScore: {
      overallScore: 0.9,
      sourceReliability: 0.9,
      historicalAccuracy: 0.9,
      adversarialRisk: "low" as FeedbackSignal["trustScore"]["adversarialRisk"],
      passedSanityCheck: true,
    },
    evidenceRefs: [],
  };

  return {
    feedbackId: "fb_001",
    taskId: "task_001",
    executionId: null,
    planId: null,
    outcome,
    signals: [signal as FeedbackSignal],
    emittedAt: 1234567890,
  };
}

test("golden: evaluator evaluate produces EvaluationReport with expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-evaluator-");

  const service = new EvaluatorService();
  const planGraphBundle = createTestPlanGraphBundle();
  const feedback = createTestFeedbackBatch("completed");

  const report = service.evaluate({ planGraphBundle, feedback });

  // Verify top-level structure
  assert.ok(report, "Report should exist");
  assert.ok(report.reportId, "Should have reportId");
  assert.ok(report.harnessRunId === "hrn_test_001", "HarnessRunId should match");
  assert.ok(report.planGraphBundleId === "pgb_test_001", "PlanGraphBundleId should match");
  assert.ok(typeof report.graphVersion === "number", "GraphVersion should be number");
  assert.ok(typeof report.passed === "boolean", "Passed should be boolean");
  assert.ok(typeof report.qualityScore === "number", "QualityScore should be number");
  assert.ok(["accept", "retry", "replan", "escalate", "approve", "abort"].includes(report.decision), "Decision should be valid");
  assert.ok(Array.isArray(report.findings), "Findings should be array");
  assert.ok(["unchanged", "elevated", "decreased"].includes(report.riskLevel), "RiskLevel should be valid");
  assert.ok(typeof report.evaluatedAt === "number", "EvaluatedAt should be number");

  assertGolden("evaluator-report-structure", {
    reportIdPrefix: report.reportId.split("_")[0],
    harnessRunId: report.harnessRunId,
    planGraphBundleId: report.planGraphBundleId,
    graphVersion: report.graphVersion,
    passed: report.passed,
    qualityScore: report.qualityScore,
    decision: report.decision,
    findingCount: report.findings.length,
    riskLevel: report.riskLevel,
    hasFindings: report.findings.length > 0,
  });

  cleanupPath(workspace);
});

test("golden: evaluator evaluate with failed feedback produces retry/escalate decision", () => {
  const workspace = createTempWorkspace("aa-golden-evaluator-failure-");

  const service = new EvaluatorService();
  const planGraphBundle = createTestPlanGraphBundle();
  const feedback = createTestFeedbackBatch("failed");

  const report = service.evaluate({ planGraphBundle, feedback });

  // Verify decision logic for failures
  assert.ok(report, "Report should exist");
  assert.ok(report.passed === false, "Should not pass with failed feedback");
  assert.ok(["retry", "replan", "escalate"].includes(report.decision), "Decision should be retry/replan/escalate for failures");

  assertGolden("evaluator-failure-decision", {
    passed: report.passed,
    decision: report.decision,
    qualityScore: report.qualityScore,
    findingCount: report.findings.length,
  });

  cleanupPath(workspace);
});

test("golden: evaluator evaluate with partial feedback produces approve decision", () => {
  const workspace = createTempWorkspace("aa-golden-evaluator-partial-");

  const service = new EvaluatorService();
  const planGraphBundle = createTestPlanGraphBundle();
  const feedback = createTestFeedbackBatch("partial");

  const report = service.evaluate({ planGraphBundle, feedback });

  // Verify decision logic for partial completion
  assert.ok(report, "Report should exist");
  assert.ok(report.decision === "approve", "Partial outcome should result in approve decision");

  assertGolden("evaluator-partial-decision", {
    passed: report.passed,
    decision: report.decision,
    qualityScore: report.qualityScore,
    findingCount: report.findings.length,
  });

  cleanupPath(workspace);
});

test("golden: evaluator evaluate with timing SLO breach produces warning", () => {
  const workspace = createTempWorkspace("aa-golden-evaluator-timing-");

  const service = new EvaluatorService();
  const planGraphBundle = createTestPlanGraphBundle();
  const feedback = createTestFeedbackBatch("completed");

  // Exceed max task duration (300000ms default)
  const report = service.evaluate({
    planGraphBundle,
    feedback,
    actualDurationMs: 400000, // Exceeds 300000ms SLO
  });

  // Verify timing SLO finding
  const timingFindings = report.findings.filter((f) => f.category === "timing");
  assert.ok(timingFindings.length > 0, "Should have timing finding for SLO breach");

  assertGolden("evaluator-timing-slo-breach", {
    passed: report.passed,
    decision: report.decision,
    findingCategories: report.findings.map((f) => f.category),
    hasTimingFinding: timingFindings.length > 0,
  });

  cleanupPath(workspace);
});

test("golden: evaluator getConfig returns default config", () => {
  const service = new EvaluatorService();
  const config = service.getConfig();

  assert.ok(config, "Config should exist");
  assert.ok(config.qualityGate, "Should have qualityGate");
  assert.ok(typeof config.qualityGate.defaultPassThreshold === "number", "defaultPassThreshold should be number");
  assert.ok(typeof config.qualityGate.criticalPassThreshold === "number", "criticalPassThreshold should be number");
  assert.ok(["blocking", "warning"].includes(config.qualityGate.enforcement), "enforcement should be valid");
  assert.ok(config.riskThresholds, "Should have riskThresholds");
  assert.ok(config.timingSlo, "Should have timingSlo");

  assertGolden("evaluator-default-config", {
    defaultPassThreshold: config.qualityGate.defaultPassThreshold,
    criticalPassThreshold: config.qualityGate.criticalPassThreshold,
    enforcement: config.qualityGate.enforcement,
    elevatedRiskThreshold: config.riskThresholds.elevatedRiskThreshold,
    criticalRiskThreshold: config.riskThresholds.criticalRiskThreshold,
    maxStepDurationMs: config.timingSlo.maxStepDurationMs,
    maxTaskDurationMs: config.timingSlo.maxTaskDurationMs,
  });
});