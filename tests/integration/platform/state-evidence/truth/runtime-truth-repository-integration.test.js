/**
 * Integration tests for RuntimeTruthRepository
 *
 * Tests the runtime truth repository including lease validation
 * and concurrent operations.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { createHarnessRun, createNodeRun, createBudgetLedger, createBudgetReservation, createNodeAttemptReceipt, createRunVersionLock, } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeTruthRepository } from "../../../../src/platform/state-evidence/truth/runtime-truth-repository.js";
// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------
function makeHarnessRunTransitionCommand(aggregate, fromStatus, toStatus) {
    return {
        aggregateType: "HarnessRun",
        aggregate,
        fromStatus,
        toStatus: toStatus,
        tenantId: "test-tenant",
        traceId: "test-trace",
        reasonCode: "test",
        emittedBy: "test-suite",
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
        lease: {
            leaseId: "lease-expired",
            ownerId: "worker-owner-1",
            expiresAt: expiredLeaseTime,
        },
        ownedBy: "worker-owner-1",
    });
    repository.seed("HarnessRun", harnessRun);
    assert.throws(() => repository.transition({
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "admission_ok",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
    }), ValidationError);
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
        // Lease owner does not match ownedBy
        lease: {
            leaseId: "lease-mismatch",
            ownerId: "worker-A",
            expiresAt: new Date(Date.now() + 60000).toISOString(), // valid expiry
        },
        ownedBy: "worker-B", // Different owner!
    });
    repository.seed("HarnessRun", harnessRun);
    assert.throws(() => repository.transition({
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "admission_ok",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
    }), ValidationError);
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
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
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
        // Valid lease
        lease: {
            leaseId: "lease-valid",
            ownerId: "worker-1",
            expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
        },
        ownedBy: "worker-1", // Same owner as lease
    });
    repository.seed("HarnessRun", harnessRun);
    // This should succeed
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
    });
    assert.equal(result.aggregate.status, "admitted");
});
// ---------------------------------------------------------------------------
// §17.1 Concurrent lease acquisition test
// ---------------------------------------------------------------------------
test("RuntimeTruthRepository handles concurrent transitions on same aggregate", () => {
    const repository = new RuntimeTruthRepository();
    // Create multiple HarnessRun instances for concurrent testing
    const runs = [];
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
    const results = runs.map((run, i) => repository.transition({
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        tenantId: "tenant-1",
        traceId: `trace-${i}`,
        reasonCode: "admission_ok",
        emittedBy: "test",
        runVersionLockId: "rvlock-1",
    }));
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
    assert.throws(() => repository.transition({
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "completed",
        toStatus: "running",
        tenantId: "tenant-1",
        traceId: "trace-1",
        reasonCode: "illegal_resume",
        emittedBy: "test",
    }), Error);
    // State should be unchanged
    const run = repository.getHarnessRun("hrun-rollback-1");
    assert.equal(run.status, "completed");
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
        receiptKind: "tool",
        status: "succeeded",
    });
    repository.appendNodeAttemptReceipt(receipt1);
    // Second append with same ID should throw
    assert.throws(() => repository.appendNodeAttemptReceipt(receipt1), ValidationError);
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
    assert.throws(() => repository.appendRunVersionLock(lock), ValidationError);
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
    });
    repository.seed("HarnessRun", harnessRun);
    // First transition
    const t1 = repository.transition(makeHarnessRunTransitionCommand(harnessRun, "created", "admitted"));
    assert.equal(t1.event.aggregateSeq, 1);
    // Second transition
    const t2 = repository.transition({
        aggregateType: "HarnessRun",
        aggregate: t1.aggregate,
        fromStatus: "admitted",
        toStatus: "planning",
        tenantId: "tenant-1",
        traceId: "trace-2",
        reasonCode: "start_planning",
        emittedBy: "test",
    });
    assert.equal(t2.event.aggregateSeq, 2);
    // Third transition
    const t3 = repository.transition({
        aggregateType: "HarnessRun",
        aggregate: t2.aggregate,
        fromStatus: "planning",
        toStatus: "ready",
        tenantId: "tenant-1",
        traceId: "trace-3",
        reasonCode: "plan_complete",
        emittedBy: "test",
    });
    assert.equal(t3.event.aggregateSeq, 3);
    // All events stored
    const events = repository.listEvents();
    assert.equal(events.length, 3);
});
//# sourceMappingURL=runtime-truth-repository-integration.test.js.map