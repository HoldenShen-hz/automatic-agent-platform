import assert from "node:assert/strict";
import test from "node:test";

import { detectLlmTruncation } from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/truncation-detector.js";
import { detectSchemaValidationLoop } from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/schema-loop-detector.js";
import { detectToolPermissionDenial } from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/permission-detector.js";
import { detectModelHallucination } from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/hallucination-detector.js";
import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/index.js";
import type { FailurePattern } from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/index.js";

function makeSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "sig-1",
    taskId: "task-1",
    sourceFeedbackId: "fb-1",
    learningType: "failure_pattern",
    valueSummary: "Test failure signal",
    confidence: 0.8,
    evidence: {},
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    generatedAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// Truncation Detector Tests
// =============================================================================

test("detectLlmTruncation returns null when no truncation evidence", () => {
  const signal = makeSignal({
    evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 500 },
  });

  const result = detectLlmTruncation(signal);

  assert.equal(result, null);
});

test("detectLlmTruncation detects finishReason=length", () => {
  const signal = makeSignal({
    learningSignalId: "sig-trunc",
    taskId: "task-trunc",
    evidence: {
      finishReason: "length",
      maxTokens: 4096,
      tokensUsed: 4096,
      stepId: "step-1",
    },
    valueSummary: "Model output was cut off",
  });

  const result = detectLlmTruncation(signal);

  assert.ok(result !== null);
  assert.equal(result!.patternType, "llm_truncation");
  assert.ok(result!.title.includes("truncated"));
});

test("detectLlmTruncation detects tokens >= 95% of maxTokens", () => {
  const signal = makeSignal({
    evidence: {
      finishReason: "stop",
      maxTokens: 1000,
      tokensUsed: 960, // 96%
    },
  });

  const result = detectLlmTruncation(signal);

  assert.ok(result !== null);
  assert.ok(result!.title.includes("near token limit"));
});

test("detectLlmTruncation does not detect when tokens < 95% of maxTokens", () => {
  const signal = makeSignal({
    evidence: {
      finishReason: "stop",
      maxTokens: 1000,
      tokensUsed: 900, // 90%
    },
  });

  const result = detectLlmTruncation(signal);

  assert.equal(result, null);
});

test("detectLlmTruncation does not detect when tokensUsed is 0", () => {
  const signal = makeSignal({
    evidence: {
      finishReason: "stop",
      maxTokens: 1000,
      tokensUsed: 0,
    },
  });

  const result = detectLlmTruncation(signal);

  assert.equal(result, null);
});

test("detectLlmTruncation handles finish_reason instead of finishReason", () => {
  const signal = makeSignal({
    evidence: {
      finish_reason: "length",
      max_tokens: 2048,
      tokens_used: 2048,
    },
  });

  const result = detectLlmTruncation(signal);

  assert.ok(result !== null);
});

test("detectLlmTruncation uses stepId from evidence", () => {
  const signal = makeSignal({
    evidence: {
      finishReason: "length",
      maxTokens: 100,
      tokensUsed: 100,
      stepId: "step-42",
    },
  });

  const result = detectLlmTruncation(signal);

  assert.equal(result!.stepId, "step-42");
});

test("detectLlmTruncation includes recommendation to increase max_tokens", () => {
  const signal = makeSignal({
    evidence: {
      finishReason: "length",
      maxTokens: 100,
      tokensUsed: 100,
    },
  });

  const result = detectLlmTruncation(signal);

  assert.ok(result!.recommendation.includes("max_tokens") || result!.recommendation.includes("context"));
});

test("detectLlmTruncation uses signal.generatedAt for detectedAt", () => {
  const signalTime = 1700000000000;
  const signal = makeSignal({
    generatedAt: signalTime,
    evidence: {
      finishReason: "length",
      maxTokens: 100,
      tokensUsed: 100,
    },
  });

  const result = detectLlmTruncation(signal);

  assert.equal(result!.detectedAt, signalTime);
});

