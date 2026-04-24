import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoldenTaskInventoryBaseline,
  SINGLE_TASK_GOLDEN_TASKS,
  REQUIRED_GOLDEN_TASK_CLASSES,
  GoldenTaskCase,
  GoldenTaskClass,
} from "../../../../src/platform/stability/golden-task-runner.js";

test("SINGLE_TASK_GOLDEN_TASKS contains expected number of cases", () => {
  assert.ok(SINGLE_TASK_GOLDEN_TASKS.length >= 7);
});

test("REQUIRED_GOLDEN_TASK_CLASSES contains all required task classes", () => {
  const expectedClasses: readonly string[] = [
    "coding",
    "research",
    "content",
    "data",
    "cross_division",
    "high_risk_approval",
    "crash_recovery",
  ];

  assert.deepEqual(REQUIRED_GOLDEN_TASK_CLASSES, expectedClasses);
});

test("SINGLE_TASK_GOLDEN_TASKS each have required fields", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(typeof task.id === "string");
    assert.ok(typeof task.title === "string");
    assert.ok(typeof task.request === "string");
    assert.ok(typeof task.metadata === "object");
    assert.ok(typeof task.expected === "object");
  }
});

test("SINGLE_TASK_GOLDEN_TASKS metadata has required fields", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(typeof task.metadata.expectedClass === "string");
    assert.ok(Array.isArray(task.metadata.successCriteria));
    assert.ok(typeof task.metadata.costCeilingUsd === "number");
    assert.ok(["interactive", "extended"].includes(task.metadata.latencyBand));
    assert.ok(["not_expected", "supervised_review_expected"].includes(task.metadata.approvalExpectation));
    assert.ok(["not_required", "requeue_supported", "manual_takeover_supported"].includes(task.metadata.recoveryExpectation));
  }
});

test("SINGLE_TASK_GOLDEN_TASKS expected has correct status values", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.equal(task.expected.taskStatus, "done");
    assert.equal(task.expected.workflowStatus, "completed");
    assert.equal(task.expected.executionStatus, "succeeded");
    assert.equal(task.expected.sessionStatus, "completed");
    assert.ok(Array.isArray(task.expected.eventTypes));
    assert.ok(typeof task.expected.stepOutputs === "number");
  }
});

test("SINGLE_TASK_GOLDEN_TASKS cover all required task classes", () => {
  const coveredClasses = SINGLE_TASK_GOLDEN_TASKS.map((t) => t.metadata.expectedClass);

  for (const requiredClass of REQUIRED_GOLDEN_TASK_CLASSES) {
    assert.ok(coveredClasses.includes(requiredClass), `Missing coverage for ${requiredClass}`);
  }
});

test("buildGoldenTaskInventoryBaseline returns correct structure", () => {
  const baseline = buildGoldenTaskInventoryBaseline(SINGLE_TASK_GOLDEN_TASKS);

  assert.ok(typeof baseline.inventoryVersion === "number");
  assert.ok(typeof baseline.totalCases === "number");
  assert.ok(Array.isArray(baseline.coveredClasses));
  assert.ok(Array.isArray(baseline.missingRequiredClasses));
  assert.ok(Array.isArray(baseline.cases));
});

test("buildGoldenTaskInventoryBaseline with no cases returns empty coverage", () => {
  const baseline = buildGoldenTaskInventoryBaseline([]);

  assert.equal(baseline.totalCases, 0);
  assert.equal(baseline.coveredClasses.length, 0);
  assert.deepEqual(baseline.missingRequiredClasses, Array.from(REQUIRED_GOLDEN_TASK_CLASSES));
});

test("buildGoldenTaskInventoryBaseline totalCases matches input length", () => {
  const baseline = buildGoldenTaskInventoryBaseline(SINGLE_TASK_GOLDEN_TASKS);

  assert.equal(baseline.totalCases, SINGLE_TASK_GOLDEN_TASKS.length);
});

test("buildGoldenTaskInventoryBaseline coveredClasses contains all covered classes", () => {
  const baseline = buildGoldenTaskInventoryBaseline(SINGLE_TASK_GOLDEN_TASKS);

  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(baseline.coveredClasses.includes(task.metadata.expectedClass));
  }
});

test("buildGoldenTaskInventoryBaseline missingRequiredClasses is empty when all covered", () => {
  const baseline = buildGoldenTaskInventoryBaseline(SINGLE_TASK_GOLDEN_TASKS);

  assert.equal(baseline.missingRequiredClasses.length, 0);
});

