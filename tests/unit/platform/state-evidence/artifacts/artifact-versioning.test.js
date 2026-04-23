import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactVersioningService } from "../../../../../../src/platform/state-evidence/artifacts/artifact-versioning.js";

test("ArtifactVersioningService can be instantiated", () => {
  const service = new ArtifactVersioningService();
  assert.ok(service != null);
});

test("createNextVersion increments version by 1", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "builder",
    type: "source_code" as const,
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "draft" as const,
    namespace: "default",
    artifactType: "source_code" as const,
    storageUri: "file:///path",
    createdBy: "builder",
    metadata: {},
  };
  const next = service.createNextVersion(previous, {});
  assert.equal(next.version, 2);
});

test("createNextVersion sets parentArtifactId to previous artifactId", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "builder",
    type: "source_code" as const,
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "draft" as const,
    namespace: "default",
    artifactType: "source_code" as const,
    storageUri: "file:///path",
    createdBy: "builder",
    metadata: {},
  };
  const next = service.createNextVersion(previous, {});
  assert.equal(next.parentArtifactId, "artifact_1");
});

test("createNextVersion applies overrides", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "builder",
    type: "source_code" as const,
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 1,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "draft" as const,
    namespace: "default",
    artifactType: "source_code" as const,
    storageUri: "file:///path",
    createdBy: "builder",
    metadata: {},
  };
  const overrides = { status: "committed" as const, size: 2048 };
  const next = service.createNextVersion(previous, overrides);
  assert.equal(next.status, "committed");
  assert.equal(next.size, 2048);
});

test("createNextVersion preserves other fields from previous", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "builder",
    type: "source_code" as const,
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 5,
    parentArtifactId: "artifact_0",
    size: 2048,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "committed" as const,
    namespace: "my-namespace",
    artifactType: "source_code" as const,
    storageUri: "file:///path",
    createdBy: "builder",
    metadata: { customField: "value" },
  };
  const next = service.createNextVersion(previous, {});
  assert.equal(next.artifactId, "artifact_1");
  assert.equal(next.taskId, "task_1");
  assert.equal(next.stepId, "step_1");
  assert.equal(next.agentRole, "builder");
  assert.equal(next.type, "source_code");
  assert.equal(next.path, "/path/to/artifact");
  assert.equal(next.namespace, "my-namespace");
  assert.equal(next.createdBy, "builder");
  assert.deepEqual(next.metadata, { customField: "value" });
});

test("createNextVersion handles version 0", () => {
  const service = new ArtifactVersioningService();
  const previous = {
    artifactId: "artifact_1",
    taskId: "task_1",
    stepId: "step_1",
    agentRole: "builder",
    type: "source_code" as const,
    path: "/path/to/artifact",
    contentHash: "abc123",
    version: 0,
    parentArtifactId: null,
    size: 1024,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "draft" as const,
    namespace: "default",
    artifactType: "source_code" as const,
    storageUri: "file:///path",
    createdBy: "builder",
    metadata: {},
  };
  const next = service.createNextVersion(previous, {});
  assert.equal(next.version, 1);
});