/**
 * Integration Test: Evaluator Service
 *
 * Tests EvaluatorService quality gating, goal deviation detection,
 * risk escalation, and decision output (accept/retry/replan/escalate/abort)
 * with real SQLite context and PlanGraphBundle.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EvaluatorService, type EvaluatorDecision } from "../../../../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import type { PlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeFeedbackBatch(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    batchId: newId("feedback_batch"),
    taskId: "task-eval-001",
    runId: "run-eval-001",
    signals: [],
    outcome: "completed",
    startedAt: Date.now() - 60000,
    completedAt: Date.now(),
    ...overrides,
  };
}

function makePlanGraphBundle(overrides: Partial<PlanGraphBundle> = {}): PlanGraphBundle {
  return {
    harnessRunId: "harness-001",
    planGraphBundleId: newId("bundle"),
    graphVersion: 1,
    rootNodeId: "node-root",
    nodes: [],
    edges: [],
    riskProfile: {
      riskClass: "medium" as const,
      riskScore: 0.5,
      factors: [],
    },
    budgetPlanRef: "budget-001",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// EvaluatorService basic evaluation tests
// ---------------------------------------------------------------------------

test("evaluator: evaluate returns accept for successful feedback", () => {
  const ctx = createSeededIntegrationContext("aa-eval-basic-", {
    taskId: "task-eval-001",
    executionId: "exec-eval-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "completed",
      signals: [
        { signalId: "sig-1", category: "success", message: "Task completed", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle({
      riskProfile: { riskClass: "low", riskScore: 0.3, factors: [] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 5000,
      actualCost: 0.01,
    });

    assert.equal(report.decision, "accept");
    assert.equal(report.passed, true);
    assert.ok(report.qualityScore >= 0.7);
  } finally {
    ctx.cleanup();
  }
});

test("evaluator: evaluate returns retry for failure signals", () => {
  const ctx = createSeededIntegrationContext("aa-eval-retry-", {
    taskId: "task-eval-retry-001",
    executionId: "exec-eval-retry-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "repairable",
      signals: [
        { signalId: "sig-1", category: "failure", message: "Step 2 failed", createdAt: Date.now() },
        { signalId: "sig-2", category: "failure", message: "Step 3 failed", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    assert.equal(report.decision, "retry");
    assert.ok(report.findings.some((f) => f.category === "quality"));
  } finally {
    ctx.cleanup();
  }
});

test("evaluator: evaluate returns replan for error findings", () => {
  const ctx = createSeededIntegrationContext("aa-eval-replan-", {
    taskId: "task-eval-replan-001",
    executionId: "exec-eval-replan-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "repairable",
      signals: [
        { signalId: "sig-1", category: "failure", message: "Error occurred", createdAt: Date.now() },
        { signalId: "sig-2", category: "failure", message: "Another error", createdAt: Date.now() },
        { signalId: "sig-3", category: "failure", message: "Third error", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle({
      riskProfile: { riskClass: "medium", riskScore: 0.5, factors: [] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    // Multiple errors should trigger replan decision
    assert.ok(
      report.decision === "replan" || report.decision === "escalate",
      `Expected replan or escalate, got ${report.decision}`,
    );
  } finally {
    ctx.cleanup();
  }
});

test("evaluator: evaluate returns escalate for critical severity", () => {
  const ctx = createSeededIntegrationContext("aa-eval-escalate-", {
    taskId: "task-eval-escalate-001",
    executionId: "exec-eval-escalate-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "repairable",
      signals: Array(3).fill(null).map((_, i) => ({
        signalId: `sig-${i}`,
        category: "failure" as const,
        message: `Critical failure ${i}`,
        createdAt: Date.now(),
      })),
    });

    const bundle = makePlanGraphBundle({
      riskProfile: { riskClass: "critical", riskScore: 0.9, factors: [] },
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
    });

    // With critical baseline and multiple failures, should escalate
    assert.ok(
      report.decision === "escalate" || report.decision === "abort",
      `Expected escalate or abort, got ${report.decision}`,
    );
    assert.ok(
      report.findings.some((f) => f.severity === "critical" || f.severity === "error"),
    );
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Quality gate threshold tests
// ---------------------------------------------------------------------------

test("evaluator: quality gate passes with default threshold", () => {
  const ctx = createSeededIntegrationContext("aa-eval-quality-", {
    taskId: "task-eval-quality-001",
    executionId: "exec-eval-quality-001",
  });

  try {
    const service = new EvaluatorService({
      config: {
        qualityGate: {
          defaultPassThreshold: 0.7,
          criticalPassThreshold: 0.9,
          enforcement: "blocking",
        },
        riskThresholds: {
          elevatedRiskThreshold: 0.6,
          criticalRiskThreshold: 0.85,
        },
        timingSlo: {
          maxStepDurationMs: 30000,
          maxTaskDurationMs: 300000,
        },
      },
    });

    const feedback = makeFeedbackBatch({
      outcome: "completed",
      signals: [
        { signalId: "sig-1", category: "success", message: "Step 1 done", createdAt: Date.now() },
        { signalId: "sig-2", category: "success", message: "Step 2 done", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle();

    const report = service.evaluate({ planGraphBundle: bundle, feedback });

    assert.ok(report.passed, "Should pass with successful outcome");
    assert.ok(report.qualityScore >= 0.7, "Quality score should meet threshold");
  } finally {
    ctx.cleanup();
  }
});

test("evaluator: quality gate fails with partial signals", () => {
  const ctx = createSeededIntegrationContext("aa-eval-partial-", {
    taskId: "task-eval-partial-001",
    executionId: "exec-eval-partial-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "partial",
      signals: [
        { signalId: "sig-1", category: "partial", message: "Step 1 partial", createdAt: Date.now() },
        { signalId: "sig-2", category: "partial", message: "Step 2 partial", createdAt: Date.now() },
        { signalId: "sig-3", category: "partial", message: "Step 3 partial", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle();

    const report = service.evaluate({ planGraphBundle: bundle, feedback });

    assert.ok(!report.passed, "Should fail with >2 partial signals");
    assert.ok(report.findings.some((f) => f.category === "quality"), "Should have quality finding");
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Risk boundary evaluation tests
// ---------------------------------------------------------------------------

test("evaluator: risk boundary elevated on failures against baseline", () => {
  const ctx = createSeededIntegrationContext("aa-eval-risk-", {
    taskId: "task-eval-risk-001",
    executionId: "exec-eval-risk-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "repairable",
      signals: [
        { signalId: "sig-1", category: "failure", message: "Failed", createdAt: Date.now() },
        { signalId: "sig-2", category: "failure", message: "Failed again", createdAt: Date.now() },
      ],
    });

    // Low baseline with 2 failures should elevate risk
    const bundle = makePlanGraphBundle({
      riskProfile: { riskClass: "low", riskScore: 0.2, factors: [] },
    });

    const report = service.evaluate({ planGraphBundle: bundle, feedback });

    const riskFinding = report.findings.find((f) => f.category === "risk");
    assert.ok(riskFinding, "Should have risk finding");
    assert.ok(
      riskFinding!.severity === "warning" || riskFinding!.severity === "error",
      `Risk should be elevated, got ${riskFinding!.severity}`,
    );
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Timing SLO evaluation tests
// ---------------------------------------------------------------------------

test("evaluator: timing SLO within bounds passes", () => {
  const ctx = createSeededIntegrationContext("aa-eval-timing-", {
    taskId: "task-eval-timing-001",
    executionId: "exec-eval-timing-001",
  });

  try {
    const service = new EvaluatorService({
      config: {
        qualityGate: { defaultPassThreshold: 0.7, criticalPassThreshold: 0.9, enforcement: "blocking" },
        riskThresholds: { elevatedRiskThreshold: 0.6, criticalRiskThreshold: 0.85 },
        timingSlo: { maxStepDurationMs: 30000, maxTaskDurationMs: 300000 },
      },
    });

    const feedback = makeFeedbackBatch({ outcome: "completed", signals: [] });
    const bundle = makePlanGraphBundle();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 5000, // Well within 300000ms max
    });

    const timingFinding = report.findings.find((f) => f.category === "timing");
    assert.ok(timingFinding, "Should have timing finding");
    assert.equal(timingFinding!.severity, "info");
  } finally {
    ctx.cleanup();
  }
});

test("evaluator: timing SLO breached triggers warning", () => {
  const ctx = createSeededIntegrationContext("aa-eval-timing-breach-", {
    taskId: "task-eval-timing-breach-001",
    executionId: "exec-eval-timing-breach-001",
  });

  try {
    const service = new EvaluatorService({
      config: {
        qualityGate: { defaultPassThreshold: 0.7, criticalPassThreshold: 0.9, enforcement: "blocking" },
        riskThresholds: { elevatedRiskThreshold: 0.6, criticalRiskThreshold: 0.85 },
        timingSlo: { maxStepDurationMs: 30000, maxTaskDurationMs: 300000 },
      },
    });

    const feedback = makeFeedbackBatch({ outcome: "completed", signals: [] });
    const bundle = makePlanGraphBundle();

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualDurationMs: 400000, // Exceeds 300000ms max
    });

    const timingFinding = report.findings.find((f) => f.category === "timing");
    assert.ok(timingFinding, "Should have timing finding");
    assert.equal(timingFinding!.severity, "warning");
    assert.ok(timingFinding!.message.includes("Timing SLO breached"));
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Budget adherence tests
// ---------------------------------------------------------------------------

test("evaluator: budget adherence tracked with actual cost", () => {
  const ctx = createSeededIntegrationContext("aa-eval-budget-", {
    taskId: "task-eval-budget-001",
    executionId: "exec-eval-budget-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({ outcome: "completed", signals: [] });
    const bundle = makePlanGraphBundle({
      budgetPlanRef: "budget-exec-001",
    });

    const report = service.evaluate({
      planGraphBundle: bundle,
      feedback,
      actualCost: 0.05,
    });

    const budgetFinding = report.findings.find((f) => f.category === "budget");
    assert.ok(budgetFinding, "Should have budget finding");
    assert.ok(budgetFinding!.message.includes("0.05"));
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Goal deviation tests
// ---------------------------------------------------------------------------

test("evaluator: goal deviation detected on failure against expectation", () => {
  const ctx = createSeededIntegrationContext("aa-eval-deviation-", {
    taskId: "task-eval-deviation-001",
    executionId: "exec-eval-deviation-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "repairable",
      signals: [
        { signalId: "sig-1", category: "failure", message: "Goal not achieved", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle();

    const report = service.evaluate({ planGraphBundle: bundle, feedback });

    const deviationFinding = report.findings.find((f) => f.category === "deviation");
    assert.ok(deviationFinding, "Should have deviation finding");
    assert.equal(deviationFinding!.severity, "error");
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Approve decision tests
// ---------------------------------------------------------------------------

test("evaluator: approve decision for partial completion", () => {
  const ctx = createSeededIntegrationContext("aa-eval-approve-", {
    taskId: "task-eval-approve-001",
    executionId: "exec-eval-approve-001",
  });

  try {
    const service = new EvaluatorService();

    const feedback = makeFeedbackBatch({
      outcome: "partial",
      signals: [
        { signalId: "sig-1", category: "partial", message: "Partial success", createdAt: Date.now() },
      ],
    });

    const bundle = makePlanGraphBundle();

    const report = service.evaluate({ planGraphBundle: bundle, feedback });

    assert.equal(report.decision, "approve", "Partial completion should require approval");
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Configuration tests
// ---------------------------------------------------------------------------

test("evaluator: getConfig returns configured values", () => {
  const ctx = createSeededIntegrationContext("aa-eval-config-", {
    taskId: "task-eval-config-001",
    executionId: "exec-eval-config-001",
  });

  try {
    const customConfig = {
      qualityGate: {
        defaultPassThreshold: 0.8,
        criticalPassThreshold: 0.95,
        enforcement: "warning" as const,
      },
      riskThresholds: {
        elevatedRiskThreshold: 0.7,
        criticalRiskThreshold: 0.9,
      },
      timingSlo: {
        maxStepDurationMs: 60000,
        maxTaskDurationMs: 600000,
      },
    };

    const service = new EvaluatorService({ config: customConfig });
    const config = service.getConfig();

    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
    assert.equal(config.riskThresholds.elevatedRiskThreshold, 0.7);
    assert.equal(config.timingSlo.maxTaskDurationMs, 600000);
  } finally {
    ctx.cleanup();
  }
});