test("buildGoldenTaskInventoryBaseline cases have required fields", () => {
  const baseline = buildGoldenTaskInventoryBaseline(SINGLE_TASK_GOLDEN_TASKS);

  for (const goldenCase of baseline.cases) {
    assert.ok(typeof goldenCase.caseId === "string");
    assert.ok(typeof goldenCase.title === "string");
    assert.ok(typeof goldenCase.expectedClass === "string");
    assert.ok(Array.isArray(goldenCase.successCriteria));
    assert.ok(typeof goldenCase.costCeilingUsd === "number");
  }
});

test("SINGLE_TASK_GOLDEN_TASKS have unique IDs", () => {
  const ids = SINGLE_TASK_GOLDEN_TASKS.map((t) => t.id);
  const uniqueIds = new Set(ids);

  assert.equal(uniqueIds.size, ids.length);
});

test("SINGLE_TASK_GOLDEN_TASKS coding task has correct expectedClass", () => {
  const codingTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "coding_minimal_baseline");

  assert.ok(codingTask);
  assert.equal(codingTask.metadata.expectedClass, "coding");
});

test("SINGLE_TASK_GOLDEN_TASKS research task has correct expectedClass", () => {
  const researchTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "research_summary_minimal");

  assert.ok(researchTask);
  assert.equal(researchTask.metadata.expectedClass, "research");
});

test("SINGLE_TASK_GOLDEN_TASKS content task has correct expectedClass", () => {
  const contentTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "content_brief_minimal");

  assert.ok(contentTask);
  assert.equal(contentTask.metadata.expectedClass, "content");
});

test("SINGLE_TASK_GOLDEN_TASKS data task has correct expectedClass", () => {
  const dataTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "data_extract_minimal");

  assert.ok(dataTask);
  assert.equal(dataTask.metadata.expectedClass, "data");
});

test("SINGLE_TASK_GOLDEN_TASKS cross_division task has correct expectedClass", () => {
  const crossDivisionTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "cross_division_handoff_minimal");

  assert.ok(crossDivisionTask);
  assert.equal(crossDivisionTask.metadata.expectedClass, "cross_division");
});

test("SINGLE_TASK_GOLDEN_TASKS high_risk_approval task has correct expectedClass", () => {
  const highRiskTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "high_risk_approval_minimal");

  assert.ok(highRiskTask);
  assert.equal(highRiskTask.metadata.expectedClass, "high_risk_approval");
});

test("SINGLE_TASK_GOLDEN_TASKS crash_recovery task has correct expectedClass", () => {
  const crashRecoveryTask = SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "crash_recovery_minimal");

  assert.ok(crashRecoveryTask);
  assert.equal(crashRecoveryTask.metadata.expectedClass, "crash_recovery");
});

test("SINGLE_TASK_GOLDEN_TASKS interactive latency tasks have lower cost ceiling", () => {
  const interactiveTasks = SINGLE_TASK_GOLDEN_TASKS.filter(
    (t) => t.metadata.latencyBand === "interactive"
  );

  for (const task of interactiveTasks) {
    assert.ok(task.metadata.costCeilingUsd <= 0.05);
  }
});

test("GoldenTaskClass type accepts valid values", () => {
  const validClasses: GoldenTaskClass[] = [
    "coding",
    "research",
    "content",
    "data",
    "cross_division",
    "high_risk_approval",
    "crash_recovery",
  ];

  for (const cls of validClasses) {
    assert.ok(REQUIRED_GOLDEN_TASK_CLASSES.includes(cls));
  }
});

test("buildGoldenTaskInventoryBaseline with partial coverage identifies missing classes", () => {
  const partialCases: GoldenTaskCase[] = [
    SINGLE_TASK_GOLDEN_TASKS.find((t) => t.id === "coding_minimal_baseline")!,
  ];

  const baseline = buildGoldenTaskInventoryBaseline(partialCases);

  assert.equal(baseline.totalCases, 1);
  assert.ok(baseline.coveredClasses.includes("coding"));
  assert.ok(baseline.missingRequiredClasses.includes("research"));
  assert.ok(baseline.missingRequiredClasses.includes("content"));
  assert.ok(baseline.missingRequiredClasses.includes("data"));
});

test("SINGLE_TASK_GOLDEN_TASKS each have non-empty success criteria", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(task.metadata.successCriteria.length > 0);
    for (const criterion of task.metadata.successCriteria) {
      assert.ok(criterion.length > 0);
    }
  }
});

test("SINGLE_TASK_GOLDEN_TASKS event types array is non-empty", () => {
  for (const task of SINGLE_TASK_GOLDEN_TASKS) {
    assert.ok(task.expected.eventTypes.length > 0);
  }
});