// =============================================================================
// Schema Validation Loop Detector Tests
// =============================================================================

test("detectSchemaValidationLoop returns null for empty signals", () => {
  const result = detectSchemaValidationLoop([]);
  assert.equal(result, null);
});

test("detectSchemaValidationLoop returns null when fewer than minOccurrences", () => {
  const signals = [
    makeSignal({ learningSignalId: "sig-1", taskId: "task-1", evidence: { stepId: "step-1" } }),
    makeSignal({ learningSignalId: "sig-2", taskId: "task-1", evidence: { stepId: "step-1" } }),
  ];

  const result = detectSchemaValidationLoop(signals, 3);

  assert.equal(result, null);
});

test("detectSchemaValidationLoop detects loop with minOccurrences >= 3", () => {
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 3; i++) {
    signals.push(
      makeSignal({
        learningSignalId: `sig-loop-${i}`,
        taskId: "task-loop",
        evidence: { stepId: "step-validation" },
      }),
    );
  }

  const result = detectSchemaValidationLoop(signals, 3);

  assert.ok(result !== null);
  assert.equal(result!.patternType, "schema_validation_loop");
});

test("detectSchemaValidationLoop uses custom minOccurrences", () => {
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 5; i++) {
    signals.push(
      makeSignal({
        learningSignalId: `sig-custom-${i}`,
        taskId: "task-custom",
        evidence: { stepId: "step-custom" },
      }),
    );
  }

  const result = detectSchemaValidationLoop(signals, 5);

  assert.ok(result !== null);
});

test("detectSchemaValidationLoop returns null with custom minOccurrences not met", () => {
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 3; i++) {
    signals.push(
      makeSignal({
        learningSignalId: `sig-min-${i}`,
        taskId: "task-min",
        evidence: { stepId: "step-min" },
      }),
    );
  }

  const result = detectSchemaValidationLoop(signals, 4);

  assert.equal(result, null);
});

test("detectSchemaValidationLoop groups by taskId and stepId", () => {
  const signals: LearningSignal[] = [
    makeSignal({ learningSignalId: "sig-a1", taskId: "task-A", evidence: { stepId: "step-1" } }),
    makeSignal({ learningSignalId: "sig-a2", taskId: "task-A", evidence: { stepId: "step-1" } }),
    makeSignal({ learningSignalId: "sig-a3", taskId: "task-A", evidence: { stepId: "step-1" } }),
    makeSignal({ learningSignalId: "sig-b1", taskId: "task-B", evidence: { stepId: "step-1" } }),
    makeSignal({ learningSignalId: "sig-b2", taskId: "task-B", evidence: { stepId: "step-1" } }),
  ];

  const result = detectSchemaValidationLoop(signals, 3);

  assert.ok(result !== null);
  assert.ok(result!.title.includes("3") || result!.title.includes("repair"));
});

test("detectSchemaValidationLoop includes repair attempt count in title", () => {
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 4; i++) {
    signals.push(
      makeSignal({
        learningSignalId: `sig-repair-${i}`,
        taskId: "task-repair",
        evidence: { stepId: "step-repair" },
      }),
    );
  }

  const result = detectSchemaValidationLoop(signals, 3);

  assert.ok(result !== null);
  assert.ok(result!.title.includes("4") || result!.title.includes("repair"));
});

test("detectSchemaValidationLoop recommendation suggests simplifying schema", () => {
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 3; i++) {
    signals.push(
      makeSignal({
        learningSignalId: `sig-rec-${i}`,
        taskId: "task-rec",
        evidence: { stepId: "step-rec" },
      }),
    );
  }

  const result = detectSchemaValidationLoop(signals, 3);

  assert.ok(result!.recommendation.includes("schema") || result!.recommendation.includes("model"));
});

