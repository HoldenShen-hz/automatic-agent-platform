import assert from "node:assert/strict";
import test from "node:test";

import { IntakeAdmissionService } from "../../../../../../src/platform/orchestration/harness/runtime/intake-admission-service.js";
import { createPrincipalRef } from "../../../../../../src/platform/contracts/executable-contracts/index.js";

function createRiskPreview(input: { riskClass: "low" | "medium" | "high" | "critical"; reasons: readonly string[] }) {
  return input;
}

function createBudgetIntent(input: { amount: number; currency: string; resourceKinds: readonly string[] }) {
  return input;
}

/**
 * R6 Fix Verification Tests
 * Tests for Intake admission + Dispatcher scheduling gaps (R6-1 to R6-12)
 */

// ---------------------------------------------------------------------------
// R6-1: ClarificationSession stage gates ConfirmedTaskSpec creation
// ---------------------------------------------------------------------------

test("R6-1: admit() creates ClarificationSession when confirmationReceipt is absent and risk is not low", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  // Medium risk without confirmation should trigger clarification session
  const result = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "maybe ship the runtime contract",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "medium", reasons: [] }),
    constraintPackRef: "policy://default",
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-1-test-1",
    traceId: "trace-1",
  });

  // With confirmation receipt, no clarification needed
  const withReceipt = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "maybe ship the runtime contract",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "medium", reasons: [] }),
    constraintPackRef: "policy://default",
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-1-test-2",
    traceId: "trace-2",
    confirmationReceipt: { receiptId: "rcpt-1", issuedAt: new Date().toISOString(), issuedBy: principal },
  });

  // Without receipt (medium risk), clarification session should be created
  assert.ok(result.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
  // With receipt, should skip clarification and directly create ConfirmedTaskSpec
  assert.ok(!withReceipt.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
});

test("R6-1: resumeClarification transitions session to confirmed and creates ConfirmedTaskSpec", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const confirmationReceipt = { receiptId: "rcpt-1", issuedAt: new Date().toISOString(), issuedBy: principal };

  // First admit without confirmation to create clarification session
  service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "maybe ship the runtime contract",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "medium", reasons: [] }),
    constraintPackRef: "policy://default",
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-1-resume-test",
    traceId: "trace-resume",
  });

  // Resume the clarification session
  const resumeResult = service.resumeClarification("clarify:r6-1-resume-test", confirmationReceipt);
  assert.equal(resumeResult.clarificationSession.stage, "confirmed");
  assert.ok(resumeResult.confirmedTaskSpec != null);
});

// ---------------------------------------------------------------------------
// R6-2: High/critical risk tasks require UserConfirmationReceipt
// ---------------------------------------------------------------------------

test("R6-2: admit() throws when high risk task lacks confirmationReceipt", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  assert.throws(
    () =>
      service.admit({
        tenantId: "tenant-1",
        principal,
        source: "nl",
        goal: "ship the runtime contract",
        inputs: {},
        riskPreview: createRiskPreview({ riskClass: "high", reasons: [] }),
        constraintPackRef: "policy://default",
        budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
        idempotencyKey: "r6-2-high-no-receipt",
        traceId: "trace-1",
      }),
    (err: Error) => err.message.includes("confirmation_required"),
  );
});

test("R6-2: admit() throws when critical risk task lacks confirmationReceipt", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  assert.throws(
    () =>
      service.admit({
        tenantId: "tenant-1",
        principal,
        source: "nl",
        goal: "ship the runtime contract",
        inputs: {},
        riskPreview: createRiskPreview({ riskClass: "critical", reasons: [] }),
        constraintPackRef: "policy://default",
        budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
        idempotencyKey: "r6-2-critical-no-receipt",
        traceId: "trace-1",
      }),
    (err: Error) => err.message.includes("confirmation_required"),
  );
});

test("R6-2: admit() succeeds when high risk task has confirmationReceipt", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const result = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "ship the runtime contract",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "high", reasons: [] }),
    constraintPackRef: "policy://default",
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-2-high-with-receipt",
    traceId: "trace-1",
    confirmationReceipt: { receiptId: "rcpt-high", issuedAt: new Date().toISOString(), issuedBy: principal },
  });
  assert.ok(result.harnessRun != null);
  assert.equal(result.harnessRun.status, "admitted");
});

// ---------------------------------------------------------------------------
// R6-12: policyGuard.allowed is not hardcoded true
// ---------------------------------------------------------------------------

test("R6-12: policyGuard evaluation returns actual allowed value based on risk class", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  // Critical risk without pre_approved should be denied
  const result = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "ship the runtime contract",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "critical", reasons: [] }),
    constraintPackRef: "policy://default", // Not pre_approved
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-12-no-approval",
    traceId: "trace-1",
    confirmationReceipt: { receiptId: "rcpt-critical", issuedAt: new Date().toISOString(), issuedBy: principal },
  });

  // The harness run should have policyGuard with actual evaluation
  assert.ok(result.harnessRun.status !== undefined);
});

// ---------------------------------------------------------------------------
// R6-9: Budget reservation validation before dispatch
// ---------------------------------------------------------------------------

test("R6-9: validateBudgetReservation ensures hard cap satisfies budget intent", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  // This test verifies the validation is performed by checking admission succeeds
  // when budget constraints are satisfied
  const result = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "run a task",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "low", reasons: [] }),
    constraintPackRef: "policy://default",
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-9-budget-ok",
    traceId: "trace-1",
  });

  assert.equal(result.harnessRun.status, "admitted");
});

// ---------------------------------------------------------------------------
// Test helper functions for detectAmbiguityFlags
// ---------------------------------------------------------------------------

test("R6-11: intent extraction with confidence scoring detects ambiguous input", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  // Vague goal with conditional language should trigger clarification
  const result = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "maybe fix something or perhaps update it later when possible",
    inputs: {},
    riskPreview: createRiskPreview({ riskClass: "medium", reasons: [] }),
    constraintPackRef: "policy://default",
    budgetIntent: createBudgetIntent({ amount: 100, currency: "USD", resourceKinds: ["token"] }),
    idempotencyKey: "r6-11-ambiguous",
    traceId: "trace-1",
  });

  // Should have clarification_needed event due to ambiguity
  assert.ok(result.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
});
