import test from "node:test";
import assert from "node:assert/strict";

import {
  FeedbackSignalSchema,
  parseFeedbackSignal,
  FeedbackSourceSchema,
  FeedbackCategorySchema,
  FeedbackSeveritySchema,
  isTrustedFeedbackSignal,
} from "../../../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";

test("FeedbackSourceSchema accepts valid sources", () => {
  const sources = ["execution", "user", "hitl", "validation", "system"] as const;
  for (const source of sources) {
    assert.equal(FeedbackSourceSchema.parse(source), source);
  }
});

test("FeedbackSourceSchema rejects invalid source", () => {
  assert.throws(() => FeedbackSourceSchema.parse("invalid_source"));
});

test("FeedbackCategorySchema accepts valid categories", () => {
  const categories = ["success", "failure", "correction", "timeout", "partial"] as const;
  for (const category of categories) {
    assert.equal(FeedbackCategorySchema.parse(category), category);
  }
});

test("FeedbackCategorySchema rejects invalid category", () => {
  assert.throws(() => FeedbackCategorySchema.parse("invalid_category"));
});

test("FeedbackSeveritySchema accepts valid severities", () => {
  const severities = ["info", "warning", "error", "critical"] as const;
  for (const severity of severities) {
    assert.equal(FeedbackSeveritySchema.parse(severity), severity);
  }
});

test("FeedbackSeveritySchema rejects invalid severity", () => {
  assert.throws(() => FeedbackSeveritySchema.parse("invalid_severity"));
});

test("FeedbackSignalSchema parses valid signal", () => {
  const validSignal = {
    signalId: "sig_001",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_123",
    source: "execution",
    category: "success",
    severity: "info",
    payload: { summary: "Task completed successfully" },
    stepOutputRefs: ["step_1", "step_2"],
    timestamp: Date.now(),
    trustScore: {
      overallScore: 0.92,
      sourceCredibility: 0.9,
      historicalAccuracy: 0.95,
      attackSurface: 0.1,
    },
    evidenceRefs: ["evidence://step-1"],
  };

  const result = FeedbackSignalSchema.parse(validSignal);
  assert.equal(result.signalId, "sig_001");
  assert.equal(result.harnessRunId, "harness_123");
  assert.equal(result.nodeRunId, "node_123");
  assert.equal(result.taskId, "task_123");
  assert.equal(result.source, "execution");
  assert.equal(result.category, "success");
  assert.equal(result.severity, "info");
  assert.deepEqual(result.stepOutputRefs, ["step_1", "step_2"]);
  assert.deepEqual(result.evidenceRefs, ["evidence://step-1"]);
});

test("FeedbackSignalSchema applies defaults", () => {
  const minimalSignal = {
    signalId: "sig_min",
    harnessRunId: "harness_min",
    nodeRunId: "node_min",
    taskId: "task_min",
    source: "user",
    category: "failure",
    severity: "error",
    timestamp: 0,
    trustScore: {
      overallScore: 0.5,
      sourceCredibility: 0.5,
      historicalAccuracy: 0.5,
      attackSurface: 0.5,
    },
  };

  const result = FeedbackSignalSchema.parse(minimalSignal);
  assert.deepEqual(result.payload, {});
  assert.deepEqual(result.stepOutputRefs, []);
  assert.deepEqual(result.evidenceRefs, []);
});

test("FeedbackSignalSchema rejects invalid source", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_err",
      harnessRunId: "harness_err",
      nodeRunId: "node_err",
      taskId: "task_err",
      source: "invalid",
      category: "success",
      severity: "info",
      timestamp: 0,
      trustScore: {
        overallScore: 0.5,
        sourceCredibility: 0.5,
        historicalAccuracy: 0.5,
        attackSurface: 0.5,
      },
    });
  });
});

test("FeedbackSignalSchema rejects invalid category", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_err",
      harnessRunId: "harness_err",
      nodeRunId: "node_err",
      taskId: "task_err",
      source: "execution",
      category: "invalid_category",
      severity: "info",
      timestamp: 0,
      trustScore: {
        overallScore: 0.5,
        sourceCredibility: 0.5,
        historicalAccuracy: 0.5,
        attackSurface: 0.5,
      },
    });
  });
});

