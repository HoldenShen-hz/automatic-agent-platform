/**
 * Unit tests for ResumeProtocol
 *
 * @see src/ops-maturity/emergency/resume-protocol/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  canResumeFromPanic,
  type ResumePlan,
} from "../../../../../src/ops-maturity/emergency/resume-protocol/index.js";

function makeResumePlan(overrides: Partial<ResumePlan> = {}): ResumePlan {
  return {
    planId: "plan-1",
    scope: "platform",
    scopeRef: "platform/root",
    approvedBy: ["operator-1", "operator-2"],
    approvalCount: 2,
    approvedRoles: ["platform_admin", "platform_admin"],
    compatibilityCheckRef: "compat-check-1",
    mode: "standard",
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test.describe("ResumeProtocol", () => {
  test.describe("canResumeFromPanic", () => {
    test("returns true when all conditions are met with array approvers", () => {
      const plan = makeResumePlan();

      const result = canResumeFromPanic(plan);

      assert.equal(result, true);
    });

    test("returns false when all conditions are met but only one approver is provided", () => {
      const plan = makeResumePlan({ approvedBy: ["operator-1"], approvalCount: 1 });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when checkpointsVerified is false", () => {
      const plan = makeResumePlan({ checkpointsVerified: false });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when forensicSnapshotReviewed is undefined", () => {
      const plan = {
        ...makeResumePlan(),
        forensicSnapshotReviewed: undefined,
      } as unknown as ResumePlan;

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when rollbackPlanReady is undefined", () => {
      const plan = {
        ...makeResumePlan(),
        rollbackPlanReady: undefined,
      } as unknown as ResumePlan;

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when validationRunPassed is undefined", () => {
      const plan = {
        ...makeResumePlan(),
        validationRunPassed: undefined,
      } as unknown as ResumePlan;

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when fewer than two non-empty approvers (empty array)", () => {
      const result = canResumeFromPanic(makeResumePlan({ approvedBy: [], approvalCount: 0 }));

      assert.equal(result, false);
    });

    test("returns false when fewer than two non-empty approvers (single approver)", () => {
      const plan = makeResumePlan({ approvedBy: ["operator-1"], approvalCount: 1 });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when approver contains only whitespace", () => {
      const plan = makeResumePlan({ approvedBy: ["   ", "operator-2"] });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns true with more than two approvers", () => {
      const plan = makeResumePlan({
        approvedBy: ["operator-1", "operator-2", "operator-3"],
        approvalCount: 3,
        approvedRoles: ["platform_admin", "platform_admin", "security_team"],
      });

      const result = canResumeFromPanic(plan);

      assert.equal(result, true);
    });

    test("returns false when approver array contains only one approver", () => {
      const plan = makeResumePlan({ approvedBy: ["super-admin-operator"], approvalCount: 1 });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when single approver entry is only whitespace", () => {
      const plan = makeResumePlan({ approvedBy: ["   "], approvalCount: 1 });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });

    test("returns false when all optional flags are false", () => {
      const plan = makeResumePlan({
        forensicSnapshotReviewed: false,
        rollbackPlanReady: false,
        validationRunPassed: false,
      });

      const result = canResumeFromPanic(plan);

      assert.equal(result, false);
    });
  });
});
