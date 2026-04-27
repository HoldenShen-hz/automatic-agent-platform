/**
 * Additional unit tests for Golden Task Runner.
 *
 * Tests the helper functions and type validation for golden task inventory
 * and execution.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoldenTaskInventoryBaseline,
  REQUIRED_GOLDEN_TASK_CLASSES,
  SINGLE_TASK_GOLDEN_TASKS,
  type GoldenTaskCase,
  type GoldenTaskRunResult,
  type GoldenTaskInventoryCaseSummary,
  type GoldenTaskClass,
} from "../../../../../src/platform/shared/stability/golden-task-runner.js";

test("REQUIRED_GOLDEN_TASK_CLASSES has 7 required classes", () => {
  assert.equal(REQUIRED_GOLDEN_TASK_CLASSES.length, 7);
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("coding"));
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("research"));
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("content"));
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("data"));
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("cross_division"));
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("high_risk_approval"));
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes("crash_recovery"));
});

test("SINGLE_TASK_GOLDEN_TASKS has exactly one case per required class", () => {
  const classCount = new Map<GoldenTaskClass, number>();
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    const cls = task.metadata.expectedClass;
    classCount.set(cls, (classCount.get(cls) ?? 0) + 1);
  }
  for (const cls of REQUIRED_GOLDEN_TASK_CLASSES) {
    assert.equal(
      classCount.get(cls) ?? 0,
      1,
      `Expected exactly one task for class ${cls}`,
    );
  }
});

test("SINGLE_TASK_GOLDEN_TASKS all have deterministic expected outcomes", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.equal(task.expected.taskStatus, "done");
    assert.equal(task.expected.workflowStatus, "completed");
    assert.equal(task.expected.executionStatus, "succeeded");
    assert.equal(task.expected.sessionStatus, "completed");
    assert.ok(task.expected.stepOutputs >= 1);
    assert.ok(Array.isArray(task.expected.eventTypes));
  }
});

test("SINGLE_TASK_GOLDEN_TASKS have unique ids", () => {
  const ids = new Set(SINGLE_TASK_GOLDEN_TASKS.map((t) => t.id));
  assert.equal(ids.size, SINGLE_TASK_GOLDEN_TASKS.length);
});

test("GoldenTaskCase structure validation", () => {
  const case_: GoldenTaskCase = {
    id: "test_case",
    title: "Test case",
    request: "Test request",
    metadata: {
      expectedClass: "coding",
      successCriteria: ["test passes"],
      costCeilingUsd: 0.01,
      latencyBand: "interactive",
      approvalExpectation: "not_expected",
      recoveryExpectation: "not_required",
    },
    expected: {
      taskStatus: "done",
      workflowStatus: "completed",
      executionStatus: "succeeded",
      sessionStatus: "completed",
      eventTypes: ["task:status_changed"],
      stepOutputs: 1,
    },
  };

  assert.equal(case_.id, "test_case");
  assert.equal(case_.metadata.expectedClass, "coding");
  assert.equal(case_.metadata.costCeilingUsd, 0.01);
  assert.equal(case_.metadata.latencyBand, "interactive");
});

test("GoldenTaskRunResult structure validation", () => {
  const result: GoldenTaskRunResult = {
    caseId: "test_case",
    dbPath: "/tmp/test.db",
    passed: true,
    actual: {
      taskStatus: "done",
      workflowStatus: "completed",
      executionStatus: "succeeded",
      sessionStatus: "completed",
      eventTypes: ["task:status_changed"],
      stepOutputs: 1,
    },
  };

  assert.equal(result.caseId, "test_case");
  assert.equal(result.passed, true);
  assert.equal(result.actual.taskStatus, "done");
});

test("GoldenTaskRunResult can represent failed run", () => {
  const result: GoldenTaskRunResult = {
    caseId: "test_case",
    dbPath: "/tmp/test.db",
    passed: false,
    actual: {
      taskStatus: "failed",
      workflowStatus: null,
      executionStatus: null,
      sessionStatus: null,
      eventTypes: [],
      stepOutputs: 0,
    },
  };

  assert.equal(result.passed, false);
  assert.equal(result.actual.taskStatus, "failed");
});

test("buildGoldenTaskInventoryBaseline with custom cases works", () => {
  const customCase: GoldenTaskCase = {
    id: "custom_case",
    title: "Custom case",
    request: "Custom request",
    metadata: {
      expectedClass: "coding",
      successCriteria: ["custom passes"],
      costCeilingUsd: 0.02,
      latencyBand: "interactive",
      approvalExpectation: "not_expected",
      recoveryExpectation: "not_required",
    },
    expected: {
      taskStatus: "done",
      workflowStatus: "completed",
      executionStatus: "succeeded",
      sessionStatus: "completed",
      eventTypes: [],
      stepOutputs: 1,
    },
  };

  const baseline = buildGoldenTaskInventoryBaseline([customCase]);

  assert.equal(baseline.inventoryVersion, 1);
  assert.equal(baseline.totalCases, 1);
  assert.deepEqual(baseline.coveredClasses, ["coding"]);
  assert.deepEqual(baseline.missingRequiredClasses, REQUIRED_GOLDEN_TASK_CLASSES.filter((c) => c !== "coding"));
  assert.equal(baseline.cases.length, 1);
  assert.equal(baseline.cases[0]?.caseId, "custom_case");
});

test("buildGoldenTaskInventoryBaseline missing classes are correctly identified", () => {
  const baseline = buildGoldenTaskInventoryBaseline([]);
  assert.deepEqual(baseline.missingRequiredClasses, [...REQUIRED_GOLDEN_TASK_CLASSES]);
  assert.deepEqual(baseline.coveredClasses, []);
});

test("buildGoldenTaskInventoryBaseline case summaries preserve all fields", () => {
  const baseline = buildGoldenTaskInventoryBaseline();

  for (const summary of baseline.cases) {
    assert.ok(summary.caseId.length > 0);
    assert.ok(summary.title.length > 0);
    assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes(summary.expectedClass));
    assert.ok(Array.isArray(summary.successCriteria));
    assert.ok(summary.costCeilingUsd > 0);
    assert.ok(summary.latencyBand === "interactive" || summary.latencyBand === "extended");
    assert.ok(summary.approvalExpectation === "not_expected" || summary.approvalExpectation === "supervised_review_expected");
    assert.ok(summary.recoveryExpectation === "not_required" || summary.recoveryExpectation === "requeue_supported" || summary.recoveryExpectation === "manual_takeover_supported");
  }
});

test("GoldenTaskCase approvalExpectation values are valid", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(
      task.metadata.approvalExpectation === "not_expected"
      || task.metadata.approvalExpectation === "supervised_review_expected",
    );
  }
});

test("GoldenTaskCase recoveryExpectation values are valid", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(
      task.metadata.recoveryExpectation === "not_required"
      || task.metadata.recoveryExpectation === "requeue_supported"
      || task.metadata.recoveryExpectation === "manual_takeover_supported",
    );
  }
});

test("GoldenTaskCase high_risk_approval has supervised_review_expected", () => {
  const highRiskCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "high_risk_approval",
  );
  assert.equal(highRiskCases.length, 1);
  assert.equal(highRiskCases[0]!.metadata.approvalExpectation, "supervised_review_expected");
});

test("GoldenTaskCase crash_recovery has requeue_supported", () => {
  const crashCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "crash_recovery",
  );
  assert.equal(crashCases.length, 1);
  assert.equal(crashCases[0]!.metadata.recoveryExpectation, "requeue_supported");
  assert.equal(crashCases[0]!.metadata.latencyBand, "extended");
});

test("GoldenTaskCase cross_division has manual_takeover_supported", () => {
  const crossCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "cross_division",
  );
  assert.equal(crossCases.length, 1);
  assert.equal(crossCases[0]!.metadata.recoveryExpectation, "manual_takeover_supported");
});

test("GoldenTaskCase cost ceiling is reasonable for all cases", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(task.metadata.costCeilingUsd <= 0.10, `Cost ceiling too high for ${task.id}`);
    assert.ok(task.metadata.costCeilingUsd > 0, `Cost ceiling must be positive for ${task.id}`);
  }
});

test("GoldenTaskCase eventTypes are non-empty for default expected outcome", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(task.expected.eventTypes.length > 0, `eventTypes should not be empty for ${task.id}`);
  }
});

test("GoldenTaskInventoryCaseSummary can be constructed from case", () => {
  const summary: GoldenTaskInventoryCaseSummary = {
    caseId: "test",
    title: "Test",
    expectedClass: "coding",
    successCriteria: ["test"],
    costCeilingUsd: 0.01,
    latencyBand: "interactive",
    approvalExpectation: "not_expected",
    recoveryExpectation: "not_required",
  };

  assert.equal(summary.expectedClass, "coding");
  assert.equal(summary.costCeilingUsd, 0.01);
});

test("Baseline with all classes covered has no missing classes", () => {
  const allCases = SINGLE_TASK_GOLDEN_TASKS;
  const baseline = buildGoldenTaskInventoryBaseline(allCases);

  assert.equal(baseline.missingRequiredClasses.length, 0);
  assert.equal(baseline.coveredClasses.length, REQUIRED_GOLDEN_TASK_CLASSES.length);
});

test("GoldenTaskClass type can be used in type narrowing", () => {
  const cls: GoldenTaskClass = "coding";
  assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes(cls));

  const invalidCls = "invalid" as GoldenTaskClass;
  // This should fail type check but we're just validating the type exists
  assert.ok(typeof invalidCls === "string");
});