import test from "node:test";
import assert from "node:assert/strict";

import { analyzeFeedbackSignals } from "../../../../../src/scale-ecosystem/feedback-loop/analyzer/index.js";
import {
  deriveFeedbackTrustScore,
  parseFeedbackSignal,
  type FeedbackSignal,
  type FeedbackTrustFactors,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

const defaultTrustFactors: FeedbackTrustFactors = {
  sourceReliability: 0.9,
  historicalAccuracy: 0.9,
  authenticatedSource: true,
  attackSurfaceExposure: 0.1,
  holdoutOverlap: 0,
};

function createSignal(overrides: Partial<FeedbackSignal>): FeedbackSignal {
  const trustFactors = overrides.trustFactors ?? defaultTrustFactors;
  return parseFeedbackSignal({
    signalId: "sig-default",
    taskId: "task-default",
    source: "execution",
    category: "failure",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1,
    trustFactors,
    feedbackTrustScore: overrides.feedbackTrustScore ?? deriveFeedbackTrustScore(trustFactors),
    ...overrides,
  });
}

test("analyzeFeedbackSignals returns empty summary for empty signals", () => {
  const result = analyzeFeedbackSignals([]);

  assert.equal(result.totalSignals, 0);
  assert.deepEqual(result.bySeverity, {});
  assert.deepEqual(result.topSubjects, []);
});

test("analyzeFeedbackSignals counts signals by severity", () => {
  const signals = [
    createSignal({ signalId: "sig_1", taskId: "task_1" }),
    createSignal({ signalId: "sig_2", taskId: "task_1", timestamp: 2 }),
    createSignal({ signalId: "sig_3", taskId: "task_1", source: "user", category: "correction", severity: "warning", timestamp: 3 }),
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.totalSignals, 3);
  assert.equal(result.bySeverity["error"], 2);
  assert.equal(result.bySeverity["warning"], 1);
});

test("analyzeFeedbackSignals identifies top subjects by task", () => {
  const signals = [
    createSignal({ signalId: "sig_1", taskId: "task_a" }),
    createSignal({ signalId: "sig_2", taskId: "task_a", timestamp: 2 }),
    createSignal({ signalId: "sig_3", taskId: "task_a", timestamp: 3 }),
    createSignal({ signalId: "sig_4", taskId: "task_b", timestamp: 4 }),
    createSignal({ signalId: "sig_5", taskId: "task_b", timestamp: 5 }),
    createSignal({ signalId: "sig_6", taskId: "task_c", timestamp: 6 }),
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.totalSignals, 6);
  assert.deepEqual(result.topSubjects, ["task:task_a", "task:task_b", "task:task_c"]);
});

test("analyzeFeedbackSignals limits top subjects to 3", () => {
  const signals = [
    createSignal({ signalId: "sig_1", taskId: "task_1" }),
    createSignal({ signalId: "sig_2", taskId: "task_2", timestamp: 2 }),
    createSignal({ signalId: "sig_3", taskId: "task_3", timestamp: 3 }),
    createSignal({ signalId: "sig_4", taskId: "task_4", timestamp: 4 }),
    createSignal({ signalId: "sig_5", taskId: "task_5", timestamp: 5 }),
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.topSubjects.length, 3);
  assert.deepEqual(result.topSubjects, ["task:task_1", "task:task_2", "task:task_3"]);
});

test("analyzeFeedbackSignals handles signals with different categories", () => {
  const signals = [
    createSignal({ signalId: "sig_1", taskId: "task_1", category: "success", severity: "info" }),
    createSignal({ signalId: "sig_2", taskId: "task_1", timestamp: 2 }),
    createSignal({ signalId: "sig_3", taskId: "task_1", source: "user", category: "correction", severity: "warning", timestamp: 3 }),
    createSignal({ signalId: "sig_4", taskId: "task_1", category: "timeout", severity: "critical", timestamp: 4 }),
    createSignal({ signalId: "sig_5", taskId: "task_1", category: "partial", severity: "warning", timestamp: 5 }),
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.totalSignals, 5);
  assert.equal(result.bySeverity["info"], 1);
  assert.equal(result.bySeverity["error"], 1);
  assert.equal(result.bySeverity["warning"], 2);
  assert.equal(result.bySeverity["critical"], 1);
});
