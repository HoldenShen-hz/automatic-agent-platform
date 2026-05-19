import assert from "node:assert/strict";
import test from "node:test";
import { AuditTrailService } from "../../../../../src/platform/state-evidence/audit/index.js";
test("AuditTrailService is instantiable", () => {
    const service = new AuditTrailService();
    assert.ok(service instanceof AuditTrailService);
});
test("record creates an audit record with generated auditId and createdAt", () => {
    const service = new AuditTrailService();
    const input = {
        actorType: "user",
        actorId: "user-123",
        tenantId: "tenant-1",
        taskId: "task-1",
        executionId: "exec-1",
        action: "artifact.publish",
        resourceRef: "artifact/bundle-1",
        decisionRef: null,
        versionRef: null,
        metadata: { reason: "testing" },
    };
    const record = service.record(input);
    assert.ok(record.auditId.startsWith("audit_"));
    assert.ok(record.createdAt);
    assert.equal(record.actorType, "user");
    assert.equal(record.actorId, "user-123");
    assert.equal(record.tenantId, "tenant-1");
    assert.equal(record.taskId, "task-1");
    assert.equal(record.executionId, "exec-1");
    assert.equal(record.action, "artifact.publish");
    assert.deepEqual(record.metadata, { reason: "testing" });
});
test("record accepts custom createdAt timestamp", () => {
    const service = new AuditTrailService();
    const customDate = "2024-01-15T10:30:00.000Z";
    const input = {
        actorType: "system",
        actorId: "system-1",
        tenantId: null,
        taskId: null,
        executionId: null,
        action: "system.maintenance",
        resourceRef: "system/health",
        decisionRef: null,
        versionRef: null,
        createdAt: customDate,
        metadata: {},
    };
    const record = service.record(input);
    assert.equal(record.createdAt, customDate);
});
test("record stores multiple records", () => {
    const service = new AuditTrailService();
    service.record({
        actorType: "agent",
        actorId: "agent-1",
        tenantId: "tenant-1",
        taskId: "task-1",
        executionId: null,
        action: "action.1",
        resourceRef: "resource/1",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    service.record({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-1",
        taskId: "task-2",
        executionId: null,
        action: "action.2",
        resourceRef: "resource/2",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    const records = service.listRecords();
    assert.equal(records.length, 2);
});
test("exportForTask returns only records for specified taskId", () => {
    const service = new AuditTrailService();
    service.record({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-1",
        taskId: "task-alpha",
        executionId: null,
        action: "action.alpha",
        resourceRef: "resource/a",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    service.record({
        actorType: "agent",
        actorId: "agent-1",
        tenantId: "tenant-1",
        taskId: "task-beta",
        executionId: null,
        action: "action.beta",
        resourceRef: "resource/b",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    service.record({
        actorType: "system",
        actorId: "system-1",
        tenantId: "tenant-1",
        taskId: "task-alpha",
        executionId: null,
        action: "action.alpha2",
        resourceRef: "resource/a2",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    const alphaRecords = service.exportForTask("task-alpha");
    assert.equal(alphaRecords.length, 2);
    assert.ok(alphaRecords.every((r) => r.taskId === "task-alpha"));
    const betaRecords = service.exportForTask("task-beta");
    assert.equal(betaRecords.length, 1);
    assert.equal(betaRecords.at(0)?.taskId, "task-beta");
});
test("exportForTask returns empty array when no records match", () => {
    const service = new AuditTrailService();
    service.record({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-1",
        taskId: "task-1",
        executionId: null,
        action: "action",
        resourceRef: "resource",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    const records = service.exportForTask("task-nonexistent");
    assert.deepEqual(records, []);
});
test("exportForTenant returns only records for specified tenantId", () => {
    const service = new AuditTrailService();
    service.record({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-alpha",
        taskId: "task-1",
        executionId: null,
        action: "action",
        resourceRef: "resource",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    service.record({
        actorType: "agent",
        actorId: "agent-1",
        tenantId: "tenant-beta",
        taskId: "task-2",
        executionId: null,
        action: "action",
        resourceRef: "resource",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    const alphaRecords = service.exportForTenant("tenant-alpha");
    assert.equal(alphaRecords.length, 1);
    assert.equal(alphaRecords.at(0)?.tenantId, "tenant-alpha");
    const betaRecords = service.exportForTenant("tenant-beta");
    assert.equal(betaRecords.length, 1);
    assert.equal(betaRecords.at(0)?.tenantId, "tenant-beta");
});
test("exportForTenant returns empty array when no records match", () => {
    const service = new AuditTrailService();
    service.record({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-existing",
        taskId: "task-1",
        executionId: null,
        action: "action",
        resourceRef: "resource",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    const records = service.exportForTenant("tenant-nonexistent");
    assert.deepEqual(records, []);
});
test("listRecords returns a copy of the records array", () => {
    const service = new AuditTrailService();
    service.record({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-1",
        taskId: "task-1",
        executionId: null,
        action: "action",
        resourceRef: "resource",
        decisionRef: null,
        versionRef: null,
        metadata: {},
    });
    const records = service.listRecords();
    assert.equal(records.length, 1);
    // Modifying the returned array should not affect the service's internal state
    records.push({});
    const recordsAgain = service.listRecords();
    assert.equal(recordsAgain.length, 1);
});
test("record handles all actor types", () => {
    const service = new AuditTrailService();
    const actorTypes = ["user", "agent", "system", "scheduler", "admin", "webhook", "recovery"];
    for (const actorType of actorTypes) {
        const record = service.record({
            actorType,
            actorId: `${actorType}-1`,
            tenantId: "tenant-1",
            taskId: null,
            executionId: null,
            action: "test.action",
            resourceRef: "test/resource",
            decisionRef: null,
            versionRef: null,
            metadata: {},
        });
        assert.equal(record.actorType, actorType);
    }
});
test("record handles null optional fields", () => {
    const service = new AuditTrailService();
    const record = service.record({
        actorType: "system",
        actorId: "system-1",
        tenantId: null,
        taskId: null,
        executionId: null,
        action: "system.startup",
        resourceRef: "system",
        decisionRef: null,
        versionRef: null,
        metadata: { bootTime: "2024-01-01T00:00:00Z" },
    });
    assert.equal(record.tenantId, null);
    assert.equal(record.taskId, null);
    assert.equal(record.executionId, null);
    assert.equal(record.decisionRef, null);
    assert.equal(record.versionRef, null);
});
test("record handles complex metadata", () => {
    const service = new AuditTrailService();
    const complexMetadata = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        boolean: true,
        null: null,
    };
    const record = service.record({
        actorType: "admin",
        actorId: "admin-1",
        tenantId: "tenant-1",
        taskId: "task-1",
        executionId: "exec-1",
        action: "admin.configure",
        resourceRef: "config/settings",
        decisionRef: "decision-1",
        versionRef: "version-1",
        metadata: complexMetadata,
    });
    assert.deepEqual(record.metadata, complexMetadata);
});
//# sourceMappingURL=audit-trail-service.test.js.map