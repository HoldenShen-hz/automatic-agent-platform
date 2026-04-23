/**
 * @fileoverview Tests for config loaders and PostExecutionQualityGate
 * These test the actual logic of loading config files with validation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { loadQualityConfig } from "../../../../../src/platform/prompt-engine/eval/quality-config-loader.js";
import { loadConversationTemplateConfig, getTemplatesFromConfig } from "../../../../../src/platform/prompt-engine/conversation-template-config-loader.js";
import { PostExecutionQualityGate } from "../../../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";
import type { ExecutionOutcomeEvaluation } from "../../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";

// Use a temp directory for config files that need to exist
const TEMP_DIR = resolve(process.cwd(), "tmp_test_configs");
const QUALITY_CONFIG_PATH = resolve(TEMP_DIR, "quality.json");
const CONVERSATION_CONFIG_PATH = resolve(TEMP_DIR, "conversation_templates.json");

function setup() {
  try {
    mkdirSync(TEMP_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

function teardown() {
  try {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

test("loadQualityConfig returns defaults when file does not exist", () => {
  const config = loadQualityConfig("/nonexistent/path/quality.json");

  assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  assert.equal(config.qualityGate.enforcement, "blocking");
  assert.equal(config.qualityScoreWeights.successSignal, 0.4);
  assert.equal(config.qualityScoreWeights.completionOutcome, 0.3);
  assert.equal(config.qualityScoreWeights.failureSignal, 0.2);
  assert.equal(config.qualityScoreWeights.partialSignal, 0.1);
  assert.equal(config.actionThresholds.completeMinScore, 0.7);
  assert.equal(config.actionThresholds.approvalRequiredScore, 0.5);
  assert.equal(config.actionThresholds.retryMaxFailures, 3);
  assert.equal(config.evidence.enabled, true);
  assert.equal(config.evidence.artifactKind, "quality_report");
  assert.equal(config.evidence.retentionDays, 30);
});

test("loadQualityConfig parses valid config file", () => {
  setup();
  try {
    const validConfig = {
      qualityGate: {
        defaultPassThreshold: 0.7,
        criticalPassThreshold: 0.9,
        enforcement: "warning",
      },
      qualityScoreWeights: {
        successSignal: 0.5,
        completionOutcome: 0.4,
        failureSignal: 0.2,
        partialSignal: 0.1,
      },
      actionThresholds: {
        completeMinScore: 0.6,
        approvalRequiredScore: 0.4,
        retryMaxFailures: 5,
      },
      evidence: {
        enabled: false,
        artifactKind: "custom_report",
        retentionDays: 60,
      },
    };

    writeFileSync(QUALITY_CONFIG_PATH, JSON.stringify(validConfig), "utf-8");

    const config = loadQualityConfig(QUALITY_CONFIG_PATH);

    assert.equal(config.qualityGate.defaultPassThreshold, 0.7);
    assert.equal(config.qualityGate.criticalPassThreshold, 0.9);
    assert.equal(config.qualityGate.enforcement, "warning");
    assert.equal(config.qualityScoreWeights.successSignal, 0.5);
    assert.equal(config.qualityScoreWeights.completionOutcome, 0.4);
    assert.equal(config.actionThresholds.retryMaxFailures, 5);
    assert.equal(config.evidence.enabled, false);
    assert.equal(config.evidence.artifactKind, "custom_report");
    assert.equal(config.evidence.retentionDays, 60);
  } finally {
    teardown();
  }
});

test("loadQualityConfig returns defaults when config is invalid JSON", () => {
  setup();
  try {
    writeFileSync(QUALITY_CONFIG_PATH, "not valid json {", "utf-8");

    const config = loadQualityConfig(QUALITY_CONFIG_PATH);

    // Should return defaults
    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
    assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  } finally {
    teardown();
  }
});

test("loadQualityConfig returns defaults when config fails Zod validation", () => {
  setup();
  try {
    // Invalid: enforcement should be "blocking" or "warning", not "invalid"
    const invalidConfig = {
      qualityGate: {
        defaultPassThreshold: 1.5, // Invalid: should be 0-1
        criticalPassThreshold: 0.95,
        enforcement: "invalid",
      },
      qualityScoreWeights: {
        successSignal: -1, // Invalid: should be >= 0
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
        artifactKind: "quality_report",
        retentionDays: 30,
      },
    };

    writeFileSync(QUALITY_CONFIG_PATH, JSON.stringify(invalidConfig), "utf-8");

    const config = loadQualityConfig(QUALITY_CONFIG_PATH);

    // Should return defaults due to validation failure
    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
    assert.equal(config.qualityScoreWeights.successSignal, 0.4);
  } finally {
    teardown();
  }
});

test("loadConversationTemplateConfig returns defaults when file does not exist", () => {
  const config = loadConversationTemplateConfig("/nonexistent/path/config.json");

  assert.deepEqual(config.templates, []);
  assert.equal(config.maxStepsPerTemplate, 10);
  assert.equal(config.enableTemplateAutoSelection, true);
});

test("loadConversationTemplateConfig parses valid config file", () => {
  setup();
  try {
    const validConfig = {
      templates: [
        { templateId: "t1", name: "Template 1", description: "Desc 1", intent: "task_create", steps: [] },
        { templateId: "t2", name: "Template 2", description: "Desc 2", intent: "task_query", steps: [] },
      ],
      defaultTemplateId: "t1",
      maxStepsPerTemplate: 5,
      enableTemplateAutoSelection: false,
    };

    writeFileSync(CONVERSATION_CONFIG_PATH, JSON.stringify(validConfig), "utf-8");

    const config = loadConversationTemplateConfig(CONVERSATION_CONFIG_PATH);

    assert.equal(config.templates.length, 2);
    assert.equal(config.maxStepsPerTemplate, 5);
    assert.equal(config.enableTemplateAutoSelection, false);
  } finally {
    teardown();
  }
});

test("loadConversationTemplateConfig returns defaults when config is invalid JSON", () => {
  setup();
  try {
    writeFileSync(CONVERSATION_CONFIG_PATH, "not valid json", "utf-8");

    const config = loadConversationTemplateConfig(CONVERSATION_CONFIG_PATH);

    // Should return defaults
    assert.deepEqual(config.templates, []);
    assert.equal(config.maxStepsPerTemplate, 10);
    assert.equal(config.enableTemplateAutoSelection, true);
  } finally {
    teardown();
  }
});

test("getTemplatesFromConfig extracts templates from config", () => {
  const config = {
    templates: [
      { templateId: "t1", name: "Template 1", description: "", intent: "task_create", steps: [] },
      { templateId: "t2", name: "Template 2", description: "", intent: "task_query", steps: [] },
    ],
    maxStepsPerTemplate: 5,
    enableTemplateAutoSelection: false,
  };

  const templates = getTemplatesFromConfig(config);

  assert.equal(templates.length, 2);
  assert.equal(templates[0]?.templateId, "t1");
  assert.equal(templates[1]?.templateId, "t2");
});

// ── PostExecutionQualityGate Tests ───────────────────────────────────

test("PostExecutionQualityGate decides released when evaluation passed and nextAction is complete", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: true,
    qualityScore: 0.9,
    nextAction: "complete",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 1,
      failureSignals: 0,
      partialSignals: 0,
      completionBonus: 0.45,
      failurePenalty: 0,
      partialPenalty: 0,
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, true);
  assert.equal(decision.releaseStage, "released");
  assert.deepEqual(decision.reasonCodes, ["quality.accepted"]);
});

test("PostExecutionQualityGate decides approval when nextAction is approve", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.5,
    nextAction: "approve",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 0,
      failureSignals: 1,
      partialSignals: 0,
      completionBonus: 0,
      failurePenalty: 0.3,
      partialPenalty: 0,
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "approval");
  assert.deepEqual(decision.reasonCodes, ["quality.approval_required"]);
});

test("PostExecutionQualityGate decides repair when nextAction is retry", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.3,
    nextAction: "retry",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 0,
      failureSignals: 2,
      partialSignals: 0,
      completionBonus: 0,
      failurePenalty: 0.6,
      partialPenalty: 0,
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
  assert.deepEqual(decision.reasonCodes, ["quality.repair_required"]);
});

test("PostExecutionQualityGate decides repair when nextAction is replan", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.2,
    nextAction: "replan",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 0,
      failureSignals: 0,
      partialSignals: 3,
      completionBonus: 0,
      failurePenalty: 0,
      partialPenalty: 0.3,
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
  assert.deepEqual(decision.reasonCodes, ["quality.repair_required"]);
});

test("PostExecutionQualityGate decides blocked as fallback", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: false,
    qualityScore: 0.1,
    nextAction: "escalate",
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 0,
      failureSignals: 5,
      partialSignals: 0,
      completionBonus: 0,
      failurePenalty: 1.5,
      partialPenalty: 0,
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "blocked");
  assert.deepEqual(decision.reasonCodes, ["quality.blocked"]);
});

test("PostExecutionQualityGate does not accept when passed is true but nextAction is not complete", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_1",
    taskId: "task_1",
    passed: true, // passed is true but...
    qualityScore: 0.9,
    nextAction: "approve", // nextAction is approve, not complete
    reasons: [],
    evaluatedAt: Date.now(),
    factorBreakdown: {
      successSignals: 1,
      failureSignals: 0,
      partialSignals: 0,
      completionBonus: 0.45,
      failurePenalty: 0,
      partialPenalty: 0,
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "approval");
});
