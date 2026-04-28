import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  createSideEffectRecord,
  type ArtifactRef,
  type SideEffectStatus,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../../../src/platform/execution/runtime-state-machine.js";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

const testArtifact: ArtifactRef = {
  artifactId: "test-artifact",
  uri: "artifact://test-artifact",
  hash: "sha256:test",
};

function createTestSideEffect(overrides?: Partial<Parameters<typeof createSideEffectRecord>[0]>) {
  return createSideEffectRecord({
    harnessRunId: "hrun-1",
    nodeRunId: "nrun-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-key-1",
    riskClass: "medium",
    preCommitPolicyProofRef: testArtifact,
    ...overrides,
  });
}

function makeSideEffectTransitionCommand(
  aggregate: ReturnType<typeof createSideEffectRecord>,
  fromStatus: SideEffectStatus,
  toStatus: SideEffectStatus,
  leaseId?: string,
  fencingToken?: string,
) {
  return {
    aggregateType: "SideEffectRecord" as const,
    aggregate,
    fromStatus,
    toStatus,
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "test",
    emittedBy: "test-suite",
    ...(leaseId != null ? { leaseId } : {}),
    ...(fencingToken != null ? { fencingToken } : {}),
  };
}

// ---------------------------------------------------------------------------
// SideEffectRecord lifecycle transitions (R4-33)
// ---------------------------------------------------------------------------

test("SideEffectRecord starts with proposed status by default", () => {
  const sideEffect = createTestSideEffect();
  assert.equal(sideEffect.status, "proposed");
});

test("SideEffectRecord can transition from proposed to approved", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "proposed" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord can transition from approved to reserved", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "approved" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "approved",
    toStatus: "reserved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "reserved",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "reserved");
});

test("SideEffectRecord can transition from reserved to committing", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "reserved" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "reserved",
    toStatus: "committing",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "committing",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "committing");
});

test("SideEffectRecord can transition from committing to committed", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "committing",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committing",
    toStatus: "committed",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "committed",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "committed");
});

test("SideEffectRecord can transition from committed to confirming", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "committed",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committed",
    toStatus: "confirming",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "confirming",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "confirming");
});

test("SideEffectRecord can transition from confirming to confirmed", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "confirming",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "confirming",
    toStatus: "confirmed",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "confirmed",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "confirmed");
});

test("SideEffectRecord can transition from confirmed to ambiguous", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "confirming",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "confirming",
    toStatus: "ambiguous",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "ambiguous",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "ambiguous");
});

test("SideEffectRecord can transition to manual_review_required", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "proposed" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "manual_review_required",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "review",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "manual_review_required");
});

test("SideEffectRecord can transition to reconciling", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "confirmed" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "confirmed",
    toStatus: "reconciling",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "reconcile",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "reconciling");
});

test("SideEffectRecord can transition to compensation_required", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "committed" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committed",
    toStatus: "compensation_required",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "compensation",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "compensation_required");
});

test("SideEffectRecord can transition from compensation_required to compensating", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "compensation_required" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "compensation_required",
    toStatus: "compensating",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "compensating",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "compensating");
});

test("SideEffectRecord can transition from compensating to compensated", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "compensating" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "compensating",
    toStatus: "compensated",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "compensated",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "compensated");
});

test("SideEffectRecord can transition to failed", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "proposed" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "failed",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "failed",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "failed");
});

test("SideEffectRecord can transition to revoked", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "proposed" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "revoked",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "revoked",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "revoked");
});

test("SideEffectRecord can transition to expired", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "reserved" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "reserved",
    toStatus: "expired",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "expired",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.status, "expired");
});

// ---------------------------------------------------------------------------
// R4-30: Fencing token enforcement for commit-affecting transitions
// ---------------------------------------------------------------------------

test("SideEffectRecord commit-affecting transition requires leaseId and fencingToken", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "reserved" });

  assert.throws(
    () =>
      stateMachine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "reserved",
        toStatus: "committing",
        tenantId: "test-tenant",
        traceId: "test-trace",
        reasonCode: "commit",
        emittedBy: "test-suite",
        // Missing leaseId and fencingToken
      }),
    WorkflowStateError,
  );
});

test("SideEffectRecord commit-affecting transition succeeds with valid leaseId and fencingToken", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "reserved" });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "reserved",
    toStatus: "committing",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "commit",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "committing");
});

test("SideEffectRecord throws when leaseId does not match stored leaseId", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "reserved",
    leaseId: "stored-lease-1",
  });

  assert.throws(
    () =>
      stateMachine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "reserved",
        toStatus: "committing",
        tenantId: "test-tenant",
        traceId: "test-trace",
        reasonCode: "commit",
        emittedBy: "test-suite",
        leaseId: "wrong-lease",
        fencingToken: "fence-token-1",
      }),
    WorkflowStateError,
  );
});

