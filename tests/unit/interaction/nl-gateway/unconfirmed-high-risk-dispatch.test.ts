/**
 * R23-01: Unconfirmed high-risk TaskSpec should NOT generate RequestEnvelope
 *
 * §39.6 requires pending confirmation states to block dispatch.
 * This test verifies that buildTask() blocks RequestEnvelope generation
 * when confirmationReceipt.state is "pending_user_confirmation" (high-risk pending confirmation),
 * while low-risk "not_required" requests may proceed directly.
 *
 * Even if confirmationRequired is true and state is "pending_user_confirmation",
 * the RequestEnvelope must remain null until that confirmation gate is cleared.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  NlEntryService,
  detectAmbiguity,
  detectAmbiguityFn,
} from "../../../../src/interaction/nl-gateway/index.js";

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

test("R23-01: buildTask emits requestEnvelope when confirmation is not required", async () => {
  // Low-risk router: no confirmation required, so dispatch may proceed directly.
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
  assert.equal(task.confirmationReceipt.state, "not_required");
  assert.ok(task.requestEnvelope != null,
    "Low-risk requests should emit a RequestEnvelope when no confirmation is required");
  assert.ok(task.confirmedTaskSpec != null);
  assert.ok(task.canonicalRequestEnvelope != null);
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

test("R23-01: low-risk not_required state still materializes canonical dispatch artifacts", async () => {
  const router = {
    route: () => ({
      classification: {
        intent: "task_query" as const,
        continuation: "new_task" as const,
        confidence: 0.85,
        matchedRules: [],
      },
      divisionId: "engineering-ops",
      workflowId: "simple_query",
    }),
  };
  const service = new NlEntryService({ intakeRouter: router as never });

  const task = await service.buildTask({
    tenantId: "tenant-r23-01-unconfirmed",
    userId: "user-r23-01-unconfirmed",
    message: "what are the current incidents for staging on 2026-05-12",
  });

  assert.equal(task.confirmationReceipt.state, "not_required");
  assert.ok(task.requestEnvelope != null);
  assert.ok(task.confirmedTaskSpec != null);
  assert.ok(task.canonicalRequestEnvelope != null);
  assert.equal(
    task.canonicalRequestEnvelope?.confirmedTaskSpecId,
    task.confirmedTaskSpec?.confirmedTaskSpecId,
  );
});

test("R23-13: nl-gateway barrel exports detectAmbiguity without wildcard shadowing", () => {
  assert.equal(typeof detectAmbiguity, "function");
  assert.equal(detectAmbiguityFn, detectAmbiguity);
});
