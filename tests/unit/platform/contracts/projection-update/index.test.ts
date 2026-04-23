import assert from "node:assert/strict";
import test from "node:test";

import { createProjectionUpdate } from "../../../../../src/platform/contracts/projection-update/index.js";
import type { ProjectionUpdate } from "../../../../../src/platform/contracts/projection-update/index.js";

// =============================================================================
// createProjectionUpdate Tests (re-exported from platform-contracts)
// =============================================================================

test("createProjectionUpdate creates update with required fields", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task-status",
    version: 1,
    sourceEvents: ["evt-1", "evt-2"],
    patch: { status: "completed" },
    triggeredBy: "system",
  });
  assert.equal(update.projectionId, "proj-123");
  assert.equal(update.projectionType, "task-status");
  assert.equal(update.version, 1);
  assert.deepEqual(update.sourceEvents, ["evt-1", "evt-2"]);
  assert.deepEqual(update.patch, { status: "completed" });
  assert.equal(update.metadata.triggeredBy, "system");
  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
  assert.ok(update.timestamp.length > 0);
});

test("createProjectionUpdate applies optional rebuiltAt field", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task-status",
    version: 5,
    sourceEvents: ["evt-1"],
    patch: { data: "updated" },
    triggeredBy: "manual-trigger",
    rebuiltAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(update.metadata.rebuiltAt, "2026-01-01T00:00:00.000Z");
  assert.equal(update.metadata.triggeredBy, "manual-trigger");
});

test("createProjectionUpdate uses custom idempotencyKey when provided", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "type-1",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
    idempotencyKey: "custom-idem-key-123",
  });
  assert.equal(update.metadata.idempotencyKey, "custom-idem-key-123");
});

test("createProjectionUpdate generates idempotency key when not provided", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "type-1",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
  });
  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
});

test("createProjectionUpdate generates unique idempotency keys", () => {
  const keys = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const update = createProjectionUpdate({
      projectionId: `proj-${i}`,
      projectionType: "test",
      version: 1,
      sourceEvents: [],
      patch: { index: i },
      triggeredBy: "system",
    });
    keys.add(update.metadata.idempotencyKey);
  }
  assert.equal(keys.size, 100, "All 100 generated idempotency keys should be unique");
});

test("createProjectionUpdate timestamp is ISO 8601 format", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "test-type",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
  });
  assert.match(update.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

// =============================================================================
// ProjectionUpdate Type Structure Tests
// =============================================================================

test("ProjectionUpdate has correct structure with required metadata", () => {
  const update: ProjectionUpdate = {
    projectionId: "proj-basic",
    projectionType: "user-stats",
    version: 10,
    timestamp: "2026-04-23T10:30:00.000Z",
    sourceEvents: ["evt-a", "evt-b", "evt-c"],
    patch: { totalTasks: 42, completedTasks: 40 },
    metadata: {
      triggeredBy: "scheduler",
      idempotencyKey: "key-123",
    },
  };
  assert.equal(update.projectionId, "proj-basic");
  assert.equal(update.projectionType, "user-stats");
  assert.equal(update.version, 10);
  assert.equal(update.timestamp, "2026-04-23T10:30:00.000Z");
  assert.deepEqual(update.sourceEvents, ["evt-a", "evt-b", "evt-c"]);
  assert.deepEqual(update.patch, { totalTasks: 42, completedTasks: 40 });
  assert.equal(update.metadata.triggeredBy, "scheduler");
  assert.equal(update.metadata.idempotencyKey, "key-123");
});

test("ProjectionUpdate metadata rebuiltAt is optional", () => {
  const withoutRebuilt: ProjectionUpdate = {
    projectionId: "p1",
    projectionType: "t1",
    version: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    sourceEvents: [],
    patch: {},
    metadata: {
      triggeredBy: "system",
      idempotencyKey: "k1",
    },
  };
  assert.equal(withoutRebuilt.metadata.rebuiltAt, undefined);

  const withRebuilt: ProjectionUpdate = {
    projectionId: "p2",
    projectionType: "t2",
    version: 2,
    timestamp: "2026-01-02T00:00:00.000Z",
    sourceEvents: [],
    patch: {},
    metadata: {
      rebuiltAt: "2026-01-01T12:00:00.000Z",
      triggeredBy: "rebuild",
      idempotencyKey: "k2",
    },
  };
  assert.equal(withRebuilt.metadata.rebuiltAt, "2026-01-01T12:00:00.000Z");
});

test("ProjectionUpdate sourceEvents can be empty", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-empty",
    projectionType: "empty-projection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "init",
  });
  assert.deepEqual(update.sourceEvents, []);
});