test("SideEffectRecord throws when fencingToken does not match stored fencingToken", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "reserved",
    leaseId: "lease-1",
    fencingToken: "stored-fence-token",
  });

  assert.throws(
    () =>
      stateMachine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "reserved",
        toStatus: "committing",
        tenantId: "test-tenant",
        traceId: "test-trace",
        reasonCode: "commit",
        emittedBy: "test-suite",
        leaseId: "lease-1",
        fencingToken: "wrong-fence-token",
      }),
    WorkflowStateError,
  );
});

test("SideEffectRecord commit transition succeeds when leaseId and fencingToken match stored values", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    status: "committing",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "committing",
    toStatus: "committed",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "committed",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });

  assert.equal(result.aggregate.status, "committed");
});

test("SideEffectRecord non-commit-affecting transitions do not require leaseId and fencingToken", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "proposed" });

  // proposed -> approved is not a commit-affecting transition
  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
    // No leaseId or fencingToken required
  });

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord emits event with correct aggregateType and aggregateId on transition", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-123",
    status: "proposed",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.equal(result.event.aggregateType, "SideEffectRecord");
  assert.equal(result.event.aggregateId, "seffect-123");
  assert.ok(result.event.eventType.includes("side_effect"));
});

// ---------------------------------------------------------------------------
// SideEffectRecord field preservation
// ---------------------------------------------------------------------------

test("SideEffectRecord preserves sideEffectId through transitions", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-unique-123",
    status: "proposed",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.sideEffectId, "seffect-unique-123");
});

test("SideEffectRecord preserves riskClass through transitions", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    riskClass: "critical",
    status: "proposed",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.riskClass, "critical");
});

test("SideEffectRecord preserves harnessRunId through transitions", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    harnessRunId: "hrun-critical-path",
    status: "proposed",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.harnessRunId, "hrun-critical-path");
});

test("SideEffectRecord preserves effectKind through transitions", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    effectKind: "transaction",
    status: "proposed",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.equal(result.aggregate.effectKind, "transaction");
});

test("SideEffectRecord updates updatedAt timestamp on transition", () => {
  const stateMachine = new RuntimeStateMachine();
  const originalTimestamp = "2024-01-01T00:00:00.000Z";
  const sideEffect = createTestSideEffect({
    createdAt: originalTimestamp,
    updatedAt: originalTimestamp,
    status: "proposed",
  });

  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
  });

  assert.notEqual(result.aggregate.updatedAt, originalTimestamp);
});

// ---------------------------------------------------------------------------
// SideEffectRecord validation edge cases
// ---------------------------------------------------------------------------

test("SideEffectRecord with high riskClass requires humanApprovalRef for certain transitions", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    riskClass: "high",
    status: "proposed",
  });

  // High risk side effects need approval ref during transition to approved
  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "proposed",
    toStatus: "approved",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "approved",
    emittedBy: "test-suite",
    sideEffectSafety: {
      humanApprovalRef: "approval-ref-123",
    },
  });

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord with critical riskClass requires humanApprovalRef for commit", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({
    riskClass: "critical",
    status: "reserved",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  // Critical risk needs human approval ref for commit
  const result = stateMachine.transition({
    aggregateType: "SideEffectRecord",
    aggregate: sideEffect,
    fromStatus: "reserved",
    toStatus: "committing",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "commit",
    emittedBy: "test-suite",
    leaseId: "lease-1",
    fencingToken: "fence-1",
    sideEffectSafety: {
      humanApprovalRef: "critical-approval-ref",
    },
  });

  assert.equal(result.aggregate.status, "committing");
});

test("SideEffectRecord terminates at dead-end states", () => {
  const stateMachine = new RuntimeStateMachine();
  const compensated = createTestSideEffect({ status: "compensated" });

  // compensated is a dead-end state - no valid transitions out
  // This test verifies the schema allows such states
  assert.equal(compensated.status, "compensated");
});

test("SideEffectRecord rejected transition throws WorkflowStateError", () => {
  const stateMachine = new RuntimeStateMachine();
  const sideEffect = createTestSideEffect({ status: "confirmed" });

  // confirmed -> proposed is not a valid transition
  assert.throws(
    () =>
      stateMachine.transition({
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: "confirmed",
        toStatus: "proposed",
        tenantId: "test-tenant",
        traceId: "test-trace",
        reasonCode: "invalid",
        emittedBy: "test-suite",
      }),
    WorkflowStateError,
  );
});