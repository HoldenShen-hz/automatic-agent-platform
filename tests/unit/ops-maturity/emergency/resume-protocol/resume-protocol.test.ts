import assert from "node:assert/strict";
import test from "node:test";

import {
  canResumeFromPanic,
  type ResumePlan,
} from "../../../../../src/ops-maturity/emergency/resume-protocol/index.js";

function createValidPlan(overrides: Partial<ResumePlan> = {}): ResumePlan {
  return {
    scope: overrides.scope ?? "platform",
    approvedBy: overrides.approvedBy ?? ["op-1", "op-2"],
    approvedRoles: overrides.approvedRoles ?? ["platform_admin", "security_team"],
    checkpointsVerified: overrides.checkpointsVerified ?? true,
    forensicSnapshotReviewed: overrides.forensicSnapshotReviewed ?? true,
    rollbackPlanReady: overrides.rollbackPlanReady ?? true,
    validationRunPassed: overrides.validationRunPassed ?? true,
  };
}

test("canResumeFromPanic returns true with valid plan and array approvers", () => {
  assert.equal(canResumeFromPanic(createValidPlan()), true);
});

test("canResumeFromPanic returns false with single string approver", () => {
  const plan = {
    ...createValidPlan(),
    approvedBy: "single-operator",
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when checkpointsVerified is false", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ checkpointsVerified: false })), false);
});

test("canResumeFromPanic returns false when forensicSnapshotReviewed is undefined", () => {
  const plan = {
    ...createValidPlan(),
    forensicSnapshotReviewed: undefined,
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when rollbackPlanReady is undefined", () => {
  const plan = {
    ...createValidPlan(),
    rollbackPlanReady: undefined,
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when validationRunPassed is undefined", () => {
  const plan = {
    ...createValidPlan(),
    validationRunPassed: undefined,
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic rejects non-boolean truthy recovery flags", () => {
  const plan = {
    ...createValidPlan(),
    forensicSnapshotReviewed: "yes",
    rollbackPlanReady: 1,
    validationRunPassed: "passed",
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false with empty approver array", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: [] })), false);
});

test("canResumeFromPanic returns false with single approver in array", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["only-one"] })), false);
});

test("canResumeFromPanic returns false when approver is whitespace only", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["   ", "valid-op"] })), false);
});

test("canResumeFromPanic returns true with three approvers", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["op-1", "op-2", "op-3"] })), true);
});

test("canResumeFromPanic returns false with string approver even if long", () => {
  const plan = {
    ...createValidPlan(),
    approvedBy: "super-duper-admin-operator-with-long-name",
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when string approver is whitespace", () => {
  const plan = {
    ...createValidPlan(),
    approvedBy: "       ",
  } as unknown as ResumePlan;

  assert.equal(canResumeFromPanic(plan), false);
});

test("canResumeFromPanic returns false when all optional flags are false", () => {
  assert.equal(
    canResumeFromPanic(
      createValidPlan({
        forensicSnapshotReviewed: false,
        rollbackPlanReady: false,
        validationRunPassed: false,
      }),
    ),
    false,
  );
});

test("canResumeFromPanic handles mixed empty and valid approvers", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["", "valid-op"] })), false);
});

test("canResumeFromPanic works with two valid approvers", () => {
  assert.equal(
    canResumeFromPanic(createValidPlan({ scope: "division-a", approvedBy: ["admin-1", "admin-2"] })),
    true,
  );
});

test("ResumePlan scope can be any string", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ scope: "any/scope/hierarchy" })), true);
});

test("ResumePlan approvedBy accepts readonly array", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["a", "b"] as const })), true);
});

test("canResumeFromPanic returns true with minimum two non-empty approvers", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["a", "b"] })), true);
});

test("canResumeFromPanic filters out empty strings from count", () => {
  assert.equal(canResumeFromPanic(createValidPlan({ approvedBy: ["", ""] })), false);
});

test("canResumeFromPanic works with readonly tuple approvers", () => {
  assert.equal(
    canResumeFromPanic(createValidPlan({ approvedBy: ["first", "second"] as readonly ["first", "second"] })),
    true,
  );
});
