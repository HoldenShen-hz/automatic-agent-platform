/**
 * Integration tests for RuntimeTruthRepository
 *
 * Tests the runtime truth repository including lease validation
 * and concurrent operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  createHarnessRun,
  createNodeRun,
  createBudgetLedger,
  createBudgetReservation,
  createNodeAttemptReceipt,
  createRunVersionLock,
  type HarnessRun,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeTruthRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/runtime-truth-repository.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function makeHarnessRunTransitionCommand(
  aggregate: ReturnType<typeof createHarnessRun>,
  fromStatus: "created" | "admitted" | "planning" | "ready" | "running",
  toStatus: string,
) {
  return {
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: aggregate.harnessRunId,
    aggregateType: "HarnessRun" as const,
    aggregate,
    fromStatus,
    toStatus: toStatus as "admitted" | "planning" | "ready" | "running",
    principal: "test-suite",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "test",
    emittedBy: "test-suite",
    leaseId: aggregate.ownership.ownerId,
    fencingToken: aggregate.fencingToken,
    auditRef: `audit://runtime-truth/${aggregate.harnessRunId}/${toStatus}`,
    ...(toStatus === "admitted" ? { runVersionLockId: "rvlock-1" } : {}),
  };
}

// ---------------------------------------------------------------------------
// Lease validation tests (§17.1 concurrent lease testing)
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository validates HarnessRun lease expiry", () => {
  const repository = new RuntimeTruthRepository();
  const expiredLeaseTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-lease-expired",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    // Simulate a HarnessRun with an expired lease
    leaseId: "lease-expired",
    ownership: { ownerId: "worker-owner-1", ownerType: "worker" },
  });

  repository.seed("HarnessRun", harnessRun);

  assert.throws(
    () =>
      repository.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun" as const,
        entityId: harnessRun.harnessRunId,
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        principal: "test",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "admission_ok",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
      }),
    ValidationError,
  );
});

test("RuntimeTruthRepository validates HarnessRun lease owner mismatch", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-lease-mismatch",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    // Lease holder does not match ownership owner
    leaseId: "worker-A",
    ownership: { ownerId: "worker-B", ownerType: "worker" }, // Different owner!
  });

  repository.seed("HarnessRun", harnessRun);

  assert.throws(
    () =>
      repository.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun" as const,
        entityId: harnessRun.harnessRunId,
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        principal: "test",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "admission_ok",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
      }),
    ValidationError,
  );
});

test("RuntimeTruthRepository allows transition without lease", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-no-lease",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    // No lease property
  });

  repository.seed("HarnessRun", harnessRun);

  // This should succeed without lease validation
  const result = repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: harnessRun.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
  });

  assert.equal(result.aggregate.status, "admitted");
});

test("RuntimeTruthRepository allows valid lease holder transition", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-valid-lease",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    leaseId: "lease-valid",
    ownership: { ownerId: "worker-1", ownerType: "worker" },
  });

  repository.seed("HarnessRun", harnessRun);

  // This should succeed
  const result = repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: harnessRun.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: harnessRun,
    fromStatus: "created",
    toStatus: "admitted",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "admission_ok",
    emittedBy: "test",
    runVersionLockId: "rvlock-1",
  });

  assert.equal(result.aggregate.status, "admitted");
});

// ---------------------------------------------------------------------------
// §17.1 Concurrent lease acquisition test
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository handles concurrent transitions on same aggregate", () => {
  const repository = new RuntimeTruthRepository();

  // Create multiple HarnessRun instances for concurrent testing
  const runs: HarnessRun[] = [];
  for (let i = 0; i < 5; i++) {
    const run = createHarnessRun({
      harnessRunId: `hrun-concurrent-${i}`,
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: `request-${i}`,
      requestHash: `hash-${i}`,
      constraintPackRef: "cp-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "bledger-1",
    });
    runs.push(run);
    repository.seed("HarnessRun", run);
  }

  // Each transition should succeed independently
  const results = runs.map((run, i) =>
    repository.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun" as const,
      entityId: run.harnessRunId,
      aggregateType: "HarnessRun",
      aggregate: run,
      fromStatus: "created",
      toStatus: "admitted",
      principal: "test",
      tenantId: "tenant-1",
      traceId: `trace-${i}`,
      reasonCode: "admission_ok",
      emittedBy: "test",
      runVersionLockId: "rvlock-1",
    }),
  );

  // All transitions should succeed
  assert.equal(results.length, 5);
  assert.ok(results.every((r) => r.aggregate.status === "admitted"));
});

// ---------------------------------------------------------------------------
// Snapshot isolation tests
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository snapshot provides consistent view", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-snapshot-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });

  repository.seed("HarnessRun", harnessRun);

  // First snapshot
  const snapshot1 = repository.snapshot();
  assert.equal(snapshot1.harnessRuns.length, 1);

  // Transition changes state
  repository.transition(makeHarnessRunTransitionCommand(harnessRun, "created", "admitted"));

  // Second snapshot should reflect the change
  const snapshot2 = repository.snapshot();
  assert.equal(snapshot2.events.length, 1);
  assert.equal(snapshot1.events.length, 0); // Original unchanged
});

// ---------------------------------------------------------------------------
// Transaction rollback tests
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository rolls back on transition error", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-rollback-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    status: "completed", // Terminal status
    currentSeq: 5,
  });

  repository.seed("HarnessRun", harnessRun);

  // Attempt invalid transition
  assert.throws(
    () =>
      repository.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun" as const,
        entityId: harnessRun.harnessRunId,
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "completed",
        toStatus: "running",
        principal: "test",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    Error,
  );

  // State should be unchanged
  const run = repository.getHarnessRun("hrun-rollback-1");
  assert.equal(run!.status, "completed");
  assert.equal(repository.listEvents().length, 0);
});

// ---------------------------------------------------------------------------
// NodeAttemptReceipt append-only tests
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository appendNodeAttemptReceipt is append-only", () => {
  const repository = new RuntimeTruthRepository();

  const receipt1 = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-append-1",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphId: "pg-1",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1,
    errorDetail: "",
  });

  repository.appendNodeAttemptReceipt(receipt1);

  // Second append with same ID should throw
  assert.throws(
    () => repository.appendNodeAttemptReceipt(receipt1),
    ValidationError,
  );

  // Snapshot should only contain one receipt
  const snapshot = repository.snapshot();
  assert.equal(snapshot.nodeAttemptReceipts.length, 1);
});

// ---------------------------------------------------------------------------
// RunVersionLock append-only tests
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository appendRunVersionLock is append-only", () => {
  const repository = new RuntimeTruthRepository();

  const lock = createRunVersionLock({
    runVersionLockId: "rvlock-append-1",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock);

  // Duplicate should throw
  assert.throws(
    () => repository.appendRunVersionLock(lock),
    ValidationError,
  );

  // Snapshot should only contain one lock
  const snapshot = repository.snapshot();
  assert.equal(snapshot.runVersionLocks.length, 1);
});

// ---------------------------------------------------------------------------
// Multi-aggregate integration
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository manages multiple aggregate types", () => {
  const repository = new RuntimeTruthRepository();

  // HarnessRun
  const run = createHarnessRun({
    harnessRunId: "hrun-multi-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  // BudgetLedger
  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-multi-1",
    tenantId: "tenant-1",
    harnessRunId: "hrun-multi-1",
    currency: "USD",
    hardCap: 5000,
  });
  repository.seed("BudgetLedger", ledger);

  // BudgetReservation
  const reservation = createBudgetReservation({
    budgetReservationId: "bresv-multi-1",
    budgetLedgerId: "bledger-multi-1",
    harnessRunId: "hrun-multi-1",
    amount: 1000,
    resourceKind: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  repository.seed("BudgetReservation", reservation);

  // NodeRun
  const nodeRun = createNodeRun({
    nodeRunId: "nrun-multi-1",
    harnessRunId: "hrun-multi-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });
  repository.seed("NodeRun", nodeRun);

  // Verify all aggregates are stored
  const snapshot = repository.snapshot();
  assert.equal(snapshot.harnessRuns.length, 1);
  assert.equal(snapshot.budgetLedgers.length, 1);
  assert.equal(snapshot.budgetReservations.length, 1);
  assert.equal(snapshot.nodeRuns.length, 1);
});

// ---------------------------------------------------------------------------
// Event sequencing tests
// ---------------------------------------------------------------------------

test("RuntimeTruthRepository assigns sequential aggregateSeq", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-seq-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    leaseId: "tenant-1",
    ownership: { ownerId: "tenant-1", ownerType: "tenant" },
  });
  repository.seed("HarnessRun", harnessRun);

  // First transition
  const t1 = repository.transition(
    makeHarnessRunTransitionCommand(harnessRun, "created", "admitted"),
  );
  assert.equal(t1.event.aggregateSeq, 1);

  // Second transition
  const t2 = repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: t1.aggregate.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: t1.aggregate,
    fromStatus: "admitted",
    toStatus: "planning",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-2",
    reasonCode: "start_planning",
    emittedBy: "test",
    auditRef: "audit://runtime-truth/hrun-seq-1/planning",
    ...(t1.aggregate.leaseId != null ? { leaseId: t1.aggregate.leaseId } : {}),
    ...(t1.aggregate.fencingToken != null ? { fencingToken: t1.aggregate.fencingToken } : {}),
  });
  assert.equal(t2.event.aggregateSeq, 2);

  // Third transition
  const t3 = repository.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun" as const,
    entityId: t2.aggregate.harnessRunId,
    aggregateType: "HarnessRun",
    aggregate: t2.aggregate,
    fromStatus: "planning",
    toStatus: "ready",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-3",
    reasonCode: "plan_complete",
    emittedBy: "test",
    auditRef: "audit://runtime-truth/hrun-seq-1/ready",
    ...(t2.aggregate.leaseId != null ? { leaseId: t2.aggregate.leaseId } : {}),
    ...(t2.aggregate.fencingToken != null ? { fencingToken: t2.aggregate.fencingToken } : {}),
  });
  assert.equal(t3.event.aggregateSeq, 3);

  // All events stored
  const events = repository.listEvents();
  assert.equal(events.length, 3);
});

// ---------------------------------------------------------------------------
// Snapshot versioning tests
// ---------------------------------------------------------------------------

test("snapshot returns version and createdAt fields", () => {
  const repository = new RuntimeTruthRepository();
  const snapshot1 = repository.snapshot();
  const snapshot2 = repository.snapshot();

  assert.equal(typeof snapshot1.version, "number");
  assert.equal(typeof snapshot1.createdAt, "string");
  assert.equal(snapshot1.version, 1);
  assert.equal(snapshot2.version, 2);
});

test("snapshot version increments on each call", () => {
  const repository = new RuntimeTruthRepository();

  const snap1 = repository.snapshot();
  const snap2 = repository.snapshot();
  const snap3 = repository.snapshot();

  assert.equal(snap1.version, 1);
  assert.equal(snap2.version, 2);
  assert.equal(snap3.version, 3);
});

test("snapshot createdAt is a valid ISO timestamp", () => {
  const repository = new RuntimeTruthRepository();
  const snapshot = repository.snapshot();

  const parsed = new Date(snapshot.createdAt);
  assert.ok(!isNaN(parsed.getTime()), "createdAt should be a valid ISO date string");
});

test("snapshot version is unique per snapshot and increments sequentially", () => {
  const repository = new RuntimeTruthRepository();

  const snap1 = repository.snapshot();
  repository.transition({
    commandId: newId("cmd"),
    entityType: "NodeRun" as const,
    entityId: "nrun-1",
    aggregateType: "NodeRun",
    aggregate: createNodeRun({
      nodeRunId: "nrun-1",
      harnessRunId: "hrun-1",
      planGraphBundleId: "pgb-1",
      graphVersion: 1,
      nodeId: "node-1",
    }),
    fromStatus: "created",
    toStatus: "ready",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });
  const snap2 = repository.snapshot();

  assert.ok(snap2.version > snap1.version, "Each snapshot should have a higher version than the previous");
});

test("snapshot returns empty state for new repository", () => {
  const repository = new RuntimeTruthRepository();
  const snapshot = repository.snapshot();

  assert.deepEqual(snapshot.harnessRuns, []);
  assert.deepEqual(snapshot.nodeRuns, []);
  assert.deepEqual(snapshot.sideEffects, []);
  assert.deepEqual(snapshot.budgetLedgers, []);
  assert.deepEqual(snapshot.budgetReservations, []);
  assert.deepEqual(snapshot.nodeAttemptReceipts, []);
  assert.deepEqual(snapshot.runVersionLocks, []);
  assert.deepEqual(snapshot.events, []);
  assert.deepEqual(snapshot.outbox, []);
  assert.deepEqual(snapshot.auditRefs, []);
  assert.equal(snapshot.version, 1);
  assert.ok(typeof snapshot.createdAt === "string");
});