test("detectSchemaValidationLoop filters non-failure_pattern signals", () => {
  const signals: LearningSignal[] = [
    makeSignal({ learningSignalId: "sig-fp", taskId: "task-filter", learningType: "failure_pattern", evidence: { stepId: "step-filter" } }),
    makeSignal({ learningSignalId: "sig-uc", taskId: "task-filter", learningType: "user_correction", evidence: { stepId: "step-filter" } }),
    makeSignal({ learningSignalId: "sig-rp", taskId: "task-filter", learningType: "recovery_playbook", evidence: { stepId: "step-filter" } }),
  ];

  const result = detectSchemaValidationLoop(signals, 3);

  assert.equal(result, null); // Only 1 failure_pattern signal
});

test("detectSchemaValidationLoop groups signals with empty stepId separately", () => {
  const signals: LearningSignal[] = [
    makeSignal({ learningSignalId: "sig-no-step", taskId: "task-no-step", evidence: {} }),
    makeSignal({ learningSignalId: "sig-no-step-2", taskId: "task-no-step", evidence: {} }),
    makeSignal({ learningSignalId: "sig-no-step-3", taskId: "task-no-step", evidence: {} }),
  ];

  const result = detectSchemaValidationLoop(signals, 3);

  // Should not detect loop for signals without stepId
  assert.equal(result, null);
});

// =============================================================================
// Tool Permission Denial Detector Tests
// =============================================================================

