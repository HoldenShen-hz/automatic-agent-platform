import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactVersioningService } from "../../../../../src/platform/state-evidence/artifacts/artifact-versioning.js";
import type { ArtifactRecordExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

function createMinimalArtifact(overrides: Partial<ArtifactRecordExtended> = {}): ArtifactRecordExtended {
  const base: ArtifactRecordExtended = {
    artifactId: "artifact:test",
    taskId: "task:test",
    stepId: "step:test",
    agentRole: "agent",
    type: "source_code",
    path: "/test/path",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 100,
    createdAt: "2024-01-01T00:00:00.000Z",
    status: "draft",
    namespace: "test",
    artifactType: "config",
    storageUri: "file:///test",
    createdBy: "test-user",
    metadata: {},
    ...overrides,
  };
  return base;
}

// Test: Version increment from 1
test("ArtifactVersioningService.createNextVersion increments version from 1 to 2", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1 });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.version, 2);
});

// Test: Version increment from higher version
test("ArtifactVersioningService.createNextVersion increments version from 5 to 6", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 5 });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.version, 6);
});

// Test: Version increment from zero
test("ArtifactVersioningService.createNextVersion increments version from 0 to 1", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 0 });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.version, 1);
});

// Test: parentArtifactId is set to previous artifactId
test("ArtifactVersioningService.createNextVersion sets parentArtifactId to previous artifactId", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ artifactId: "artifact:v1", version: 1 });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.parentArtifactId, "artifact:v1");
});

// Test: parentArtifactId is not affected by overrides
test("ArtifactVersioningService.createNextVersion parentArtifactId ignores overrides", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ artifactId: "artifact:v1", version: 1 });
  const next = service.createNextVersion(previous, { parentArtifactId: "artifact:ignored" });

  assert.equal(next.parentArtifactId, "artifact:v1");
});

// Test: Initial artifact has null parentArtifactId
test("ArtifactVersioningService.createNextVersion initial artifact has null parentArtifactId", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ artifactId: "artifact:base", version: 1, parentArtifactId: null });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.parentArtifactId, "artifact:base");
});

// Test: Overrides replace previous field values
test("ArtifactVersioningService.createNextVersion applies overrides to all fields", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({
    version: 1,
    namespace: "original-namespace",
    createdBy: "original-user",
  });
  const next = service.createNextVersion(previous, {
    namespace: "new-namespace",
    createdBy: "new-user",
  });

  assert.equal(next.namespace, "new-namespace");
  assert.equal(next.createdBy, "new-user");
});

// Test: Version override is always ignored
test("ArtifactVersioningService.createNextVersion ignores version override", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 5 });
  const next = service.createNextVersion(previous, { version: 99 });

  assert.equal(next.version, 6);
});

// Test: Multiple consecutive version chains
test("ArtifactVersioningService.createNextVersion maintains version chain", () => {
  const service = new ArtifactVersioningService();
  let current = createMinimalArtifact({ artifactId: "artifact:base", version: 1 });
  assert.equal(current.parentArtifactId, null);

  current = service.createNextVersion(current, { artifactId: "artifact:v2" });
  assert.equal(current.version, 2);
  assert.equal(current.parentArtifactId, "artifact:base");

  current = service.createNextVersion(current, { artifactId: "artifact:v3" });
  assert.equal(current.version, 3);
  assert.equal(current.parentArtifactId, "artifact:v2");

  current = service.createNextVersion(current, { artifactId: "artifact:v4" });
  assert.equal(current.version, 4);
  assert.equal(current.parentArtifactId, "artifact:v3");
});

// Test: Metadata is preserved when not overridden
test("ArtifactVersioningService.createNextVersion preserves metadata", () => {
  const service = new ArtifactVersioningService();
  const metadata = { key: "value", nested: { a: 1 } };
  const previous = createMinimalArtifact({ version: 1, metadata });
  const next = service.createNextVersion(previous, {});

  assert.deepEqual(next.metadata, metadata);
});

// Test: Metadata override replaces previous metadata
test("ArtifactVersioningService.createNextVersion applies metadata override", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1, metadata: { old: "value" } });
  const next = service.createNextVersion(previous, { metadata: { new: "value" } });

  assert.deepEqual(next.metadata, { new: "value" });
});

// Test: Status can be overridden
test("ArtifactVersioningService.createNextVersion allows status override", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1, status: "draft" });
  const next = service.createNextVersion(previous, { status: "published" });

  assert.equal(next.status, "published");
});

// Test: Size can be overridden
test("ArtifactVersioningService.createNextVersion allows size override", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1, size: 100 });
  const next = service.createNextVersion(previous, { size: 200 });

  assert.equal(next.size, 200);
});

// Test: TaskId is preserved
test("ArtifactVersioningService.createNextVersion preserves taskId", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1, taskId: "task:12345" });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.taskId, "task:12345");
});

// Test: ArtifactType can be overridden
test("ArtifactVersioningService.createNextVersion allows artifactType override", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1, artifactType: "config" });
  const next = service.createNextVersion(previous, { artifactType: "document" });

  assert.equal(next.artifactType, "document");
});

// Test: StorageUri is preserved
test("ArtifactVersioningService.createNextVersion preserves storageUri", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1, storageUri: "file:///original/path" });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.storageUri, "file:///original/path");
});

// Test: Empty overrides object still increments version and sets parentArtifactId
test("ArtifactVersioningService.createNextVersion works with empty overrides", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 3, artifactId: "artifact:test", parentArtifactId: "artifact:parent" });
  const next = service.createNextVersion(previous, {});

  assert.equal(next.version, 4);
  assert.equal(next.parentArtifactId, "artifact:test");
});

// Test: All required fields from ArtifactRecordExtended are present in output
test("ArtifactVersioningService.createNextVersion returns complete ArtifactRecordExtended", () => {
  const service = new ArtifactVersioningService();
  const previous = createMinimalArtifact({ version: 1 });
  const next = service.createNextVersion(previous, {});

  // Check all required fields exist
  assert.ok(next.artifactId);
  assert.ok(next.taskId);
  assert.ok(next.stepId);
  assert.ok(next.agentRole);
  assert.ok(next.type);
  assert.ok(next.path);
  assert.ok(next.contentHash);
  assert.ok(next.namespace);
  assert.ok(next.artifactType);
  assert.ok(next.storageUri);
  assert.ok(next.createdBy);
  assert.ok(next.metadata !== undefined);
});
