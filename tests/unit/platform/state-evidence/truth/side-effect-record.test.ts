import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  createSideEffectRecord,
  type ArtifactRef,
  type SideEffectStatus,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeTruthRepository } from "../../../../../src/platform/state-evidence/truth/runtime-truth-repository.js";

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
  extra?: { leaseId?: string; fencingToken?: string },
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
    ...(extra?.leaseId != null ? { leaseId: extra.leaseId } : {}),
    ...(extra?.fencingToken != null ? { fencingToken: extra.fencingToken } : {}),
  };
}

// ---------------------------------------------------------------------------
// SideEffectRecord seed and retrieval (R4-33 lifecycle)
// ---------------------------------------------------------------------------

test("seed stores SideEffectRecord and makes it retrievable", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-seed-1" });

  repository.seed("SideEffectRecord", sideEffect);

  assert.equal(repository.getSideEffect("seffect-seed-1")?.sideEffectId, "seffect-seed-1");
});

test("seed stores SideEffectRecord with all fields preserved", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fields-1",
    effectKind: "transaction",
    riskClass: "high",
    externalRef: "ext-ref-123",
  });

  repository.seed("SideEffectRecord", sideEffect);

  const retrieved = repository.getSideEffect("seffect-fields-1");
  assert.equal(retrieved?.sideEffectId, "seffect-fields-1");
  assert.equal(retrieved?.effectKind, "transaction");
  assert.equal(retrieved?.riskClass, "high");
  assert.equal(retrieved?.externalRef, "ext-ref-123");
});

test("getSideEffect returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getSideEffect("non-existent-side-effect"), null);
});

test("SideEffectRecord starts with proposed status by default", () => {
  const sideEffect = createTestSideEffect();
  assert.equal(sideEffect.status, "proposed");
});

// ---------------------------------------------------------------------------
// SideEffectRecord lifecycle transitions through repository (R4-33)
// ---------------------------------------------------------------------------

test("SideEffectRecord can transition from proposed to approved via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-1",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.status, "approved");
  assert.equal(result.event.aggregateType, "SideEffectRecord");
  assert.equal(result.event.aggregateId, "seffect-lifecycle-1");
});

test("SideEffectRecord can transition from approved to reserved via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-2",
    status: "approved",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "approved", "reserved"),
  );

  assert.equal(result.aggregate.status, "reserved");
});

test("SideEffectRecord can transition from reserved to committing via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-3",
    status: "reserved",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "reserved", "committing", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "committing");
});

test("SideEffectRecord can transition from committing to committed via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-4",
    status: "committing",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "committing", "committed", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "committed");
});

test("SideEffectRecord can transition from committed to confirming via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-5",
    status: "committed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "committed", "confirming", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "confirming");
});

test("SideEffectRecord can transition from confirming to confirmed via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-6",
    status: "confirming",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "confirming", "confirmed", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "confirmed");
});

test("SideEffectRecord can transition to manual_review_required via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-7",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "manual_review_required"),
  );

  assert.equal(result.aggregate.status, "manual_review_required");
});

test("SideEffectRecord can transition to reconciling via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-8",
    status: "confirmed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "confirmed", "reconciling"),
  );

  assert.equal(result.aggregate.status, "reconciling");
});

test("SideEffectRecord can transition to compensation_required via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-9",
    status: "committed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "committed", "compensation_required", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "compensation_required");
});

test("SideEffectRecord can transition from compensation_required to compensating via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-10",
    status: "compensation_required",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "compensation_required", "compensating"),
  );

  assert.equal(result.aggregate.status, "compensating");
});

test("SideEffectRecord can transition from compensating to compensated via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-11",
    status: "compensating",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "compensating", "compensated"),
  );

  assert.equal(result.aggregate.status, "compensated");
});

test("SideEffectRecord can transition to failed via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-12",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "failed"),
  );

  assert.equal(result.aggregate.status, "failed");
});

test("SideEffectRecord can transition to revoked via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-13",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "revoked"),
  );

  assert.equal(result.aggregate.status, "revoked");
});

test("SideEffectRecord can transition to expired via repository", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-lifecycle-14",
    status: "reserved",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "reserved", "expired"),
  );

  assert.equal(result.aggregate.status, "expired");
});

