import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFeedbackSignals, type FeedbackAnalysisSummary } from "../../../../../src/scale-ecosystem/feedback-loop/analyzer/index.js";
import type { FeedbackSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: "sig-1",
    taskId: "task-1",
    source: "agent",
    category: "failure",
    severity: "high",
    timestamp: Date.now(),
    stepOutputRefs: [],
    payload: {
      reasonCode: "timeout",
      summary: "Task timed out",
    },
    ...overrides,
  };
}

test("analyzeFeedbackSignals counts signals by severity", () => {
  const signals: FeedbackSignal[] = [
    makeSignal({ severity: "high", signalId: "s1" }),
    makeSignal({ severity: "high", signalId: "s2" }),
    makeSignal({ severity: "medium", signalId: "s3" }),
  ];

  const summary = analyzeFeedbackSignals(signals);

  assert.equal(summary.totalSignals, 3);
  assert.equal(summary.bySeverity["high"], 2);
  assert.equal(summary.bySeverity["medium"], 1);
});

test("analyzeFeedbackSignals identifies top subjects by task", () => {
  const signals: FeedbackSignal[] = [
    makeSignal({ taskId: "task-a", signalId: "s1" }),
    makeSignal({ taskId: "task-a", signalId: "s2" }),
    makeSignal({ taskId: "task-b", signalId: "s3" }),
  ];

  const summary = analyzeFeedbackSignals(signals);

  assert.equal(summary.totalSignals, 3);
  assert.deepEqual(summary.topSubjects, ["task:task-a", "task:task-b"]);
});

test("analyzeFeedbackSignals handles empty array", () => {
  const summary = analyzeFeedbackSignals([]);

  assert.equal(summary.totalSignals, 0);
  assert.deepEqual(summary.bySeverity, {});
  assert.deepEqual(summary.topSubjects, []);
});

test("analyzeFeedbackSignals limits top subjects to 3", () => {
  const signals: FeedbackSignal[] = [
    makeSignal({ taskId: "task-1", signalId: "s1" }),
    makeSignal({ taskId: "task-2", signalId: "s2" }),
    makeSignal({ taskId: "task-3", signalId: "s3" }),
    makeSignal({ taskId: "task-4", signalId: "s4" }),
    makeSignal({ taskId: "task-5", signalId: "s5" }),
  ];

  const summary = analyzeFeedbackSignals(signals);

  assert.ok(summary.topSubjects.length <= 3);
});

test("analyzeFeedbackSignals handles multiple signals for same task", () => {
  const signals: FeedbackSignal[] = [
    makeSignal({ taskId: "task-x", signalId: "s1" }),
    makeSignal({ taskId: "task-x", signalId: "s2" }),
    makeSignal({ taskId: "task-x", signalId: "s3" }),
    makeSignal({ taskId: "task-y", signalId: "s4" }),
  ];

  const summary = analyzeFeedbackSignals(signals);

  assert.equal(summary.topSubjects[0], "task:task-x");
});