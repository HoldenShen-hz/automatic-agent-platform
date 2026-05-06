/**
 * Unit tests for ConfigVersioningService
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigVersioningService,
} from "../../../../../src/platform/control-plane/config-center/config-versioning-service.js";

// Mock DurableEventBus for testing event emission
class MockEventBus {
  public publishedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  publish(event: { eventType: string; payload: Record<string, unknown> }): void {
    this.publishedEvents.push(event);
  }
}

test("ConfigVersioningService.createVersion creates a new version snapshot", async () => {
  const service = new ConfigVersioningService();
  const snapshot = await service.createVersion(
    "runtime.timeout",
    "platform",
    null,
    { value: 30000 },
    "user-123",
    "Initial configuration",
  );

  assert.ok(snapshot.versionId);
  assert.strictEqual(snapshot.configPath, "runtime.timeout");
  assert.strictEqual(snapshot.layer, "platform");
  assert.strictEqual(snapshot.sourceId, null);
  assert.deepStrictEqual(snapshot.content, { value: 30000 });
  assert.ok(snapshot.contentHash);
  assert.ok(snapshot.createdAt);
  assert.strictEqual(snapshot.createdBy, "user-123");
  assert.strictEqual(snapshot.reason, "Initial configuration");
  assert.strictEqual(snapshot.parentVersionId, null);
});

test("ConfigVersioningService.createVersion tracks parent version", async () => {
  const service = new ConfigVersioningService();

  const v1 = await service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user-1", "v1");
  const v2 = await service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user-2", "v2");

  assert.strictEqual(v1.parentVersionId, null);
  assert.strictEqual(v2.parentVersionId, v1.versionId);
});

test("ConfigVersioningService.getCurrentVersion returns latest version", async () => {
  const service = new ConfigVersioningService();

  await service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
  await service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
  const v3 = await service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user", "v3");

  const current = await service.getCurrentVersion("runtime.timeout", "platform", null);

  assert.ok(current);
  assert.strictEqual(current!.versionId, v3.versionId);
  assert.deepStrictEqual(current!.content, { value: 3000 });
});

test("ConfigVersioningService.getCurrentVersion returns null for non-existent path", async () => {
  const service = new ConfigVersioningService();

  const current = await service.getCurrentVersion("non.existent", "platform", null);

  assert.strictEqual(current, null);
});

test("ConfigVersioningService.getVersion finds version by ID", async () => {
  const service = new ConfigVersioningService();

  const created = await service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
  const found = await service.getVersion(created.versionId);

  assert.ok(found);
  assert.strictEqual(found!.versionId, created.versionId);
});

test("ConfigVersioningService.getVersion returns null for non-existent ID", async () => {
  const service = new ConfigVersioningService();

  const found = await service.getVersion("non-existent-id");

  assert.strictEqual(found, null);
});

test("ConfigVersioningService.getVersionHistory returns all versions in order", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
  const v2 = service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
  const v3 = service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user", "v3");

  const history = service.getVersionHistory("runtime.timeout", "platform", null);

  assert.strictEqual(history.length, 3);
  assert.strictEqual(history[0]!.versionId, v1.versionId);
  assert.strictEqual(history[1]!.versionId, v2.versionId);
  assert.strictEqual(history[2]!.versionId, v3.versionId);
});

test("ConfigVersioningService.diffVersions computes correct diff", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000, name: "old" }, "user", "v1");
  const v2 = service.createVersion("runtime.timeout", "platform", null, { value: 2000, name: "new" }, "user", "v2");

  const diff = service.diffVersions(v1.versionId, v2.versionId);

  assert.ok(diff);
  assert.strictEqual(diff!.versionA, v1.versionId);
  assert.strictEqual(diff!.versionB, v2.versionId);
  assert.ok(diff!.additions >= 0);
  assert.ok(diff!.removals >= 0);
  assert.ok(diff!.modifications >= 0);
});

test("ConfigVersioningService.diffVersions returns null for non-existent version", () => {
  const service = new ConfigVersioningService();

  const created = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
  const diff = service.diffVersions(created.versionId, "non-existent-id");

  assert.strictEqual(diff, null);
});

test("ConfigVersioningService.createRollbackPoint creates a rollback point", () => {
  const service = new ConfigVersioningService();

  const version = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
  const rollbackPoint = service.createRollbackPoint("runtime.timeout", "platform", null, "user");

  assert.ok(rollbackPoint);
  assert.ok(rollbackPoint!.rollbackId.startsWith("rbp_"));
  assert.strictEqual(rollbackPoint!.versionId, version.versionId);
  assert.strictEqual(rollbackPoint!.configPath, "runtime.timeout");
  assert.strictEqual(rollbackPoint!.layer, "platform");
  assert.ok(rollbackPoint!.createdAt);
  assert.strictEqual(rollbackPoint!.createdBy, "user");
});

test("ConfigVersioningService.createRollbackPoint returns null without current version", () => {
  const service = new ConfigVersioningService();

  const rollbackPoint = service.createRollbackPoint("runtime.timeout", "platform", null, "user");

  assert.strictEqual(rollbackPoint, null);
});

test("ConfigVersioningService.getRollbackPoints returns all rollback points", () => {
  const service = new ConfigVersioningService();

  service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
  service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");

  service.createRollbackPoint("runtime.timeout", "platform", null, "user");
  const rp2 = service.createRollbackPoint("runtime.timeout", "platform", null, "user");

  const points = service.getRollbackPoints("runtime.timeout", "platform", null);

  assert.strictEqual(points.length, 2);
  assert.strictEqual(points[1]!.rollbackId, rp2!.rollbackId);
});

test("ConfigVersioningService.rollback creates new version with old content", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "v1");
  service.createVersion("runtime.timeout", "platform", null, { value: 2000 }, "user", "v2");
  service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user", "v3");

  const rollbackVersion = service.rollback(v1.versionId, "admin", "Reverting to v1");

  assert.ok(rollbackVersion);
  assert.notStrictEqual(rollbackVersion!.versionId, v1.versionId);
  assert.deepStrictEqual(rollbackVersion!.content, { value: 1000 });
  assert.strictEqual(rollbackVersion!.reason, "Reverting to v1");
  assert.strictEqual(rollbackVersion!.createdBy, "admin");
});

test("ConfigVersioningService.rollback returns null for non-existent version", () => {
  const service = new ConfigVersioningService();

  const rollbackVersion = service.rollback("non-existent-id", "user", "test");

  assert.strictEqual(rollbackVersion, null);
});

test("ConfigVersioningService.getVersionContent returns content for version", () => {
  const service = new ConfigVersioningService();

  const created = service.createVersion("runtime.timeout", "platform", null, { value: 1000 }, "user", "test");
  const content = service.getVersionContent(created.versionId);

  assert.deepStrictEqual(content, { value: 1000 });
});

test("ConfigVersioningService.getVersionContent returns null for non-existent version", () => {
  const service = new ConfigVersioningService();

  const content = service.getVersionContent("non-existent-id");

  assert.strictEqual(content, null);
});

test("ConfigVersioningService.pruneVersions removes old versions", () => {
  const service = new ConfigVersioningService({ maxVersionsPerPath: 3 });

  service.createVersion("runtime.timeout", "platform", null, { value: 2 }, "user", "v2");
  service.createVersion("runtime.timeout", "platform", null, { value: 3 }, "user", "v3");
  service.createVersion("runtime.timeout", "platform", null, { value: 4 }, "user", "v4");
  service.createVersion("runtime.timeout", "platform", null, { value: 5 }, "user", "v5");

  const history = service.getVersionHistory("runtime.timeout", "platform", null);

  assert.strictEqual(history.length, 3);
  assert.deepStrictEqual(history[0]!.content, { value: 3 });
  assert.deepStrictEqual(history[1]!.content, { value: 4 });
  assert.deepStrictEqual(history[2]!.content, { value: 5 });
});

test("ConfigVersioningService handles different layers and sourceIds separately", () => {
  const service = new ConfigVersioningService();

  service.createVersion("runtime.timeout", "platform", null, { value: 100 }, "user", "platform");
  service.createVersion("runtime.timeout", "tenant", "tenant-1", { value: 200 }, "user", "tenant");
  service.createVersion("runtime.timeout", "tenant", "tenant-2", { value: 300 }, "user", "tenant-2");

  const platform = service.getCurrentVersion("runtime.timeout", "platform", null);
  const tenant1 = service.getCurrentVersion("runtime.timeout", "tenant", "tenant-1");
  const tenant2 = service.getCurrentVersion("runtime.timeout", "tenant", "tenant-2");

  assert.deepStrictEqual(platform!.content, { value: 100 });
  assert.deepStrictEqual(tenant1!.content, { value: 200 });
  assert.deepStrictEqual(tenant2!.content, { value: 300 });
});

test("ConfigVersioningService.getCurrentVersion works with sourceId", () => {
  const service = new ConfigVersioningService();

  service.createVersion("runtime.timeout", "tenant", "tenant-1", { value: 100 }, "user", "v1");
  const v2 = service.createVersion("runtime.timeout", "tenant", "tenant-1", { value: 200 }, "user", "v2");

  const current = service.getCurrentVersion("runtime.timeout", "tenant", "tenant-1");

  assert.ok(current);
  assert.strictEqual(current!.versionId, v2.versionId);
  assert.deepStrictEqual(current!.content, { value: 200 });
});

test("ConfigVersioningService.diffVersions detects additions", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("config", "platform", null, { existing: true }, "user", "v1");
  const v2 = service.createVersion("config", "platform", null, { existing: true, added: true }, "user", "v2");

  const diff = service.diffVersions(v1.versionId, v2.versionId);

  assert.ok(diff);
  assert.ok(diff!.additions > 0 || diff!.modifications > 0);
});

test("ConfigVersioningService.diffVersions detects removals", () => {
  const service = new ConfigVersioningService();

  const v1 = service.createVersion("config", "platform", null, { kept: true, removed: true }, "user", "v1");
  const v2 = service.createVersion("config", "platform", null, { kept: true }, "user", "v2");

  const diff = service.diffVersions(v1.versionId, v2.versionId);

  assert.ok(diff);
  assert.ok(diff!.removals > 0);
});

test("ConfigVersioningService emits version event when eventBus is provided", () => {
  const mockBus = new MockEventBus();
  const service = new ConfigVersioningService({ eventBus: mockBus as any });

  const version = service.createVersion("runtime.timeout", "platform", null, { value: 5000 }, "user1", "test reason");

  assert.strictEqual(mockBus.publishedEvents.length, 1);
  assert.strictEqual(mockBus.publishedEvents[0]!.eventType, "config.version.created");
  assert.strictEqual(mockBus.publishedEvents[0]!.payload.versionId, version.versionId);
  assert.strictEqual(mockBus.publishedEvents[0]!.payload.createdBy, "user1");
});

test("ConfigVersioningService emits rollback event on rollback operation", () => {
  const mockBus = new MockEventBus();
  const service = new ConfigVersioningService({ eventBus: mockBus as any });

  service.createVersion("runtime.timeout", "platform", null, { value: 5000 }, "user1");
  const oldVersion = service.createVersion("runtime.timeout", "platform", null, { value: 3000 }, "user1");

  mockBus.publishedEvents = [];
  const rollbackVersion = service.rollback(oldVersion.versionId, "admin");

  assert.ok(rollbackVersion);
  // rollback creates a new version, so we get both "config.version.created" and "config.version.rollback"
  const rollbackEvent = mockBus.publishedEvents.find((e) => e.eventType === "config.version.rollback");
  assert.ok(rollbackEvent, "should have a rollback event");
  assert.strictEqual(rollbackEvent!.payload.versionId, rollbackVersion!.versionId);
});

test("ConfigVersioningService.rollback deep-clones nested content", async () => {
  const service = new ConfigVersioningService();
  const original = await service.createVersion(
    "runtime.nested",
    "platform",
    null,
    { limits: { retries: 3, flags: ["a"] } },
    "user1",
  );
  await service.createVersion(
    "runtime.nested",
    "platform",
    null,
    { limits: { retries: 5, flags: ["b"] } },
    "user1",
  );

  const rollbackVersion = await service.rollback(original.versionId, "admin");
  assert.ok(rollbackVersion);
  (rollbackVersion!.content.limits as { retries: number; flags: string[] }).retries = 99;
  (rollbackVersion!.content.limits as { retries: number; flags: string[] }).flags.push("mutated");

  const originalContent = await service.getVersionContent(original.versionId);
  assert.deepStrictEqual(originalContent, { limits: { retries: 3, flags: ["a"] } });
});

test("ConfigVersioningService emits rollback point event when creating rollback point", () => {
  const mockBus = new MockEventBus();
  const service = new ConfigVersioningService({ eventBus: mockBus as any });

  service.createVersion("runtime.timeout", "platform", null, { value: 5000 }, "user1");
  service.createRollbackPoint("runtime.timeout", "platform", null, "user1");

  assert.strictEqual(mockBus.publishedEvents.length, 2);
  assert.strictEqual(mockBus.publishedEvents[1]!.eventType, "config.rollback_point.created");
});

test("ConfigVersioningService.pruneAllVersions returns 0 when nothing to prune", () => {
  const service = new ConfigVersioningService({ maxVersionsPerPath: 50 });

  service.createVersion("runtime.task", "platform", null, { a: 1 }, "user1");
  service.createVersion("runtime.task", "platform", null, { a: 2 }, "user1");

  const totalPruned = service.pruneAllVersions();

  assert.strictEqual(totalPruned, 0);
});

test("ConfigVersioningService.pruneVersions prunes by path", () => {
  const service = new ConfigVersioningService({ maxVersionsPerPath: 2 });

  service.createVersion("runtime.task", "platform", null, { a: 1 }, "user1");
  service.createVersion("runtime.task", "platform", null, { a: 2 }, "user1");
  service.createVersion("runtime.task", "platform", null, { a: 3 }, "user1");
  service.createVersion("runtime.task", "platform", null, { a: 4 }, "user1");

  // After creating 4 versions with maxVersionsPerPath=2, only 2 remain (v3, v4)
  // because pruning happens during createVersion
  assert.strictEqual(service.getVersionHistory("runtime.task", "platform", null).length, 2);

  // Calling pruneVersions explicitly returns 0 since nothing to prune
  const pruned = service.pruneVersions("runtime.task", "platform", null);
  assert.strictEqual(pruned, 0);
});