test("FeedbackSignalSchema rejects invalid severity", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_err",
      harnessRunId: "harness_err",
      nodeRunId: "node_err",
      taskId: "task_err",
      source: "execution",
      category: "success",
      severity: "invalid_severity",
      timestamp: 0,
      trustScore: {
        overallScore: 0.5,
        sourceCredibility: 0.5,
        historicalAccuracy: 0.5,
        attackSurface: 0.5,
      },
    });
  });
});

test("FeedbackSignalSchema rejects missing required fields", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_partial",
    });
  });
});

test("FeedbackSignalSchema rejects empty signalId", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "",
      harnessRunId: "harness_123",
      nodeRunId: "node_123",
      taskId: "task_123",
      source: "execution",
      category: "success",
      severity: "info",
      timestamp: 0,
      trustScore: {
        overallScore: 0.5,
        sourceCredibility: 0.5,
        historicalAccuracy: 0.5,
        attackSurface: 0.5,
      },
    });
  });
});

test("parseFeedbackSignal returns parsed FeedbackSignal", () => {
  const input = {
    signalId: "sig_parse_1",
    harnessRunId: "harness_parse",
    nodeRunId: "node_parse",
    taskId: "task_parse",
    source: "validation",
    category: "correction",
    severity: "warning",
    payload: {
      summary: "Output schema mismatch detected",
      expected: "number",
      actual: "string",
    },
    stepOutputRefs: ["step_validation_1"],
    timestamp: 9876543210,
    trustScore: {
      overallScore: 0.83,
      sourceCredibility: 0.8,
      historicalAccuracy: 0.9,
      attackSurface: 0.2,
    },
    evidenceRefs: ["evidence://validation-1"],
  };

  const result = parseFeedbackSignal(input);
  assert.equal(result.signalId, "sig_parse_1");
  assert.equal(result.harnessRunId, "harness_parse");
  assert.equal(result.nodeRunId, "node_parse");
  assert.equal(result.source, "validation");
  assert.equal(result.category, "correction");
  assert.equal(result.severity, "warning");
  assert.equal(result.payload.expected, "number");
  assert.equal(result.payload.actual, "string");
});

test("parseFeedbackSignal throws on invalid input", () => {
  assert.throws(() => {
    parseFeedbackSignal({
      signalId: "",
      harnessRunId: "",
      nodeRunId: "",
      taskId: "",
      source: "invalid",
      category: "invalid",
      severity: "invalid",
      timestamp: -1,
    });
  });
});

test("FeedbackSignalSchema handles complex payload", () => {
  const signalWithComplexPayload = {
    signalId: "sig_complex",
    harnessRunId: "harness_complex",
    nodeRunId: "node_complex",
    taskId: "task_complex",
    source: "execution",
    category: "failure",
    severity: "critical",
    payload: {
      errorCode: "TOOL_TIMEOUT",
      toolName: "bash",
      durationMs: 30000,
      thresholdMs: 10000,
      retryable: true,
      nestedData: {
        attempt: 1,
        maxAttempts: 3,
      },
    },
    stepOutputRefs: [],
    timestamp: 1234567890,
    trustScore: {
      overallScore: 0.97,
      sourceCredibility: 0.95,
      historicalAccuracy: 0.98,
      attackSurface: 0.05,
    },
    evidenceRefs: ["evidence://critical"],
  };

  const result = FeedbackSignalSchema.parse(signalWithComplexPayload);
  assert.equal(result.payload.errorCode, "TOOL_TIMEOUT");
  assert.equal(result.payload.retryable, true);
  // Zod's z.record(z.string(), z.unknown()) preserves nested objects
  const nestedData = (result.payload as Record<string, unknown>).nestedData as { attempt: number; maxAttempts: number };
  assert.equal(nestedData.attempt, 1);
  assert.equal(nestedData.maxAttempts, 3);
});

test("isTrustedFeedbackSignal rejects low-trust signals", () => {
  const signal = parseFeedbackSignal({
    signalId: "sig_low_trust",
    harnessRunId: "harness_low_trust",
    nodeRunId: "node_low_trust",
    source: "system",
    category: "partial",
    severity: "warning",
    timestamp: 1,
    trustScore: {
      overallScore: 0.2,
      sourceCredibility: 0.4,
      historicalAccuracy: 0.3,
      attackSurface: 0.8,
    },
  });

  assert.equal(isTrustedFeedbackSignal(signal), false);
});
