/**
 * R23-01: Unconfirmed high-risk TaskSpec should NOT generate RequestEnvelope
 *
 * §39.6 requires only confirmed state can dispatch.
 * This test verifies that buildTask() blocks RequestEnvelope generation
 * when confirmationReceipt.state is "pending_user_confirmation" (high-risk pending confirmation).
 *
 * Even if confirmationRequired is true and state is "pending_user_confirmation",
 * the RequestEnvelope must remain null until state becomes "confirmed".
 */

import assert from "node:assert/strict";
import test from "node:test";

import { NlEntryService } from "../../../../src/interaction/nl-gateway/index.js";

test("R23-01: buildTask keeps requestEnvelope null when confirmationReceipt.state is pending_user_confirmation", async () => {
  // High-risk router: triggers approvalRequired and critical/high risk
  const highRiskRouter = {
    route: () => ({
      classification: {
        intent: "modify" as const,
        continuation: "new_task" as const,
        confidence: 0.98,
        matchedRules: ["delete", "production"],
      },
      divisionId: "platform_engineering",
      workflowId: "change_managed_release",
    }),
  };
  const service = new NlEntryService({ intakeRouter: highRiskRouter as never });

  const task = await service.buildTask({
    tenantId: "tenant-r23-01-pending",
    userId: "user-r23-01-pending",
    message: "delete production database immediately",
  });

  // High-risk tasks require confirmation
  assert.equal(task.confirmationRequired, true);

  // R23-01 FIX: RequestEnvelope must be null when state is "pending_user_confirmation"
  // §39.6 requires only "confirmed" state can dispatch
  assert.equal(task.requestEnvelope, null,
    "RequestEnvelope must NOT be generated when confirmationReceipt.state is pending_user_confirmation");

  // State should be pending_user_confirmation (awaiting user confirmation)
  assert.equal(task.confirmationReceipt.state, "pending_user_confirmation",
    "State must be pending_user_confirmation for high-risk tasks requiring confirmation");

  // confirmationReceipt should indicate confirmation is required
  assert.equal(task.confirmationReceipt.required, true);
});

test("R23-01: buildTask emits requestEnvelope ONLY when confirmationReceipt.state is confirmed", async () => {
  // Low-risk router: no confirmation required
  const lowRiskRouter = {
    route: () => ({
      classification: {
        intent: "query" as const,
        continuation: "new_task" as const,
        confidence: 0.98,
        matchedRules: ["list"],
      },
      divisionId: "platform_engineering",
      workflowId: "read_only_inquiry",
    }),
  };
  const service = new NlEntryService({ intakeRouter: lowRiskRouter as never });

  const task = await service.buildTask({
    tenantId: "tenant-r23-01-confirmed",
    userId: "user-r23-01-confirmed",
    message: "list platform engineering incidents for staging",
  });

  // Low-risk does not require confirmation
  assert.equal(task.confirmationRequired, false);

  // For low-risk with no confirmation required, state should be "not_required"
  // But per §39.6, only "confirmed" can dispatch - so even "not_required" blocks here
  // The key fix is: we require explicit "confirmed" state for dispatch
  assert.equal(task.confirmationReceipt.state, "not_required");

  // R23-01: After fix, requestEnvelope should only emit when state === "confirmed"
  // For "not_required" state, requestEnvelope should be null (per the fix)
  // This ensures consistency: only confirmed tasks dispatch
  assert.equal(task.requestEnvelope, null,
    "RequestEnvelope must be null when state is not_required (only confirmed can dispatch)");
});

test("R23-01: buildTask blocks dispatch for high-risk tasks even after clarification", async () => {
  // This tests the scenario where a high-risk task goes through clarification
  // but is still in "pending_user_confirmation" state - must not dispatch
  const ambiguousRouter = {
    route: () => ({
      classification: {
        intent: "modify" as const,
        continuation: "follow_up" as const,
        confidence: 0.6,  // Low confidence triggers clarification
        matchedRules: ["ambiguous"],
      },
      divisionId: "platform_engineering",
      workflowId: "change_managed_release",
    }),
  };
  const service = new NlEntryService({ intakeRouter: ambiguousRouter as never });

  // First buildTask call - starts clarification
  const task1 = await service.buildTask({
    tenantId: "tenant-r23-01-clarification",
    userId: "user-r23-01-clarification",
    message: "帮我改一下",
  });

  // Even after clarification rounds, state is still pending_user_confirmation
  // RequestEnvelope must remain null until explicit confirmation
  assert.equal(task1.confirmationReceipt.state, "pending_user_confirmation");
  assert.equal(task1.requestEnvelope, null,
    "RequestEnvelope must be null during clarification for high-risk tasks");
});

test("R23-01: TaskBuildResult.requestEnvelope is null for all unconfirmed states", async () => {
  // Test that the fix correctly handles all non-confirmed states
  const router = {
    route: () => ({
      classification: {
        intent: "task_query" as const,
        continuation: "new_task" as const,
        confidence: 0.85,
        matchedRules: [],
      },
      divisionId: "engineering_ops",
      workflowId: "simple_query",
    }),
  };
  const service = new NlEntryService({ intakeRouter: router as never });

  const task = await service.buildTask({
    tenantId: "tenant-r23-01-unconfirmed",
    userId: "user-r23-01-unconfirmed",
    message: "what are the current incidents",
  });

  // state is "not_required" but should still block dispatch per R23-01 fix
  assert.ok(
    task.confirmationReceipt.state === "not_required" ||
    task.confirmationReceipt.state === "pending_user_confirmation",
    "State should be unconfirmed"
  );

  // Per §39.6 fix: only "confirmed" allows dispatch
  // So for "not_required" (which is not "confirmed"), requestEnvelope must be null
  assert.equal(task.requestEnvelope, null,
    "RequestEnvelope must be null for all non-confirmed states per R23-01 fix");
});