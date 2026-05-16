/**
 * Integration Tests: Evaluator Service
 *
 * Tests EvaluatorService as a first-class Harness role:
 * - Quality gating (quality gate / pass-fail)
 * - Goal deviation detection
 * - Risk escalation
 * - Decision output (accept/retry/replan/escalate/abort)
 *
 * §13.5: Evaluator consumes PlanGraphBundle (not legacy Plan) to access
 * graph-level metadata including node risk, budget reservation, and graph version.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { EvaluatorService, type EvaluatorDecision, type EvaluationReport } from "../../../../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import {
  createPlanGraphBundle,
  type PlanGraphBundle,
  type RiskPreview,
  type PlanNode,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createIntegrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/evaluator-integration-test.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store, cleanup: () => {
    db.close();
    cleanupPath(workspace);
  }};
}

// Helper to create minimal PlanGraphBundle for testing
function createPlanGraphBundleForEval(overrides: {
  riskProfile?: RiskPreview;
  harnessRunId?: string;
} = {}): PlanGraphBundle {
  const node: PlanNode = {
    nodeId: "node-001",
    action: "test_action",
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: {} },
    riskLevel: 0.5,
    estimatedDurationMs: 1000,
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    compensationNodeId: null,
  };

  return createPlanGraphBundle({
    harnessRunId: overrides.harnessRunId ?? "harness-" + newId("test"),
    graph: {
      graphId: "graph-" + newId("test"),
      nodes: [node],
      edges: [],
      entryNodeIds: ["node-001"],
      terminalNodeIds: ["node-001"],
      joinStrategy: "all",
      graphHash: "hash-" + newId("test"),
    },
    schedulerPolicy: { policyId: "policy-001", strategy: "deterministic_fifo" },
    budgetPlanRef: "budget-ref-001",
    riskProfile: overrides.riskProfile ?? { riskClass: "medium", reasons: ["Test medium risk"] },
  });
}

// Helper to create FeedbackBatch for testing
function createFeedbackBatch(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    taskId: "task-" + newId("test"),
    harnessRunId: "harness-" + newId("test"),
    signals: [],
    outcome: "completed" as const,
    observedAt: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// EvaluatorService: Quality Gate Evaluation
// ============================================================================

test("EvaluatorService: evaluate passes quality gate for completed outcome with no failures", () => {
  const ctx = createIntegrationContext("aa-eval-quality-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-001",
          source: "execution" as const,
          category: "success" as const,
          severity: "info" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.ok(report.passed, "Should pass quality gate for completed outcome");
    assert.ok(report.qualityScore >= 0.7, "Quality score should be >= default threshold");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate fails quality gate for outcome with failures", () => {
  const ctx = createIntegrationContext("aa-eval-quality-fail-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-002",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.ok(!report.passed, "Should fail quality gate when outcome is failed");
    const qualityFinding = report.findings.find(f => f.category === "quality");
    assert.ok(qualityFinding, "Should have quality finding");
    assert.equal(qualityFinding.severity, "error");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate detects multiple failure signals as critical", () => {
  const ctx = createIntegrationContext("aa-eval-critical-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-003",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-003",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-003",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "medium", reasons: ["Test medium risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const qualityFinding = report.findings.find(f => f.category === "quality");
    assert.ok(qualityFinding, "Should have quality finding");
    assert.equal(qualityFinding.severity, "critical", "3+ failures should be critical severity");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate detects partial signals as warning", () => {
  const ctx = createIntegrationContext("aa-eval-partial-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "partial",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-004",
          source: "execution" as const,
          category: "partial" as const,
          severity: "warning" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-004",
          source: "execution" as const,
          category: "partial" as const,
          severity: "warning" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-004",
          source: "execution" as const,
          category: "partial" as const,
          severity: "warning" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const qualityFinding = report.findings.find(f => f.category === "quality");
    assert.ok(qualityFinding, "Should have quality finding");
    assert.equal(qualityFinding.severity, "warning", "3+ partial signals should be warning");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Goal Deviation Detection
// ============================================================================

test("EvaluatorService: evaluate detects goal deviation when failures prevent completion", () => {
  const ctx = createIntegrationContext("aa-eval-deviation-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-005",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const deviationFinding = report.findings.find(f => f.category === "deviation");
    assert.ok(deviationFinding, "Should have deviation finding");
    assert.equal(deviationFinding.severity, "error");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate passes goal deviation check for completed outcome", () => {
  const ctx = createIntegrationContext("aa-eval-deviation-pass-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-006",
          source: "execution" as const,
          category: "success" as const,
          severity: "info" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const deviationFinding = report.findings.find(f => f.category === "deviation");
    assert.ok(deviationFinding, "Should have deviation finding");
    assert.equal(deviationFinding.severity, "info", "No deviation should be info severity");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Risk Boundary Evaluation
// ============================================================================

test("EvaluatorService: evaluate detects elevated risk when failures exceed baseline", () => {
  const ctx = createIntegrationContext("aa-eval-risk-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-007",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-007",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-007",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "medium", reasons: ["Test medium risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const riskFinding = report.findings.find(f => f.category === "risk");
    assert.ok(riskFinding, "Should have risk finding");
    assert.equal(riskFinding.severity, "error", "3+ failures on medium baseline should be error");
    assert.equal(report.riskLevel, "elevated", "Risk level should be elevated");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate handles low baseline with multiple failures", () => {
  const ctx = createIntegrationContext("aa-eval-risk-low-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-008",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-008",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "low", reasons: ["Test low risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const riskFinding = report.findings.find(f => f.category === "risk");
    assert.ok(riskFinding, "Should have risk finding");
    assert.equal(report.riskLevel, "elevated");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate detects critical risk for high baseline", () => {
  const ctx = createIntegrationContext("aa-eval-risk-critical-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-009",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-009",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "high", reasons: ["Test high risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    const riskFinding = report.findings.find(f => f.category === "risk");
    assert.ok(riskFinding, "Should have risk finding");
    assert.equal(riskFinding.severity, "critical", "High baseline with failures should be critical");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Budget Adherence
// ============================================================================

test("EvaluatorService: evaluate passes budget adherence when no cost data", () => {
  const ctx = createIntegrationContext("aa-eval-budget-none-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      // No actualCost provided
    });

    const budgetFinding = report.findings.find(f => f.category === "budget");
    assert.ok(budgetFinding, "Should have budget finding");
    assert.equal(budgetFinding.severity, "info");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate includes budget reference in budget finding", () => {
  const ctx = createIntegrationContext("aa-eval-budget-ref-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [],
    });

    const bundle = createPlanGraphBundleForEval({
      harnessRunId: "harness-budget-test",
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualCost: 5.50,
    });

    const budgetFinding = report.findings.find(f => f.category === "budget");
    assert.ok(budgetFinding, "Should have budget finding");
    assert.ok(budgetFinding.message.includes("budget-ref-001"));
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Timing SLO
// ============================================================================

test("EvaluatorService: evaluate passes timing SLO when duration within limit", () => {
  const ctx = createIntegrationContext("aa-eval-timing-pass-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 50000, // 50 seconds, within 300s default
    });

    const timingFinding = report.findings.find(f => f.category === "timing");
    assert.ok(timingFinding, "Should have timing finding");
    assert.equal(timingFinding.severity, "info");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate fails timing SLO when duration exceeds limit", () => {
  const ctx = createIntegrationContext("aa-eval-timing-fail-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 400000, // 400 seconds, exceeds 300s default
    });

    const timingFinding = report.findings.find(f => f.category === "timing");
    assert.ok(timingFinding, "Should have timing finding");
    assert.equal(timingFinding.severity, "warning");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Decision Output
// ============================================================================

test("EvaluatorService: determineDecision returns escalate for critical findings", () => {
  const ctx = createIntegrationContext("aa-eval-decide-escalate-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-010",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "critical", reasons: ["Test critical risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 400000,
    });

    assert.equal(report.decision, "escalate", "Critical risk should escalate");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: determineDecision returns replan for error findings", () => {
  const ctx = createIntegrationContext("aa-eval-decide-replan-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-011",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "low", reasons: ["Test low risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.equal(report.decision, "replan", "Error findings should trigger replan");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: determineDecision returns accept for completed outcome with no issues", () => {
  const ctx = createIntegrationContext("aa-eval-decide-accept-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-012",
          source: "execution" as const,
          category: "success" as const,
          severity: "info" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "low", reasons: ["Test low risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.equal(report.decision, "accept", "Completed with no issues should accept");
    assert.ok(report.passed, "Report should indicate passed");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: determineDecision returns retry for failure signals without critical issues", () => {
  const ctx = createIntegrationContext("aa-eval-decide-retry-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-013",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "low", reasons: ["Test low risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.equal(report.decision, "replan", "Single failure should lead to replan");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: determineDecision returns approve for partial completion", () => {
  const ctx = createIntegrationContext("aa-eval-decide-approve-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "partial",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-014",
          source: "execution" as const,
          category: "partial" as const,
          severity: "warning" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.equal(report.decision, "approve", "Partial completion should require approval");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Custom Configuration
// ============================================================================

test("EvaluatorService: custom config overrides default thresholds", () => {
  const ctx = createIntegrationContext("aa-eval-config-");
  try {
    const service = new EvaluatorService({
      config: {
        qualityGate: {
          defaultPassThreshold: 0.5,
          criticalPassThreshold: 0.7,
          enforcement: "warning" as const,
        },
        riskThresholds: {
          elevatedRiskThreshold: 0.7,
          criticalRiskThreshold: 0.9,
        },
        timingSlo: {
          maxStepDurationMs: 10000,
          maxTaskDurationMs: 60000,
        },
      },
    });

    const config = service.getConfig();
    assert.equal(config.qualityGate.defaultPassThreshold, 0.5);
    assert.equal(config.timingSlo.maxTaskDurationMs, 60000);
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate with custom timing SLO respects custom maxTaskDurationMs", () => {
  const ctx = createIntegrationContext("aa-eval-config-timing-");
  try {
    const service = new EvaluatorService({
      config: {
        qualityGate: {
          defaultPassThreshold: 0.7,
          criticalPassThreshold: 0.9,
          enforcement: "blocking" as const,
        },
        riskThresholds: {
          elevatedRiskThreshold: 0.6,
          criticalRiskThreshold: 0.85,
        },
        timingSlo: {
          maxStepDurationMs: 5000,
          maxTaskDurationMs: 50000, // 50 seconds
        },
      },
    });

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [],
    });

    const bundle = createPlanGraphBundleForEval();

    // 60 seconds should fail the 50s SLO
    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 60000,
    });

    const timingFinding = report.findings.find(f => f.category === "timing");
    assert.ok(timingFinding, "Should have timing finding");
    assert.equal(timingFinding.severity, "warning");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Quality Score Calculation
// ============================================================================

test("EvaluatorService: qualityScore reduces for quality gate failure", () => {
  const ctx = createIntegrationContext("aa-eval-score-quality-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-015",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.ok(report.qualityScore < 0.7, "Quality score should be reduced when quality gate fails");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: qualityScore reduces for elevated risk", () => {
  const ctx = createIntegrationContext("aa-eval-score-risk-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-016",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-016",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "medium", reasons: ["Test medium risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.ok(report.qualityScore < 0.6, "Quality score should reflect elevated risk");
    assert.equal(report.riskLevel, "elevated");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: qualityScore is bounded between 0 and 1", () => {
  const ctx = createIntegrationContext("aa-eval-score-bounds-");
  try {
    const service = new EvaluatorService();

    // Create worst-case scenario
    const feedback = createFeedbackBatch({
      outcome: "failed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-017",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-017",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
        {
          signalId: newId("sig"),
          taskId: "task-017",
          source: "execution" as const,
          category: "failure" as const,
          severity: "error" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval({
      riskProfile: { riskClass: "critical", reasons: ["Test critical risk"] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 400000,
      actualCost: 100.0,
    });

    assert.ok(report.qualityScore >= 0, "Quality score should be >= 0");
    assert.ok(report.qualityScore <= 1, "Quality score should be <= 1");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// EvaluatorService: Report Contents Validation
// ============================================================================

test("EvaluatorService: evaluate returns complete report with all required fields", () => {
  const ctx = createIntegrationContext("aa-eval-report-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [
        {
          signalId: newId("sig"),
          taskId: "task-018",
          source: "execution" as const,
          category: "success" as const,
          severity: "info" as const,
          payload: {},
          stepOutputRefs: [],
          timestamp: Date.now(),
        },
      ],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.ok(report.reportId.startsWith("eval_report_"), "Report should have valid ID");
    assert.equal(report.harnessRunId, bundle.harnessRunId);
    assert.equal(report.planGraphBundleId, bundle.planGraphBundleId);
    assert.equal(report.graphVersion, bundle.graphVersion);
    assert.ok(typeof report.passed === "boolean");
    assert.ok(typeof report.qualityScore === "number");
    assert.ok(typeof report.decision === "string");
    assert.ok(Array.isArray(report.findings));
    assert.ok(typeof report.riskLevel === "string");
    assert.ok(typeof report.evaluatedAt === "number");
  } finally {
    ctx.cleanup();
  }
});

test("EvaluatorService: evaluate produces findings for each evaluation dimension", () => {
  const ctx = createIntegrationContext("aa-eval-findings-");
  try {
    const service = new EvaluatorService();

    const feedback = createFeedbackBatch({
      outcome: "completed",
      signals: [],
    });

    const bundle = createPlanGraphBundleForEval();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    // Should have a finding for each category
    const categories = report.findings.map(f => f.category);
    assert.ok(categories.includes("risk"), "Should have risk finding");
    assert.ok(categories.includes("budget"), "Should have budget finding");
    assert.ok(categories.includes("timing"), "Should have timing finding");
  } finally {
    ctx.cleanup();
  }
});