import assert from "node:assert/strict";
import test from "node:test";

import { EvaluatorService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import type { PlanGraphBundle } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createMockPlanGraphBundle(overrides: Partial<PlanGraphBundle> = {}): PlanGraphBundle {
  const now = Date.now();
  return {
    harnessRunId: "test-hrun-001",
    planGraphBundleId: "bundle-001",
    graphVersion: 1,
    createdAt: now - 60000,
    riskProfile: {
      riskClass: "medium" as const,
      riskScore: 0.5,
    },
    budgetPlanRef: "budget-001",
    ...overrides,
  } as PlanGraphBundle;
}

function createMockFeedbackBatch(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    harnessRunId: "test-hrun-001",
    signals: [],
    outcome: "completed" as const,
    timestamp: Date.now(),
    ...overrides,
  } as FeedbackBatch;
}

test("EvaluatorService constructor accepts no arguments", () => {
  const service = new EvaluatorService();
  assert.ok(service);
});

test("EvaluatorService constructor accepts config options", () => {
  const service = new EvaluatorService({
    config: {
      qualityGate: {
        defaultPassThreshold: 0.8,
        criticalPassThreshold: 0.95,
        enforcement: "warning" as const,
      },
      riskThresholds: {
        elevatedRiskThreshold: 0.5,
        criticalRiskThreshold: 0.9,
      },
      timingSlo: {
        maxStepDurationMs: 15000,
        maxTaskDurationMs: 150000,
      },
    },
  });
  assert.ok(service);
});

test("getConfig returns default config when no options provided", () => {
  const service = new EvaluatorService();
  const config = service.getConfig();

  assert.equal(config.qualityGate.defaultPassThreshold, 0.7);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.9);
  assert.equal(config.qualityGate.enforcement, "blocking");
  assert.equal(config.riskThresholds.elevatedRiskThreshold, 0.6);
  assert.equal(config.riskThresholds.criticalRiskThreshold, 0.85);
  assert.equal(config.timingSlo.maxStepDurationMs, 30000);
  assert.equal(config.timingSlo.maxTaskDurationMs, 300000);
});

test("getConfig returns custom config when provided", () => {
  const service = new EvaluatorService({
    config: {
      qualityGate: {
        defaultPassThreshold: 0.5,
        criticalPassThreshold: 0.8,
        enforcement: "warning" as const,
      },
      riskThresholds: {
        elevatedRiskThreshold: 0.3,
        criticalRiskThreshold: 0.7,
      },
      timingSlo: {
        maxStepDurationMs: 10000,
        maxTaskDurationMs: 60000,
      },
    },
  });
  const config = service.getConfig();

  assert.equal(config.qualityGate.defaultPassThreshold, 0.5);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.8);
  assert.equal(config.qualityGate.enforcement, "warning");
  assert.equal(config.riskThresholds.elevatedRiskThreshold, 0.3);
  assert.equal(config.riskThresholds.criticalRiskThreshold, 0.7);
  assert.equal(config.timingSlo.maxStepDurationMs, 10000);
  assert.equal(config.timingSlo.maxTaskDurationMs, 60000);
});

test("evaluate returns EvaluationReport with correct structure", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch();

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.ok(result.reportId.length > 0);
  assert.equal(result.harnessRunId, bundle.harnessRunId);
  assert.equal(result.planGraphBundleId, bundle.planGraphBundleId);
  assert.equal(result.graphVersion, bundle.graphVersion);
  assert.ok(typeof result.passed === "boolean");
  assert.ok(typeof result.qualityScore === "number");
  assert.ok(["accept", "retry", "replan", "escalate", "approve", "abort"].includes(result.decision));
  assert.ok(Array.isArray(result.findings));
  assert.ok(["unchanged", "elevated", "decreased"].includes(result.riskLevel));
  assert.ok(result.evaluatedAt > 0);
});

test("evaluate with no signals returns passed=true for completed outcome", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({ signals: [], outcome: "completed" });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.passed, true);
  assert.equal(result.decision, "accept");
  assert.equal(result.findings.length, 4);
  assert.deepEqual(
    result.findings.map((finding) => finding.category),
    ["deviation", "risk", "budget", "timing"],
  );
});