// ---------------------------------------------------------------------------
// Truth mutation with event append (INV-STATE-001)
// ---------------------------------------------------------------------------

test("transition appends platform fact event to repository events list", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-event-1" });
  repository.seed("SideEffectRecord", sideEffect);

  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  const events = repository.listEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].aggregateType, "SideEffectRecord");
  assert.equal(events[0].aggregateId, "seffect-event-1");
});

test("transition appends platform fact event to outbox", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-outbox-1" });
  repository.seed("SideEffectRecord", sideEffect);

  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  const outbox = repository.listOutbox();
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].aggregateId, "seffect-outbox-1");
});

test("multiple transitions increment aggregateSeq for same aggregate", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-seq-1",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const t1 = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );
  const t2 = repository.transition(
    makeSideEffectTransitionCommand(t1.aggregate, "approved", "reserved"),
  );
  const t3 = repository.transition(
    makeSideEffectTransitionCommand(t2.aggregate, "reserved", "committing", {
      leaseId: "lease-1",
      fencingToken: "fence-1",
    }),
  );

  assert.equal(t1.event.aggregateSeq, 1);
  assert.equal(t2.event.aggregateSeq, 2);
  assert.equal(t3.event.aggregateSeq, 3);
  assert.equal(repository.listEvents().length, 3);
});

test("transition updates aggregate in place (truth mutation)", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-mutation-1",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  const stored = repository.getSideEffect("seffect-mutation-1");
  assert.equal(stored?.status, "approved");
});

test("event contains correct payload with status change", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-payload-1",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.ok(result.event.payload);
  assert.deepEqual(result.event.payload, { status: "approved" });
});

test("event records occurredAt timestamp", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-time-1" });
  repository.seed("SideEffectRecord", sideEffect);

  const before = new Date().toISOString();
  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );
  const after = new Date().toISOString();

  const event = repository.listEvents()[0];
  assert.ok(event.occurredAt >= before && event.occurredAt <= after);
});

test("transition stores event in both events list and outbox simultaneously", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-both-1" });
  repository.seed("SideEffectRecord", sideEffect);

  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(repository.listEvents().length, 1);
  assert.equal(repository.listOutbox().length, 1);
  assert.equal(
    repository.listEvents()[0],
    repository.listOutbox()[0],
    "events list and outbox should contain same event reference",
  );
});

// ---------------------------------------------------------------------------
// R4-30: Fencing token enforcement for commit-affecting transitions
// ---------------------------------------------------------------------------

test("SideEffectRecord commit-affecting transition requires leaseId and fencingToken", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-1",
    status: "reserved",
  });
  repository.seed("SideEffectRecord", sideEffect);

  assert.throws(
    () =>
      repository.transition(
        makeSideEffectTransitionCommand(sideEffect, "reserved", "committing"),
      ),
    WorkflowStateError,
  );
});

test("SideEffectRecord commit-affecting transition succeeds with valid leaseId and fencingToken", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-2",
    status: "reserved",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "reserved", "committing", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "committing");
});

test("SideEffectRecord throws when leaseId does not match stored leaseId", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-3",
    status: "reserved",
    leaseId: "stored-lease-1",
  });
  repository.seed("SideEffectRecord", sideEffect);

  assert.throws(
    () =>
      repository.transition(
        makeSideEffectTransitionCommand(sideEffect, "reserved", "committing", {
          leaseId: "wrong-lease",
          fencingToken: "fence-token-1",
        }),
      ),
    WorkflowStateError,
  );
});

test("SideEffectRecord throws when fencingToken does not match stored fencingToken", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-4",
    status: "reserved",
    leaseId: "lease-1",
    fencingToken: "stored-fence-token",
  });
  repository.seed("SideEffectRecord", sideEffect);

  assert.throws(
    () =>
      repository.transition(
        makeSideEffectTransitionCommand(sideEffect, "reserved", "committing", {
          leaseId: "lease-1",
          fencingToken: "wrong-fence-token",
        }),
      ),
    WorkflowStateError,
  );
});

test("SideEffectRecord commit transition succeeds when leaseId and fencingToken match stored values", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-5",
    status: "committing",
    leaseId: "lease-1",
    fencingToken: "fence-token-1",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "committing", "committed", {
      leaseId: "lease-1",
      fencingToken: "fence-token-1",
    }),
  );

  assert.equal(result.aggregate.status, "committed");
});

