import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  createBudgetReservation,
  createHarnessRun,
  createNodeAttemptReceipt,
  createNodeRun,
  createRunVersionLock,
  createSideEffectRecord,
  type ArtifactRef,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeTruthRepository } from "../../../../../src/platform/state-evidence/truth/runtime-truth-repository.js";

const testArtifact: ArtifactRef = {
  artifactId: "test-artifact",
  uri: "artifact://test-artifact",
  hash: "sha256:test",
};

// ---------------------------------------------------------------------------
// Helper to build a minimal valid transition command for a given aggregate
// ---------------------------------------------------------------------------

function makeHarnessRunTransitionCommand(
  aggregate: ReturnType<typeof createHarnessRun>,
  fromStatus: "created" | "admitted" | "planning" | "ready" | "running",
  toStatus: string,
) {
  return {
    aggregateType: "HarnessRun" as const,
    aggregate,
    fromStatus,
    toStatus: toStatus as "admitted" | "planning" | "ready" | "running",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "test",
    emittedBy: "test-suite",
    ...(toStatus === "admitted" ? { runVersionLockId: "rvlock-1" } : {}),
  };
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

test("seed stores HarnessRun and makes it retrievable", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });

  repository.seed("HarnessRun", run);

  assert.equal(repository.getHarnessRun("hrun-1")?.harnessRunId, "hrun-1");
});

test("seed stores NodeRun and makes it retrievable", () => {
  const repository = new RuntimeTruthRepository();
  const nodeRun = createNodeRun({
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });

  repository.seed("NodeRun", nodeRun);

  assert.equal(repository.getNodeRun("nrun-1")?.nodeRunId, "nrun-1");
});

test("seed stores SideEffectRecord and makes it retrievable", () => {
  const repository = new RuntimeTruthRepository();
  const sideEffect = createSideEffectRecord({
    sideEffectId: "seffect-1",
    harnessRunId: "hrun-1",
    nodeRunId: "nrun-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "medium",
    preCommitPolicyProofRef: testArtifact,
  });

  repository.seed("SideEffectRecord", sideEffect);

  assert.equal(repository.getSideEffect("seffect-1")?.sideEffectId, "seffect-1");
});

test("seed stores BudgetLedger and makes it retrievable", () => {
  const repository = new RuntimeTruthRepository();
  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-1",
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
  });

  repository.seed("BudgetLedger", ledger);

  assert.equal(repository.getBudgetLedger("bledger-1")?.budgetLedgerId, "bledger-1");
});

test("seed stores BudgetReservation and makes it retrievable", () => {
  const repository = new RuntimeTruthRepository();
  const reservation = createBudgetReservation({
    budgetReservationId: "bresv-1",
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    amount: 50,
    resourceKind: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });

  repository.seed("BudgetReservation", reservation);

  assert.equal(repository.getBudgetReservation("bresv-1")?.budgetReservationId, "bresv-1");
});

// ---------------------------------------------------------------------------
// transition
// ---------------------------------------------------------------------------

test("transition updates aggregate status and appends platform fact event", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    currentSeq: 0,
  });
  repository.seed("HarnessRun", run);

  const result = repository.transition(
    makeHarnessRunTransitionCommand(run, "created", "admitted"),
  );

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(result.event.eventType, "platform.harness_run.status_changed");
  assert.equal(result.event.aggregateSeq, 1);
});

test("transition rolls back state when invalid transition is attempted", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    status: "completed",
    currentSeq: 5,
  });
  repository.seed("HarnessRun", run);

  assert.throws(
    () =>
      repository.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "completed",
        toStatus: "running",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
      }),
    WorkflowStateError,
  );

  // State must be unchanged after rollback
  assert.equal(repository.getHarnessRun("hrun-1")?.status, "completed");
  assert.equal(repository.listEvents().length, 0);
});

test("transition throws when aggregate not found in repository", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  // Note: run is NOT seeded

  assert.throws(
    () =>
      repository.transition(
        makeHarnessRunTransitionCommand(run, "created", "admitted"),
      ),
    ValidationError,
  );
});

test("transition increments aggregateSeq for each event on same aggregate", () => {
  const repository = new RuntimeTruthRepository();
  const nodeRun = createNodeRun({
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "created",
    currentSeq: 0,
  });
  repository.seed("NodeRun", nodeRun);

  const t1 = repository.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  const t2 = repository.transition({
    aggregateType: "NodeRun",
    aggregate: t1.aggregate,
    fromStatus: "ready",
    toStatus: "queued",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(t1.event.aggregateSeq, 1);
  assert.equal(t2.event.aggregateSeq, 2);
  assert.equal(repository.listEvents().length, 2);
});

test("transition stores event in both events list and outbox", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));

  assert.equal(repository.listEvents().length, 1);
  assert.equal(repository.listOutbox().length, 1);
  assert.equal(repository.listEvents()[0], repository.listOutbox()[0]);
});

test("transition records auditRef when provided", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  repository.transition({
    ...makeHarnessRunTransitionCommand(run, "created", "admitted"),
    auditRef: "audit/ref/123",
  });

  assert.deepEqual(repository.listAuditRefs(), ["audit/ref/123"]);
});

