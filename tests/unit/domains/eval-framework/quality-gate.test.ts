import assert from "node:assert/strict";
import test from "node:test";

import { PostExecutionQualityGate } from "../../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";
import { ExecutionOutcomeEvaluator } from "../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import { QualityGateEvidenceService } from "../../../../src/platform/prompt-engine/eval/quality-gate-evidence-service.js";
import type { ExecutionOutcomeEvaluation } from "../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import type { PostExecutionQualityGateDecision } from "../../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";
import type { QualityGateConfig, QualityEvaluationEvidence } from "../../../../src/platform/prompt-engine/eval/types.js";

// ── Mock Artifact Store ────────────────────────────────────────────────────────

function createMockArtifactStore() {
  const artifacts: Array<{ input: unknown; result: unknown }> = [];

  return {
    writeTextArtifact(input: unknown) {
      const record = {
        artifactId: "artifact_test_123",
        taskId: (input as { taskId: string }).taskId,
        executionId: (input as { executionId?: string | null }).executionId ?? null,
        stepId: null,
        kind: (input as { kind: string }).kind,
        storagePath: `/fake/path/${(input as { taskId: string }).taskId}/artifact_test_123/${(input as { fileName: string }).fileName}`,
        fileName: (input as { fileName: string }).fileName,
        mimeType: (input as { mimeType?: string }).mimeType ?? "text/plain",
        sizeBytes: Buffer.byteLength((input as { content: string }).content, "utf8"),
        checksum: "fake_checksum",
        lineageJson: "{}",
        createdAt: new Date().toISOString(),
      };
      artifacts.push({ input, result: { record, ref: { artifactId: record.artifactId, kind: record.kind, uri: record.storagePath, mimeType: record.mimeType, sizeBytes: record.sizeBytes, checksum: record.checksum, createdAt: record.createdAt } } });
      return { record, ref: { artifactId: record.artifactId, kind: record.kind, uri: record.storagePath, mimeType: record.mimeType, sizeBytes: record.sizeBytes, checksum: record.checksum, createdAt: record.createdAt } };
    },
    artifacts,
  };
}

// ── PostExecutionQualityGate Tests ────────────────────────────────────────────

test("PostExecutionQualityGate.decide returns released for complete+passed", () => {
  const gate = new PostExecutionQualityGate();

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: true,
    qualityScore: 0.8,
    nextAction: "complete",
    reasons: ["success:task_completed"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 1, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, true);
  assert.equal(decision.releaseStage, "released");
  assert.ok(decision.reasonCodes.includes("quality.accepted"));
});

test("PostExecutionQualityGate.decide returns approval for approve action", () => {
  const gate = new PostExecutionQualityGate();

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_2",
    taskId: "task_2",
    passed: false,
    qualityScore: 0.35,
    nextAction: "approve",
    reasons: ["quality:approval_required"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 1, partialSignals: 0, completionBonus: 0, failurePenalty: 0.3, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "approval");
  assert.ok(decision.reasonCodes.includes("quality.approval_required"));
});

test("PostExecutionQualityGate.decide returns repair for retry action", () => {
  const gate = new PostExecutionQualityGate();

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_3",
    taskId: "task_3",
    passed: false,
    qualityScore: 0.25,
    nextAction: "retry",
    reasons: ["failure:timeout"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 2, partialSignals: 0, completionBonus: 0, failurePenalty: 0.6, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
  assert.ok(decision.reasonCodes.includes("quality.repair_required"));
});

test("PostExecutionQualityGate.decide returns repair for replan action", () => {
  const gate = new PostExecutionQualityGate();

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_4",
    taskId: "task_4",
    passed: false,
    qualityScore: 0.2,
    nextAction: "replan",
    reasons: ["failure:repairable"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 1, partialSignals: 1, completionBonus: 0, failurePenalty: 0.3, partialPenalty: 0.1 },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
});

test("PostExecutionQualityGate.decide returns blocked for default case", () => {
  const gate = new PostExecutionQualityGate();

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_5",
    taskId: "task_5",
    passed: false,
    qualityScore: 0.1,
    nextAction: "escalate",
    reasons: ["failure:escalated"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 3, partialSignals: 0, completionBonus: 0, failurePenalty: 0.9, partialPenalty: 0 },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "blocked");
  assert.ok(decision.reasonCodes.includes("quality.blocked"));
});