test("ProjectionUpdate patch can contain arbitrary data", () => {
  const complexPatch = {
    stringField: "value",
    numberField: 42,
    boolField: true,
    nullField: null,
    arrayField: [1, 2, 3],
    nestedField: { deep: { nested: "value" } },
  };
  const update = createProjectionUpdate({
    projectionId: "proj-complex",
    projectionType: "complex-type",
    version: 1,
    sourceEvents: ["evt-1"],
    patch: complexPatch,
    triggeredBy: "test",
  });
  assert.equal(update.patch.stringField, "value");
  assert.equal(update.patch.numberField, 42);
  assert.equal(update.patch.boolField, true);
  assert.equal(update.patch.nullField, null);
  assert.deepEqual(update.patch.arrayField, [1, 2, 3]);
  // Access nested field through type assertion since patch is Record<string, unknown>
  const nested = update.patch.nestedField as { deep: { nested: string } };
  assert.equal(nested.deep.nested, "value");
});

test("ProjectionUpdate version can be any positive integer", () => {
  const versions = [1, 2, 100, 1000, 999999];
  for (const version of versions) {
    const update = createProjectionUpdate({
      projectionId: `proj-v${version}`,
      projectionType: "test",
      version,
      sourceEvents: [],
      patch: {},
      triggeredBy: "test",
    });
    assert.equal(update.version, version);
  }
});

// =============================================================================
// Edge Cases
// =============================================================================

test("createProjectionUpdate handles version 0", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-v0",
    projectionType: "initial",
    version: 0,
    sourceEvents: [],
    patch: { initialized: true },
    triggeredBy: "bootstrap",
  });
  assert.equal(update.version, 0);
});

test("createProjectionUpdate handles large sourceEvents arrays", () => {
  const events = Array.from({ length: 1000 }, (_, i) => `evt-${i}`);
  const update = createProjectionUpdate({
    projectionId: "proj-many",
    projectionType: "batch",
    version: 1,
    sourceEvents: events,
    patch: { count: 1000 },
    triggeredBy: "batch-processor",
  });
  assert.equal(update.sourceEvents.length, 1000);
  assert.equal(update.sourceEvents[999], "evt-999");
});

test("createProjectionUpdate handles unicode in triggeredBy", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-unicode",
    projectionType: "test",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "操作员-中文",
  });
  assert.equal(update.metadata.triggeredBy, "操作员-中文");
});

test("createProjectionUpdate handles long projection IDs", () => {
  const longId = "proj-" + "x".repeat(100);
  const update = createProjectionUpdate({
    projectionId: longId,
    projectionType: "test",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });
  assert.equal(update.projectionId, longId);
});

test("createProjectionUpdate handles empty patch object", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-empty-patch",
    projectionType: "test",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "test",
  });
  assert.deepEqual(update.patch, {});
});

test("ProjectionUpdate metadata is readonly", () => {
  const update: ProjectionUpdate = {
    projectionId: "p1",
    projectionType: "t1",
    version: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    sourceEvents: [],
    patch: {},
    metadata: {
      triggeredBy: "system",
      idempotencyKey: "key1",
    },
  };
  // Verify structure at runtime
  assert.equal(update.metadata.triggeredBy, "system");
  assert.equal(update.metadata.idempotencyKey, "key1");
  assert.equal(update.metadata.rebuiltAt, undefined);
});

test("createProjectionUpdate with only triggeredBy (minimum viable)", () => {
  const update = createProjectionUpdate({
    projectionId: "proj-min",
    projectionType: "min",
    version: 1,
    sourceEvents: ["evt-init"],
    patch: { init: true },
    triggeredBy: "system",
  });
  assert.equal(update.projectionId, "proj-min");
  assert.equal(update.metadata.triggeredBy, "system");
  assert.ok(update.metadata.idempotencyKey.length > 0);
});
