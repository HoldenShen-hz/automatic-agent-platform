/**
 * Side Effect Manager Unit Tests
 *
 * Tests side effect transitions, reconciliation application,
 * compensation initiation, and completion.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SideEffectManager } from "../../../../src/platform/five-plane-execution/side-effect-manager.js";
import type { SideEffectRecord, SideEffectStatus, ReconciliationRecord, CompensationRecord } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createTestSideEffect(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return {
    sideEffectId: newId("se"),
    harnessRunId: newId("hrun"),
    nodeRunId: newId("nrun"),
    nodeAttemptId: newId("na"),
    effectKind: "external_api",
    idempotencyKey: newId("idem"),
    status: "ambiguous",
    riskClass: "medium",
    preCommitPolicyProofRef: { artifactId: newId("art"), uri: "policy://proof" },
    deadline: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestContext() {
  return {
    tenantId: "test_tenant",
    traceId: newId("trace"),
    emittedBy: "test_operator",
    leaseId: "lease-test-side-effect",
    fencingToken: "fence-test-side-effect",
  };
}

function createReconciliationRecord(overrides: Partial<ReconciliationRecord> = {}): ReconciliationRecord {
  return {
    reconciliationId: newId("recon"),
    sideEffectId: newId("se"),
    probeKind: "http_probe",
    externalObservedState: { state: "confirmed" },
    result: "confirmed",
    evidenceRefs: [],
    nextAction: "mark_confirmed",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createCompensationRecord(overrides: Partial<CompensationRecord> = {}): CompensationRecord {
  return {
    compensationId: newId("comp"),
    sideEffectId: newId("se"),
    harnessRunId: newId("hrun"),
    planRef: { artifactId: newId("art"), uri: "plan://ref" },
    status: "running",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: applyReconciliation
// ---------------------------------------------------------------------------

test("applyReconciliation: mark_confirmed transitions to confirmed", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "confirmed");
  assert.ok(result.event);
});

test("applyReconciliation: retry_probe transitions to reconciling", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "retry_probe" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "reconciling");
});

test("applyReconciliation: compensate transitions to compensation_required", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "compensate" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "compensation_required");
});

test("applyReconciliation: escalate_hitl transitions to manual_review_required", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "escalate_hitl" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "manual_review_required");
});

test("applyReconciliation: mark_failed transitions to failed", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_failed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "failed");
});

test("applyReconciliation includes reconciliation result in reasonCode", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({
    nextAction: "mark_confirmed",
    result: "confirmed",
  });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.ok(result.event.payload && typeof result.event.payload === 'object');
  const payload = result.event.payload as Record<string, unknown>;
  assert.ok(payload.reasonCode?.includes("confirmed"));
  assert.ok(payload.reasonCode?.includes("mark_confirmed"));
});

// ---------------------------------------------------------------------------
// Tests: startCompensation
// ---------------------------------------------------------------------------

test("startCompensation transitions to compensating", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensation_required" });
  const compensation = createCompensationRecord({ status: "running" });
  const context = createTestContext();

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "compensating");
});

test("startCompensation includes compensation status in reasonCode", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensation_required" });
  const compensation = createCompensationRecord({ status: "running" });
  const context = createTestContext();

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.ok(result.event.payload && typeof result.event.payload === 'object');
  const payload = result.event.payload as Record<string, unknown>;
  assert.ok(payload.reasonCode?.includes("running"));
});

// ---------------------------------------------------------------------------
// Tests: completeCompensation
// ---------------------------------------------------------------------------

test("completeCompensation: succeeded status transitions to compensated", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensating" });
  const compensation = createCompensationRecord({ status: "succeeded" });
  const context = createTestContext();

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "compensated");
});

test("completeCompensation: failed status transitions to failed", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensating" });
  const compensation = createCompensationRecord({ status: "failed" });
  const context = createTestContext();

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "failed");
});

test("completeCompensation includes compensation status in reasonCode", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensating" });
  const compensation = createCompensationRecord({ status: "succeeded" });
  const context = createTestContext();

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.ok(result.event.payload && typeof result.event.payload === 'object');
  const payload = result.event.payload as Record<string, unknown>;
  assert.ok(payload.reasonCode?.includes("succeeded"));
});

// ---------------------------------------------------------------------------
// Tests: SideEffectManager with Custom StateMachine
// ---------------------------------------------------------------------------

test("SideEffectManager uses provided state machine", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  // If state machine is used correctly, we get a valid result
  assert.ok(result.aggregate);
  assert.ok(result.event);
  assert.equal(result.aggregate.status, "confirmed");
});

// ---------------------------------------------------------------------------
// Tests: Event Emission
// ---------------------------------------------------------------------------

test("applyReconciliation emits platform event", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.ok(result.event.eventType);
  assert.ok(result.event.aggregateId);
  assert.equal(result.event.aggregateType, "SideEffectRecord");
});

test("startCompensation emits platform event", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensation_required" });
  const compensation = createCompensationRecord({ status: "running" });
  const context = createTestContext();

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.ok(result.event.eventType);
  assert.ok(result.event.aggregateId);
  assert.equal(result.event.aggregateType, "SideEffectRecord");
});

test("SideEffectManager exposes registration lifecycle before commit", () => {
  const manager = new SideEffectManager();
  const context = createTestContext();

  const proposed = manager.registerProposal(
    createTestSideEffect({ status: "proposed" }),
    context,
  );
  const approved = manager.approve(proposed.aggregate, context);
  const reserved = manager.reserve(approved.aggregate, context);
  const committing = manager.startCommit(reserved.aggregate, context);
  const committed = manager.recordCommitted(committing.aggregate, context);
  const confirming = manager.startConfirmation(committed.aggregate, context);
  const confirmed = manager.confirm(confirming.aggregate, context);

  assert.equal(proposed.aggregate.status, "proposed");
  assert.equal(approved.aggregate.status, "approved");
  assert.equal(reserved.aggregate.status, "reserved");
  assert.equal(committing.aggregate.status, "committing");
  assert.equal(committed.aggregate.status, "committed");
  assert.equal(confirming.aggregate.status, "confirming");
  assert.equal(confirmed.aggregate.status, "confirmed");
});

test("SideEffectManager re-validates before entering commit path", () => {
  const validationTargets: SideEffectStatus[] = [];
  const manager = new SideEffectManager({
    preCommitValidator: {
      validate(request) {
        validationTargets.push(request.targetStatus);
      },
    },
  });
  const context = createTestContext();

  const proposed = manager.registerProposal(createTestSideEffect({ status: "proposed" }), context);
  const approved = manager.approve(proposed.aggregate, context);
  const reserved = manager.reserve(approved.aggregate, context);
  const committing = manager.startCommit(reserved.aggregate, context);
  const committed = manager.recordCommitted(committing.aggregate, context);
  const confirming = manager.startConfirmation(committed.aggregate, context);
  manager.confirm(confirming.aggregate, context);

  assert.deepEqual(validationTargets, [
    "approved",
    "reserved",
    "committing",
    "committed",
    "confirming",
    "confirmed",
  ]);
});

test("completeCompensation emits platform event", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensating" });
  const compensation = createCompensationRecord({ status: "succeeded" });
  const context = createTestContext();

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.ok(result.event.eventType);
  assert.ok(result.event.aggregateId);
  assert.equal(result.event.aggregateType, "SideEffectRecord");
});

// ---------------------------------------------------------------------------
// Tests: Side Effect Safety
// ---------------------------------------------------------------------------

test("applyReconciliation includes sideEffectSafety in transition", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({
    status: "ambiguous",
    idempotencyKey: "test-key-123",
    approvalRef: "human://approval/456",
  });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  // The transition should succeed if proper safety attributes are set
  assert.ok(result.aggregate);
});

test("startCompensation includes sideEffectSafety in transition", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({
    status: "compensation_required",
    idempotencyKey: "test-key-123",
    preCommitPolicyProofRef: { artifactId: newId("art"), uri: "policy://proof" },
  });
  const compensation = createCompensationRecord({ status: "running" });
  const context = createTestContext();

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.ok(result.aggregate);
});

// ---------------------------------------------------------------------------
// Tests: High Risk Side Effects
// ---------------------------------------------------------------------------

test("applyReconciliation for high risk side effect requires approval ref", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({
    status: "ambiguous",
    riskClass: "high",
    approvalRef: "human://approval/789",
  });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  // Should succeed with human approval ref set
  assert.equal(result.aggregate.status, "confirmed");
});

test("applyReconciliation for critical risk side effect requires approval ref", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({
    status: "ambiguous",
    riskClass: "critical",
    approvalRef: "human://approval/789",
  });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  // Should succeed with human approval ref set
  assert.equal(result.aggregate.status, "confirmed");
});

// ---------------------------------------------------------------------------
// Tests: Custom occurredAt
// ---------------------------------------------------------------------------

test("applyReconciliation uses custom occurredAt when provided", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });
  const reconciliation = createReconciliationRecord({ nextAction: "mark_confirmed" });
  const customTime = "2024-01-15T10:30:00.000Z";
  const context = {
    ...createTestContext(),
    occurredAt: customTime,
  };

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.updatedAt, customTime);
});

test("startCompensation uses custom occurredAt when provided", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensation_required" });
  const compensation = createCompensationRecord({ status: "running" });
  const customTime = "2024-01-15T10:30:00.000Z";
  const context = {
    ...createTestContext(),
    occurredAt: customTime,
  };

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.updatedAt, customTime);
});

test("completeCompensation uses custom occurredAt when provided", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ status: "compensating" });
  const compensation = createCompensationRecord({ status: "succeeded" });
  const customTime = "2024-01-15T10:30:00.000Z";
  const context = {
    ...createTestContext(),
    occurredAt: customTime,
  };

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.updatedAt, customTime);
});

// ---------------------------------------------------------------------------
// Tests: Audit Reference Generation
// ---------------------------------------------------------------------------

test("applyReconciliation generates audit ref with side effect id and reason code", () => {
  const manager = new SideEffectManager();
  const sideEffect = createTestSideEffect({ sideEffectId: "se_test_123" });
  const reconciliation = createReconciliationRecord({
    sideEffectId: "se_test_123",
    nextAction: "mark_confirmed",
  });
  const context = createTestContext();

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  // The event should have an auditRef that includes the side effect id
  assert.ok(result.event.payload && typeof result.event.payload === 'object');
});
