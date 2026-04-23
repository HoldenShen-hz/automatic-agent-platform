/**
 * Unit tests for ConfigVersioningService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigVersioningService, } from "../../../../../src/platform/control-plane/config-center/config-versioning-service.js";
test("ConfigVersioningService.createVersion creates a new version snapshot", () => {
    const service = new ConfigVersioningService();
    const snapshot = service.createVersion("runtime.timeout", "platform", null, { value: 30000 }, "user-123", "Initial configuration");
    assert.ok(snapshot.versionId);
    assert.equal(snapshot.configPath, "runtime.timeout");
    assert.equal(snapshot.layer, "platform");
    assert.equal(snapshot.sourceId, null);
    assert.deepEqual(snapshot.content, { value: 30000 });
    assert.ok(snapshot.contentHash);
    assert.ok(snapshot.createdAt);
    assert.equal(snapshot.createdBy, "user-123");
    assert.equal(snapshot.reason, "Initial configuration");
    assert.equal(snapshot.parentVersionId, null);
});
test("ConfigVersioningService.createVersion tracks parent version", () => {
    const service = new ConfigVersioningService();
    const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user-1", "v1");
    const v2 = service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user-2", "v2");
    assert.equal(v1.parentVersionId, null);
    assert.equal(v2.parentVersionId, v1.versionId);
});
test("ConfigVersioningService.getCurrentVersion returns latest version", () => {
    const service = new ConfigVersioningService();
    service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
    service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
    const v3 = service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user", "v3");
    const current = service.getCurrentVersion("runtime.timeout", "platform", null);
    assert.ok(current);
    assert.equal(current.versionId, v3.versionId);
    assert.deepEqual(current.content, { value: 3000 });
});
test("ConfigVersioningService.getCurrentVersion returns null for non-existent path", () => {
    const service = new ConfigVersioningService();
    const current = service.getCurrentVersion("non.existent", "platform", null);
    assert.equal(current, null);
});
test("ConfigVersioningService.getVersion finds version by ID", () => {
    const service = new ConfigVersioningService();
    const created = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
    const found = service.getVersion(created.versionId);
    assert.ok(found);
    assert.equal(found.versionId, created.versionId);
});
test("ConfigVersioningService.getVersion returns null for non-existent ID", () => {
    const service = new ConfigVersioningService();
    const found = service.getVersion("non-existent-id");
    assert.equal(found, null);
});
test("ConfigVersioningService.getVersionHistory returns all versions in order", () => {
    const service = new ConfigVersioningService();
    const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
    const v2 = service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
    const v3 = service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user", "v3");
    const history = service.getVersionHistory("runtime.timeout", "platform", null);
    assert.equal(history.length, 3);
    assert.equal(history[0].versionId, v1.versionId);
    assert.equal(history[1].versionId, v2.versionId);
    assert.equal(history[2].versionId, v3.versionId);
});
test("ConfigVersioningService.diffVersions computes correct diff", () => {
    const service = new ConfigVersioningService();
    const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000, name: "old" }, "user", "v1");
    const v2 = service.createVersion("runtime.timeout", "platform", null, { value: 2000, name: "new" }, "user", "v2");
    const diff = service.diffVersions(v1.versionId, v2.versionId);
    assert.ok(diff);
    assert.equal(diff.versionA, v1.versionId);
    assert.equal(diff.versionB, v2.versionId);
    assert.ok(diff.additions >= 0);
    assert.ok(diff.removals >= 0);
    assert.ok(diff.modifications >= 0);
});
test("ConfigVersioningService.diffVersions returns null for non-existent version", () => {
    const service = new ConfigVersioningService();
    const created = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
    const diff = service.diffVersions(created.versionId, "non-existent-id");
    assert.equal(diff, null);
});
test("ConfigVersioningService.createRollbackPoint creates a rollback point", () => {
    const service = new ConfigVersioningService();
    const version = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
    const rollbackPoint = service.createRollbackPoint("runtime.timeout", "platform", null, "user");
    assert.ok(rollbackPoint);
    assert.ok(rollbackPoint.rollbackId);
    assert.equal(rollbackPoint.versionId, version.versionId);
    assert.equal(rollbackPoint.configPath, "runtime.timeout");
    assert.equal(rollbackPoint.layer, "platform");
    assert.ok(rollbackPoint.createdAt);
    assert.equal(rollbackPoint.createdBy, "user");
});
test("ConfigVersioningService.createRollbackPoint returns null without current version", () => {
    const service = new ConfigVersioningService();
    const rollbackPoint = service.createRollbackPoint("runtime.timeout", "platform", null, "user");
    assert.equal(rollbackPoint, null);
});
test("ConfigVersioningService.getRollbackPoints returns all rollback points", () => {
    const service = new ConfigVersioningService();
    service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
    service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
    service.createRollbackPoint("runtime.timeout", "platform", null, "user");
    const rp2 = service.createRollbackPoint("runtime.timeout", "platform", null, "user");
    const points = service.getRollbackPoints("runtime.timeout", "platform", null);
    assert.equal(points.length, 2);
    assert.equal(points[1].rollbackId, rp2.rollbackId);
});
test("ConfigVersioningService.rollback creates new version with old content", () => {
    const service = new ConfigVersioningService();
    const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
    service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
    service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user", "v3");
    const rollbackVersion = service.rollback(v1.versionId, "admin", "Reverting to v1");
    assert.ok(rollbackVersion);
    assert.notEqual(rollbackVersion.versionId, v1.versionId);
    assert.deepEqual(rollbackVersion.content, { value: 1000 });
    assert.equal(rollbackVersion.reason, "Reverting to v1");
    assert.equal(rollbackVersion.createdBy, "admin");
});
test("ConfigVersioningService.rollback returns null for non-existent version", () => {
    const service = new ConfigVersioningService();
    const rollbackVersion = service.rollback("non-existent-id", "user", "test");
    assert.equal(rollbackVersion, null);
});
test("ConfigVersioningService.getVersionContent returns content for version", () => {
    const service = new ConfigVersioningService();
    const created = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
    const content = service.getVersionContent(created.versionId);
    assert.deepEqual(content, { value: 1000 });
});
test("ConfigVersioningService.getVersionContent returns null for non-existent version", () => {
    const service = new ConfigVersioningService();
    const content = service.getVersionContent("non-existent-id");
    assert.equal(content, null);
});
test("ConfigVersioningService.pruneVersions removes old versions", () => {
    const service = new ConfigVersioningService({ maxVersionsPerPath: 3 });
    service.createVersion("runtime.timeout", "platform", null, { value: 2 }, "user", "v2");
    service.createVersion("runtime.timeout", "platform", null, { value: 3 }, "user", "v3");
    service.createVersion("runtime.timeout", "platform", null, { value: 4 }, "user", "v4");
    service.createVersion("runtime.timeout", "platform", null, { value: 5 }, "user", "v5");
    const history = service.getVersionHistory("runtime.timeout", "platform", null);
    assert.equal(history.length, 3);
    assert.deepEqual(history[0].content, { value: 3 });
    assert.deepEqual(history[1].content, { value: 4 });
    assert.deepEqual(history[2].content, { value: 5 });
});
test("ConfigVersioningService handles different layers and sourceIds separately", () => {
    const service = new ConfigVersioningService();
    service.createVersion("runtime.timeout", "platform", null, { value: 100 }, "user", "platform");
    service.createVersion("runtime.timeout", "tenant", "tenant-1", { value: 200 }, "user", "tenant");
    service.createVersion("runtime.timeout", "tenant", "tenant-2", { value: 300 }, "user", "tenant-2");
    const platform = service.getCurrentVersion("runtime.timeout", "platform", null);
    const tenant1 = service.getCurrentVersion("runtime.timeout", "tenant", "tenant-1");
    const tenant2 = service.getCurrentVersion("runtime.timeout", "tenant", "tenant-2");
    assert.deepEqual(platform.content, { value: 100 });
    assert.deepEqual(tenant1.content, { value: 200 });
    assert.deepEqual(tenant2.content, { value: 300 });
});
test("ConfigVersioningService.getCurrentVersion works with sourceId", () => {
    const service = new ConfigVersioningService();
    service.createVersion("runtime.timeout", "tenant", "tenant-1", { value: 100 }, "user", "v1");
    const v2 = service.createVersion("runtime.timeout", "tenant", "tenant-1", { value: 200 }, "user", "v2");
    const current = service.getCurrentVersion("runtime.timeout", "tenant", "tenant-1");
    assert.ok(current);
    assert.equal(current.versionId, v2.versionId);
    assert.deepEqual(current.content, { value: 200 });
});
test("ConfigVersioningService.diffVersions detects additions", () => {
    const service = new ConfigVersioningService();
    const v1 = service.createVersion("config", "platform", null, { existing: true }, "user", "v1");
    const v2 = service.createVersion("config", "platform", null, { existing: true, added: true }, "user", "v2");
    const diff = service.diffVersions(v1.versionId, v2.versionId);
    assert.ok(diff);
    assert.ok(diff.additions > 0 || diff.modifications > 0);
});
test("ConfigVersioningService.diffVersions detects removals", () => {
    const service = new ConfigVersioningService();
    const v1 = service.createVersion("config", "platform", null, { kept: true, removed: true }, "user", "v1");
    const v2 = service.createVersion("config", "platform", null, { kept: true }, "user", "v2");
    const diff = service.diffVersions(v1.versionId, v2.versionId);
    assert.ok(diff);
    assert.ok(diff.removals > 0);
});
//# sourceMappingURL=config-versioning-service.test.js.map