/**
 * Compensation Manager Unit Tests
 *
 * Tests compensation logic, side effect reversibility, compensation state machine,
 * plan generation, and human approval requirements.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CompensationManager, type CompensationPlan, type CompensationStep, type CompensationContext } from "../../../../src/platform/five-plane-execution/compensation-manager.js";
import type { SideEffectRecord, SideEffectStatus, CompensationRecord } from "../../../../src/platform/contracts/executable-contracts/index.js";
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

function createTestCompensationRecord(overrides: Partial<CompensationRecord> = {}): CompensationRecord {
  return {
    compensationId: newId("comp"),
    sideEffectId: newId("se"),
    harnessRunId: newId("hrun"),
    planRef: { artifactId: newId("art"), uri: "plan://ref" },
    status: "running",
    ...overrides,
  };
}

function createTestCompensationContext(): CompensationContext {
  return {
    tenantId: "test_tenant",
    traceId: newId("trace"),
    operatorId: "test_operator",
    reason: "test compensation",
  };
}

// ---------------------------------------------------------------------------
// Tests: isCompensatable
// ---------------------------------------------------------------------------

test("isCompensatable returns true for ambiguous status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });

  assert.equal(manager.isCompensatable(sideEffect), true);
});

test("isCompensatable returns true for compensation_required status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "compensation_required" });

  assert.equal(manager.isCompensatable(sideEffect), true);
});

test("isCompensatable returns true for failed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "failed" });

  assert.equal(manager.isCompensatable(sideEffect), true);
});

test("isCompensatable returns false for confirmed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "confirmed" });

  assert.equal(manager.isCompensatable(sideEffect), false);
});

test("isCompensatable returns false for compensated status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "compensated" });

  assert.equal(manager.isCompensatable(sideEffect), false);
});

test("isCompensatable returns false for committed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "committed" });

  assert.equal(manager.isCompensatable(sideEffect), false);
});

test("isCompensatable returns false for proposed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "proposed" });

  assert.equal(manager.isCompensatable(sideEffect), false);
});

// ---------------------------------------------------------------------------
// Tests: getNextCompensationStatus
// ---------------------------------------------------------------------------

test("getNextCompensationStatus: planned -> running via approve", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("planned", "approve");

  assert.equal(nextStatus, "running");
});

test("getNextCompensationStatus: planned -> requires_human via escalate", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("planned", "escalate");

  assert.equal(nextStatus, "requires_human");
});

test("getNextCompensationStatus: running -> succeeded via confirm", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("running", "confirm");

  assert.equal(nextStatus, "succeeded");
});

test("getNextCompensationStatus: running -> failed via fail", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("running", "fail");

  assert.equal(nextStatus, "failed");
});

test("getNextCompensationStatus: running -> requires_human via escalate", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("running", "escalate");

  assert.equal(nextStatus, "requires_human");
});

test("getNextCompensationStatus: failed -> planned via plan", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("failed", "plan");

  assert.equal(nextStatus, "planned");
});

test("getNextCompensationStatus: failed -> requires_human via escalate", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("failed", "escalate");

  assert.equal(nextStatus, "requires_human");
});

test("getNextCompensationStatus: requires_human -> planned via plan", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("requires_human", "plan");

  assert.equal(nextStatus, "planned");
});

test("getNextCompensationStatus: succeeded -> null (terminal)", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("succeeded", "approve");

  assert.equal(nextStatus, null);
});

test("getNextCompensationStatus: invalid transition returns null", () => {
  const manager = new CompensationManager();
  const nextStatus = manager.getNextCompensationStatus("planned", "confirm");

  assert.equal(nextStatus, null);
});

// ---------------------------------------------------------------------------
// Tests: getTargetSideEffectStatus
// ---------------------------------------------------------------------------

test("getTargetSideEffectStatus: succeeded -> compensated", () => {
  const manager = new CompensationManager();
  const targetStatus = manager.getTargetSideEffectStatus("succeeded");

  assert.equal(targetStatus, "compensated");
});

test("getTargetSideEffectStatus: failed -> failed", () => {
  const manager = new CompensationManager();
  const targetStatus = manager.getTargetSideEffectStatus("failed");

  assert.equal(targetStatus, "failed");
});

test("getTargetSideEffectStatus: requires_human -> manual_review_required", () => {
  const manager = new CompensationManager();
  const targetStatus = manager.getTargetSideEffectStatus("requires_human");

  assert.equal(targetStatus, "manual_review_required");
});

test("getTargetSideEffectStatus: running -> compensating", () => {
  const manager = new CompensationManager();
  const targetStatus = manager.getTargetSideEffectStatus("running");

  assert.equal(targetStatus, "compensating");
});

test("getTargetSideEffectStatus: planned -> compensating", () => {
  const manager = new CompensationManager();
  const targetStatus = manager.getTargetSideEffectStatus("planned");

  assert.equal(targetStatus, "compensating");
});

// ---------------------------------------------------------------------------
// Tests: requiresHumanApproval
// ---------------------------------------------------------------------------

test("requiresHumanApproval: low impact returns false", () => {
  const manager = new CompensationManager();
  const requiresApproval = manager.requiresHumanApproval("low");

  assert.equal(requiresApproval, false);
});

test("requiresHumanApproval: medium impact returns true", () => {
  const manager = new CompensationManager();
  const requiresApproval = manager.requiresHumanApproval("medium");

  assert.equal(requiresApproval, true);
});

test("requiresHumanApproval: high impact returns true", () => {
  const manager = new CompensationManager();
  const requiresApproval = manager.requiresHumanApproval("high");

  assert.equal(requiresApproval, true);
});

// ---------------------------------------------------------------------------
// Tests: validateCompensationPreconditions
// ---------------------------------------------------------------------------

test("validateCompensationPreconditions: valid for ambiguous side effect", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "ambiguous" });

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, true);
});

test("validateCompensationPreconditions: invalid for already compensated", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "compensated" });

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("already been compensated"));
});

test("validateCompensationPreconditions: invalid for non-compensatable state", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({ status: "confirmed" });

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes("not in a compensatable state"));
});

// ---------------------------------------------------------------------------
// Tests: planCompensation
// ---------------------------------------------------------------------------

test("planCompensation generates a valid compensation plan", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "file_write",
    riskClass: "medium",
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.compensationId);
  assert.equal(plan.sideEffectId, sideEffect.sideEffectId);
  assert.equal(plan.harnessRunId, sideEffect.harnessRunId);
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.createdAt);
});

test("planCompensation derives steps based on effect kind", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "external_api",
    riskClass: "low",
    idempotencyKey: "test-key-123",
    externalRef: "https://api.example.com/resource/123",
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.steps.length > 0);
  const firstStep = plan.steps[0];
  assert.equal(firstStep.stepType, "reverse");
  assert.ok(firstStep.action.includes("external_api"));
});

test("planCompensation estimates high impact for critical risk", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "transaction",
    riskClass: "critical",
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.steps.length > 0);
  const firstStep = plan.steps[0];
  assert.equal(firstStep.estimatedImpact, "high");
});

test("planCompensation estimates medium impact for high risk", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "external_api",
    riskClass: "high",
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.steps.length > 0);
  const firstStep = plan.steps[0];
  assert.equal(firstStep.estimatedImpact, "medium");
});

test("planCompensation estimates low impact for low risk", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "message_send",
    riskClass: "low",
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.steps.length > 0);
  const firstStep = plan.steps[0];
  assert.equal(firstStep.estimatedImpact, "low");
});

test("planCompensation uses externalRef as targetRef when available", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "external_api",
    riskClass: "low",
    externalRef: "https://api.example.com/resource/123",
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.steps.length > 0);
  const firstStep = plan.steps[0];
  assert.equal(firstStep.targetRef, "https://api.example.com/resource/123");
});

test("planCompensation uses idempotencyKey as targetRef when no externalRef", () => {
  const manager = new CompensationManager();
  const sideEffect = createTestSideEffect({
    effectKind: "tool_commit",
    riskClass: "low",
    idempotencyKey: "unique-idempotency-key",
    externalRef: undefined,
  });
  const context = createTestCompensationContext();

  const plan = manager.planCompensation(sideEffect, context);

  assert.ok(plan.steps.length > 0);
  const firstStep = plan.steps[0];
  assert.equal(firstStep.targetRef, "unique-idempotency-key");
});

// ---------------------------------------------------------------------------
// Tests: createCompensationRecord
// ---------------------------------------------------------------------------

test("createCompensationRecord creates record with default running status", () => {
  const manager = new CompensationManager();

  const record = manager.createCompensationRecord(
    "se_123",
    "hrun_456",
    { artifactId: "art_789", uri: "plan://ref" },
  );

  assert.equal(record.sideEffectId, "se_123");
  assert.equal(record.harnessRunId, "hrun_456");
  assert.equal(record.status, "running");
  assert.ok(record.compensationId);
});

test("createCompensationRecord creates record with custom status", () => {
  const manager = new CompensationManager();

  const record = manager.createCompensationRecord(
    "se_123",
    "hrun_456",
    { artifactId: "art_789", uri: "plan://ref" },
    "succeeded",
  );

  assert.equal(record.sideEffectId, "se_123");
  assert.equal(record.harnessRunId, "hrun_456");
  assert.equal(record.status, "succeeded");
  assert.ok(record.compensationId);
});

// ---------------------------------------------------------------------------
// Tests: Compensation State Machine Flow
// ---------------------------------------------------------------------------

test("full compensation flow: planned -> running -> succeeded", () => {
  const manager = new CompensationManager();

  // Start with planned status
  let currentStatus: "planned" | "running" | "succeeded" | "failed" = "planned";

  // Transition: planned -> running
  let nextStatus = manager.getNextCompensationStatus(currentStatus, "approve");
  assert.equal(nextStatus, "running");
  currentStatus = nextStatus!;

  // Transition: running -> succeeded
  nextStatus = manager.getNextCompensationStatus(currentStatus, "confirm");
  assert.equal(nextStatus, "succeeded");
});

test("full compensation flow: planned -> requires_human -> planned", () => {
  const manager = new CompensationManager();

  // Start with planned status
  let currentStatus: "planned" | "running" | "succeeded" | "failed" | "requires_human" = "planned";

  // Escalate
  let nextStatus = manager.getNextCompensationStatus(currentStatus, "escalate");
  assert.equal(nextStatus, "requires_human");
  currentStatus = nextStatus!;

  // Re-plan after human approval
  nextStatus = manager.getNextCompensationStatus(currentStatus, "plan");
  assert.equal(nextStatus, "planned");
});

test("failed compensation can be replanned", () => {
  const manager = new CompensationManager();

  let currentStatus: "planned" | "running" | "succeeded" | "failed" | "requires_human" = "running";

  // Fail
  let nextStatus = manager.getNextCompensationStatus(currentStatus, "fail");
  assert.equal(nextStatus, "failed");
  currentStatus = nextStatus!;

  // Re-plan
  nextStatus = manager.getNextCompensationStatus(currentStatus, "plan");
  assert.equal(nextStatus, "planned");
});

// ---------------------------------------------------------------------------
// Tests: Irreversible Side Effect Marker
// ---------------------------------------------------------------------------

test("IrreversibleSideEffectMarker interface structure", () => {
  const marker = {
    sideEffectId: "se_123",
    irreversibleReason: "Database transaction that cannot be rolled back",
    elevatedApprovalRequired: true,
    markedAt: new Date().toISOString(),
    markedBy: "system",
  };

  assert.equal(marker.sideEffectId, "se_123");
  assert.ok(marker.irreversibleReason.length > 0);
  assert.equal(marker.elevatedApprovalRequired, true);
  assert.ok(marker.markedAt);
  assert.ok(marker.markedBy);
});