// ---------------------------------------------------------------------------
// appendNodeAttemptReceipt
// ---------------------------------------------------------------------------

test("appendNodeAttemptReceipt stores receipt and makes it retrievable via snapshot", () => {
  const repository = new RuntimeTruthRepository();
  const receipt = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-1",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });

  repository.appendNodeAttemptReceipt(receipt);

  const snapshot = repository.snapshot();
  assert.equal(snapshot.nodeAttemptReceipts.length, 1);
  assert.equal(snapshot.nodeAttemptReceipts[0].nodeAttemptReceiptId, "receipt-1");
});

test("appendNodeAttemptReceipt throws when duplicate receipt ID is appended", () => {
  const repository = new RuntimeTruthRepository();
  const receipt = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-1",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });

  repository.appendNodeAttemptReceipt(receipt);

  assert.throws(
    () => repository.appendNodeAttemptReceipt(receipt),
    ValidationError,
  );
});

test("appendNodeAttemptReceipt throws with correct error code for duplicate", () => {
  const repository = new RuntimeTruthRepository();
  const receipt = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-dup",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });

  repository.appendNodeAttemptReceipt(receipt);

  try {
    repository.appendNodeAttemptReceipt(receipt);
    assert.fail("Expected ValidationError to be thrown");
  } catch (error) {
    assert.equal(error.code, "runtime_truth_repository.duplicate_node_attempt_receipt");
  }
});

test("appendNodeAttemptReceipt rolls back on error", () => {
  const repository = new RuntimeTruthRepository();
  const receipt1 = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-1",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });
  const receipt2 = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-2",
    nodeAttemptId: "attempt-2",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });

  repository.appendNodeAttemptReceipt(receipt1);
  assert.throws(() => repository.appendNodeAttemptReceipt(receipt1), ValidationError);
  repository.appendNodeAttemptReceipt(receipt2);

  const snapshot = repository.snapshot();
  assert.equal(snapshot.nodeAttemptReceipts.length, 2);
});

// ---------------------------------------------------------------------------
// appendRunVersionLock
// ---------------------------------------------------------------------------

test("appendRunVersionLock stores lock and makes it retrievable via snapshot", () => {
  const repository = new RuntimeTruthRepository();
  const lock = createRunVersionLock({
    runVersionLockId: "rvlock-1",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock);

  const snapshot = repository.snapshot();
  assert.equal(snapshot.runVersionLocks.length, 1);
  assert.equal(snapshot.runVersionLocks[0].runVersionLockId, "rvlock-1");
});

test("appendRunVersionLock throws when duplicate lock ID is appended", () => {
  const repository = new RuntimeTruthRepository();
  const lock = createRunVersionLock({
    runVersionLockId: "rvlock-dup",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock);

  assert.throws(
    () => repository.appendRunVersionLock(lock),
    ValidationError,
  );
});

test("appendRunVersionLock throws with correct error code for duplicate", () => {
  const repository = new RuntimeTruthRepository();
  const lock = createRunVersionLock({
    runVersionLockId: "rvlock-dup",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock);

  try {
    repository.appendRunVersionLock(lock);
    assert.fail("Expected ValidationError to be thrown");
  } catch (error) {
    assert.equal(error.code, "runtime_truth_repository.duplicate_run_version_lock");
  }
});

test("appendRunVersionLock rolls back on error", () => {
  const repository = new RuntimeTruthRepository();
  const lock1 = createRunVersionLock({
    runVersionLockId: "rvlock-1",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });
  const lock2 = createRunVersionLock({
    runVersionLockId: "rvlock-2",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock1);
  assert.throws(() => repository.appendRunVersionLock(lock1), ValidationError);
  repository.appendRunVersionLock(lock2);

  const snapshot = repository.snapshot();
  assert.equal(snapshot.runVersionLocks.length, 2);
});

// ---------------------------------------------------------------------------
// getHarnessRun / getNodeRun / getSideEffect / getBudgetLedger / getBudgetReservation
// ---------------------------------------------------------------------------

test("getHarnessRun returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getHarnessRun("non-existent"), null);
});

test("getNodeRun returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getNodeRun("non-existent"), null);
});

test("getSideEffect returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getSideEffect("non-existent"), null);
});

test("getBudgetLedger returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getBudgetLedger("non-existent"), null);
});

test("getBudgetReservation returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getBudgetReservation("non-existent"), null);
});

// ---------------------------------------------------------------------------
// listEvents / listOutbox / listAuditRefs
// ---------------------------------------------------------------------------

test("listEvents returns empty array when no events exist", () => {
  const repository = new RuntimeTruthRepository();
  assert.deepEqual(repository.listEvents(), []);
});

test("listOutbox returns empty array when no events exist", () => {
  const repository = new RuntimeTruthRepository();
  assert.deepEqual(repository.listOutbox(), []);
});

test("listAuditRefs returns empty array when no audit refs exist", () => {
  const repository = new RuntimeTruthRepository();
  assert.deepEqual(repository.listAuditRefs(), []);
});