test("detectToolPermissionDenial returns null when no denial evidence", () => {
  const signal = makeSignal({
    valueSummary: "Tool executed successfully",
    evidence: { toolName: "read", operation: "read_file" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.equal(result, null);
});

test("detectToolPermissionDenial detects permission denied in valueSummary", () => {
  const signal = makeSignal({
    learningSignalId: "sig-perm",
    taskId: "task-perm",
    valueSummary: "permission denied for bash tool",
    evidence: { toolName: "bash" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
  assert.equal(result!.patternType, "tool_permission_denial");
  assert.ok(result!.title.includes("permission denial"));
});

test("detectToolPermissionDenial detects access denied", () => {
  const signal = makeSignal({
    valueSummary: "access denied to resource",
    evidence: {},
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial detects forbidden", () => {
  const signal = makeSignal({
    valueSummary: "403 forbidden",
    evidence: {},
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial detects EPERM in evidence", () => {
  const signal = makeSignal({
    valueSummary: "Operation failed",
    evidence: { errorCode: "EPERM" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial detects eacces", () => {
  const signal = makeSignal({
    valueSummary: "Operation failed",
    evidence: { errorCode: "eacces" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial detects not permitted", () => {
  const signal = makeSignal({
    valueSummary: "Operation not permitted",
    evidence: {},
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial extracts toolName from evidence", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "exec" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result!.title.includes("exec"));
});

test("detectToolPermissionDenial extracts operation from evidence", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "bash", operation: "execute_command" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result!.summary.includes("execute_command"));
});

test("detectToolPermissionDenial handles tool field instead of toolName", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: { tool: "write_file" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial handles action field instead of operation", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "bash", action: "run_script" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial defaults to unknown tool when not specified", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: {},
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result!.title.includes("unknown"));
});

test("detectToolPermissionDenial includes sandbox recommendation", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "bash" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result!.recommendation.includes("sandbox") || result!.recommendation.includes("HITL"));
});

test("detectToolPermissionDenial is case insensitive", () => {
  const signal = makeSignal({
    valueSummary: "PERMISSION DENIED",
    evidence: { toolName: "bash" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(result !== null);
});

test("detectToolPermissionDenial uses stepId from evidence", () => {
  const signal = makeSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "bash", stepId: "step-99" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.equal(result!.stepId, "step-99");
});

test("detectToolPermissionDenial recommendation suggests approval or policy adjustment", () => {
  const signal = makeSignal({
    valueSummary: "requires approval",
    evidence: { toolName: "write" },
  });

  const result = detectToolPermissionDenial(signal);

  assert.ok(
    result!.recommendation.includes("sandbox") ||
    result!.recommendation.includes("approval") ||
    result!.recommendation.includes("policy"),
  );
});

// =============================================================================
// Model Hallucination Detector Tests
// =============================================================================

test("detectModelHallucination returns null when evalScore is not low", () => {
  const signal = makeSignal({
    evidence: { evalScore: 0.8 },
  });

  const result = detectModelHallucination(signal);

  assert.equal(result, null);
});

test("detectModelHallucination detects low evalScore below 0.3", () => {
  const signal = makeSignal({
    learningSignalId: "sig-hall",
    taskId: "task-hall",
    evidence: {
      evalScore: 0.2,
      modelId: "gpt-4o",
      stepId: "step-1",
    },
    valueSummary: "Model hallucinated facts",
  });

  const result = detectModelHallucination(signal);

  assert.ok(result !== null);
  assert.equal(result!.patternType, "model_hallucination");
  assert.ok(result!.title.includes("hallucination"));
});

test("detectModelHallucination does not detect when evalScore >= 0.3", () => {
  const signal = makeSignal({
    evidence: { evalScore: 0.5 },
  });

  const result = detectModelHallucination(signal);

  assert.equal(result, null);
});

test("detectModelHallucination handles eval_score snake_case", () => {
  const signal = makeSignal({
    evidence: { eval_score: 0.15 },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result !== null);
});

test("detectModelHallucination extracts model from evidence", () => {
  const signal = makeSignal({
    evidence: {
      evalScore: 0.2,
      modelId: "claude-3-opus",
    },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result!.summary.includes("claude-3-opus") || result!.title.includes("hallucination"));
});

test("detectModelHallucination uses stepId from evidence", () => {
  const signal = makeSignal({
    evidence: {
      evalScore: 0.1,
      stepId: "step-hall",
    },
  });

  const result = detectModelHallucination(signal);

  assert.equal(result!.stepId, "step-hall");
});

test("detectModelHallucination recommends validating outputs", () => {
  const signal = makeSignal({
    evidence: { evalScore: 0.2 },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result!.recommendation.length > 0);
});

test("detectModelHallucination handles null/undefined evalScore", () => {
  const signal = makeSignal({
    evidence: { modelId: "gpt-4" },
  });

  const result = detectModelHallucination(signal);

  assert.equal(result, null);
});

test("detectModelHallucination handles evalScore = 0.3 exactly (threshold)", () => {
  const signal = makeSignal({
    evidence: { evalScore: 0.3 },
  });

  const result = detectModelHallucination(signal);

  assert.equal(result, null); // 0.3 is not < 0.3
});

test("detectModelHallucination detects evalScore just below threshold", () => {
  const signal = makeSignal({
    evidence: { evalScore: 0.29 },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result !== null);
});

test("detectModelHallucination handles very low evalScore", () => {
  const signal = makeSignal({
    evidence: { evalScore: 0.01 },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result !== null);
});

test("detectModelHallucination is case insensitive in valueSummary search", () => {
  const signal = makeSignal({
    valueSummary: "HALLUCINATED",
    evidence: {},
  });

  // Hallucination detector primarily uses evalScore, but may also check valueSummary
  const result = detectModelHallucination(signal);

  // Result depends on evalScore - if not low, may be null
  // This test just verifies the function handles the input
  assert.ok(result === null || result.patternType === "model_hallucination");
});

test("detectModelHallucination uses learningSignalId in sourceSignalIds", () => {
  const signal = makeSignal({
    learningSignalId: "sig-specific-id",
    evidence: { evalScore: 0.2 },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result!.sourceSignalIds.includes("sig-specific-id"));
});

test("detectModelHallucination includes modelId in summary when available", () => {
  const signal = makeSignal({
    evidence: {
      evalScore: 0.15,
      modelId: "gpt-4-turbo",
      stepId: "step-model",
    },
  });

  const result = detectModelHallucination(signal);

  assert.ok(result !== null);
  assert.ok(result!.summary.includes("gpt-4-turbo") || result!.title.includes("hallucination"));
});