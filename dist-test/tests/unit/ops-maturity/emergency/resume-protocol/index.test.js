/**
 * Unit tests for ResumeProtocol
 *
 * @see src/ops-maturity/emergency/resume-protocol/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canResumeFromPanic, } from "../../../../../src/ops-maturity/emergency/resume-protocol/index.js";
test.describe("ResumeProtocol", () => {
    test.describe("canResumeFromPanic", () => {
        test("returns true when all conditions are met with array approvers", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, true);
        });
        test("returns false when all conditions are met but only one string approver is provided", () => {
            const plan = {
                scope: "platform",
                approvedBy: "operator-1",
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when checkpointsVerified is false", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2"],
                checkpointsVerified: false,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when forensicSnapshotReviewed is undefined", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2"],
                checkpointsVerified: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when rollbackPlanReady is undefined", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when validationRunPassed is undefined", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when fewer than two non-empty approvers (empty array)", () => {
            const plan = {
                scope: "platform",
                approvedBy: [],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when fewer than two non-empty approvers (single approver)", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when approver contains only whitespace", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["   ", "operator-2"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns true with more than two approvers", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2", "operator-3"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, true);
        });
        test("returns false when approver is a single string with sufficient length", () => {
            const plan = {
                scope: "platform",
                approvedBy: "super-admin-operator",
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when single string approver is only whitespace", () => {
            const plan = {
                scope: "platform",
                approvedBy: "   ",
                checkpointsVerified: true,
                forensicSnapshotReviewed: true,
                rollbackPlanReady: true,
                validationRunPassed: true,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
        test("returns false when all optional flags are false", () => {
            const plan = {
                scope: "platform",
                approvedBy: ["operator-1", "operator-2"],
                checkpointsVerified: true,
                forensicSnapshotReviewed: false,
                rollbackPlanReady: false,
                validationRunPassed: false,
            };
            const result = canResumeFromPanic(plan);
            assert.equal(result, false);
        });
    });
});
//# sourceMappingURL=index.test.js.map