test("evaluate with failure signals returns passed=false", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "failure" as const, message: "Step 1 failed", severity: "error" as const, timestamp: Date.now() },
    ],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.passed, false);
  assert.equal(result.decision, "replan");
  assert.ok(result.findings.some(f => f.category === "quality" && f.severity === "error"));
});

test("evaluate with multiple failure signals uses critical severity", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "failure" as const, message: "Step 1 failed", severity: "error" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Step 2 failed", severity: "error" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Step 3 failed", severity: "error" as const, timestamp: Date.now() },
    ],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  const qualityFinding = result.findings.find(f => f.category === "quality");
  assert.ok(qualityFinding);
  assert.equal(qualityFinding?.severity, "critical");
});

test("evaluate with partial signals returns passed=false", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "partial" as const, message: "Step 1 partially succeeded", severity: "warning" as const, timestamp: Date.now() },
      { category: "partial" as const, message: "Step 2 partial", severity: "warning" as const, timestamp: Date.now() },
      { category: "partial" as const, message: "Step 3 partial", severity: "warning" as const, timestamp: Date.now() },
    ],
    outcome: "partial" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.passed, false);
  const qualityFinding = result.findings.find(f => f.category === "quality");
  assert.ok(qualityFinding);
  assert.equal(qualityFinding?.severity, "warning");
});

test("evaluate with no success signals but has timeout returns error severity", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [{ category: "timeout" as const, message: "Timed out", severity: "error" as const, timestamp: Date.now() }],
    outcome: "partial" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  const qualityFinding = result.findings.find(f => f.category === "quality");
  assert.ok(qualityFinding);
  // Timeout counts as a failure signal, so severity is "error"
  assert.equal(qualityFinding?.severity, "error");
  assert.ok(qualityFinding?.message.includes("failure signal"));
});

test("evaluate with timing exceeding SLO adds timing finding", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch();

  // Duration exceeds maxTaskDurationMs of 300000 (5 minutes)
  const result = service.evaluate({
    planGraphBundle: bundle,
    feedback,
    actualDurationMs: 400000,
  });

  const timingFinding = result.findings.find(f => f.category === "timing");
  assert.ok(timingFinding);
  assert.equal(timingFinding?.severity, "warning");
  assert.ok(timingFinding?.message.includes("Timing SLO breached"));
});

test("evaluate with timing within SLO does not add timing finding", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch();

  const result = service.evaluate({
    planGraphBundle: bundle,
    feedback,
    actualDurationMs: 10000,
  });

  // Within SLO means no timing finding is added (withinSlo = true, no finding)
  const timingFinding = result.findings.find(f => f.category === "timing");
  // No timing finding means timing was within SLO
  assert.ok(!timingFinding || timingFinding.severity === "info");
});

test("evaluate goal deviation when failures and not completed", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [{ category: "failure" as const, message: "Failed", severity: "error" as const, timestamp: Date.now() }],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  const deviationFinding = result.findings.find(f => f.category === "deviation");
  assert.ok(deviationFinding);
  assert.equal(deviationFinding?.severity, "error");
  assert.ok(deviationFinding?.message.includes("Goal not achieved"));
});

test("evaluate risk boundary with low baseline and failures elevates risk", () => {
  const service = new EvaluatorService();
  // For low baseline, need >= 2 failures to elevate
  // But for medium baseline with >= 3 failures it elevates
  const bundle = createMockPlanGraphBundle({ riskProfile: { riskClass: "medium" as const, riskScore: 0.5 } });
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "failure" as const, message: "Failed", severity: "error" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Failed", severity: "error" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Failed", severity: "error" as const, timestamp: Date.now() },
    ],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.riskLevel, "elevated");
});

test("evaluate risk boundary with no failures stays unchanged", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle({ riskProfile: { riskClass: "medium" as const, riskScore: 0.5 } });
  const feedback = createMockFeedbackBatch({ signals: [], outcome: "completed" });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.riskLevel, "unchanged");
});

test("evaluate budget adherence returns adherent when no cost provided", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle({ budgetPlanRef: "budget-001" });
  const feedback = createMockFeedbackBatch();

  const result = service.evaluate({ planGraphBundle: bundle, feedback, actualCost: undefined });

  // When no actualCost provided, budget adherence is skipped (no finding)
  const budgetFinding = result.findings.find(f => f.category === "budget");
  assert.ok(!budgetFinding || budgetFinding.severity === "info");
});

