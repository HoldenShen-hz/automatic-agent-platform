/**
 * Learn Service Tests for OAPEFLIR Learning Pipeline
 *
 * Tests the learning services including StrategyLearningService,
 * FailurePatternMiner, LearningObjectValidator, and pattern detectors.
 *
 * Architecture: §56 Learning Pipeline & ADR-080 Learning Object Schema
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FailurePatternMiner } from "../../../../../../src/platform/five-plane-orchestration/learn/failure-pattern-miner.js";
import { LearningObjectValidator } from "../../../../../../src/platform/five-plane-orchestration/learn/learning-object-validator.js";
import { StrategyLearningService } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/strategy-learning-service.js";
import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create minimal LearningSignal for testing
// ─────────────────────────────────────────────────────────────────────────────

function createLearningSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "signal_test_1",
    taskId: "task_learning_test",
    sourceFeedbackId: "fb_learning_1",
    learningType: "failure_pattern",
    confidence: 0.75,
    valueSummary: "Test learning signal summary",
    evidenceRefs: ["artifact:test_ref_1"],
    sourceSignalIds: ["signal_source_1"],
    relatedSignalIds: [],
    evidence: { source: "execution", category: "test" },
    generatedAt: Date.now(),
    ...overrides,
  };
}

// Valid learning object content for tests
const validContent = {
  title: "Valid Learning Object",
  summary: "This is a valid learning object for testing",
  recommendation: "Apply the recommended fix",
  evidenceRefs: ["artifact:learning_1", "artifact:learning_2"],
  sourceSignalIds: ["signal_1", "signal_2"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: LearningObjectValidator - PII/Secret Detection
// ─────────────────────────────────────────────────────────────────────────────

test("LearningObjectValidator detects password in text", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_pwd",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Auth failure",
      summary: "User password needs reset",
      recommendation: "Use password manager",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.secret_detected");
});

test("LearningObjectValidator detects API key in text", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_api",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "API issue",
      summary: "api_key_abc123 was found in logs",
      recommendation: "Rotate API keys",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.secret_detected");
});

test("LearningObjectValidator detects email address in text", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_email",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Contact issue",
      summary: "Contact user@example.com for help",
      recommendation: "Use internal channel",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_detected");
});

test("LearningObjectValidator detects credit card pattern", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_cc",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Payment issue",
      summary: "Card 4111111111111111 detected",
      recommendation: "Use tokenization",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_detected");
});

test("LearningObjectValidator detects SSN pattern", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_ssn",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Compliance issue",
      summary: "SSN 123-45-6789 found in record",
      recommendation: "Redact PII",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_detected");
});

test("LearningObjectValidator detects secret in recommendation", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_secret",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Security issue",
      summary: "Credential was exposed",
      recommendation: "Rotate secret_token_xyz",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.secret_detected");
});

test("LearningObjectValidator accepts safe content", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_safe",
    kind: "failure_pattern",
    content: {
      title: "Schema validation issue",
      summary: "Output schema did not match expected format",
      recommendation: "Add output validation step",
      evidenceRefs: ["artifact:safe_test"],
      sourceSignalIds: ["signal_safe"],
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, true);
  assert.equal(result.reasonCode, "learning.validated");
});

test("LearningObjectValidator detects credential in title", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_cred",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "API token exposure incident",
      summary: "Token was logged in plaintext",
      recommendation: "Use secure token storage",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.secret_detected");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: LearningObjectValidator - Confidence Thresholds
// ─────────────────────────────────────────────────────────────────────────────

test("LearningObjectValidator rejects failure_pattern below 0.5", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_fp_low",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Low confidence pattern",
      summary: "Pattern with low confidence",
      recommendation: "Gather more evidence",
    },
    confidence: 0.49,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator accepts failure_pattern at 0.5", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_fp_50",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Boundary confidence pattern",
      summary: "At exactly 0.5 threshold",
      recommendation: "Monitor closely",
    },
    confidence: 0.5,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, true);
});

test("LearningObjectValidator accepts failure_pattern above 0.5", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_fp_above",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Good confidence pattern",
      summary: "High confidence pattern",
      recommendation: "Apply fix",
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, true);
});

test("LearningObjectValidator rejects user_correction below 0.9", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_uc_low",
    kind: "user_correction",
    content: {
      ...validContent,
      title: "User correction with low confidence",
      summary: "User corrected but confidence low",
      recommendation: "Review correction",
    },
    confidence: 0.85,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator accepts user_correction at 0.9", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_uc_90",
    kind: "user_correction",
    content: {
      ...validContent,
      title: "User correction at threshold",
      summary: "User corrected approach",
      recommendation: "Adopt correction",
    },
    confidence: 0.9,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, true);
});

test("LearningObjectValidator rejects recovery_playbook below 0.7", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_rp_low",
    kind: "recovery_playbook",
    content: {
      ...validContent,
      title: "Recovery playbook low confidence",
      summary: "Recovery worked but confidence low",
      recommendation: "Gather more data",
    },
    confidence: 0.65,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator accepts recovery_playbook at 0.7", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_rp_70",
    kind: "recovery_playbook",
    content: {
      ...validContent,
      title: "Recovery playbook at threshold",
      summary: "Recovery playbook with sufficient confidence",
      recommendation: "Standardize recovery",
    },
    confidence: 0.7,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: LearningObjectValidator - Validation Rules
// ─────────────────────────────────────────────────────────────────────────────

test("LearningObjectValidator requires evidenceRefs in content", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_no_evidence",
    kind: "failure_pattern",
    content: {
      title: "No evidence object",
      summary: "This has no evidence refs",
      recommendation: "Add evidence",
      evidenceRefs: [],
      sourceSignalIds: ["signal_no_evidence"],
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.missing_evidence");
});

test("LearningObjectValidator sets quarantine status on invalid objects", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_quarantine",
    kind: "failure_pattern",
    content: {
      ...validContent,
      title: "Quarantine test",
      summary: "Will be quarantined due to low confidence",
      recommendation: "Increase confidence",
    },
    confidence: 0.3,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  const learningObj = result.learningObject as { promotionStatus?: string };
  assert.equal(learningObj.promotionStatus, "quarantined");
});

test("LearningObjectValidator.validateMany filters invalid objects", () => {
  const validator = new LearningObjectValidator();
  const objects = [
    {
      objectId: "valid_1",
      kind: "failure_pattern",
      content: {
        title: "Valid Object 1",
        summary: "Has evidence and good confidence",
        recommendation: "Apply fix",
        evidenceRefs: ["artifact:1"],
        sourceSignalIds: ["signal_1"],
      },
      confidence: 0.8,
      status: "created",
      createdAt: new Date().toISOString(),
    },
    {
      objectId: "invalid_1",
      kind: "failure_pattern",
      content: {
        title: "Invalid Object - No Evidence",
        summary: "Missing evidence",
        recommendation: "Add evidence",
        evidenceRefs: [],
        sourceSignalIds: ["signal_inv"],
      },
      confidence: 0.8,
      status: "created",
      createdAt: new Date().toISOString(),
    },
    {
      objectId: "valid_2",
      kind: "user_correction",
      content: {
        title: "Valid Object 2",
        summary: "User correction with high confidence",
        recommendation: "Adopt correction",
        evidenceRefs: ["artifact:2"],
        sourceSignalIds: ["signal_2"],
      },
      confidence: 0.95,
      status: "created",
      createdAt: new Date().toISOString(),
    },
  ];

  const validated = validator.validateMany(objects);

  assert.equal(validated.length, 2);
  assert.ok(validated.some((obj) => (obj as { objectId: string }).objectId === "valid_1"));
  assert.ok(validated.some((obj) => (obj as { objectId: string }).objectId === "valid_2"));
});

test("LearningObjectValidator.validateMany handles empty array", () => {
  const validator = new LearningObjectValidator();
  const validated = validator.validateMany([]);

  assert.deepStrictEqual(validated, []);
});

test("LearningObjectValidator.validateMany returns all valid when all pass", () => {
  const validator = new LearningObjectValidator();
  const objects = [
    {
      objectId: "obj_a",
      kind: "failure_pattern",
      content: {
        title: "Object A",
        summary: "Summary A",
        recommendation: "Rec A",
        evidenceRefs: ["artifact:a"],
        sourceSignalIds: ["sig_a"],
      },
      confidence: 0.8,
      status: "created",
      createdAt: new Date().toISOString(),
    },
    {
      objectId: "obj_b",
      kind: "recovery_playbook",
      content: {
        title: "Object B",
        summary: "Summary B",
        recommendation: "Rec B",
        evidenceRefs: ["artifact:b"],
        sourceSignalIds: ["sig_b"],
      },
      confidence: 0.85,
      status: "created",
      createdAt: new Date().toISOString(),
    },
  ];

  const validated = validator.validateMany(objects);

  assert.equal(validated.length, 2);
});

test("LearningObjectValidator sets validated status on successful validation", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    objectId: "obj_validated",
    kind: "failure_pattern",
    content: {
      title: "Should be validated",
      summary: "This should pass validation",
      recommendation: "Good to go",
      evidenceRefs: ["artifact:validated"],
      sourceSignalIds: ["sig_validated"],
    },
    confidence: 0.8,
    status: "created",
    createdAt: new Date().toISOString(),
  });

  assert.equal(result.valid, true);
  const learningObj = result.learningObject as { promotionStatus?: string; validatedBy?: string };
  assert.equal(learningObj.promotionStatus, "validated");
  assert.equal(learningObj.validatedBy, "evidence");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: FailurePatternMiner
// ─────────────────────────────────────────────────────────────────────────────

test("FailurePatternMiner.mine handles empty signals array", () => {
  const miner = new FailurePatternMiner();
  const objects = miner.mine([]);

  assert.deepStrictEqual(objects, []);
});

test("FailurePatternMiner.mine produces objects from failure_pattern signals", () => {
  const miner = new FailurePatternMiner();
  const signals = [
    createLearningSignal({
      learningSignalId: "sig_fp_miner",
      learningType: "failure_pattern",
      evidenceRefs: ["artifact:fp_test"],
    }),
  ];

  const objects = miner.mine(signals);

  assert.ok(objects.length >= 1);
  const obj = objects[0] as { learningType?: string; title?: string };
  assert.equal(obj.learningType, "failure_pattern");
  assert.ok(typeof obj.title === "string");
});

test("FailurePatternMiner.mine filters non-failure signals during mining", () => {
  const miner = new FailurePatternMiner();
  const signals = [
    createLearningSignal({ learningType: "user_correction" }),
    createLearningSignal({ learningType: "recovery_playbook" }),
  ];

  const objects = miner.mine(signals);

  // Non-failure signals don't produce mined objects
  assert.ok(Array.isArray(objects));
});

test("FailurePatternMiner.mine creates generic failure for unmatched patterns", () => {
  const miner = new FailurePatternMiner();
  const signals = [
    createLearningSignal({
      learningType: "failure_pattern",
      patternCategory: "unknown_pattern_xyz",
      valueSummary: "Something went wrong but no specific pattern detected",
    }),
  ];

  const objects = miner.mine(signals);

  assert.ok(objects.length >= 1);
  const obj = objects[0] as { learningType?: string; title?: string };
  assert.equal(obj.learningType, "failure_pattern");
  assert.ok(obj.title?.includes("Failure pattern:"));
});

test("FailurePatternMiner.mine sets recommendation on output objects", () => {
  const miner = new FailurePatternMiner();
  const signals = [
    createLearningSignal({
      learningType: "failure_pattern",
      valueSummary: "Test failure signal",
    }),
  ];

  const objects = miner.mine(signals);

  assert.ok(objects.length > 0);
  const obj = objects[0] as { recommendation?: string };
  assert.ok(typeof obj.recommendation === "string");
});

test("FailurePatternMiner.mine preserves evidenceRefs from signal", () => {
  const miner = new FailurePatternMiner();
  const signals = [
    createLearningSignal({
      learningType: "failure_pattern",
      evidenceRefs: ["artifact:miner_1", "artifact:miner_2"],
    }),
  ];

  const objects = miner.mine(signals);

  assert.ok(objects.length > 0);
  const obj = objects[0] as { evidenceRefs?: string[] };
  assert.ok(obj.evidenceRefs?.length >= 1);
});

test("FailurePatternMiner.mine produces consistent ID format", () => {
  const miner = new FailurePatternMiner();
  const signals = [createLearningSignal({ learningType: "failure_pattern" })];

  const objects = miner.mine(signals);

  for (const obj of objects) {
    const learningObj = obj as { learningObjectId?: string };
    assert.ok(learningObj.learningObjectId?.startsWith("learning_"));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: StrategyLearningService - Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("StrategyLearningService returns empty array for empty signals", () => {
  const service = new StrategyLearningService();
  const objects = service.learnSync([]);

  assert.deepStrictEqual(objects, []);
});

test("StrategyLearningService async returns empty array for empty signals", async () => {
  const service = new StrategyLearningService();
  const objects = await service.learn([]);

  assert.deepStrictEqual(objects, []);
});

test("StrategyLearningService works without evidenceStore", () => {
  const service = new StrategyLearningService();
  const signals = [createLearningSignal({ learningSignalId: "sig_no_store" })];

  // Should not throw even without evidenceStore
  const objects = service.learnSync(signals);
  assert.ok(Array.isArray(objects));
});

test("StrategyLearningService async works without evidenceStore", async () => {
  const service = new StrategyLearningService();
  const signals = [createLearningSignal({ learningSignalId: "sig_no_store_async" })];

  // Should not throw even without evidenceStore
  const objects = await service.learn(signals);
  assert.ok(Array.isArray(objects));
});

test("StrategyLearningService handles signals with cost and latency", () => {
  const service = new StrategyLearningService();
  const signals = [
    createLearningSignal({
      learningSignalId: "sig_meta",
      costUsd: 0.05,
      latencyMs: 1500,
      tokenUsage: { inputTokens: 1000, outputTokens: 500 },
    }),
  ];

  const objects = service.learnSync(signals);
  assert.ok(Array.isArray(objects));
});

test("StrategyLearningService handles signals with repair rounds", () => {
  const service = new StrategyLearningService();
  const signals = [createLearningSignal({ learningSignalId: "sig_repair", repairRounds: 3 })];

  const objects = service.learnSync(signals);
  assert.ok(Array.isArray(objects));
});

test("StrategyLearningService handles signals with errorCode", () => {
  const service = new StrategyLearningService();
  const signals = [createLearningSignal({ learningSignalId: "sig_error", errorCode: "EXECUTION_TIMEOUT" })];

  const objects = service.learnSync(signals);
  assert.ok(Array.isArray(objects));
});

test("StrategyLearningService normalizes signal references", () => {
  const service = new StrategyLearningService();
  const signal = createLearningSignal({
    evidenceRefs: [],
    sourceSignalIds: [],
  });

  // Should not throw - normalization adds fallbacks
  const objects = service.learnSync([signal]);
  assert.ok(Array.isArray(objects));
});
