import test from "node:test";
import assert from "node:assert/strict";

import { analyzeFeedbackSignals } from "../../../../../src/scale-ecosystem/feedback-loop/analyzer/index.js";

test("analyzeFeedbackSignals returns empty summary for empty signals", () => {
  const result = analyzeFeedbackSignals([]);

  assert.equal(result.totalSignals, 0);
  assert.deepEqual(result.bySeverity, {});
  assert.deepEqual(result.topSubjects, []);
});

test("analyzeFeedbackSignals counts signals by severity", () => {
  const signals = [
    { signalId: "sig_1", taskId: "task_1", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 1 },
    { signalId: "sig_2", taskId: "task_1", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 2 },
    { signalId: "sig_3", taskId: "task_1", source: "user" as const, category: "correction" as const, severity: "warning" as const, payload: {}, stepOutputRefs: [], timestamp: 3 },
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.totalSignals, 3);
  assert.equal(result.bySeverity["error"], 2);
  assert.equal(result.bySeverity["warning"], 1);
});

test("analyzeFeedbackSignals identifies top subjects by task", () => {
  const signals = [
    { signalId: "sig_1", taskId: "task_a", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 1 },
    { signalId: "sig_2", taskId: "task_a", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 2 },
    { signalId: "sig_3", taskId: "task_a", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 3 },
    { signalId: "sig_4", taskId: "task_b", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 4 },
    { signalId: "sig_5", taskId: "task_b", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 5 },
    { signalId: "sig_6", taskId: "task_c", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 6 },
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.totalSignals, 6);
  assert.deepEqual(result.topSubjects, ["task:task_a", "task:task_b", "task:task_c"]);
});

test("analyzeFeedbackSignals limits top subjects to 3", () => {
  const signals = [
    { signalId: "sig_1", taskId: "task_1", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 1 },
    { signalId: "sig_2", taskId: "task_2", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 2 },
    { signalId: "sig_3", taskId: "task_3", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 3 },
    { signalId: "sig_4", taskId: "task_4", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 4 },
    { signalId: "sig_5", taskId: "task_5", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 5 },
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.topSubjects.length, 3);
  assert.deepEqual(result.topSubjects, ["task:task_1", "task:task_2", "task:task_3"]);
});

test("analyzeFeedbackSignals handles signals with different categories", () => {
  const signals = [
    { signalId: "sig_1", taskId: "task_1", source: "execution" as const, category: "success" as const, severity: "info" as const, payload: {}, stepOutputRefs: [], timestamp: 1 },
    { signalId: "sig_2", taskId: "task_1", source: "execution" as const, category: "failure" as const, severity: "error" as const, payload: {}, stepOutputRefs: [], timestamp: 2 },
    { signalId: "sig_3", taskId: "task_1", source: "user" as const, category: "correction" as const, severity: "warning" as const, payload: {}, stepOutputRefs: [], timestamp: 3 },
    { signalId: "sig_4", taskId: "task_1", source: "execution" as const, category: "timeout" as const, severity: "critical" as const, payload: {}, stepOutputRefs: [], timestamp: 4 },
    { signalId: "sig_5", taskId: "task_1", source: "execution" as const, category: "partial" as const, severity: "warning" as const, payload: {}, stepOutputRefs: [], timestamp: 5 },
  ];

  const result = analyzeFeedbackSignals(signals);

  assert.equal(result.totalSignals, 5);
  assert.equal(result.bySeverity["info"], 1);
  assert.equal(result.bySeverity["error"], 1);
  assert.equal(result.bySeverity["warning"], 2);
  assert.equal(result.bySeverity["critical"], 1);
});
