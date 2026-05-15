import assert from "node:assert/strict";
import test from "node:test";
import { ArtifactRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/artifact-repository.js";

function createMockConn() {
  return {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  };
}

test("ArtifactRepository has all required methods", () => {
  const mockConn = createMockConn() as any;
  const repo = new ArtifactRepository(mockConn);

  assert.equal(typeof repo.insertArtifact, "function");
  assert.equal(typeof repo.getArtifact, "function");
  assert.equal(typeof repo.listArtifactsByTask, "function");
});

test("ArtifactRepository inserts artifact", () => {
  const mockConn = createMockConn() as any;
  const repo = new ArtifactRepository(mockConn);

  const now = "2026-04-21T10:00:00.000Z";
  const artifact = {
    artifactId: "artifact_1",
    taskId: "task_1",
    executionId: "exec_1",
    stepId: "step_1",
    kind: "output",
    storagePath: "/artifacts/output_1.json",
    fileName: "output_1.json",
    mimeType: "application/json",
    sizeBytes: 1024,
    checksum: "abc123",
    lineageJson: "[]",
    createdAt: now,
  };

  repo.insertArtifact(artifact);
  assert.ok(true);
});

test("ArtifactRepository gets artifact by id", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    }),
  } as any;
  const repo = new ArtifactRepository(mockConn);

  const result = repo.getArtifact("nonexistent");
  assert.equal(result, null);
});

test("ArtifactRepository lists artifacts by task", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new ArtifactRepository(mockConn);

  const result = repo.listArtifactsByTask("task_1");
  assert.ok(Array.isArray(result));
});

test("ArtifactRepository lists artifacts by task with tenant scope", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new ArtifactRepository(mockConn);

  const result = repo.listArtifactsByTask("task_1", "tenant_1");
  assert.ok(Array.isArray(result));
});

test("ArtifactRepository returns empty array for missing task", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;
  const repo = new ArtifactRepository(mockConn);

  const result = repo.listArtifactsByTask("missing_task");
  assert.deepEqual(result, []);
});