test("SideEffectRecord non-commit-affecting transitions do not require leaseId and fencingToken", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-6",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  // proposed -> approved is not a commit-affecting transition
  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.status, "approved");
});

test("SideEffectRecord rejected transition throws WorkflowStateError and does not mutate state", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-fence-7",
    status: "confirmed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  // confirmed -> proposed is not a valid transition
  assert.throws(
    () =>
      repository.transition(
        makeSideEffectTransitionCommand(sideEffect, "confirmed", "proposed"),
      ),
    WorkflowStateError,
  );

  // State must be unchanged
  const stored = repository.getSideEffect("seffect-fence-7");
  assert.equal(stored?.status, "confirmed");
  assert.equal(repository.listEvents().length, 0);
});

test("SideEffectRecord transition rolls back on error (transaction atomicity)", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-rollback-1",
    status: "reserved",
    leaseId: "stored-lease",
  });
  repository.seed("SideEffectRecord", sideEffect);

  // This should throw due to lease mismatch
  try {
    repository.transition(
      makeSideEffectTransitionCommand(sideEffect, "reserved", "committing", {
        leaseId: "wrong-lease",
        fencingToken: "fence-token-1",
      }),
    );
  } catch (error) {
    // Expected to throw
  }

  // State must be unchanged after rollback
  const stored = repository.getSideEffect("seffect-rollback-1");
  assert.equal(stored?.status, "reserved");
  assert.equal(stored?.leaseId, "stored-lease");
  assert.equal(repository.listEvents().length, 0);
});

// ---------------------------------------------------------------------------
// SideEffectRecord field preservation through transitions
// ---------------------------------------------------------------------------

test("SideEffectRecord preserves sideEffectId through transitions", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-preserve-1",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.sideEffectId, "seffect-preserve-1");
});

test("SideEffectRecord preserves riskClass through transitions", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-preserve-2",
    riskClass: "critical",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.riskClass, "critical");
});

test("SideEffectRecord preserves harnessRunId through transitions", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-preserve-3",
    harnessRunId: "hrun-critical-path",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.harnessRunId, "hrun-critical-path");
});

test("SideEffectRecord preserves effectKind through transitions", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-preserve-4",
    effectKind: "transaction",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.effectKind, "transaction");
});

test("SideEffectRecord updates updatedAt timestamp on transition", () => {
  const repository = new RuntimeTruthRepository();
  const originalTimestamp = "2024-01-01T00:00:00.000Z";
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-preserve-5",
    createdAt: originalTimestamp,
    updatedAt: originalTimestamp,
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.notEqual(result.aggregate.updatedAt, originalTimestamp);
});

test("SideEffectRecord preserves idempotencyKey through transitions", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({
    sideEffectId: "seffect-preserve-6",
    idempotencyKey: "unique-idempotency-key-12345",
    status: "proposed",
  });
  repository.seed("SideEffectRecord", sideEffect);

  const result = repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  assert.equal(result.aggregate.idempotencyKey, "unique-idempotency-key-12345");
});

// ---------------------------------------------------------------------------
// Snapshot integration for SideEffectRecord
// ---------------------------------------------------------------------------

test("snapshot returns SideEffectRecords", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-snap-1" });
  repository.seed("SideEffectRecord", sideEffect);

  const snapshot = repository.snapshot();

  assert.equal(snapshot.sideEffects.length, 1);
  assert.equal(snapshot.sideEffects[0].sideEffectId, "seffect-snap-1");
});

test("snapshot includes SideEffectRecord events", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-snap-2" });
  repository.seed("SideEffectRecord", sideEffect);

  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );

  const snapshot = repository.snapshot();

  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0].aggregateType, "SideEffectRecord");
});

test("snapshot arrays are independent from subsequent mutations", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createTestSideEffect({ sideEffectId: "seffect-snap-3" });
  repository.seed("SideEffectRecord", sideEffect);

  const snapshot1 = repository.snapshot();
  repository.transition(
    makeSideEffectTransitionCommand(sideEffect, "proposed", "approved"),
  );
  const snapshot2 = repository.snapshot();

  assert.equal(snapshot1.events.length, 0);
  assert.equal(snapshot2.events.length, 1);
});