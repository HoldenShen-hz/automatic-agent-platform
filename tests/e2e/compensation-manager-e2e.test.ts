/**
 * E2E Compensation Manager Tests
 *
 * End-to-end tests for compensation manager functionality.
 * Tests cover:
 * 1. Side effect compensatability checks
 * 2. Compensation state machine transitions
 * 3. Compensation plan creation
 * 4. Human approval requirements
 * 5. Precondition validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CompensationManager,
  type CompensationContext,
} from "../../src/platform/execution/compensation-manager.js";
import type { SideEffectRecord, SideEffectStatus } from "../../src/platform/contracts/executable-contracts/index.js";
import { createCompensationRecord } from "../../src/platform/contracts/executable-contracts/index.js";

// ============================================================================
// Test Suite 1: Compensation Manager - Basic Operations
// ============================================================================

test("E2E CompensationManager: creates instance with default config", () => {
  const manager = new CompensationManager();
  assert.ok(manager);
});

test("E2E CompensationManager: isCompensatable returns true for compensatable statuses", () => {
  const manager = new CompensationManager();

  const compensatableStatuses: SideEffectStatus[] = [
    "ambiguous",
    "compensation_required",
    "failed",
  ];

  for (const status of compensatableStatuses) {
    const sideEffect = createMockSideEffect({ status });
    assert.equal(manager.isCompensatable(sideEffect), true, `Expected ${status} to be compensatable`);
  }
});

test("E2E CompensationManager: isCompensatable returns false for non-compensatable statuses", () => {
  const manager = new CompensationManager();

  const nonCompensatableStatuses: SideEffectStatus[] = [
    "confirmed",
    "compensated",
    "compensating",
    "expired",
  ];

  for (const status of nonCompensatableStatuses) {
    const sideEffect = createMockSideEffect({ status });
    assert.equal(manager.isCompensatable(sideEffect), false, `Expected ${status} to not be compensatable`);
  }
});

// ============================================================================
// Test Suite 2: State Machine Transitions
// ============================================================================

test("E2E CompensationManager: planned transitions to running on approve", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("planned", "approve");

  assert.equal(nextStatus, "running");
});

test("E2E CompensationManager: planned transitions to requires_human on escalate", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("planned", "escalate");

  assert.equal(nextStatus, "requires_human");
});

test("E2E CompensationManager: running transitions to succeeded on confirm", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("running", "confirm");

  assert.equal(nextStatus, "succeeded");
});

test("E2E CompensationManager: running transitions to failed on fail", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("running", "fail");

  assert.equal(nextStatus, "failed");
});

test("E2E CompensationManager: running transitions to requires_human on escalate", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("running", "escalate");

  assert.equal(nextStatus, "requires_human");
});

test("E2E CompensationManager: failed transitions to planned on plan", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("failed", "plan");

  assert.equal(nextStatus, "planned");
});

test("E2E CompensationManager: failed transitions to requires_human on escalate", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("failed", "escalate");

  assert.equal(nextStatus, "requires_human");
});

test("E2E CompensationManager: requires_human transitions to planned on plan", () => {
  const manager = new CompensationManager();

  const nextStatus = manager.getNextCompensationStatus("requires_human", "plan");

  assert.equal(nextStatus, "planned");
});

test("E2E CompensationManager: terminal states have no transitions", () => {
  const manager = new CompensationManager();

  assert.equal(manager.getNextCompensationStatus("succeeded", "approve"), null);
  assert.equal(manager.getNextCompensationStatus("succeeded", "fail"), null);
});

test("E2E CompensationManager: invalid transitions return null", () => {
  const manager = new CompensationManager();

  assert.equal(manager.getNextCompensationStatus("planned", "confirm"), null);
  assert.equal(manager.getNextCompensationStatus("running", "plan"), null);
});

// ============================================================================
// Test Suite 3: Target Side Effect Status
// ============================================================================

test("E2E CompensationManager: succeeded maps to compensated", () => {
  const manager = new CompensationManager();

  const targetStatus = manager.getTargetSideEffectStatus("succeeded");

  assert.equal(targetStatus, "compensated");
});

test("E2E CompensationManager: failed maps to failed", () => {
  const manager = new CompensationManager();

  const targetStatus = manager.getTargetSideEffectStatus("failed");

  assert.equal(targetStatus, "failed");
});

test("E2E CompensationManager: requires_human maps to manual_review_required", () => {
  const manager = new CompensationManager();

  const targetStatus = manager.getTargetSideEffectStatus("requires_human");

  assert.equal(targetStatus, "manual_review_required");
});

test("E2E CompensationManager: running and other states map to compensating", () => {
  const manager = new CompensationManager();

  assert.equal(manager.getTargetSideEffectStatus("planned"), "compensating");
  assert.equal(manager.getTargetSideEffectStatus("running"), "compensating");
});

// ============================================================================
// Test Suite 4: Human Approval Requirements
// ============================================================================

test("E2E CompensationManager: high impact requires human approval", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("high"), true);
});

test("E2E CompensationManager: low impact does not require human approval", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("low"), false);
  assert.equal(manager.requiresHumanApproval("medium"), false);
});

// ============================================================================
// Test Suite 5: Precondition Validation
// ============================================================================

test("E2E CompensationManager: validates non-compensatable side effects", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({ status: "confirmed" });

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("not in a compensatable state"));
});

test("E2E CompensationManager: validates already compensated side effects", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({ status: "compensated" });

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("already been compensated"));
});

test("E2E CompensationManager: validates compensatable side effects", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({ status: "failed" });

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, true);
  assert.equal(result.reason, undefined);
});

// ============================================================================
// Test Suite 6: Compensation Plan Creation
// ============================================================================

test("E2E CompensationManager: planCompensation creates plan with steps", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-123",
    status: "failed",
    effectKind: "file_write",
    riskClass: "medium",
  });
  const context: CompensationContext = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test compensation",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.compensationId);
  assert.equal(plan.sideEffectId, "effect-123");
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.stepType, "reverse");
  assert.equal(plan.steps[0]?.action, "reverse_file_write");
});

test("E2E CompensationManager: planCompensation sets high impact for critical risk", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-critical",
    status: "failed",
    effectKind: "file_write",
    riskClass: "critical",
  });
  const context: CompensationContext = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Critical compensation",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.equal(plan.steps[0]?.estimatedImpact, "high");
});

test("E2E CompensationManager: planCompensation sets medium impact for high risk", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-high",
    status: "failed",
    effectKind: "external_api",
    riskClass: "high",
  });
  const context: CompensationContext = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "High risk compensation",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.equal(plan.steps[0]?.estimatedImpact, "medium");
});

test("E2E CompensationManager: planCompensation sets low impact for low risk", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-low",
    status: "failed",
    effectKind: "message_send",
    riskClass: "low",
  });
  const context: CompensationContext = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Low risk compensation",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.equal(plan.steps[0]?.estimatedImpact, "low");
});

// ============================================================================
// Test Suite 7: Compensation Record Creation
// ============================================================================

test("E2E CompensationManager: createCompensationRecord creates valid record", () => {
  const manager = new CompensationManager();

  const record = manager.createCompensationRecord(
    "effect-456",
    "harness-789",
    { artifactId: "artifact-1", kind: "checkpoint", uri: "file://test" },
    "planned",
  );

  assert.equal(record.sideEffectId, "effect-456");
  assert.equal(record.harnessRunId, "harness-789");
  assert.equal(record.status, "planned");
  assert.ok(record.planRef);
});

// ============================================================================
// Test Suite 8: Derive Compensation Steps
// ============================================================================

test("E2E CompensationManager: derives reverse step for side effect", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-reverse",
    effectKind: "transaction",
    externalRef: "db://table/row/123",
    riskClass: "high",
  });
  const context: CompensationContext = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.stepType, "reverse");
  assert.equal(plan.steps[0]?.targetRef, "db://table/row/123");
  assert.equal(plan.steps[0]?.action, "reverse_database_insert");
});

test("E2E CompensationManager: uses idempotency key when no external ref", () => {
  const manager = new CompensationManager();
  const sideEffect = createMockSideEffect({
    sideEffectId: "effect-idem",
    effectKind: "external_api",
    idempotencyKey: "idem-key-123",
    riskClass: "medium",
  });
  const context: CompensationContext = {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "Test",
  };

  const plan = manager.planCompensation(sideEffect, context);

  assert.equal(plan.steps[0]?.targetRef, "idem-key-123");
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockSideEffect(overrides: Partial<SideEffectRecord> = {}): SideEffectRecord {
  return {
    id: overrides.sideEffectId ?? "se-default",
    sideEffectId: overrides.sideEffectId ?? "se-default",
    harnessRunId: overrides.harnessRunId ?? "harness-default",
    effectKind: overrides.effectKind ?? "test_effect",
    status: overrides.status ?? "succeeded",
    riskClass: overrides.riskClass ?? "low",
    externalRef: overrides.externalRef ?? "external-ref-123",
    idempotencyKey: overrides.idempotencyKey ?? "idem-key-default",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as SideEffectRecord;
}