test("listEvents returns a copy, not the internal array", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);
  repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));

  const events1 = repository.listEvents();
  const events2 = repository.listEvents();

  assert.notEqual(events1, events2);
  assert.deepEqual(events1, events2);
});

test("listOutbox returns a copy, not the internal array", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);
  repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));

  const outbox1 = repository.listOutbox();
  const outbox2 = repository.listOutbox();

  assert.notEqual(outbox1, outbox2);
  assert.deepEqual(outbox1, outbox2);
});

test("listAuditRefs returns a copy, not the internal array", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);
  repository.transition({
    ...makeHarnessRunTransitionCommand(run, "created", "admitted"),
    auditRef: "audit/ref/1",
  });

  const refs1 = repository.listAuditRefs();
  const refs2 = repository.listAuditRefs();

  assert.notEqual(refs1, refs2);
  assert.deepEqual(refs1, refs2);
});

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

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
});

test("snapshot returns all aggregates and events", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });
  repository.seed("NodeRun", nodeRun);

  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-1",
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
  });
  repository.seed("BudgetLedger", ledger);

  repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));

  const snapshot = repository.snapshot();

  assert.equal(snapshot.harnessRuns.length, 1);
  assert.equal(snapshot.nodeRuns.length, 1);
  assert.equal(snapshot.budgetLedgers.length, 1);
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.outbox.length, 1);
});

test("snapshot returns readonly arrays", () => {
  const repository = new RuntimeTruthRepository();
  const snapshot = repository.snapshot();

  // Verify readonly nature by checking they have readonly modifiers
  type IsReadonlyArray<T> = readonly T[] extends T[] ? false : true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _check: IsReadonlyArray<typeof snapshot.harnessRuns> = true;
  void _check;
});

test("snapshot arrays are independent from subsequent mutations", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  const snapshot1 = repository.snapshot();
  repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));
  const snapshot2 = repository.snapshot();

  assert.equal(snapshot1.events.length, 0);
  assert.equal(snapshot2.events.length, 1);
});

// ---------------------------------------------------------------------------
// Multiple aggregate types in same repository
// ---------------------------------------------------------------------------

test("repository can store and retrieve multiple aggregate types simultaneously", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });
  repository.seed("NodeRun", nodeRun);

  const sideEffect = createSideEffectRecord({
    sideEffectId: "seffect-1",
    harnessRunId: "hrun-1",
    nodeRunId: "nrun-1",
    nodeAttemptId: "attempt-1",
    effectKind: "external_api",
    idempotencyKey: "idem-1",
    riskClass: "low",
    preCommitPolicyProofRef: testArtifact,
  });
  repository.seed("SideEffectRecord", sideEffect);

  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-1",
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
  });
  repository.seed("BudgetLedger", ledger);

  const reservation = createBudgetReservation({
    budgetReservationId: "bresv-1",
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    amount: 50,
    resourceKind: "token",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  repository.seed("BudgetReservation", reservation);

  assert.equal(repository.getHarnessRun("hrun-1")?.harnessRunId, "hrun-1");
  assert.equal(repository.getNodeRun("nrun-1")?.nodeRunId, "nrun-1");
  assert.equal(repository.getSideEffect("seffect-1")?.sideEffectId, "seffect-1");
  assert.equal(repository.getBudgetLedger("bledger-1")?.budgetLedgerId, "bledger-1");
  assert.equal(repository.getBudgetReservation("bresv-1")?.budgetReservationId, "bresv-1");
});

// ---------------------------------------------------------------------------
// Transition failure edge cases
// ---------------------------------------------------------------------------

test("transition throws when HarnessRun admission lacks runVersionLockId", () => {
  const repository = new RuntimeTruthRepository();
  const run = createHarnessRun({
    harnessRunId: "hrun-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  assert.throws(
    () =>
      repository.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "admission_ok",
        emittedBy: "test",
        // Missing runVersionLockId
      }),
    WorkflowStateError,
  );
});

test("transition throws when NodeRun execution lacks leaseId and fencingToken", () => {
  const repository = new RuntimeTruthRepository();
  const nodeRun = createNodeRun({
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "ready",
  });
  repository.seed("NodeRun", nodeRun);

  assert.throws(
    () =>
      repository.transition({
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "ready",
        toStatus: "running",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "exec",
        emittedBy: "test",
        // Missing leaseId and fencingToken
      }),
    WorkflowStateError,
  );
});

test("transition with CAS version mismatch throws", () => {
  const repository = new RuntimeTruthRepository();
  const ledger = createBudgetLedger({
    budgetLedgerId: "bledger-1",
    tenantId: "tenant-1",
    harnessRunId: "hrun-1",
    currency: "USD",
    hardCap: 1000,
    version: 5,
  });
  repository.seed("BudgetLedger", ledger);

  assert.throws(
    () =>
      repository.transition({
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        expectedVersion: 3, // Wrong version
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "soft_cap",
        emittedBy: "test",
      }),
    WorkflowStateError,
  );
});