// ── ExecutionOutcomeEvaluator Tests ───────────────────────────────────────────

function createMockFeedback(outcome: "completed" | "repairable" | "failed", signals: Array<{ category: string; payload: { reasonCode?: string; summary?: string } }>) {
  return { outcome, signals };
}

function createMockPlan(taskId: string): { taskId: string; steps?: unknown[] } {
  return { taskId };
}

test("ExecutionOutcomeEvaluator.evaluate returns pass for completed high score", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const plan = createMockPlan("task_pass");
  const feedback = createMockFeedback("completed", [
    { category: "success", payload: { summary: "step completed" } },
    { category: "success", payload: { summary: "task done" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.passed, true);
  assert.ok(result.qualityScore >= 0.5);
  assert.equal(result.nextAction, "complete");
  assert.equal(result.taskId, "task_pass");
});

test("ExecutionOutcomeEvaluator.evaluate returns fail for low score completed", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const plan = createMockPlan("task_low");
  const feedback = createMockFeedback("completed", [
    { category: "failure", payload: { reasonCode: "error" } },
    { category: "failure", payload: { reasonCode: "error" } },
    { category: "failure", payload: { reasonCode: "error" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.passed, false);
  assert.ok(result.qualityScore < 0.5);
});

test("ExecutionOutcomeEvaluator.evaluate suggests replan for repairable outcome", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const plan = createMockPlan("task_repair");
  const feedback = createMockFeedback("repairable", [
    { category: "failure", payload: { reasonCode: "retryable_error" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.nextAction, "replan");
});

test("ExecutionOutcomeEvaluator.evaluate suggests retry for few failures", () => {
  const evaluator = new ExecutionOutcomeEvaluator({ config: { qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" as const }, qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 }, actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 }, evidence: { enabled: false, artifactKind: "test", retentionDays: 30 } });

  const plan = createMockPlan("task_retry");
  const feedback = createMockFeedback("failed", [
    { category: "failure", payload: { reasonCode: "error_1" } },
    { category: "failure", payload: { reasonCode: "error_2" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.nextAction, "retry");
});

test("ExecutionOutcomeEvaluator.evaluate suggests escalate for many failures", () => {
  const evaluator = new ExecutionOutcomeEvaluator({ config: { qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" as const }, qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 }, actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 }, evidence: { enabled: false, artifactKind: "test", retentionDays: 30 } });

  const plan = createMockPlan("task_escalate");
  const feedback = createMockFeedback("failed", [
    { category: "failure", payload: { reasonCode: "e1" } },
    { category: "failure", payload: { reasonCode: "e2" } },
    { category: "failure", payload: { reasonCode: "e3" } },
    { category: "failure", payload: { reasonCode: "e4" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.nextAction, "escalate");
});

test("ExecutionOutcomeEvaluator.evaluate suggests approve for low quality score", () => {
  const evaluator = new ExecutionOutcomeEvaluator({ config: { qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" as const }, qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 }, actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 }, evidence: { enabled: false, artifactKind: "test", retentionDays: 30 } });

  const plan = createMockPlan("task_approve");
  const feedback = createMockFeedback("failed", [
    { category: "failure", payload: { reasonCode: "error" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  // After retry check, since failureSignals=1 < retryMaxFailures=3, and qualityScore below approvalRequiredScore
  assert.ok(result.nextAction === "approve" || result.nextAction === "escalate");
});

test("ExecutionOutcomeEvaluator.evaluate includes approval signal for approval reason", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const plan = createMockPlan("task_approval_signal");
  const feedback = createMockFeedback("failed", [
    { category: "failure", payload: { reasonCode: "approval_required" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.nextAction, "approve");
});

test("ExecutionOutcomeEvaluator.evaluate computes factor breakdown correctly", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const plan = createMockPlan("task_factors");
  const feedback = createMockFeedback("completed", [
    { category: "success", payload: { summary: "s1" } },
    { category: "success", payload: { summary: "s2" } },
    { category: "partial", payload: { summary: "p1" } },
    { category: "failure", payload: { reasonCode: "f1" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.equal(result.factorBreakdown.successSignals, 2);
  assert.equal(result.factorBreakdown.failureSignals, 1);
  assert.equal(result.factorBreakdown.partialSignals, 1);
  assert.ok(result.factorBreakdown.completionBonus > 0);
  assert.ok(result.factorBreakdown.failurePenalty > 0);
  assert.ok(result.factorBreakdown.partialPenalty > 0);
});

test("ExecutionOutcomeEvaluator.evaluate uses custom config", () => {
  const customConfig: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.6,
      criticalPassThreshold: 0.9,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.5,
      completionOutcome: 0.3,
      failureSignal: 0.4,
      partialSignal: 0.2,
    },
    actionThresholds: {
      completeMinScore: 0.7,
      approvalRequiredScore: 0.4,
      retryMaxFailures: 2,
    },
    evidence: {
      enabled: false,
      artifactKind: "custom",
      retentionDays: 60,
    },
  };

  const evaluator = new ExecutionOutcomeEvaluator({ config: customConfig });

  const plan = createMockPlan("task_custom");
  const feedback = createMockFeedback("completed", [
    { category: "success", payload: { summary: "ok" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.ok(result.evaluationId.startsWith("outcome_eval_"));
  assert.equal(result.taskId, "task_custom");
});

test("ExecutionOutcomeEvaluator.evaluate clamps quality score between 0 and 1", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  // Many failures to push score negative
  const plan = createMockPlan("task_clamps");
  const feedback = createMockFeedback("failed", [
    { category: "failure", payload: { reasonCode: "e1" } },
    { category: "failure", payload: { reasonCode: "e2" } },
    { category: "failure", payload: { reasonCode: "e3" } },
    { category: "failure", payload: { reasonCode: "e4" } },
    { category: "failure", payload: { reasonCode: "e5" } },
    { category: "failure", payload: { reasonCode: "e6" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.ok(result.qualityScore >= 0);
  assert.ok(result.qualityScore <= 1);
});

test("ExecutionOutcomeEvaluator.evaluate collects reason codes from signals", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const plan = createMockPlan("task_reasons");
  const feedback = createMockFeedback("completed", [
    { category: "success", payload: { summary: "great" } },
    { category: "failure", payload: { reasonCode: "ERR_TIMEOUT" } },
  ]);

  const result = evaluator.evaluate(plan as never, feedback as never);

  assert.ok(result.reasons.some(r => r.includes("failure")));
  assert.ok(result.reasons.some(r => r.includes("ERR_TIMEOUT")));
});

// ── QualityGateEvidenceService Tests ─────────────────────────────────────────

test("QualityGateEvidenceService.persistEvaluation returns empty when disabled", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: false, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_1",
    taskId: "task_ev_1",
    passed: true,
    qualityScore: 0.85,
    nextAction: "complete",
    reasons: ["quality.accepted"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 1, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: true,
    releaseStage: "released",
    reasonCodes: ["quality.accepted"],
  };

  const artifactId = service.persistEvaluation(evaluation, decision);

  assert.equal(artifactId, "");
  assert.equal(store.artifacts.length, 0);
});

test("QualityGateEvidenceService.persistEvaluation writes artifact when enabled", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_2",
    taskId: "task_ev_2",
    passed: true,
    qualityScore: 0.85,
    nextAction: "complete",
    reasons: ["quality.accepted"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 1, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: true,
    releaseStage: "released",
    reasonCodes: ["quality.accepted"],
  };

  const artifactId = service.persistEvaluation(evaluation, decision);

  assert.ok(artifactId.length > 0);
  assert.equal(store.artifacts.length, 1);
  assert.ok(store.artifacts[0].input.content.includes("qualityScore"));
});

test("QualityGateEvidenceService.persistEvaluation computes fail verdict when blocked", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_3",
    taskId: "task_ev_3",
    passed: false,
    qualityScore: 0.2,
    nextAction: "retry",
    reasons: ["failure:blocked"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 3, partialSignals: 0, completionBonus: 0, failurePenalty: 0.9, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: false,
    releaseStage: "blocked",
    reasonCodes: ["quality.blocked"],
  };

  service.persistEvaluation(evaluation, decision);

  const stored = JSON.parse((store.artifacts[0].input as { content: string }).content);
  assert.equal(stored.verdict, "fail");
  assert.equal(stored.releaseStage, "blocked");
});

test("QualityGateEvidenceService.persistEvaluation computes degraded verdict for approval", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_4",
    taskId: "task_ev_4",
    passed: false,
    qualityScore: 0.35,
    nextAction: "approve",
    reasons: ["quality.approval_required"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 1, partialSignals: 0, completionBonus: 0, failurePenalty: 0.3, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: false,
    releaseStage: "approval",
    reasonCodes: ["quality.approval_required"],
  };

  service.persistEvaluation(evaluation, decision);

  const stored = JSON.parse((store.artifacts[0].input as { content: string }).content);
  assert.equal(stored.verdict, "degraded");
  assert.equal(stored.releaseStage, "approval");
});

test("QualityGateEvidenceService.persistEvaluation computes pass verdict for high quality", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_5",
    taskId: "task_ev_5",
    passed: true,
    qualityScore: 0.85,
    nextAction: "complete",
    reasons: ["quality.accepted"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 2, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: true,
    releaseStage: "released",
    reasonCodes: ["quality.accepted"],
  };

  service.persistEvaluation(evaluation, decision);

  const stored = JSON.parse((store.artifacts[0].input as { content: string }).content);
  assert.equal(stored.verdict, "pass");
  assert.equal(stored.passed, true);
  assert.ok(stored.qualityScore >= 0.8);
});

test("QualityGateEvidenceService.persistEvaluation merges reason codes", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_6",
    taskId: "task_ev_6",
    passed: false,
    qualityScore: 0.3,
    nextAction: "retry",
    reasons: ["failure:error_1", "failure:error_2"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 0, failureSignals: 2, partialSignals: 0, completionBonus: 0, failurePenalty: 0.6, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: false,
    releaseStage: "repair",
    reasonCodes: ["quality.repair_required", "retry_count_exceeded"],
  };

  service.persistEvaluation(evaluation, decision);

  const stored = JSON.parse((store.artifacts[0].input as { content: string }).content);
  assert.ok(stored.reasonCodes.includes("failure:error_1"));
  assert.ok(stored.reasonCodes.includes("failure:error_2"));
  assert.ok(stored.reasonCodes.includes("quality.repair_required"));
  assert.ok(stored.reasonCodes.includes("retry_count_exceeded"));
});

test("QualityGateEvidenceService.persistEvaluation includes executionId when provided", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_7",
    taskId: "task_ev_7",
    passed: true,
    qualityScore: 0.9,
    nextAction: "complete",
    reasons: ["quality.accepted"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 1, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: true,
    releaseStage: "released",
    reasonCodes: ["quality.accepted"],
  };

  service.persistEvaluation(evaluation, decision, "exec_123");

  const stored = JSON.parse((store.artifacts[0].input as { content: string }).content);
  assert.equal(stored.executionId, "exec_123");
});

test("QualityGateEvidenceService.persistEvaluation includes config snapshot", () => {
  const store = createMockArtifactStore();
  const config: QualityGateConfig = {
    qualityGate: { defaultPassThreshold: 0.5, criticalPassThreshold: 0.8, enforcement: "blocking" },
    qualityScoreWeights: { successSignal: 0.35, completionOutcome: 0.45, failureSignal: 0.3, partialSignal: 0.1 },
    actionThresholds: { completeMinScore: 0.5, approvalRequiredScore: 0.3, retryMaxFailures: 3 },
    evidence: { enabled: true, artifactKind: "quality-evaluation", retentionDays: 90 },
  };

  const service = new QualityGateEvidenceService({ artifactStore: store as never, config });

  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_evidence_8",
    taskId: "task_ev_8",
    passed: true,
    qualityScore: 0.85,
    nextAction: "complete",
    reasons: ["quality.accepted"],
    evaluatedAt: Date.now(),
    factorBreakdown: { successSignals: 1, failureSignals: 0, partialSignals: 0, completionBonus: 0.45, failurePenalty: 0, partialPenalty: 0 },
  };

  const decision: PostExecutionQualityGateDecision = {
    accepted: true,
    releaseStage: "released",
    reasonCodes: ["quality.accepted"],
  };

  service.persistEvaluation(evaluation, decision);

  const stored = JSON.parse((store.artifacts[0].input as { content: string }).content);
  assert.equal(stored.configSnapshot.passThreshold, 0.5);
  assert.ok(stored.configSnapshot.weights);
  assert.equal(stored.configSnapshot.weights.successSignal, 0.35);
});