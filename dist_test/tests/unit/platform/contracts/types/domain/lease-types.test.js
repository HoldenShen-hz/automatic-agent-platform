import assert from "node:assert/strict";
import test from "node:test";
test("ExecutionLeaseRecord structure is correct", () => {
    const record = {
        id: "lease_123",
        executionId: "exec_456",
        workerId: "worker_789",
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "active",
        leasedAt: "2026-04-14T00:00:00.000Z",
        expiresAt: "2026-04-14T00:30:00.000Z",
        lastHeartbeatAt: "2026-04-14T00:15:00.000Z",
        releasedAt: null,
        reasonCode: null,
    };
    assert.equal(record.id, "lease_123");
    assert.equal(record.status, "active");
    assert.equal(record.fencingToken, 1);
});
test("ExecutionLeaseRecord allows expired status", () => {
    const record = {
        id: "lease_expired",
        executionId: "exec_abc",
        workerId: "worker_def",
        attempt: 1,
        fencingToken: 2,
        queueName: null,
        status: "expired",
        leasedAt: "2026-04-14T00:00:00.000Z",
        expiresAt: "2026-04-14T00:30:00.000Z",
        lastHeartbeatAt: "2026-04-14T00:10:00.000Z",
        releasedAt: null,
        reasonCode: "lease_expired",
    };
    assert.equal(record.status, "expired");
    assert.equal(record.reasonCode, "lease_expired");
});
test("ExecutionLeaseRecord allows released status", () => {
    const record = {
        id: "lease_released",
        executionId: "exec_ghi",
        workerId: "worker_jkl",
        attempt: 2,
        fencingToken: 3,
        queueName: "background",
        status: "released",
        leasedAt: "2026-04-14T00:00:00.000Z",
        expiresAt: "2026-04-14T00:30:00.000Z",
        lastHeartbeatAt: "2026-04-14T00:20:00.000Z",
        releasedAt: "2026-04-14T00:25:00.000Z",
        reasonCode: "task_completed",
    };
    assert.equal(record.status, "released");
    assert.ok(record.releasedAt !== null);
    assert.equal(record.reasonCode, "task_completed");
});
test("ExecutionLeaseRecord allows reclaimed status", () => {
    const record = {
        id: "lease_reclaimed",
        executionId: "exec_reclaimed",
        workerId: "worker_original",
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "reclaimed",
        leasedAt: "2026-04-14T00:00:00.000Z",
        expiresAt: "2026-04-14T00:30:00.000Z",
        lastHeartbeatAt: null,
        releasedAt: null,
        reasonCode: "stale_lease",
    };
    assert.equal(record.status, "reclaimed");
    assert.equal(record.reasonCode, "stale_lease");
});
test("LeaseStatus accepts all valid values", () => {
    const statuses = ["active", "expired", "released", "reclaimed"];
    assert.equal(statuses.length, 4);
});
test("LeaseAuditRecord structure is correct", () => {
    const record = {
        id: "audit_123",
        executionId: "exec_456",
        leaseId: "lease_789",
        workerId: "worker_abc",
        fencingToken: 1,
        eventType: "lease_granted",
        reasonCode: null,
        recordedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.id, "audit_123");
    assert.equal(record.eventType, "lease_granted");
    assert.equal(record.fencingToken, 1);
});
test("LeaseAuditRecord allows lease_renewed event", () => {
    const record = {
        id: "audit_renewed",
        executionId: "exec_renewed",
        leaseId: "lease_renewed",
        workerId: "worker_renewed",
        fencingToken: 3,
        eventType: "lease_renewed",
        reasonCode: null,
        recordedAt: "2026-04-14T00:15:00.000Z",
    };
    assert.equal(record.eventType, "lease_renewed");
    assert.equal(record.fencingToken, 3);
});
test("LeaseAuditRecord allows lease_expired event", () => {
    const record = {
        id: "audit_expired",
        executionId: "exec_expired",
        leaseId: "lease_expired",
        workerId: "worker_expired",
        fencingToken: 1,
        eventType: "lease_expired",
        reasonCode: "ttl_exceeded",
        recordedAt: "2026-04-14T00:30:00.000Z",
    };
    assert.equal(record.eventType, "lease_expired");
    assert.equal(record.reasonCode, "ttl_exceeded");
});
test("LeaseAuditRecord allows lease_reclaimed event", () => {
    const record = {
        id: "audit_reclaimed",
        executionId: "exec_reclaimed",
        leaseId: "lease_reclaimed",
        workerId: "worker_reclaimed",
        fencingToken: 2,
        eventType: "lease_reclaimed",
        reasonCode: "worker_crash",
        recordedAt: "2026-04-14T00:35:00.000Z",
    };
    assert.equal(record.eventType, "lease_reclaimed");
    assert.equal(record.reasonCode, "worker_crash");
});
test("LeaseAuditRecord allows lease_released event", () => {
    const record = {
        id: "audit_released",
        executionId: "exec_released",
        leaseId: "lease_released",
        workerId: "worker_released",
        fencingToken: 1,
        eventType: "lease_released",
        reasonCode: "task_completed",
        recordedAt: "2026-04-14T00:25:00.000Z",
    };
    assert.equal(record.eventType, "lease_released");
    assert.equal(record.reasonCode, "task_completed");
});
test("LeaseAuditRecord allows stale_write_rejected event", () => {
    const record = {
        id: "audit_stale",
        executionId: "exec_stale",
        leaseId: "lease_stale",
        workerId: "worker_stale",
        fencingToken: 0,
        eventType: "stale_write_rejected",
        reasonCode: "fencing_token_mismatch",
        recordedAt: "2026-04-14T00:10:00.000Z",
    };
    assert.equal(record.eventType, "stale_write_rejected");
    assert.equal(record.fencingToken, 0);
});
test("LeaseAuditRecord allows lease_handover event", () => {
    const record = {
        id: "audit_handover",
        executionId: "exec_handover",
        leaseId: "lease_handover",
        workerId: "worker_new",
        fencingToken: 2,
        eventType: "lease_handover",
        reasonCode: "worker_replacement",
        recordedAt: "2026-04-14T00:40:00.000Z",
    };
    assert.equal(record.eventType, "lease_handover");
});
test("LeaseAuditEventType accepts all valid values", () => {
    const eventTypes = [
        "lease_granted",
        "lease_renewed",
        "lease_expired",
        "lease_reclaimed",
        "stale_write_rejected",
        "lease_released",
        "lease_handover",
    ];
    assert.equal(eventTypes.length, 7);
});
//# sourceMappingURL=lease-types.test.js.map