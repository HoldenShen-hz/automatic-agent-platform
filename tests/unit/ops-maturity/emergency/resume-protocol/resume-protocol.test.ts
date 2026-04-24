import assert from "node:assert/strict";
import test from "node:test";

import {
  canResumeFromPanic,
  type ResumePlan,
} from "../../../../../src/ops-maturity/emergency/resume-protocol/index.js";

test("canResumeFromPanic returns true with valid plan and array approvers", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});

test("canResumeFromPanic returns false with single string approver", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: "single-operator",
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when checkpointsVerified is false", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: false,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when forensicSnapshotReviewed is undefined", () => {
  const plan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when rollbackPlanReady is undefined", () => {
  const plan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    validationRunPassed: true,
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when validationRunPassed is undefined", () => {
  const plan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false with empty approver array", () => {
  const plan = {
    scope: "platform",
    approvedBy: [] as unknown as ResumePlan["approvedBy"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan as ResumePlan), false);
});

test("canResumeFromPanic returns false with single approver in array", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["only-one"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when approver is whitespace only", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["   ", "valid-op"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns true with three approvers", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2", "op-3"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});

test("canResumeFromPanic returns false with string approver even if long", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: "super-duper-admin-operator-with-long-name",
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when string approver is whitespace", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: "       ",
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when all optional flags are false", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: false,
    rollbackPlanReady: false,
    validationRunPassed: false,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic handles mixed empty and valid approvers", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["", "valid-op"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic works with two valid approvers", () => {
  const plan: ResumePlan = {
    scope: "division-a",
    approvedBy: ["admin-1", "admin-2"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});

test("ResumePlan scope can be any string", () => {
  const plan: ResumePlan = {
    scope: "any/scope/hierarchy",
    approvedBy: ["op-1", "op-2"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});

test("ResumePlan approvedBy accepts readonly array", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["a", "b"] as const,
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});

test("canResumeFromPanic returns true with minimum two non-empty approvers", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["a", "b"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});

test("canResumeFromPanic filters out empty strings from count", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["", ""],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic works with readonly tuple approvers", () => {
  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["first", "second"] as readonly ["first", "second"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  assert.equal(canResumeFromPanic(plan), true);
});