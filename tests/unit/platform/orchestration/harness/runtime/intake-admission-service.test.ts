import test from "node:test";
import assert from "node:assert/strict";
import { IntakeAdmissionService } from "../../../../../../src/platform/orchestration/harness/runtime/intake-admission-service.js";
import { createPrincipalRef } from "../../../../../../src/platform/contracts/executable-contracts/index.js";

test("IntakeAdmissionService.admit creates harness run with admitted status", () => {
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
    goal: "Ship the runtime contract",
    inputs: { repo: "automatic_agent_platform" },
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token", "tool"],
    },
    idempotencyKey: "intake-admit-001",
    traceId: "trace-001",
  });

  assert.equal(result.harnessRun.status, "admitted");
  assert.equal(result.harnessRun.tenantId, "tenant-1");
  assert.ok(result.harnessRun.harnessRunId.startsWith("harness_run_"));
});

test("IntakeAdmissionService.admit is idempotent by idempotencyKey", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const first = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "Ship the runtime contract",
    inputs: { repo: "automatic_agent_platform" },
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token", "tool"],
    },
    idempotencyKey: "intake-idempotent-001",
    traceId: "trace-002",
  });

  const second = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "Ship the runtime contract",
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-idempotent-001",
    traceId: "trace-003",
  });

  assert.equal(first, second);
  assert.equal(first.harnessRun.harnessRunId, second.harnessRun.harnessRunId);
});

test("IntakeAdmissionService.admit creates confirmed task spec", () => {
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
    goal: "Execute task",
    inputs: {},
    riskPreview: { riskClass: "low", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 50,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-confirmed-001",
    traceId: "trace-004",
  });

  assert.ok(result.confirmedTaskSpec != null);
  assert.equal(result.confirmedTaskSpec.taskDraftId, result.taskDraft.taskDraftId);
  assert.equal(result.confirmedTaskSpec.goal, "Execute task");
});

test("IntakeAdmissionService.admit creates request envelope", () => {
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
    goal: "Create envelope",
    inputs: {},
    riskPreview: { riskClass: "low", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 50,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-envelope-001",
    traceId: "trace-005",
  });

  assert.ok(result.requestEnvelope != null);
  assert.ok(result.requestEnvelope.requestId.startsWith("request_envelope_"));
  assert.equal(result.requestEnvelope.confirmedTaskSpecId, result.confirmedTaskSpec.confirmedTaskSpecId);
});

test("IntakeAdmissionService.admit creates run version lock", () => {
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
    goal: "Lock version",
    inputs: {},
    riskPreview: { riskClass: "low", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 50,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-lock-001",
    traceId: "trace-006",
  });

  assert.ok(result.runVersionLock != null);
  assert.equal(result.runVersionLock.harnessRunId, result.harnessRun.harnessRunId);
  assert.ok(result.runVersionLock.runVersionLockId.startsWith("run_version_lock_"));
});

test("IntakeAdmissionService.admit emits platform.request_envelope.admitted event", () => {
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
    goal: "Emit event",
    inputs: {},
    riskPreview: { riskClass: "low", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 50,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-event-001",
    traceId: "trace-007",
  });

  assert.ok(result.events.length > 0);
  assert.ok(result.events.some((e) => e.eventType === "platform.request_envelope.admitted"));
});

test("IntakeAdmissionService.admit throws for high risk without confirmationReceipt", () => {
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
        goal: "High risk task",
        inputs: {},
        riskPreview: { riskClass: "high", reasons: [] },
        constraintPackRef: "policy://default",
        budgetIntent: {
          amount: 100,
          currency: "USD",
          resourceKinds: ["token"],
        },
        idempotencyKey: "intake-high-risk-001",
        traceId: "trace-008",
      }),
    /admission.confirmation_required/,
  );
});

test("IntakeAdmissionService.admit throws for critical risk without confirmationReceipt", () => {
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
        goal: "Critical risk task",
        inputs: {},
        riskPreview: { riskClass: "critical", reasons: [] },
        constraintPackRef: "policy://default",
        budgetIntent: {
          amount: 100,
          currency: "USD",
          resourceKinds: ["token"],
        },
        idempotencyKey: "intake-critical-risk-001",
        traceId: "trace-009",
      }),
    /admission.confirmation_required/,
  );
});

test("IntakeAdmissionService.admit allows high risk with confirmationReceipt", () => {
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
    goal: "High risk with confirmation",
    inputs: {},
    riskPreview: { riskClass: "high", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-high-confirm-001",
    traceId: "trace-010",
    confirmationReceipt: {
      receiptId: "confirmation-001",
      confirmedAt: new Date().toISOString(),
      confirmedBy: "user-1",
      scope: "high_risk_task",
    },
  });

  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService.admit creates clarification session for non-low risk without confirmation", () => {
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
    goal: "Medium risk task that needs clarification",
    inputs: {},
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-clarify-001",
    traceId: "trace-011",
  });

  // Should return early with clarification needed event
  assert.ok(result.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
});

test("IntakeAdmissionService.admit denies critical risk with missing constraints", () => {
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
        goal: "Critical task without constraints",
        inputs: {},
        riskPreview: { riskClass: "critical", reasons: [] },
        constraintPackRef: "",
        budgetIntent: {
          amount: 100,
          currency: "USD",
          resourceKinds: ["token"],
        },
        idempotencyKey: "intake-deny-001",
        traceId: "trace-012",
        confirmationReceipt: {
          receiptId: "confirmation-002",
          confirmedAt: new Date().toISOString(),
          confirmedBy: "user-1",
          scope: "critical_task",
        },
      }),
    /admission.policy_denied/,
  );
});

test("IntakeAdmissionService.admit allows critical risk with pre_approved constraint pack", () => {
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
    goal: "Pre-approved critical task",
    inputs: {},
    riskPreview: { riskClass: "critical", reasons: [] },
    constraintPackRef: "policy://pre_approved",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-preapproved-001",
    traceId: "trace-013",
  });

  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService.admit allows critical risk for admin principal", () => {
  const service = new IntakeAdmissionService();
  const adminPrincipal = createPrincipalRef({
    principalId: "admin-1",
    tenantId: "tenant-1",
    roles: ["admin"],
    authorizationLevel: "admin",
  });

  const result = service.admit({
    tenantId: "tenant-1",
    principal: adminPrincipal,
    source: "nl",
    goal: "Admin critical task",
    inputs: {},
    riskPreview: { riskClass: "critical", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-admin-001",
    traceId: "trace-014",
  });

  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService.admit detects vague goal language", () => {
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
    goal: "Maybe perhaps do something about some things",
    inputs: {},
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-vague-001",
    traceId: "trace-015",
  });

  // Should emit clarification_needed event with vague_goal_language flag
  assert.ok(result.events.some((e) => e.eventType === "platform.intake.clarification_needed"));
});

test("IntakeAdmissionService.admit creates task draft with correct fields", () => {
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
    goal: "Draft task",
    inputs: { key: "value" },
    riskPreview: { riskClass: "low", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 50,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "intake-draft-001",
    traceId: "trace-016",
  });

  assert.ok(result.taskDraft != null);
  assert.equal(result.taskDraft.taskDraftId, result.confirmedTaskSpec.taskDraftId);
  assert.equal(result.taskDraft.normalizedIntent.goal, "Draft task");
});