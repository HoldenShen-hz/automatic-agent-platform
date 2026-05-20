/**
 * Compensation Manager Unit Tests
 *
 * Tests for the CompensationManager class covering:
 * - createCompensationRecord
 * - isCompensatable
 * - getNextCompensationStatus
 * - getTargetSideEffectStatus
 * - requiresHumanApproval
 * - validateCompensationPreconditions
 * - planCompensation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSideEffectRecord, type ArtifactRef, type SideEffectRecord, type SideEffectStatus } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { CompensationManager, type CompensationContext } from "../../../../src/platform/five-plane-execution/compensation-manager.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

function createSideEffect(status: SideEffectStatus): SideEffectRecord {
  return createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status,
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
}

function createContext(): CompensationContext {
  return {
    tenantId: "tenant-1",
    traceId: "trace-1",
    operatorId: "operator-1",
    reason: "test compensation",
  };
}

test("CompensationManager creates compensation record", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  const result = manager.createCompensationRecord(
    sideEffect.sideEffectId,
    sideEffect.harnessRunId,
    artifact,
  );

  assert.equal(result.sideEffectId, sideEffect.sideEffectId);
  assert.equal(result.harnessRunId, sideEffect.harnessRunId);
  assert.ok(result.planRef);
});

test("CompensationManager creates compensation record with status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  const result = manager.createCompensationRecord(
    sideEffect.sideEffectId,
    sideEffect.harnessRunId,
    artifact,
    "planned",
  );

  assert.equal(result.status, "planned");
});

// ── isCompensatable Tests ─────────────────────────────────────────────────────

test("CompensationManager: isCompensatable returns true for ambiguous status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("ambiguous");

  assert.equal(manager.isCompensatable(sideEffect), true);
});

test("CompensationManager: isCompensatable returns true for compensation_required status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  assert.equal(manager.isCompensatable(sideEffect), true);
});

test("CompensationManager: isCompensatable returns true for failed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("failed");

  assert.equal(manager.isCompensatable(sideEffect), true);
});

test("CompensationManager: isCompensatable returns false for confirmed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("confirmed");

  assert.equal(manager.isCompensatable(sideEffect), false);
});

test("CompensationManager: isCompensatable returns false for compensated status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensated");

  assert.equal(manager.isCompensatable(sideEffect), false);
});

test("CompensationManager: isCompensatable returns false for committed status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("committed");

  assert.equal(manager.isCompensatable(sideEffect), false);
});

test("CompensationManager: isCompensatable returns false for reconciling status", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("reconciling");

  assert.equal(manager.isCompensatable(sideEffect), false);
});

// ── getNextCompensationStatus Tests ──────────────────────────────────────────

test("CompensationManager: getNextCompensationStatus planned -> approve -> running", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("planned", "approve");

  assert.equal(next, "running");
});

test("CompensationManager: getNextCompensationStatus planned -> escalate -> requires_human", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("planned", "escalate");

  assert.equal(next, "requires_human");
});

test("CompensationManager: getNextCompensationStatus running -> confirm -> succeeded", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("running", "confirm");

  assert.equal(next, "succeeded");
});

test("CompensationManager: getNextCompensationStatus running -> fail -> failed", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("running", "fail");

  assert.equal(next, "failed");
});

test("CompensationManager: getNextCompensationStatus running -> commit stays running", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("running", "commit");

  assert.equal(next, "running");
});

test("CompensationManager: getNextCompensationStatus succeeded has no transitions", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("succeeded", "approve");

  assert.equal(next, null);
});

test("CompensationManager: getNextCompensationStatus failed -> plan -> planned", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("failed", "plan");

  assert.equal(next, "planned");
});

test("CompensationManager: getNextCompensationStatus requires_human -> plan -> planned", () => {
  const manager = new CompensationManager();

  const next = manager.getNextCompensationStatus("requires_human", "plan");

  assert.equal(next, "planned");
});

// ── getTargetSideEffectStatus Tests ───────────────────────────────────────────

test("CompensationManager: getTargetSideEffectStatus succeeded -> compensated", () => {
  const manager = new CompensationManager();

  const status = manager.getTargetSideEffectStatus("succeeded");

  assert.equal(status, "compensated");
});

test("CompensationManager: getTargetSideEffectStatus failed -> failed", () => {
  const manager = new CompensationManager();

  const status = manager.getTargetSideEffectStatus("failed");

  assert.equal(status, "failed");
});

test("CompensationManager: getTargetSideEffectStatus requires_human -> manual_review_required", () => {
  const manager = new CompensationManager();

  const status = manager.getTargetSideEffectStatus("requires_human");

  assert.equal(status, "manual_review_required");
});

test("CompensationManager: getTargetSideEffectStatus running -> compensating", () => {
  const manager = new CompensationManager();

  const status = manager.getTargetSideEffectStatus("running");

  assert.equal(status, "compensating");
});

test("CompensationManager: getTargetSideEffectStatus planned -> compensating", () => {
  const manager = new CompensationManager();

  const status = manager.getTargetSideEffectStatus("planned");

  assert.equal(status, "compensating");
});

// ── requiresHumanApproval Tests ───────────────────────────────────────────────

test("CompensationManager: requiresHumanApproval high -> true", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("high"), true);
});

test("CompensationManager: requiresHumanApproval medium -> true", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("medium"), true);
});

test("CompensationManager: requiresHumanApproval low -> false", () => {
  const manager = new CompensationManager();

  assert.equal(manager.requiresHumanApproval("low"), false);
});

// ── validateCompensationPreconditions Tests ───────────────────────────────────

test("CompensationManager: validateCompensationPreconditions valid for ambiguous", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("ambiguous");

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, true);
});

test("CompensationManager: validateCompensationPreconditions valid for compensation_required", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, true);
});

test("CompensationManager: validateCompensationPreconditions invalid for compensated", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensated");

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, false);
  assert.ok(result.reason);
});

test("CompensationManager: validateCompensationPreconditions invalid for confirmed", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("confirmed");

  const result = manager.validateCompensationPreconditions(sideEffect);

  assert.equal(result.valid, false);
  assert.ok(result.reason);
});

// ── planCompensation Tests ────────────────────────────────────────────────────

test("CompensationManager: planCompensation creates plan with steps", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  const plan = manager.planCompensation(sideEffect, createContext());

  assert.ok(plan.compensationId);
  assert.equal(plan.sideEffectId, sideEffect.sideEffectId);
  assert.equal(plan.harnessRunId, sideEffect.harnessRunId);
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.createdAt);
});

test("CompensationManager: planCompensation derives steps based on effect kind", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  const plan = manager.planCompensation(sideEffect, createContext());

  assert.equal(plan.steps[0]?.stepType, "reverse");
  assert.ok(plan.steps[0]?.action.includes("external_api"));
});

test("CompensationManager: planCompensation estimates impact based on risk class", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "compensation_required",
    riskClass: "critical",
    preCommitPolicyProofRef: artifact,
  });

  const plan = manager.planCompensation(sideEffect, createContext());

  // Critical risk should result in high impact
  assert.equal(plan.steps[0]?.estimatedImpact, "high");
});

test("CompensationManager: planCompensation uses externalRef or idempotencyKey for targetRef", () => {
  const manager = new CompensationManager();
  const sideEffect = createSideEffect("compensation_required");

  const plan = manager.planCompensation(sideEffect, createContext());

  assert.ok(plan.steps[0]?.targetRef);
});
