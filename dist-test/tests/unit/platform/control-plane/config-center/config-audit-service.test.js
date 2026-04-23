/**
 * Unit tests for ConfigAuditService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigAuditService } from "../../../../../src/platform/control-plane/config-center/config-audit-service.js";
test("ConfigAuditService records create action", () => {
    const service = new ConfigAuditService();
    const before = { timeout: 30000 };
    const after = { timeout: 60000 };
    const entry = service.recordCreate("platform.runtime.timeout", "platform", null, after, "user-123", "Increase timeout for production");
    assert.ok(entry.auditId.startsWith("caud_"));
    assert.equal(entry.configPath, "platform.runtime.timeout");
    assert.equal(entry.layer, "platform");
    assert.equal(entry.action, "create");
    assert.equal(entry.actor, "user-123");
    assert.equal(entry.afterHash !== null, true);
    assert.equal(entry.beforeHash, null);
});
test("ConfigAuditService records update action with diff", () => {
    const service = new ConfigAuditService();
    const before = { timeout: 30000, retries: 3 };
    const after = { timeout: 60000, retries: 5 };
    const entry = service.recordUpdate("tenant-1.runtime.timeout", "tenant", "tenant-1", before, after, "user-456", "Update timeout and retries");
    assert.equal(entry.action, "update");
    assert.equal(entry.configPath, "tenant-1.runtime.timeout");
    assert.ok(entry.changes.length > 0);
    assert.ok(entry.beforeHash !== null);
    assert.ok(entry.afterHash !== null);
});
test("ConfigAuditService records delete action", () => {
    const service = new ConfigAuditService();
    const before = { deprecatedSetting: true };
    const entry = service.recordDelete("platform.legacy.setting", "platform", null, before, "system", "Remove deprecated config");
    assert.equal(entry.action, "delete");
    assert.ok(entry.beforeHash !== null);
    assert.equal(entry.afterHash, null);
});
test("ConfigAuditService records rollback action", () => {
    const service = new ConfigAuditService();
    const before = { version: 2, timeout: 60000 };
    const after = { version: 1, timeout: 30000 };
    const entry = service.recordRollback("tenant-1.config.feature", "tenant", "tenant-1", before, after, "v1-backup", "admin-001", "Rollback to stable version");
    assert.equal(entry.action, "rollback");
    assert.equal(entry.metadata?.targetVersionId, "v1-backup");
    assert.equal(entry.reason, "Rollback to stable version");
});
test("ConfigAuditService records approval", () => {
    const service = new ConfigAuditService();
    const entry = service.recordCreate("platform.protected.config", "platform", null, { value: "test" }, "user-123", "Test config", { approvalRequired: true });
    assert.equal(entry.approvalStatus, "pending");
    const updated = service.recordApproval(entry.auditId, "approver-001", "Approved by security");
    assert.ok(updated !== null);
    assert.equal(updated.approvalStatus, "approved");
    assert.equal(updated.approvedBy, "approver-001");
    assert.ok(updated.approvedAt !== null);
});
test("ConfigAuditService records rejection", () => {
    const service = new ConfigAuditService();
    const entry = service.recordCreate("platform.protected.config", "platform", null, { value: "test" }, "user-123", "Test config", { approvalRequired: true });
    const updated = service.recordRejection(entry.auditId, "rejector-001", "Does not meet security requirements");
    assert.ok(updated !== null);
    assert.equal(updated.approvalStatus, "rejected");
    assert.equal(updated.approvedBy, "rejector-001");
});
test("ConfigAuditService records approval returns null for unknown auditId", () => {
    const service = new ConfigAuditService();
    const result = service.recordApproval("non-existent-id", "approver");
    assert.equal(result, null);
});
test("ConfigAuditService query filters by configPath", () => {
    const service = new ConfigAuditService();
    service.recordCreate("platform.timeout", "platform", null, { value: 1 }, "user", null);
    service.recordCreate("platform.retries", "platform", null, { value: 3 }, "user", null);
    service.recordCreate("tenant.timeout", "tenant", "tenant-1", { value: 2 }, "user", null);
    const result = service.query({ configPath: "platform.timeout" });
    assert.equal(result.totalCount, 1);
    assert.equal(result.entries[0].configPath, "platform.timeout");
});
test("ConfigAuditService query filters by layer", () => {
    const service = new ConfigAuditService();
    service.recordCreate("platform.config", "platform", null, { v: 1 }, "user", null);
    service.recordCreate("tenant.config", "tenant", "t1", { v: 2 }, "user", null);
    service.recordCreate("tenant.config", "tenant", "t2", { v: 3 }, "user", null);
    const result = service.query({ layer: "tenant" });
    assert.equal(result.totalCount, 2);
});
test("ConfigAuditService query filters by actor", () => {
    const service = new ConfigAuditService();
    service.recordCreate("config1", "platform", null, {}, "alice", null);
    service.recordCreate("config2", "platform", null, {}, "bob", null);
    service.recordCreate("config3", "platform", null, {}, "alice", null);
    const result = service.query({ actor: "alice" });
    assert.equal(result.totalCount, 2);
});
test("ConfigAuditService query filters by action", () => {
    const service = new ConfigAuditService();
    service.recordCreate("platform.create", "platform", null, {}, "user", null);
    service.recordUpdate("platform.update", "platform", null, {}, {}, "user", null);
    service.recordDelete("platform.delete", "platform", null, {}, "user", null);
    const result = service.query({ action: "delete" });
    assert.equal(result.totalCount, 1);
    assert.equal(result.entries[0].action, "delete");
});
test("ConfigAuditService query supports pagination", () => {
    const service = new ConfigAuditService();
    for (let i = 0; i < 10; i++) {
        service.recordCreate(`platform.config.${i}`, "platform", null, { index: i }, "user", null);
    }
    const page1 = service.query({ limit: 3, offset: 0 });
    const page2 = service.query({ limit: 3, offset: 3 });
    assert.equal(page1.entries.length, 3);
    assert.equal(page2.entries.length, 3);
    assert.equal(page1.totalCount, 10);
    assert.equal(page2.hasMore, true);
});
test("ConfigAuditService getEntriesForConfig returns entries for specific config", () => {
    const service = new ConfigAuditService();
    service.recordCreate("platform.timeout", "platform", null, { value: 1 }, "user", null);
    service.recordUpdate("platform.timeout", "platform", null, { value: 1 }, { value: 2 }, "user", null);
    service.recordCreate("platform.retries", "platform", null, { value: 3 }, "user", null);
    const entries = service.getEntriesForConfig("platform.timeout", "platform", null);
    assert.equal(entries.length, 2);
    assert.ok(entries.some((entry) => entry.action === "update"));
    assert.ok(entries.some((entry) => entry.action === "create"));
});
test("ConfigAuditService getPendingApprovals returns pending entries", () => {
    const service = new ConfigAuditService();
    service.recordCreate("config1", "platform", null, {}, "user", null, { approvalRequired: false });
    const pendingEntry = service.recordCreate("config2", "platform", null, {}, "user", null, { approvalRequired: true });
    service.recordCreate("config3", "platform", null, {}, "user", null, { approvalRequired: true });
    const pending = service.getPendingApprovals();
    assert.equal(pending.length, 2);
    assert.ok(pending.some(e => e.auditId === pendingEntry.auditId));
});
test("ConfigAuditService getStats returns correct statistics", () => {
    const service = new ConfigAuditService();
    service.recordCreate("platform.test", "platform", null, {}, "user", null);
    service.recordUpdate("platform.test", "platform", null, {}, {}, "user", null);
    service.recordUpdate("platform.test", "platform", null, {}, {}, "user", null);
    const stats = service.getStats("platform.test", "platform", null);
    assert.equal(stats.totalEntries, 3);
    assert.equal(stats.createCount, 1);
    assert.equal(stats.updateCount, 2);
    assert.equal(stats.deleteCount, 0);
    assert.ok(stats.firstEntryAt !== null);
    assert.ok(stats.lastEntryAt !== null);
});
test("ConfigAuditService pruneOldEntries removes expired entries", () => {
    const service = new ConfigAuditService({ maxEntryAgeMs: 1 });
    service.recordCreate("platform.old", "platform", null, {}, "user", null);
    const pruned = service.pruneOldEntries();
    assert.equal(pruned, 0);
});
//# sourceMappingURL=config-audit-service.test.js.map