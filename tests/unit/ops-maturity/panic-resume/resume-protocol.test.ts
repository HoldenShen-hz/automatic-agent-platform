import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canResumeFromPanic,
  type ResumePlan,
  type ResumeApprovalRole,
  type ResumeMode,
} from "../../../../src/ops-maturity/emergency/resume-protocol/index.js";

describe("resume-protocol", () => {
  describe("canResumeFromPanic", () => {
    const createValidPlan = (overrides: Partial<ResumePlan> = {}): ResumePlan => ({
      planId: "plan-001",
      scope: "platform/us-east-1",
      scopeRef: "scope-ref-001",
      approvedBy: ["admin1@example.com", "admin2@example.com"],
      approvalCount: 2,
      approvedRoles: ["platform_admin", "security_team"],
      compatibilityCheckRef: "check-ref-001",
      mode: "standard",
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
      createdAt: "2026-05-21T10:00:00Z",
      ...overrides,
    });

    it("should return true for a fully valid resume plan", () => {
      const plan = createValidPlan();
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should return false when scope is empty", () => {
      const plan = createValidPlan({ scope: "" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when scope is only whitespace", () => {
      const plan = createValidPlan({ scope: "   " });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when planId is empty", () => {
      const plan = createValidPlan({ planId: "" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when scopeRef is empty", () => {
      const plan = createValidPlan({ scopeRef: "" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when compatibilityCheckRef is empty", () => {
      const plan = createValidPlan({ compatibilityCheckRef: "" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when createdAt is empty", () => {
      const plan = createValidPlan({ createdAt: "" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when checkpointsVerified is false", () => {
      const plan = createValidPlan({ checkpointsVerified: false });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when forensicSnapshotReviewed is false", () => {
      const plan = createValidPlan({ forensicSnapshotReviewed: false });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when forensicSnapshotReviewed is undefined", () => {
      const plan = createValidPlan({ forensicSnapshotReviewed: undefined });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when rollbackPlanReady is false", () => {
      const plan = createValidPlan({ rollbackPlanReady: false });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when rollbackPlanReady is undefined", () => {
      const plan = createValidPlan({ rollbackPlanReady: undefined });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when validationRunPassed is false", () => {
      const plan = createValidPlan({ validationRunPassed: false });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when validationRunPassed is undefined", () => {
      const plan = createValidPlan({ validationRunPassed: undefined });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when approvalCount is less than 2", () => {
      const plan = createValidPlan({ approvalCount: 1 });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when approvers count is less than 2", () => {
      const plan = createValidPlan({ approvedBy: ["only-one-admin@example.com"] });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when no platform_admin in approvedRoles", () => {
      const plan = createValidPlan({ approvedRoles: ["security_team", "break_glass"] as readonly ResumeApprovalRole[] });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should return false when security_team missing in break_glass scenario", () => {
      const plan = createValidPlan({ approvedRoles: ["platform_admin", "break_glass"] as readonly ResumeApprovalRole[] });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should pass when two platform_admins are present", () => {
      const plan = createValidPlan({
        approvedRoles: ["platform_admin", "platform_admin"] as readonly ResumeApprovalRole[],
        approvedBy: ["admin1@example.com", "admin2@example.com"],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should pass when platform_admin and security_team are both present", () => {
      const plan = createValidPlan({
        approvedRoles: ["platform_admin", "security_team"] as readonly ResumeApprovalRole[],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should handle string approvedBy (single string)", () => {
      const plan = createValidPlan({ approvedBy: "single-admin@example.com" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should handle whitespace-only approvers", () => {
      const plan = createValidPlan({
        approvedBy: ["admin1@example.com", "   ", "admin2@example.com"],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should handle duplicate approvers", () => {
      const plan = createValidPlan({
        approvedBy: ["admin1@example.com", "admin1@example.com", "admin2@example.com"],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should handle empty approvedBy array", () => {
      const plan = createValidPlan({ approvedBy: [] });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should handle non-array approvedBy", () => {
      const plan = createValidPlan({ approvedBy: 123 as unknown as readonly string[] });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should handle non-array approvedRoles", () => {
      const plan = createValidPlan({ approvedRoles: "not-an-array" as unknown as readonly ResumeApprovalRole[] });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should use approvers.length when approvalCount is not a finite number", () => {
      const plan = createValidPlan({
        approvalCount: NaN,
        approvedBy: ["a1@example.com", "a2@example.com", "a3@example.com"],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should use approvers.length when approvalCount is Infinity", () => {
      const plan = createValidPlan({
        approvalCount: Infinity,
        approvedBy: ["a1@example.com", "a2@example.com"],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should handle dry_run mode", () => {
      const plan = createValidPlan({ mode: "dry_run" as ResumeMode });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should handle break_glass mode", () => {
      const plan = createValidPlan({ mode: "break_glass" as ResumeMode });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should return false for null scope", () => {
      const plan = createValidPlan({ scope: null as unknown as string });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });

    it("should trim whitespace from scope field", () => {
      const plan = createValidPlan({ scope: "  platform/us-east-1  " });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should accept platform scope with region", () => {
      const plan = createValidPlan({ scope: "region/eu-west-1" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should accept tenant scope", () => {
      const plan = createValidPlan({ scope: "tenant/production" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should accept domain scope", () => {
      const plan = createValidPlan({ scope: "domain/payment-gateway" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should accept run scope", () => {
      const plan = createValidPlan({ scope: "run/execution-12345" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should accept node scope", () => {
      const plan = createValidPlan({ scope: "node/worker-pool-3" });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should count unique platform_admin roles correctly", () => {
      const plan = createValidPlan({
        approvedRoles: ["platform_admin", "platform_admin", "security_team"] as readonly ResumeApprovalRole[],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, true);
    });

    it("should require minimum 1 platform_admin in break_glass", () => {
      const plan = createValidPlan({
        approvedRoles: ["platform_admin"] as readonly ResumeApprovalRole[],
        approvedBy: ["admin1@example.com"],
      });
      const result = canResumeFromPanic(plan);
      assert.strictEqual(result, false);
    });
  });
});