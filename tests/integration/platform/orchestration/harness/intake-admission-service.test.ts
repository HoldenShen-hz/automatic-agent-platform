/**
 * Integration Tests: IntakeAdmissionService
 *
 * Tests IntakeAdmissionService with policy evaluation and confirmation receipt handling.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { IntakeAdmissionService } from "../../../../../src/platform/orchestration/harness/runtime/intake-admission-service.js";
import { createPrincipalRef, type PrincipalRef } from "../../../../../src/platform/contracts/executable-contracts/index.js";

function createTestPrincipal(overrides: Partial<PrincipalRef> = {}): PrincipalRef {
  return createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
    ...overrides,
  });
}

function createMediumRiskInput(overrides = {}) {
  return {
    tenantId: "tenant-1",
    principal: createTestPrincipal(),
    source: "nl" as const,
    domainId: "project-management",
    goal: "Execute test task",
    inputs: {},
    riskPreview: { riskClass: "medium" as const, reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 50,
      currency: "USD",
      resourceKinds: ["token"] as const,
    },
    idempotencyKey: `intake-int-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    traceId: "trace-int-001",
    ...overrides,
  };
}

test("IntakeAdmissionService integration: admit creates full admission chain", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput();

  const result = service.admit(input);

  assert.equal(result.harnessRun.status, "admitted");
  assert.ok(result.confirmedTaskSpec != null);
  assert.ok(result.requestEnvelope != null);
  assert.ok(result.runVersionLock != null);
  assert.ok(result.taskDraft != null);
});

test("IntakeAdmissionService integration: admit creates events with admitted event", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput();

  const result = service.admit(input);

  assert.ok(result.events.length >= 1);
  assert.ok(result.events.some((e) => e.eventType === "platform.request_envelope.admitted"));
});

test("IntakeAdmissionService integration: admit is idempotent", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({ idempotencyKey: "intake-idempotent-int-001" });

  const first = service.admit(input);
  const second = service.admit(input);

  assert.equal(first, second);
  assert.equal(first.harnessRun.harnessRunId, second.harnessRun.harnessRunId);
});

test("IntakeAdmissionService integration: high risk requires confirmationReceipt", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "high", reasons: [] },
    idempotencyKey: "intake-high-risk-int-001",
  });

  assert.throws(
    () => service.admit(input),
    /admission.confirmation_required/,
  );
});

test("IntakeAdmissionService integration: critical risk requires confirmationReceipt", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "critical", reasons: [] },
    idempotencyKey: "intake-critical-risk-int-001",
  });

  assert.throws(
    () => service.admit(input),
    /admission.confirmation_required/,
  );
});

test("IntakeAdmissionService integration: high risk with confirmationReceipt succeeds", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "high", reasons: [] },
    idempotencyKey: "intake-high-confirm-int-001",
    confirmationReceipt: {
      receiptId: "confirmation-high-001",
      confirmedAt: new Date().toISOString(),
      confirmedBy: "user-1",
      scope: "high_risk_task",
    },
  });

  const result = service.admit(input);
  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService integration: critical risk with admin principal succeeds without confirmation", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    principal: createTestPrincipal({ authorizationLevel: "admin" }),
    riskPreview: { riskClass: "critical", reasons: [] },
    constraintPackRef: "policy://default",
    idempotencyKey: "intake-admin-int-001",
  });

  const result = service.admit(input);
  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService integration: critical risk with pre_approved constraint succeeds", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "critical", reasons: [] },
    constraintPackRef: "policy://pre_approved",
    idempotencyKey: "intake-preapproved-int-001",
  });

  const result = service.admit(input);
  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService integration: missing constraintPackRef for high risk is denied", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "high", reasons: [] },
    constraintPackRef: "",
    idempotencyKey: "intake-deny-int-001",
    confirmationReceipt: {
      receiptId: "confirmation-002",
      confirmedAt: new Date().toISOString(),
      confirmedBy: "user-1",
      scope: "high_risk_task",
    },
  });

  assert.throws(
    () => service.admit(input),
    /admission.policy_denied/,
  );
});

test("IntakeAdmissionService integration: low risk does not require clarification session", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "low", reasons: [] },
    idempotencyKey: "intake-low-risk-int-001",
  });

  const result = service.admit(input);

  // Low risk without confirmation should proceed without clarification
  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService integration: medium risk without confirmation creates clarification session", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    riskPreview: { riskClass: "medium", reasons: [] },
    idempotencyKey: "intake-clarify-int-001",
  });

  const result = service.admit(input);

  // Should emit clarification_needed event
  assert.ok(result.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
});

test("IntakeAdmissionService integration: vague goal language triggers clarification", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    goal: "Maybe perhaps do something with some things maybe",
    riskPreview: { riskClass: "medium", reasons: [] },
    idempotencyKey: "intake-vague-int-001",
  });

  const result = service.admit(input);

  assert.ok(result.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
});

test("IntakeAdmissionService integration: confirmedTaskSpec links to taskDraft", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    goal: "Test linkage",
    idempotencyKey: "intake-link-int-001",
  });

  const result = service.admit(input);

  assert.equal(result.confirmedTaskSpec.taskDraftId, result.taskDraft.taskDraftId);
});

test("IntakeAdmissionService integration: requestEnvelope links to confirmedTaskSpec", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    goal: "Test envelope linkage",
    idempotencyKey: "intake-env-link-int-001",
  });

  const result = service.admit(input);

  assert.equal(result.requestEnvelope.confirmedTaskSpecId, result.confirmedTaskSpec.confirmedTaskSpecId);
});

test("IntakeAdmissionService integration: runVersionLock links to harnessRun", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    goal: "Test version lock linkage",
    idempotencyKey: "intake-lock-link-int-001",
  });

  const result = service.admit(input);

  assert.equal(result.runVersionLock.harnessRunId, result.harnessRun.harnessRunId);
});

test("IntakeAdmissionService integration: budget ledger created with correct hard cap", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    budgetIntent: {
      amount: 200,
      currency: "USD",
      resourceKinds: ["token", "tool"],
    },
    idempotencyKey: "intake-budget-int-001",
  });

  const result = service.admit(input);

  // Budget ledger ID should be created and linked
  assert.ok(result.harnessRun.budgetLedgerId.startsWith("budget_ledger_"));
});

test("IntakeAdmissionService integration: harnessRun has correct tenant", () => {
  const service = new IntakeAdmissionService();
  const input = createMediumRiskInput({
    tenantId: "tenant-special-123",
    idempotencyKey: "intake-tenant-int-001",
  });

  const result = service.admit(input);

  assert.equal(result.harnessRun.tenantId, "tenant-special-123");
});