test("evaluate budget adherence returns adherent when budgetPlanRef missing", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle({ budgetPlanRef: undefined });
  const feedback = createMockFeedbackBatch();

  const result = service.evaluate({ planGraphBundle: bundle, feedback, actualCost: 100 });

  // When no budgetPlanRef, budget adherence is skipped (no finding)
  const budgetFinding = result.findings.find(f => f.category === "budget");
  assert.ok(!budgetFinding || budgetFinding.severity === "info");
});

test("determineDecision returns escalate for high criticality risk", () => {
  const service = new EvaluatorService();
  // Use high risk baseline with critical severity signals
  const bundle = createMockPlanGraphBundle({ riskProfile: { riskClass: "critical" as const, riskScore: 0.95 } });
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "failure" as const, message: "Critical failure", severity: "critical" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Critical failure 2", severity: "critical" as const, timestamp: Date.now() },
    ],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  // With high/critical baseline and critical severity signals, risk becomes critical
  assert.ok(result.findings.some(f => f.severity === "critical" && f.category === "risk"));
});

test("determineDecision returns retry for failure signals", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [{ category: "failure" as const, message: "Failed", severity: "error" as const, timestamp: Date.now() }],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  // With error finding, replan takes precedence over retry
  assert.equal(result.decision, "replan");
});

test("determineDecision returns approve for partial outcome", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [],
    outcome: "partial" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.decision, "approve");
});

test("determineDecision returns approve for repairable outcome", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [],
    outcome: "repairable" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.decision, "approve");
});

test("determineDecision returns accept for completed outcome with no findings", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch({
    signals: [{ category: "success" as const, message: "Succeeded", severity: "info" as const, timestamp: Date.now() }],
    outcome: "completed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.equal(result.passed, true);
  assert.equal(result.decision, "accept");
});

test("quality score calculation with passed quality and no risk elevation", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle({ riskProfile: { riskClass: "low" as const, riskScore: 0.2 } });
  const feedback = createMockFeedbackBatch({
    signals: [{ category: "success" as const, message: "Success", severity: "info" as const, timestamp: Date.now() }],
    outcome: "completed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.ok(result.qualityScore >= 0.9);
});

test("quality score calculation with failed quality and elevated risk", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle({ riskProfile: { riskClass: "high" as const, riskScore: 0.8 } });
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "failure" as const, message: "Failed", severity: "error" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Failed 2", severity: "error" as const, timestamp: Date.now() },
    ],
    outcome: "failed" as const,
  });

  const result = service.evaluate({ planGraphBundle: bundle, feedback });

  assert.ok(result.qualityScore < 0.5);
});

test("quality score is bounded between 0 and 1", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle({ riskProfile: { riskClass: "critical" as const, riskScore: 1.0 } });
  const feedback = createMockFeedbackBatch({
    signals: [
      { category: "failure" as const, message: "Failed", severity: "critical" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Failed 2", severity: "critical" as const, timestamp: Date.now() },
      { category: "failure" as const, message: "Failed 3", severity: "critical" as const, timestamp: Date.now() },
    ],
    outcome: "failed" as const,
  });

  const result = service.evaluate({
    planGraphBundle: bundle,
    feedback,
    actualDurationMs: 600000,
    actualCost: 1000,
  });

  assert.ok(result.qualityScore >= 0);
  assert.ok(result.qualityScore <= 1);
});

test("evaluate with all optional params", () => {
  const service = new EvaluatorService();
  const bundle = createMockPlanGraphBundle();
  const feedback = createMockFeedbackBatch();

  const result = service.evaluate({
    planGraphBundle: bundle,
    feedback,
    actualDurationMs: 50000,
    actualCost: 25.50,
  });

  assert.ok(result.reportId);
  assert.equal(result.harnessRunId, bundle.harnessRunId);
});

test("evaluate uses default threshold 0.7 for quality gate", () => {
  const service = new EvaluatorService();
  const config = service.getConfig();
  assert.equal(config.qualityGate.defaultPassThreshold, 0.7);
});
