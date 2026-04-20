import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoldenTaskInventoryBaseline,
  SINGLE_TASK_GOLDEN_TASKS,
  REQUIRED_GOLDEN_TASK_CLASSES,
  type GoldenTaskCase,
} from "../../../../../src/platform/shared/stability/golden-task-runner.js";

test("buildGoldenTaskInventoryBaseline with default cases covers all required classes", () => {
  const baseline = buildGoldenTaskInventoryBaseline();

  assert.equal(baseline.inventoryVersion, 1);
  assert.equal(baseline.totalCases, SINGLE_TASK_GOLDEN_TASKS.length);
  assert.equal(baseline.coveredClasses.length, REQUIRED_GOLDEN_TASK_CLASSES.length);
  assert.deepEqual(baseline.missingRequiredClasses, []);
});

test("buildGoldenTaskInventoryBaseline detects missing required classes", () => {
  // Create a subset of cases that only covers some classes
  const partialCases: readonly GoldenTaskCase[] = [
    {
      id: "coding_partial",
      title: "Partial coding case",
      request: "Do coding",
      metadata: {
        expectedClass: "coding",
        successCriteria: [],
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
        eventTypes: [],
        stepOutputs: 1,
      },
    },
  ];

  const baseline = buildGoldenTaskInventoryBaseline(partialCases);

  assert.equal(baseline.totalCases, 1);
  assert.deepEqual(baseline.coveredClasses, ["coding"]);
  assert.deepEqual(baseline.missingRequiredClasses, REQUIRED_GOLDEN_TASK_CLASSES.filter((c) => c !== "coding"));
});

test("buildGoldenTaskInventoryBaseline with empty cases has all missing classes", () => {
  const baseline = buildGoldenTaskInventoryBaseline([]);

  assert.equal(baseline.totalCases, 0);
  assert.deepEqual(baseline.coveredClasses, []);
  assert.deepEqual(baseline.missingRequiredClasses, [...REQUIRED_GOLDEN_TASK_CLASSES]);
});

test("buildGoldenTaskInventoryBaseline case summaries preserve expectedClass", () => {
  const baseline = buildGoldenTaskInventoryBaseline();

  for (const testCase of baseline.cases) {
    assert.ok(
      REQUIRED_GOLDEN_TASK_CLASSES.includes(testCase.expectedClass),
      `Case ${testCase.caseId} has valid expectedClass: ${testCase.expectedClass}`,
    );
  }
});

test("buildGoldenTaskInventoryBaseline case summaries preserve success criteria", () => {
  const baseline = buildGoldenTaskInventoryBaseline();

  for (const testCase of baseline.cases) {
    assert.ok(Array.isArray(testCase.successCriteria));
    assert.ok(testCase.successCriteria.length > 0);
  }
});

test("buildGoldenTaskInventoryBaseline case summaries preserve latency band", () => {
  const baseline = buildGoldenTaskInventoryBaseline();

  for (const testCase of baseline.cases) {
    assert.ok(
      testCase.latencyBand === "interactive" || testCase.latencyBand === "extended",
      `Case ${testCase.caseId} has valid latencyBand: ${testCase.latencyBand}`,
    );
  }
});

test("buildGoldenTaskInventoryBaseline case summaries preserve cost ceiling", () => {
  const baseline = buildGoldenTaskInventoryBaseline();

  for (const testCase of baseline.cases) {
    assert.ok(typeof testCase.costCeilingUsd === "number");
    assert.ok(testCase.costCeilingUsd > 0);
  }
});

test("SINGLE_TASK_GOLDEN_TASKS has one case per required class", () => {
  const classCounts = new Map<string, number>();

  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    const expectedClass = task.metadata.expectedClass;
    classCounts.set(expectedClass, (classCounts.get(expectedClass) ?? 0) + 1);
  }

  for (const requiredClass of REQUIRED_GOLDEN_TASK_CLASSES) {
    assert.ok(
      classCounts.has(requiredClass) && classCounts.get(requiredClass) === 1,
      `Required class ${requiredClass} should have exactly one case`,
    );
  }
});

test("SINGLE_TASK_GOLDEN_TASKS all have expected outcome of done/completed/succeeded", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.equal(task.expected.taskStatus, "done");
    assert.equal(task.expected.workflowStatus, "completed");
    assert.equal(task.expected.executionStatus, "succeeded");
    assert.equal(task.expected.sessionStatus, "completed");
  }
});

test("SINGLE_TASK_GOLDEN_TASKS coding class uses interactive latency", () => {
  const codingCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "coding",
  );
  assert.ok(codingCases.length === 1);
  assert.equal(codingCases[0]!.metadata.latencyBand, "interactive");
});

test("SINGLE_TASK_GOLDEN_TASKS crash_recovery class uses extended latency", () => {
  const crashRecoveryCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "crash_recovery",
  );
  assert.ok(crashRecoveryCases.length === 1);
  assert.equal(crashRecoveryCases[0]!.metadata.latencyBand, "extended");
});

test("SINGLE_TASK_GOLDEN_TASKS crash_recovery class has requeue_supported recovery expectation", () => {
  const crashRecoveryCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "crash_recovery",
  );
  assert.equal(crashRecoveryCases[0]!.metadata.recoveryExpectation, "requeue_supported");
});

test("SINGLE_TASK_GOLDEN_TASKS high_risk_approval class has supervised_review_expected", () => {
  const highRiskCases = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.expectedClass === "high_risk_approval",
  );
  assert.equal(highRiskCases[0]!.metadata.approvalExpectation, "supervised_review_expected");
});
