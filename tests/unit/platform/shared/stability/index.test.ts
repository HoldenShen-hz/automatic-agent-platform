import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  REQUIRED_GOLDEN_TASK_CLASSES,
  SINGLE_TASK_GOLDEN_TASKS,
  type GoldenTaskClass,
  type GoldenTaskLatencyBand,
  type GoldenTaskApprovalExpectation,
  type GoldenTaskRecoveryExpectation,
  type GoldenTaskCase,
} from "../../../../../src/platform/shared/stability/index.js";

test("REQUIRED_GOLDEN_TASK_CLASSES is an array of task classes", () => {
  assert.ok(Array.isArray(REQUIRED_GOLDEN_TASK_CLASSES));
  assert.equal(REQUIRED_GOLDEN_TASK_CLASSES.length, 7);
  assert.equal(REQUIRED_GOLDEN_TASK_CLASSES[0], "coding");
});

test("GoldenTaskClass type accepts valid values from REQUIRED_GOLDEN_TASK_CLASSES", () => {
  const validClasses: GoldenTaskClass[] = [
    "coding",
    "research",
    "content",
    "data",
    "cross_division",
    "high_risk_approval",
    "crash_recovery",
  ];
  assert.equal(validClasses.length, 7);
});

test("GoldenTaskLatencyBand type accepts valid values", () => {
  const bands: GoldenTaskLatencyBand[] = ["interactive", "extended"];
  assert.equal(bands.length, 2);
});

test("GoldenTaskApprovalExpectation type accepts valid values", () => {
  const expectations: GoldenTaskApprovalExpectation[] = [
    "not_expected",
    "supervised_review_expected",
  ];
  assert.equal(expectations.length, 2);
});

test("GoldenTaskRecoveryExpectation type accepts valid values", () => {
  const expectations: GoldenTaskRecoveryExpectation[] = [
    "not_required",
    "requeue_supported",
    "manual_takeover_supported",
  ];
  assert.equal(expectations.length, 3);
});

test("SINGLE_TASK_GOLDEN_TASKS is a non-empty array", () => {
  assert.ok(Array.isArray(SINGLE_TASK_GOLDEN_TASKS));
  assert.ok(SINGLE_TASK_GOLDEN_TASKS.length > 0);
});

test("GoldenTaskCase structure is correct", () => {
  const taskCase: GoldenTaskCase = {
    id: "test_case",
    title: "Test case",
    request: "Do something",
    metadata: {
      expectedClass: "coding",
      successCriteria: ["compiles", "tests pass"],
      costCeilingUsd: 1.00,
      latencyBand: "interactive",
      approvalExpectation: "not_expected",
      recoveryExpectation: "not_required",
    },
    expected: {
      taskStatus: "done",
      workflowStatus: "completed",
      executionStatus: "succeeded",
      sessionStatus: "completed",
      eventTypes: ["task_created", "task_completed"],
      stepOutputs: 1,
    },
  };
  assert.equal(taskCase.id, "test_case");
  assert.equal(taskCase.title, "Test case");
  assert.equal(taskCase.metadata.expectedClass, "coding");
  assert.equal(taskCase.metadata.costCeilingUsd, 1.00);
  assert.equal(taskCase.expected.taskStatus, "done");
});
