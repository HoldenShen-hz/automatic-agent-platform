import assert from "node:assert/strict";
import test from "node:test";

import {
  parseFeedbackSignal,
  FeedbackSignalSchema,
} from "../../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";

test("parseFeedbackSignal parses valid signal", () => {
  const valid = {
    signalId: "sig_123",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1000,
    trustScore: {
      overallScore: 0.91,
      sourceCredibility: 0.9,
      historicalAccuracy: 0.93,
      attackSurface: 0.1,
    },
    evidenceRefs: ["evidence://123"],
  };

  const result = parseFeedbackSignal(valid);
  assert.equal(result.signalId, "sig_123");
  assert.equal(result.harnessRunId, "harness_123");
  assert.equal(result.nodeRunId, "node_123");
  assert.equal(result.taskId, "task_456");
  assert.equal(result.source, "execution");
  assert.equal(result.category, "success");
});

test("parseFeedbackSignal applies defaults", () => {
  const minimal = {
    signalId: "sig_123",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_456",
    source: "user",
    category: "failure",
    severity: "error",
    timestamp: 2000,
    trustScore: {
      overallScore: 0.6,
      sourceCredibility: 0.6,
      historicalAccuracy: 0.6,
      attackSurface: 0.3,
    },
  };

  const result = parseFeedbackSignal(minimal);
  assert.deepEqual(result.payload, {});
  assert.deepEqual(result.stepOutputRefs, []);
  assert.deepEqual(result.evidenceRefs, []);
});

test("parseFeedbackSignal rejects empty signalId", () => {
  const invalid = {
    signalId: "",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1000,
    trustScore: {
      overallScore: 0.6,
      sourceCredibility: 0.6,
      historicalAccuracy: 0.6,
      attackSurface: 0.3,
    },
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("parseFeedbackSignal rejects empty taskId", () => {
  const invalid = {
    signalId: "sig_123",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1000,
    trustScore: {
      overallScore: 0.6,
      sourceCredibility: 0.6,
      historicalAccuracy: 0.6,
      attackSurface: 0.3,
    },
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("parseFeedbackSignal accepts all valid sources", () => {
  const sources = ["execution", "user", "hitl", "validation", "system"] as const;
  for (const source of sources) {
    const signal = {
      signalId: "sig_123",
      harnessRunId: "harness_123",
      nodeRunId: "node_123",
      taskId: "task_456",
      source,
      category: "success",
      severity: "info",
      timestamp: 1000,
      trustScore: {
        overallScore: 0.6,
        sourceCredibility: 0.6,
        historicalAccuracy: 0.6,
        attackSurface: 0.3,
      },
    };
    const result = parseFeedbackSignal(signal);
    assert.equal(result.source, source);
  }
});

test("parseFeedbackSignal accepts all valid categories", () => {
  const categories = ["success", "failure", "correction", "timeout", "partial"] as const;
  for (const category of categories) {
    const signal = {
      signalId: "sig_123",
      harnessRunId: "harness_123",
      nodeRunId: "node_123",
      taskId: "task_456",
      source: "execution",
      category,
      severity: "info",
      timestamp: 1000,
      trustScore: {
        overallScore: 0.6,
        sourceCredibility: 0.6,
        historicalAccuracy: 0.6,
        attackSurface: 0.3,
      },
    };
    const result = parseFeedbackSignal(signal);
    assert.equal(result.category, category);
  }
});

test("parseFeedbackSignal accepts all valid severities", () => {
  const severities = ["info", "warning", "error", "critical"] as const;
  for (const severity of severities) {
    const signal = {
      signalId: "sig_123",
      harnessRunId: "harness_123",
      nodeRunId: "node_123",
      taskId: "task_456",
      source: "execution",
      category: "failure",
      severity,
      timestamp: 1000,
      trustScore: {
        overallScore: 0.6,
        sourceCredibility: 0.6,
        historicalAccuracy: 0.6,
        attackSurface: 0.3,
      },
    };
    const result = parseFeedbackSignal(signal);
    assert.equal(result.severity, severity);
  }
});

test("parseFeedbackSignal rejects invalid source", () => {
  const invalid = {
    signalId: "sig_123",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_456",
    source: "invalid_source",
    category: "success",
    severity: "info",
    timestamp: 1000,
    trustScore: {
      overallScore: 0.6,
      sourceCredibility: 0.6,
      historicalAccuracy: 0.6,
      attackSurface: 0.3,
    },
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("parseFeedbackSignal rejects negative timestamp", () => {
  const invalid = {
    signalId: "sig_123",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: -1,
    trustScore: {
      overallScore: 0.6,
      sourceCredibility: 0.6,
      historicalAccuracy: 0.6,
      attackSurface: 0.3,
    },
  };

  assert.throws(() => parseFeedbackSignal(invalid));
});

test("FeedbackSignalSchema rejects non-integer timestamp", () => {
  const signal = {
    signalId: "sig_123",
    harnessRunId: "harness_123",
    nodeRunId: "node_123",
    taskId: "task_456",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1.5,
    payload: {},
    stepOutputRefs: [],
    trustScore: {
      overallScore: 0.6,
      sourceCredibility: 0.6,
      historicalAccuracy: 0.6,
      attackSurface: 0.3,
    },
  };

  assert.throws(() => FeedbackSignalSchema.parse(signal));
});
