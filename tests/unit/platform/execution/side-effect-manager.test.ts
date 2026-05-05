/**
 * Side Effect Manager Unit Tests
 *
 * Tests for the SideEffectManager class covering:
 * - applyReconciliation transitions
 * - startCompensation transitions
 * - completeCompensation transitions
 * - Status mapping for reconciliation results
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompensationRecord,
  createReconciliationRecord,
  createSideEffectRecord,
  type ArtifactRef,
  type SideEffectStatus,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../src/platform/execution/runtime-state-machine.js";
import { SideEffectManager, type SideEffectManagerContext } from "../../../../src/platform/execution/side-effect-manager.js";

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

const context = {
  tenantId: "tenant-1",
  traceId: "trace-1",
  emittedBy: "side-effect-manager",
  occurredAt: "2026-04-27T00:00:00.000Z",
  leaseId: "lease-side-effect-manager",
  fencingToken: "fence-side-effect-manager",
};

function createContext(): SideEffectManagerContext {
  return {
    tenantId: "tenant-1",
    traceId: "trace-1",
    emittedBy: "test",
    occurredAt: "2026-04-27T00:00:00.000Z",
    leaseId: "lease-side-effect-manager",
    fencingToken: "fence-side-effect-manager",
  };
}

// ── applyReconciliation Tests ─────────────────────────────────────────────────

test("SideEffectManager applies reconciliation mark_confirmed through RuntimeStateMachine", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "reconciling",
    riskClass: "medium",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "external_get",
    externalObservedState: { status: "committed" },
    result: "confirmed",
    nextAction: "mark_confirmed",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "confirmed");
  assert.equal(result.event.eventType, "platform.side_effect.status_changed");
  assert.equal(result.event.payload.reasonCode, "reconciliation.confirmed.mark_confirmed");
});

test("SideEffectManager routes ambiguous reconciliation to HITL-safe ambiguous state", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "committing",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "external_get",
    externalObservedState: { status: "unknown" },
    result: "ambiguous",
    nextAction: "escalate_hitl",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "ambiguous");
});

test("SideEffectManager completes compensation without mutating original record", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    status: "compensating",
    riskClass: "high",
    preCommitPolicyProofRef: artifact,
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: "run-1",
    planRef: artifact,
    status: "succeeded",
  });

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(sideEffect.status, "compensating");
  assert.equal(result.aggregate.status, "compensated");
});

// ── Additional applyReconciliation Tests ──────────────────────────────────────

test("SideEffectManager applies reconciliation - retry_probe", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "ambiguous",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "http_check",
    externalObservedState: { status: "unknown" },
    result: "ambiguous",
    nextAction: "retry_probe",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "reconciling");
  assert.ok(result.event);
});

test("SideEffectManager applies reconciliation - compensate", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "ambiguous",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "http_check",
    externalObservedState: { status: "diverged" },
    result: "not_found",
    nextAction: "compensate",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "compensation_required");
  assert.ok(result.event);
});

test("SideEffectManager applies reconciliation - mark_failed", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "ambiguous",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "http_check",
    externalObservedState: { status: "not_found" },
    result: "not_found",
    nextAction: "mark_failed",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "failed");
  assert.ok(result.event);
});

// ── startCompensation Tests ──────────────────────────────────────────────────

test("SideEffectManager starts compensation and transitions to compensating", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "compensation_required",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: sideEffect.harnessRunId,
    planRef: artifact,
    status: "running",
  });

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "compensating");
  assert.ok(result.event);
});

test("SideEffectManager sets reason code for compensation", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "compensation_required",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: sideEffect.harnessRunId,
    planRef: artifact,
    status: "running",
  });

  const result = manager.startCompensation(sideEffect, compensation, context);

  assert.ok(result.event.payload.reasonCode);
  assert.ok(result.event.payload.reasonCode.includes("compensation"));
});

// ── completeCompensation Tests ────────────────────────────────────────────────

test("SideEffectManager completes compensation - succeeded leads to compensated", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "compensating",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: sideEffect.harnessRunId,
    planRef: artifact,
    status: "succeeded",
  });

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "compensated");
  assert.ok(result.event);
});

test("SideEffectManager completes compensation - failed leads to failed", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "compensating",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const compensation = createCompensationRecord({
    sideEffectId: sideEffect.sideEffectId,
    harnessRunId: sideEffect.harnessRunId,
    planRef: artifact,
    status: "failed",
  });

  const result = manager.completeCompensation(sideEffect, compensation, context);

  assert.equal(result.aggregate.status, "failed");
  assert.ok(result.event);
});

// ── State Machine Injection Tests ─────────────────────────────────────────────

test("SideEffectManager uses injected state machine", () => {
  const stateMachine = new RuntimeStateMachine();
  const manager = new SideEffectManager({ stateMachine });
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "ambiguous",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "http_check",
    externalObservedState: { confirmed: true },
    result: "confirmed",
    nextAction: "mark_confirmed",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "confirmed");
  assert.ok(result.event);
});

test("SideEffectManager creates default state machine if not injected", () => {
  const manager = new SideEffectManager();
  const sideEffect = createSideEffectRecord({
    harnessRunId: "run-1",
    nodeRunId: "node-run-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "external-idem-1",
    status: "ambiguous",
    riskClass: "low",
    preCommitPolicyProofRef: artifact,
  });
  const reconciliation = createReconciliationRecord({
    sideEffectId: sideEffect.sideEffectId,
    probeKind: "http_check",
    externalObservedState: { confirmed: true },
    result: "confirmed",
    nextAction: "mark_confirmed",
  });

  const result = manager.applyReconciliation(sideEffect, reconciliation, context);

  assert.equal(result.aggregate.status, "confirmed");
  assert.ok(result.event);
});
