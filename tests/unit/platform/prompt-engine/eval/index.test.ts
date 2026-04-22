import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for evaluation module
import {
  EvalDatasetJudgeService,
  LLM_EVAL_DDL,
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
  QualityGateEvidenceService,
  CrossProviderJudgeService,
  JudgeProviderRegistryService,
  ExecutionOutcomeEvaluator,
  PromptModelPolicyGovernanceService,
} from "../../../../../src/platform/prompt-engine/eval/index.js";
import type { QualityGateConfig, QualityEvaluationEvidence } from "../../../../../src/platform/prompt-engine/eval/index.js";

test("LLM_EVAL_DDL is a non-empty string", () => {
  assert.ok(typeof LLM_EVAL_DDL === "string");
  assert.ok(LLM_EVAL_DDL.length > 0);
  assert.ok(LLM_EVAL_DDL.includes("CREATE TABLE"));
});

test("LLM_EVAL_DDL contains eval_suites table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_suites"));
  assert.ok(LLM_EVAL_DDL.includes("id TEXT PRIMARY KEY"));
});

test("LLM_EVAL_DDL contains eval_runs table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_runs"));
  assert.ok(LLM_EVAL_DDL.includes("suite_id"));
});

test("LLM_EVAL_DDL contains eval_case_results table", () => {
  assert.ok(LLM_EVAL_DDL.includes("eval_case_results"));
  assert.ok(LLM_EVAL_DDL.includes("run_id"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL is a non-empty string", () => {
  assert.ok(typeof PROMPT_MODEL_POLICY_GOVERNANCE_DDL === "string");
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.length > 0);
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("CREATE TABLE"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains governance_releases table", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("governance_releases"));
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("release_type"));
});

test("PROMPT_MODEL_POLICY_GOVERNANCE_DDL contains governance_gate_events table", () => {
  assert.ok(PROMPT_MODEL_POLICY_GOVERNANCE_DDL.includes("governance_gate_events"));
});

test("eval barrel exposes dataset and judge orchestration service", () => {
  assert.equal(typeof EvalDatasetJudgeService, "function");
});

test("eval barrel exports all expected services as functions or classes", () => {
  assert.equal(typeof EvalDatasetJudgeService, "function");
  assert.equal(typeof QualityGateEvidenceService, "function");
  assert.equal(typeof CrossProviderJudgeService, "function");
  assert.equal(typeof JudgeProviderRegistryService, "function");
  assert.equal(typeof ExecutionOutcomeEvaluator, "function");
  assert.equal(typeof PromptModelPolicyGovernanceService, "function");
});

test("eval barrel exports QualityGateConfig interface shape", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.8,
      criticalPassThreshold: 0.95,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.4,
      completionOutcome: 0.3,
      failureSignal: 0.2,
      partialSignal: 0.1,
    },
    actionThresholds: {
      completeMinScore: 0.7,
      approvalRequiredScore: 0.5,
      retryMaxFailures: 3,
    },
    evidence: {
      enabled: true,
      artifactKind: "quality_evidence",
      retentionDays: 90,
    },
  };

  assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  assert.equal(config.qualityScoreWeights.successSignal, 0.4);
  assert.equal(config.evidence.retentionDays, 90);
});

test("eval barrel exports QualityEvaluationEvidence interface shape", () => {
  const evidence: QualityEvaluationEvidence = {
    evaluationId: "eval_123",
    taskId: "task_456",
    executionId: "exec_789",
    qualityScore: 0.85,
    passed: true,
    verdict: "pass",
    releaseStage: "released",
    reasonCodes: ["success_signal_high", "completion_bonus"],
    factorBreakdown: {
      successSignals: 0.9,
      failureSignals: 0.05,
      partialSignals: 0.05,
      completionBonus: 0.1,
      failurePenalty: 0.05,
      partialPenalty: 0.05,
    },
    evaluatedAt: "2024-01-01T00:00:00.000Z",
    configSnapshot: {
      passThreshold: 0.8,
      weights: {
        successSignal: 0.4,
        completionOutcome: 0.3,
        failureSignal: 0.2,
        partialSignal: 0.1,
      },
    },
  };

  assert.equal(evidence.evaluationId, "eval_123");
  assert.equal(evidence.verdict, "pass");
  assert.equal(evidence.releaseStage, "released");
  assert.equal(evidence.factorBreakdown.successSignals, 0.9);
});

test("eval barrel exports JudgeProviderRegistryService class", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();
  const descriptors = service.listDescriptors("ready");
  assert.ok(descriptors.length > 0);
});
