/**
 * Execution Lease Integration Tests
 *
 * Tests the full lease lifecycle: acquisition, renewal, release, and expiration.
 * Uses in-memory SQLite and temp directories for test isolation.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { ExecutionLeaseService } from "../../../../../src/platform/execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
const BASE_TIME = "2026-04-23T10:00:00.000Z";
const TTL_MS = 30_000;
function advanceTime(ms) {
    return new Date(Date.parse(BASE_TIME) + ms).toISOString();
}
// ── Lease Acquisition ──────────────────────────────────────────────────────────
test("lease: acquire grants lease to worker and increments fencing token", () => {
    const workspace = createTempWorkspace("aa-lease-acquire-");
    const dbPath = join(workspace, "lease-acquire.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-acquire",
            executionId: "exec-acquire",
        });
        const result = service.acquireLease({
            executionId: "exec-acquire",
            workerId: "worker-1",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(result.outcome, "granted");
        assert.ok(result.lease, "Lease should be returned");
        assert.equal(result.lease.workerId, "worker-1");
        assert.equal(result.lease.executionId, "exec-acquire");
        assert.equal(result.lease.status, "active");
        assert.equal(result.lease.fencingToken, 1);
        assert.ok(result.lease.leasedAt, "leasedAt should be set");
        assert.ok(result.lease.expiresAt, "expiresAt should be set");
        const activeLease = store.worker.getActiveExecutionLease("exec-acquire");
        assert.ok(activeLease, "Active lease should exist in store");
        assert.equal(activeLease.id, result.lease.id);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: acquire is blocked when active lease exists", () => {
    const workspace = createTempWorkspace("aa-lease-block-");
    const dbPath = join(workspace, "lease-block.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-block",
            executionId: "exec-block",
        });
        const first = service.acquireLease({
            executionId: "exec-block",
            workerId: "worker-a",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(first.outcome, "granted");
        const second = service.acquireLease({
            executionId: "exec-block",
            workerId: "worker-b",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(second.outcome, "blocked");
        assert.equal(second.reasonCode, "active_lease_exists");
        assert.ok(second.lease, "Blocked result should include the active lease");
        assert.equal(second.lease.workerId, "worker-a");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: acquire creates audit record for granted lease", () => {
    const workspace = createTempWorkspace("aa-lease-audit-grant-");
    const dbPath = join(workspace, "lease-audit-grant.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-audit-grant",
            executionId: "exec-audit-grant",
        });
        service.acquireLease({
            executionId: "exec-audit-grant",
            workerId: "worker-audit",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        const audits = store.listLeaseAudits("exec-audit-grant");
        assert.ok(audits.length > 0, "At least one audit record should exist");
        assert.ok(audits.some((a) => a.eventType === "lease_granted" && a.workerId === "worker-audit"), "Audit should record lease_granted event");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// ── Lease Renewal ──────────────────────────────────────────────────────────────
test("lease: renew extends lease expiration and updates heartbeat", () => {
    const workspace = createTempWorkspace("aa-lease-renew-");
    const dbPath = join(workspace, "lease-renew.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-renew",
            executionId: "exec-renew",
        });
        const granted = service.acquireLease({
            executionId: "exec-renew",
            workerId: "worker-renew",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(granted.outcome, "granted");
        const originalExpiresAt = granted.lease.expiresAt;
        const renewed = service.renewLease({
            leaseId: granted.lease.id,
            workerId: "worker-renew",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(10_000),
        });
        assert.equal(renewed.outcome, "renewed");
        assert.ok(renewed.lease, "Renewed lease should be returned");
        assert.ok(Date.parse(renewed.lease.expiresAt) > Date.parse(originalExpiresAt), "New expiration should be later than original");
        assert.equal(renewed.lease.fencingToken, granted.lease.fencingToken, "Fencing token should not change on renew");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: renew is blocked when worker ID does not match", () => {
    const workspace = createTempWorkspace("aa-lease-renew-mismatch-");
    const dbPath = join(workspace, "lease-renew-mismatch.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-renew-mismatch",
            executionId: "exec-renew-mismatch",
        });
        const granted = service.acquireLease({
            executionId: "exec-renew-mismatch",
            workerId: "worker-owner",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        const blocked = service.renewLease({
            leaseId: granted.lease.id,
            workerId: "worker-intruder",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(10_000),
        });
        assert.equal(blocked.outcome, "blocked");
        assert.equal(blocked.reasonCode, "worker_mismatch");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: renew is blocked when lease is expired", () => {
    const workspace = createTempWorkspace("aa-lease-renew-expired-");
    const dbPath = join(workspace, "lease-renew-expired.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-renew-expired",
            executionId: "exec-renew-expired",
        });
        const granted = service.acquireLease({
            executionId: "exec-renew-expired",
            workerId: "worker-expired",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        // Try to renew at a time past the expiration
        const blocked = service.renewLease({
            leaseId: granted.lease.id,
            workerId: "worker-expired",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(TTL_MS + 1000),
        });
        assert.equal(blocked.outcome, "blocked");
        assert.equal(blocked.reasonCode, "lease_expired");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: renew creates audit record for lease_renewed event", () => {
    const workspace = createTempWorkspace("aa-lease-audit-renew-");
    const dbPath = join(workspace, "lease-audit-renew.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-audit-renew",
            executionId: "exec-audit-renew",
        });
        const granted = service.acquireLease({
            executionId: "exec-audit-renew",
            workerId: "worker-audit-renew",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        service.renewLease({
            leaseId: granted.lease.id,
            workerId: "worker-audit-renew",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(10_000),
        });
        const audits = store.listLeaseAudits("exec-audit-renew");
        assert.ok(audits.some((a) => a.eventType === "lease_renewed" && a.workerId === "worker-audit-renew"), "Audit should record lease_renewed event");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// ── Lease Release ─────────────────────────────────────────────────────────────
test("lease: release closes the lease and allows new acquisition", () => {
    const workspace = createTempWorkspace("aa-lease-release-");
    const dbPath = join(workspace, "lease-release.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-release",
            executionId: "exec-release",
        });
        const granted = service.acquireLease({
            executionId: "exec-release",
            workerId: "worker-release",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(granted.outcome, "granted");
        const released = service.releaseLease({
            leaseId: granted.lease.id,
            workerId: "worker-release",
            reasonCode: "completed",
            occurredAt: advanceTime(15_000),
        });
        assert.equal(released.outcome, "released");
        assert.ok(released.lease, "Released lease should be returned");
        assert.equal(released.lease.status, "released");
        const activeLease = store.worker.getActiveExecutionLease("exec-release");
        assert.ok(!activeLease, "No active lease should exist after release");
        // New worker should be able to acquire
        const nextGranted = service.acquireLease({
            executionId: "exec-release",
            workerId: "worker-next",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(16_000),
        });
        assert.equal(nextGranted.outcome, "granted");
        assert.equal(nextGranted.lease.workerId, "worker-next");
        assert.equal(nextGranted.lease.fencingToken, 2, "Fencing token should increment after release");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: release is blocked when worker ID does not match", () => {
    const workspace = createTempWorkspace("aa-lease-release-mismatch-");
    const dbPath = join(workspace, "lease-release-mismatch.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-release-mismatch",
            executionId: "exec-release-mismatch",
        });
        const granted = service.acquireLease({
            executionId: "exec-release-mismatch",
            workerId: "worker-owner",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        const blocked = service.releaseLease({
            leaseId: granted.lease.id,
            workerId: "worker-intruder",
            reasonCode: "unauthorized",
            occurredAt: advanceTime(15_000),
        });
        assert.equal(blocked.outcome, "blocked");
        assert.equal(blocked.reasonCode, "worker_mismatch");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: release creates audit record for lease_released event", () => {
    const workspace = createTempWorkspace("aa-lease-audit-release-");
    const dbPath = join(workspace, "lease-audit-release.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-audit-release",
            executionId: "exec-audit-release",
        });
        const granted = service.acquireLease({
            executionId: "exec-audit-release",
            workerId: "worker-audit-release",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        service.releaseLease({
            leaseId: granted.lease.id,
            workerId: "worker-audit-release",
            reasonCode: "test_completion",
            occurredAt: advanceTime(15_000),
        });
        const audits = store.listLeaseAudits("exec-audit-release");
        assert.ok(audits.some((a) => a.eventType === "lease_released"
            && a.workerId === "worker-audit-release"
            && a.reasonCode === "test_completion"), "Audit should record lease_released event with reason code");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// ── Lease Expiration ──────────────────────────────────────────────────────────
test("lease: expired lease is automatically reclaimed on new acquisition", () => {
    const workspace = createTempWorkspace("aa-lease-expire-");
    const dbPath = join(workspace, "lease-expire.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-expire",
            executionId: "exec-expire",
        });
        // Acquire with TTL that will expire before next acquisition
        const granted = service.acquireLease({
            executionId: "exec-expire",
            workerId: "worker-expire",
            ttlMs: 5_000,
            occurredAt: BASE_TIME,
        });
        assert.equal(granted.outcome, "granted");
        // Try to acquire after the lease has expired (past TTL + some buffer)
        const afterExpiry = service.acquireLease({
            executionId: "exec-expire",
            workerId: "worker-next",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(10_000),
        });
        assert.equal(afterExpiry.outcome, "granted");
        assert.equal(afterExpiry.lease.workerId, "worker-next");
        assert.equal(afterExpiry.lease.fencingToken, 2, "Fencing token increments after expired lease");
        const expiredLease = store.worker.getExecutionLease(granted.lease.id);
        assert.equal(expiredLease.status, "expired");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: reclaimExpiredLeases finds and closes all expired leases", () => {
    const workspace = createTempWorkspace("aa-lease-reclaim-");
    const dbPath = join(workspace, "lease-reclaim.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        // Create two executions with short TTL leases
        seedTaskAndExecution(db, store, {
            taskId: "task-reclaim-1",
            executionId: "exec-reclaim-1",
        });
        seedTaskAndExecution(db, store, {
            taskId: "task-reclaim-2",
            executionId: "exec-reclaim-2",
        });
        service.acquireLease({
            executionId: "exec-reclaim-1",
            workerId: "worker-reclaim-1",
            ttlMs: 5_000,
            occurredAt: BASE_TIME,
        });
        service.acquireLease({
            executionId: "exec-reclaim-2",
            workerId: "worker-reclaim-2",
            ttlMs: 5_000,
            occurredAt: BASE_TIME,
        });
        // Reclaim after both have expired
        const reclaimed = service.reclaimExpiredLeases(advanceTime(10_000));
        assert.equal(reclaimed.length, 2, "Both expired leases should be reclaimed");
        const audits = store.listLeaseAudits("exec-reclaim-1");
        assert.ok(audits.some((a) => a.eventType === "lease_reclaimed"), "Audit should record lease_reclaimed event");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: renew fails for already expired lease", () => {
    const workspace = createTempWorkspace("aa-lease-renew-fail-");
    const dbPath = join(workspace, "lease-renew-fail.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-renew-fail",
            executionId: "exec-renew-fail",
        });
        const granted = service.acquireLease({
            executionId: "exec-renew-fail",
            workerId: "worker-renew-fail",
            ttlMs: 5_000,
            occurredAt: BASE_TIME,
        });
        // Let it expire via reclaim - this sets status to "reclaimed"
        service.reclaimExpiredLeases(advanceTime(10_000));
        const renewed = service.renewLease({
            leaseId: granted.lease.id,
            workerId: "worker-renew-fail",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(11_000),
        });
        // After reclaim, lease status is "reclaimed" not "active", so renew is blocked
        assert.equal(renewed.outcome, "blocked");
        assert.equal(renewed.reasonCode, "lease_not_active");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// ── Fencing Token & Write Validation ───────────────────────────────────────────
test("lease: fencing token increments on each new grant after release", () => {
    const workspace = createTempWorkspace("aa-lease-fencing-");
    const dbPath = join(workspace, "lease-fencing.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-fencing",
            executionId: "exec-fencing",
        });
        const first = service.acquireLease({
            executionId: "exec-fencing",
            workerId: "worker-fencing",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(first.lease.fencingToken, 1);
        service.releaseLease({
            leaseId: first.lease.id,
            workerId: "worker-fencing",
            occurredAt: advanceTime(15_000),
        });
        const second = service.acquireLease({
            executionId: "exec-fencing",
            workerId: "worker-fencing-2",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(16_000),
        });
        assert.equal(second.lease.fencingToken, 2);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: validateWriteAccess allows access with correct token", () => {
    const workspace = createTempWorkspace("aa-lease-validate-");
    const dbPath = join(workspace, "lease-validate.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-validate",
            executionId: "exec-validate",
        });
        const granted = service.acquireLease({
            executionId: "exec-validate",
            workerId: "worker-validate",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        const validation = service.validateWriteAccess({
            executionId: "exec-validate",
            workerId: "worker-validate",
            fencingToken: granted.lease.fencingToken,
            leaseId: granted.lease.id,
            occurredAt: advanceTime(10_000),
        });
        assert.equal(validation.allowed, true);
        assert.equal(validation.authoritativeFencingToken, granted.lease.fencingToken);
        assert.equal(validation.activeLeaseId, granted.lease.id);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: validateWriteAccess rejects stale fencing token", () => {
    const workspace = createTempWorkspace("aa-lease-stale-");
    const dbPath = join(workspace, "lease-stale.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-stale",
            executionId: "exec-stale",
        });
        const first = service.acquireLease({
            executionId: "exec-stale",
            workerId: "worker-stale",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        // Release and acquire new lease with higher fencing token
        service.releaseLease({
            leaseId: first.lease.id,
            workerId: "worker-stale",
            occurredAt: advanceTime(15_000),
        });
        const second = service.acquireLease({
            executionId: "exec-stale",
            workerId: "worker-stale-2",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(16_000),
        });
        assert.equal(second.lease.fencingToken, 2);
        // Try to write with old (stale) fencing token
        const staleValidation = service.validateWriteAccess({
            executionId: "exec-stale",
            workerId: "worker-stale",
            fencingToken: first.lease.fencingToken, // Stale token = 1
            leaseId: first.lease.id,
            occurredAt: advanceTime(17_000),
        });
        assert.equal(staleValidation.allowed, false);
        assert.equal(staleValidation.reasonCode, "stale_fencing_token");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: validateWriteAccess rejects when no lease record exists", () => {
    const workspace = createTempWorkspace("aa-lease-no-active-");
    const dbPath = join(workspace, "lease-no-active.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-no-active",
            executionId: "exec-no-active",
        });
        // No lease has been acquired for this execution - validateWriteAccess returns lease_not_found
        const validation = service.validateWriteAccess({
            executionId: "exec-no-active",
            workerId: "worker-no-active",
            fencingToken: 1,
            leaseId: null,
            occurredAt: BASE_TIME,
        });
        assert.equal(validation.allowed, false);
        assert.equal(validation.reasonCode, "lease_not_found");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: validateWriteAccess rejects worker mismatch", () => {
    const workspace = createTempWorkspace("aa-lease-worker-mismatch-");
    const dbPath = join(workspace, "lease-worker-mismatch.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-worker-mismatch",
            executionId: "exec-worker-mismatch",
        });
        const granted = service.acquireLease({
            executionId: "exec-worker-mismatch",
            workerId: "worker-owner",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        const validation = service.validateWriteAccess({
            executionId: "exec-worker-mismatch",
            workerId: "worker-intruder",
            fencingToken: granted.lease.fencingToken,
            leaseId: granted.lease.id,
            occurredAt: advanceTime(10_000),
        });
        assert.equal(validation.allowed, false);
        assert.equal(validation.reasonCode, "worker_mismatch");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// ── Handover ──────────────────────────────────────────────────────────────────
test("lease: handover transfers lease to new worker and increments fencing token", () => {
    const workspace = createTempWorkspace("aa-lease-handover-");
    const dbPath = join(workspace, "lease-handover.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        const workers = new WorkerRegistryService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-handover",
            executionId: "exec-handover",
        });
        // Register both workers
        workers.recordHeartbeat({
            workerId: "worker-source",
            status: "busy",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-handover"],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: BASE_TIME,
        });
        workers.recordHeartbeat({
            workerId: "worker-target",
            status: "idle",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: BASE_TIME,
        });
        const granted = service.acquireLease({
            executionId: "exec-handover",
            workerId: "worker-source",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(granted.outcome, "granted");
        const handedOver = service.handoverLease({
            leaseId: granted.lease.id,
            workerId: "worker-source",
            newWorkerId: "worker-target",
            ttlMs: TTL_MS,
            reasonCode: "worker_draining_handover",
            occurredAt: advanceTime(10_000),
        });
        assert.equal(handedOver.outcome, "handed_over");
        assert.equal(handedOver.lease.workerId, "worker-target");
        assert.equal(handedOver.lease.fencingToken, 2, "Fencing token should increment on handover");
        assert.equal(handedOver.previousLease.status, "released");
        const audits = store.listLeaseAudits("exec-handover");
        assert.ok(audits.some((a) => a.eventType === "lease_handover"), "Should have handover audit");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: handover is blocked for non-owner worker", () => {
    const workspace = createTempWorkspace("aa-lease-handover-blocked-");
    const dbPath = join(workspace, "lease-handover-blocked.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        const workers = new WorkerRegistryService(store);
        seedTaskAndExecution(db, store, {
            taskId: "task-handover-blocked",
            executionId: "exec-handover-blocked",
        });
        workers.recordHeartbeat({
            workerId: "worker-owner",
            status: "busy",
            capabilities: ["bash"],
            runningExecutionIds: ["exec-handover-blocked"],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: BASE_TIME,
        });
        workers.recordHeartbeat({
            workerId: "worker-intruder",
            status: "idle",
            capabilities: ["bash"],
            runningExecutionIds: [],
            maxConcurrency: 1,
            queueAffinity: "default",
            occurredAt: BASE_TIME,
        });
        const granted = service.acquireLease({
            executionId: "exec-handover-blocked",
            workerId: "worker-owner",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        const blocked = service.handoverLease({
            leaseId: granted.lease.id,
            workerId: "worker-intruder", // Not the owner
            newWorkerId: "worker-target",
            ttlMs: TTL_MS,
            occurredAt: advanceTime(10_000),
        });
        assert.equal(blocked.outcome, "blocked");
        assert.equal(blocked.reasonCode, "worker_mismatch");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
// ── Edge Cases ────────────────────────────────────────────────────────────────
test("lease: acquire throws when execution not found", () => {
    const workspace = createTempWorkspace("aa-lease-notfound-");
    const dbPath = join(workspace, "lease-notfound.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        assert.throws(() => service.acquireLease({
            executionId: "non-existent-execution",
            workerId: "worker-notfound",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        }), /Execution not found/);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: renew and release are blocked when lease not found", () => {
    const workspace = createTempWorkspace("aa-lease-notfound-ops-");
    const dbPath = join(workspace, "lease-notfound-ops.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        const renewBlocked = service.renewLease({
            leaseId: "non-existent-lease",
            workerId: "worker-x",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(renewBlocked.outcome, "blocked");
        assert.equal(renewBlocked.reasonCode, "lease_not_found");
        const releaseBlocked = service.releaseLease({
            leaseId: "non-existent-lease",
            workerId: "worker-x",
            occurredAt: BASE_TIME,
        });
        assert.equal(releaseBlocked.outcome, "blocked");
        assert.equal(releaseBlocked.reasonCode, "lease_not_found");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lease: multiple leases for same execution are not allowed", () => {
    const workspace = createTempWorkspace("aa-lease-no-duplicate-");
    const dbPath = join(workspace, "lease-no-duplicate.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const service = new ExecutionLeaseService(db, store);
        seedTaskAndExecution(db, store, {
            taskId: "task-no-dup",
            executionId: "exec-no-dup",
        });
        const granted = service.acquireLease({
            executionId: "exec-no-dup",
            workerId: "worker-dup-1",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        // Try to acquire again - should be blocked
        const secondAcquisition = service.acquireLease({
            executionId: "exec-no-dup",
            workerId: "worker-dup-2",
            ttlMs: TTL_MS,
            occurredAt: BASE_TIME,
        });
        assert.equal(secondAcquisition.outcome, "blocked");
        assert.equal(secondAcquisition.reasonCode, "active_lease_exists");
        // Verify only one active lease exists
        const activeLeases = store.worker.listExecutionLeases("exec-no-dup").filter((l) => l.status === "active");
        assert.equal(activeLeases.length, 1);
        assert.equal(activeLeases[0].workerId, "worker-dup-1");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=lease-lifecycle.test.js.map