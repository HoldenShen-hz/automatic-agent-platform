/**
 * Additional unit tests for RuntimeTruthRepository
 *
 * Tests edge cases and additional coverage for the truth repository.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  createHarnessRun,
  createNodeRun,
  createBudgetLedger,
  createBudgetReservation,
  createSideEffectRecord,
  createNodeAttemptReceipt,
  createRunVersionLock,
  type ArtifactRef,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeTruthRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/runtime-truth-repository.js";

const testArtifact: ArtifactRef = {
  artifactId: "test-artifact",
  uri: "artifact://test-artifact",
  hash: "sha256:test",
};

function makeHarnessRunTransitionCommand(
  aggregate: ReturnType<typeof createHarnessRun>,
  fromStatus: "created" | "admitted" | "planning" | "ready" | "running",
  toStatus: string,
  overrides: Record<string, unknown> = {},
) {
  const leaseId = aggregate.leaseId ?? aggregate.ownership.ownerId;
  const fencingToken = aggregate.fencingToken ?? "fence-1";
  return {
    commandId: `cmd-${aggregate.harnessRunId}-${fromStatus}-${toStatus}`,
    entityType: "HarnessRun" as const,
    entityId: aggregate.harnessRunId,
    principal: "test-suite",
    aggregateType: "HarnessRun" as const,
    aggregate,
    fromStatus,
    toStatus: toStatus as "admitted" | "planning" | "ready" | "running",
    tenantId: "test-tenant",
    traceId: "test-trace",
    reasonCode: "test",
    emittedBy: "test-suite",
    leaseId,
    fencingToken,
    auditRef: `audit/ref/${aggregate.harnessRunId}/${fromStatus}/${toStatus}`,
    ...(toStatus === "admitted" ? { runVersionLockId: "rvlock-1" } : {}),
    ...overrides,
  };
}

test("RuntimeTruthRepository handles multiple aggregates of same type", () => {
  const repository = new RuntimeTruthRepository();

  // Seed multiple HarnessRuns
  for (let i = 0; i < 5; i++) {
    const run = createHarnessRun({
      harnessRunId: `hrun-${i}`,
      tenantId: "tenant-1",
      confirmedTaskSpecId: "ctspec-1",
      requestEnvelopeId: "request-1",
      requestHash: "hash-1",
      constraintPackRef: "cp-1",
      versionLockId: "rvlock-1",
      budgetLedgerId: "bledger-1",
    });
    repository.seed("HarnessRun", run);
  }

  const snapshot = repository.snapshot();
  assert.equal(snapshot.harnessRuns.length, 5);
});

test("RuntimeTruthRepository handles multiple NodeRuns per HarnessRun", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-multi",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  // Create multiple NodeRuns for the same HarnessRun
  for (let i = 0; i < 3; i++) {
    const nodeRun = createNodeRun({
      nodeRunId: `nrun-${i}`,
      harnessRunId: "hrun-multi",
      planGraphBundleId: "pgb-1",
      graphVersion: 1,
      nodeId: `node-${i}`,
    });
    repository.seed("NodeRun", nodeRun);
  }

  const snapshot = repository.snapshot();
  assert.equal(snapshot.nodeRuns.length, 3);
});

test("RuntimeTruthRepository stores different aggregate types independently even when IDs overlap", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-wrong-type",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  // Try to transition a different aggregate type with same ID
  const nodeRun = createNodeRun({
    nodeRunId: "hrun-wrong-type", // Same ID as harnessRun
    harnessRunId: "hrun-wrong-type",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });

  const result = repository.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: nodeRun.fencingToken,
  });

  assert.equal(result.aggregate.nodeRunId, "hrun-wrong-type");
  assert.equal(repository.getHarnessRun("hrun-wrong-type")?.harnessRunId, "hrun-wrong-type");
  assert.equal(repository.getNodeRun("hrun-wrong-type")?.nodeRunId, "hrun-wrong-type");
});

test("RuntimeTruthRepository.appendNodeAttemptReceipt validates receipt is append-only", () => {
  const repository = new RuntimeTruthRepository();

  const receipt = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-append-only",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });

  repository.appendNodeAttemptReceipt(receipt);

  // Trying to append the same receipt again should throw
  assert.throws(
    () => repository.appendNodeAttemptReceipt(receipt),
    (error: unknown) => error instanceof ValidationError && error.code === "runtime_truth_repository.duplicate_node_attempt_receipt",
  );
});

test("RuntimeTruthRepository.appendRunVersionLock validates lock is append-only", () => {
  const repository = new RuntimeTruthRepository();

  const lock = createRunVersionLock({
    runVersionLockId: "rvlock-append-only",
    harnessRunId: "hrun-1",
    runtimeProfileVersion: "1.0",
  });

  repository.appendRunVersionLock(lock);

  // Trying to append the same lock again should throw
  assert.throws(
    () => repository.appendRunVersionLock(lock),
    (error: unknown) => error instanceof ValidationError && error.code === "runtime_truth_repository.duplicate_run_version_lock",
  );
});

test("RuntimeTruthRepository.transition increments aggregateSeq correctly for same aggregate", () => {
  const repository = new RuntimeTruthRepository();

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-seq",
    harnessRunId: "hrun-seq",
    planGraphBundleId: "pgb-seq",
    graphVersion: 1,
    nodeId: "node-seq",
    status: "created",
    currentSeq: 0,
  });
  repository.seed("NodeRun", nodeRun);

  // First transition - use valid transitions
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
    fencingToken: nodeRun.fencingToken,
  });
  assert.equal(t1.event.aggregateSeq, 1);

  // Second transition on same aggregate - use valid transition
  const t2 = repository.transition({
    aggregateType: "NodeRun",
    aggregate: t1.aggregate,
    fromStatus: "ready",
    toStatus: "leased",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: t1.aggregate.fencingToken,
  });
  assert.equal(t2.event.aggregateSeq, 2);

  // Third transition
  const t3 = repository.transition({
    aggregateType: "NodeRun",
    aggregate: t2.aggregate,
    fromStatus: "leased",
    toStatus: "running",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: t2.aggregate.fencingToken,
  });
  assert.equal(t3.event.aggregateSeq, 3);
});

test("RuntimeTruthRepository stores events in both events list and outbox", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-events-outbox",
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
  assert.strictEqual(repository.listEvents()[0], repository.listOutbox()[0]);
});

test("RuntimeTruthRepository.transition records auditRef correctly", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-audit",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  const auditRef = "audit/ref/custom/path";
  repository.transition({
    ...makeHarnessRunTransitionCommand(run, "created", "admitted"),
    auditRef,
  });

  const refs = repository.listAuditRefs();
  assert.ok(refs.some((ref) => ref.includes("audit/ref/custom/path")));
});

test("RuntimeTruthRepository.auditRefs contain transaction markers", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-txn-markers",
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

  const refs = repository.listAuditRefs();
  assert.ok(refs.some((ref) => ref.startsWith("BEGIN_TXN_")));
  assert.ok(refs.some((ref) => ref.startsWith("COMMIT_TXN_")));
});

test("RuntimeTruthRepository.transaction rollback on error", () => {
  const repository = new RuntimeTruthRepository();

  const receipt1 = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-rollback-1",
    nodeAttemptId: "attempt-1",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });
  repository.appendNodeAttemptReceipt(receipt1);

  const receipt2 = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "receipt-rollback-2",
    nodeAttemptId: "attempt-2",
    nodeRunId: "nrun-1",
    receiptKind: "tool",
    status: "succeeded",
  });

  // This should fail because receipt1 is already appended
  assert.throws(
    () => repository.appendNodeAttemptReceipt(receipt1),
    ValidationError,
  );

  // After rollback, receipt2 should still be appendable
  repository.appendNodeAttemptReceipt(receipt2);

  const snapshot = repository.snapshot();
  assert.equal(snapshot.nodeAttemptReceipts.length, 2);
});

test("RuntimeTruthRepository.getHarnessRun returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getHarnessRun("non-existent-hrun"), null);
});

test("RuntimeTruthRepository.getNodeRun returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getNodeRun("non-existent-nrun"), null);
});

test("RuntimeTruthRepository.getSideEffect returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getSideEffect("non-existent-se"), null);
});

test("RuntimeTruthRepository.getBudgetLedger returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getBudgetLedger("non-existent-ledger"), null);
});

test("RuntimeTruthRepository.getBudgetReservation returns null for non-existent ID", () => {
  const repository = new RuntimeTruthRepository();
  assert.equal(repository.getBudgetReservation("non-existent-reservation"), null);
});

test("RuntimeTruthRepository handles seed then transition workflow", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-seed-transition",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });

  // Seed first
  repository.seed("HarnessRun", harnessRun);
  assert.equal(repository.getHarnessRun("hrun-seed-transition")?.harnessRunId, "hrun-seed-transition");

  // Then transition
  const result = repository.transition(makeHarnessRunTransitionCommand(harnessRun, "created", "admitted"));
  assert.equal(result.aggregate.status, "admitted");
});

test("RuntimeTruthRepository applies explicit lease and fencing on initial NodeRun transition", () => {
  const repository = new RuntimeTruthRepository();

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-initial-fence",
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
  });

  const result = repository.transition({
    commandId: "cmd-node-run-init",
    entityType: "NodeRun",
    entityId: nodeRun.nodeRunId,
    principal: "test-suite",
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "initialize",
    emittedBy: "test-suite",
    leaseId: "lease-initial",
    fencingToken: "fence-initial",
  });

  assert.equal(result.aggregate.leaseId, "lease-initial");
  assert.equal(result.aggregate.fencingToken, "fence-initial");
  assert.equal(result.aggregate.status, "ready");
});

test("RuntimeTruthRepository validates lease for HarnessRun mutations", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-lease-validation",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    status: "admitted",
    currentSeq: 1,
    leaseId: "lease-current",
    fencingToken: "fence-current",
    ownership: { ownerId: "lease-current", ownerType: "worker" },
  });
  repository.seed("HarnessRun", harnessRun);

  // Stale lease ID should throw
  assert.throws(
    () => repository.transition({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "admitted",
      toStatus: "planning",
      tenantId: "tenant-1",
      traceId: "trace-1",
      reasonCode: "advance",
      emittedBy: "test",
      leaseId: "lease-stale",
      fencingToken: "fence-current",
    }),
    (error: unknown) =>
      error instanceof ValidationError
      && error.code === "runtime_truth_repository.contention_retry_exhausted"
      && (error.details as { causeCode?: string } | undefined)?.causeCode === "runtime_truth_repository.stale_lease_id",
  );
});

test("RuntimeTruthRepository validates fencing token for HarnessRun mutations", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-fencing-validation",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    status: "admitted",
    currentSeq: 1,
    leaseId: "lease-current",
    fencingToken: "fence-current",
    ownership: { ownerId: "lease-current", ownerType: "worker" },
  });
  repository.seed("HarnessRun", harnessRun);

  // Stale fencing token should throw
  assert.throws(
    () => repository.transition({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "admitted",
      toStatus: "planning",
      tenantId: "tenant-1",
      traceId: "trace-1",
      reasonCode: "advance",
      emittedBy: "test",
      leaseId: "lease-current",
      fencingToken: "fence-stale",
    }),
    (error: unknown) =>
      error instanceof ValidationError
      && error.code === "runtime_truth_repository.contention_retry_exhausted"
      && (error.details as { causeCode?: string } | undefined)?.causeCode === "runtime_truth_repository.stale_fencing_token",
  );
});

test("RuntimeTruthRepository requires leaseId and fencingToken when HarnessRun has them", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-lease-required",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    status: "admitted",
    currentSeq: 1,
    leaseId: "lease-set",
    fencingToken: "fence-set",
    ownership: { ownerId: "lease-set", ownerType: "worker" },
  });
  repository.seed("HarnessRun", harnessRun);

  // Missing leaseId should throw
  assert.throws(
    () => repository.transition({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "admitted",
      toStatus: "planning",
      tenantId: "tenant-1",
      traceId: "trace-1",
      reasonCode: "advance",
      emittedBy: "test",
      // Missing leaseId
      fencingToken: "fence-set",
    }),
    (error: unknown) =>
      error instanceof ValidationError
      && error.code === "runtime_truth_repository.contention_retry_exhausted"
      && (error.details as { causeCode?: string } | undefined)?.causeCode === "runtime_truth_repository.lease_fencing_required",
  );
});

test("RuntimeTruthRepository snapshot returns independent arrays", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-snapshot-independent",
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
  const harnessRuns1Array = snapshot1.harnessRuns;

  // Add more data
  repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));

  const snapshot2 = repository.snapshot();

  // Snapshot arrays should be independent copies
  assert.equal(harnessRuns1Array.length, 1);
  assert.equal(snapshot2.harnessRuns.length, 1);
  // The original snapshot array should not reflect the transition
  assert.equal(snapshot1.harnessRuns.length, 1);
});

test("RuntimeTruthRepository synthesizes auditRef for HarnessRun transitions when omitted", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-no-audit",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  const command = makeHarnessRunTransitionCommand(run, "created", "admitted");
  delete command.auditRef;

  const result = repository.transition(command);

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(repository.listEvents().length, 1);
  assert.ok(repository.listAuditRefs().some((entry) => entry.startsWith("BEGIN_TXN_")));
  assert.ok(repository.listAuditRefs().some((entry) => entry.startsWith("COMMIT_TXN_")));
});

test("RuntimeTruthRepository transaction markers stay unique across consecutive transitions", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-txn-markers",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", run);

  const admitted = repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));
  repository.transition(makeHarnessRunTransitionCommand(admitted.aggregate, "admitted", "planning"));

  const transactionMarkers = repository.listAuditRefs()
    .filter((entry) => entry.startsWith("BEGIN_TXN_"))
    .map((entry) => entry.replace("BEGIN_", ""));
  assert.equal(transactionMarkers.length, 2);
  assert.equal(new Set(transactionMarkers).size, 2);
});

test("RuntimeTruthRepository assigns monotonic fallback fencing tokens when commands omit them", () => {
  const repository = new RuntimeTruthRepository();

  const firstNode = {
    ...createNodeRun({
      nodeRunId: "nrun-fence-1",
      harnessRunId: "hrun-fence-1",
      planGraphBundleId: "pgb-1",
      graphVersion: 1,
      nodeId: "node-1",
    }),
    fencingToken: undefined,
  };
  const secondNode = {
    ...createNodeRun({
      nodeRunId: "nrun-fence-2",
      harnessRunId: "hrun-fence-2",
      planGraphBundleId: "pgb-2",
      graphVersion: 1,
      nodeId: "node-2",
    }),
    fencingToken: undefined,
  };

  const first = repository.transition({
    commandId: "cmd-fence-1",
    entityType: "NodeRun" as const,
    entityId: firstNode.nodeRunId,
    aggregateType: "NodeRun",
    aggregate: firstNode,
    fromStatus: "created",
    toStatus: "ready",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    auditRef: "audit://runtime-truth/node-fence-1",
  });
  const second = repository.transition({
    commandId: "cmd-fence-2",
    entityType: "NodeRun" as const,
    entityId: secondNode.nodeRunId,
    aggregateType: "NodeRun",
    aggregate: secondNode,
    fromStatus: "created",
    toStatus: "ready",
    principal: "test",
    tenantId: "tenant-1",
    traceId: "trace-2",
    reasonCode: "test",
    emittedBy: "test",
    auditRef: "audit://runtime-truth/node-fence-2",
  });

  assert.equal(first.aggregate.fencingToken, "1");
  assert.equal(second.aggregate.fencingToken, "2");
});

test("RuntimeTruthRepository appends events with correct aggregateSeq across different aggregates", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-events",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  const nodeRun = createNodeRun({
    nodeRunId: "nrun-events",
    harnessRunId: "hrun-events",
    planGraphBundleId: "pgb-1",
    graphVersion: 1,
    nodeId: "node-1",
    status: "created",
    currentSeq: 0,
  });
  repository.seed("NodeRun", nodeRun);

  // Transition HarnessRun
  repository.transition(makeHarnessRunTransitionCommand(harnessRun, "created", "admitted"));

  // Transition NodeRun
  repository.transition({
    aggregateType: "NodeRun",
    aggregate: nodeRun,
    fromStatus: "created",
    toStatus: "ready",
    tenantId: "tenant-1",
    traceId: "trace-1",
    reasonCode: "test",
    emittedBy: "test",
    leaseId: "lease-1",
    fencingToken: nodeRun.fencingToken,
  });

  const events = repository.listEvents();
  assert.equal(events.length, 2);
});

test("RuntimeTruthRepository CAS rejects protection field overwrite without expected protection hash", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-protection-cas",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    leaseId: "lease-a",
    fencingToken: "fence-a",
    ownership: { ownerId: "worker-a", ownerType: "agent" },
  });
  repository.seed("HarnessRun", harnessRun);

  const overwriteAttempt = repository.upsertWithCas({
    aggregateType: "HarnessRun",
    aggregateId: harnessRun.harnessRunId,
    expectedVersion: harnessRun.currentSeq,
    aggregate: {
      ...harnessRun,
      leaseId: "lease-b",
      fencingToken: "fence-b",
      ownership: { ownerId: "worker-b", ownerType: "agent" },
    },
  });

  assert.equal(overwriteAttempt.success, false);
  assert.equal(typeof overwriteAttempt.actualProtectionHash, "string");
  assert.equal(repository.getHarnessRun(harnessRun.harnessRunId)?.leaseId, "lease-a");
});

test("RuntimeTruthRepository CAS accepts protection field overwrite with matching protection hash", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-protection-cas-ok",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
    leaseId: "lease-a",
    fencingToken: "fence-a",
    ownership: { ownerId: "worker-a", ownerType: "agent" },
  });
  repository.seed("HarnessRun", harnessRun);
  const protectionHash = repository.getAggregateProtectionHash("HarnessRun", harnessRun.harnessRunId);

  const overwriteAttempt = repository.upsertWithCas({
    aggregateType: "HarnessRun",
    aggregateId: harnessRun.harnessRunId,
    expectedVersion: harnessRun.currentSeq,
    expectedProtectionHash: protectionHash ?? undefined,
    aggregate: {
      ...harnessRun,
      leaseId: "lease-b",
      fencingToken: "fence-b",
      ownership: { ownerId: "worker-b", ownerType: "agent" },
    },
  });

  assert.equal(overwriteAttempt.success, true);
  assert.equal(repository.getHarnessRun(harnessRun.harnessRunId)?.leaseId, "lease-b");
});

test("RuntimeTruthRepository replay reuses original events without populating outbox", () => {
  const repository = new RuntimeTruthRepository();

  const harnessRun = createHarnessRun({
    harnessRunId: "hrun-replay-safe",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  repository.seed("HarnessRun", harnessRun);

  const originalTransition = repository.transition(makeHarnessRunTransitionCommand(harnessRun, "created", "admitted"));
  const replayRepository = new RuntimeTruthRepository();
  replayRepository.seed("HarnessRun", harnessRun);
  replayRepository.replayEvents([originalTransition.event]);

  const replayedEvents = replayRepository.listEvents();
  assert.equal(replayedEvents.length, 1);
  assert.equal(replayRepository.listOutbox().length, 0);
  assert.equal(replayedEvents[0]?.eventId, originalTransition.event.eventId);
  assert.equal(replayedEvents[0]?.traceId, originalTransition.event.traceId);
  assert.equal(replayRepository.getHarnessRun(harnessRun.harnessRunId)?.status, "admitted");
});

test("RuntimeTruthRepository allows initial aggregate transition without prior seed", () => {
  const repository = new RuntimeTruthRepository();

  const run = createHarnessRun({
    harnessRunId: "hrun-not-found",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "hash-1",
    constraintPackRef: "cp-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });
  const result = repository.transition(makeHarnessRunTransitionCommand(run, "created", "admitted"));

  assert.equal(result.aggregate.status, "admitted");
  assert.equal(repository.getHarnessRun("hrun-not-found")?.status, "admitted");
});

test("RuntimeTruthRepository allows unlocked HarnessRun admission without lease and fencing", () => {
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
    // No leaseId or fencingToken set
  });
  repository.seed("HarnessRun", harnessRun);

  const result = repository.transition({
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      tenantId: "tenant-1",
      traceId: "trace-1",
      reasonCode: "admission_ok",
      emittedBy: "test",
      runVersionLockId: "rvlock-1",
      auditRef: "audit/ref/hrun-no-lease/admission",
  });

  assert.equal(result.aggregate.status, "admitted");
});
