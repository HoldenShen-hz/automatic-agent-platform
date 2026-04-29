/**
 * Integration tests for ArtifactRepository
 *
 * Tests artifact storage and retrieval using SQLite backend:
 * - storeArtifact saves artifact with metadata
 * - getArtifact retrieves artifact by ID
 * - listArtifacts returns artifacts for execution
 * - Artifact content integrity is maintained
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { ArtifactRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/artifact-repository.js";
import type { ArtifactRecord } from "../../../../src/contracts/types/domain.js";

test("storeArtifact saves artifact with metadata", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-store-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifact: ArtifactRecord = {
      artifactId: "artifact-meta-001",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/output-meta.txt",
      fileName: "output-meta.txt",
      mimeType: "text/plain",
      sizeBytes: 2048,
      checksum: "checksum-abc123",
      lineageJson: null,
      createdAt: "2026-04-29T10:00:00.000Z",
    };

    repo.insertArtifact(artifact);

    // Verify artifact was persisted
    const saved = repo.getArtifact("artifact-meta-001");
    assert.ok(saved, "artifact should be persisted");
    assert.strictEqual(saved.artifactId, "artifact-meta-001");
    assert.strictEqual(saved.taskId, "task-seeded-001");
    assert.strictEqual(saved.executionId, "exec-seeded-001");
    assert.strictEqual(saved.stepId, "step-1");
    assert.strictEqual(saved.kind, "output");
    assert.strictEqual(saved.storagePath, "/artifacts/output-meta.txt");
    assert.strictEqual(saved.fileName, "output-meta.txt");
    assert.strictEqual(saved.mimeType, "text/plain");
    assert.strictEqual(saved.sizeBytes, 2048);
    assert.strictEqual(saved.checksum, "checksum-abc123");
  } finally {
    ctx.cleanup();
  }
});

test("getArtifact retrieves artifact by ID", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-get-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifact: ArtifactRecord = {
      artifactId: "artifact-get-001",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "log",
      storagePath: "/artifacts/log-get.txt",
      fileName: "log-get.txt",
      mimeType: "text/plain",
      sizeBytes: 512,
      checksum: "checksum-get-001",
      lineageJson: null,
      createdAt: "2026-04-29T11:00:00.000Z",
    };

    repo.insertArtifact(artifact);

    const retrieved = repo.getArtifact("artifact-get-001");
    assert.ok(retrieved, "artifact should be retrieved");
    assert.strictEqual(retrieved.artifactId, "artifact-get-001");
    assert.strictEqual(retrieved.taskId, "task-seeded-001");
    assert.strictEqual(retrieved.fileName, "log-get.txt");
    assert.strictEqual(retrieved.checksum, "checksum-get-001");
  } finally {
    ctx.cleanup();
  }
});

test("getArtifact returns null for non-existent artifact", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-notfound-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const result = repo.getArtifact("non-existent-artifact-id");
    assert.strictEqual(result, null, "should return null for non-existent artifact");
  } finally {
    ctx.cleanup();
  }
});

test("listArtifactsByTask returns artifacts for execution", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-list-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifacts: ArtifactRecord[] = [
      {
        artifactId: "artifact-list-001",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-1",
        kind: "output",
        storagePath: "/artifacts/output-001.txt",
        fileName: "output-001.txt",
        mimeType: "text/plain",
        sizeBytes: 1024,
        checksum: "checksum-list-001",
        lineageJson: null,
        createdAt: "2026-04-29T10:00:00.000Z",
      },
      {
        artifactId: "artifact-list-002",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-2",
        kind: "log",
        storagePath: "/artifacts/log-001.txt",
        fileName: "log-001.txt",
        mimeType: "text/plain",
        sizeBytes: 512,
        checksum: "checksum-list-002",
        lineageJson: null,
        createdAt: "2026-04-29T10:30:00.000Z",
      },
      {
        artifactId: "artifact-list-003",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-3",
        kind: "snapshot",
        storagePath: "/artifacts/snapshot-001.json",
        fileName: "snapshot-001.json",
        mimeType: "application/json",
        sizeBytes: 4096,
        checksum: "checksum-list-003",
        lineageJson: null,
        createdAt: "2026-04-29T11:00:00.000Z",
      },
    ];

    for (const artifact of artifacts) {
      repo.insertArtifact(artifact);
    }

    const listed = repo.listArtifactsByTask("task-seeded-001");
    assert.strictEqual(listed.length, 3, "should return all artifacts for task");

    // Verify ordering by created_at ASC
    assert.strictEqual(listed[0].artifactId, "artifact-list-001");
    assert.strictEqual(listed[1].artifactId, "artifact-list-002");
    assert.strictEqual(listed[2].artifactId, "artifact-list-003");

    // Verify metadata integrity
    const outputArtifact = listed.find((a) => a.kind === "output");
    assert.ok(outputArtifact, "should have output artifact");
    assert.strictEqual(outputArtifact.fileName, "output-001.txt");
    assert.strictEqual(outputArtifact.sizeBytes, 1024);
  } finally {
    ctx.cleanup();
  }
});

test("listArtifactsByTask with tenant scoping", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-tenant-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifact: ArtifactRecord = {
      artifactId: "artifact-tenant-001",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/output-tenant.txt",
      fileName: "output-tenant.txt",
      mimeType: "text/plain",
      sizeBytes: 256,
      checksum: "checksum-tenant-001",
      lineageJson: null,
      createdAt: "2026-04-29T12:00:00.000Z",
    };

    repo.insertArtifact(artifact);

    // Without tenant scoping
    const allArtifacts = repo.listArtifactsByTask("task-seeded-001");
    assert.strictEqual(allArtifacts.length, 1, "should find artifact without tenant filter");

    // With tenant scoping - task-seeded-001 has null tenantId
    const scopedArtifacts = repo.listArtifactsByTask("task-seeded-001", null);
    assert.strictEqual(scopedArtifacts.length, 1, "should find artifact with null tenant filter");
  } finally {
    ctx.cleanup();
  }
});

test("listArtifactsByTask returns empty array for task with no artifacts", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-empty-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const result = repo.listArtifactsByTask("task-with-no-artifacts");
    assert.strictEqual(result.length, 0, "should return empty array for task without artifacts");
  } finally {
    ctx.cleanup();
  }
});

test("artifact content integrity is maintained through store and retrieve", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-integrity-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifact: ArtifactRecord = {
      artifactId: "artifact-integrity-001",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/integrity-test.json",
      fileName: "integrity-test.json",
      mimeType: "application/json",
      sizeBytes: 8192,
      checksum: "sha256:abc123def456789012345678901234567890",
      lineageJson: JSON.stringify({
        parentArtifactId: null,
        transformSteps: ["extract", "process", "validate"],
      }),
      createdAt: "2026-04-29T15:00:00.000Z",
    };

    repo.insertArtifact(artifact);

    const retrieved = repo.getArtifact("artifact-integrity-001");
    assert.ok(retrieved, "artifact should be retrieved");

    // Verify all fields preserved exactly
    assert.strictEqual(retrieved.artifactId, artifact.artifactId);
    assert.strictEqual(retrieved.taskId, artifact.taskId);
    assert.strictEqual(retrieved.executionId, artifact.executionId);
    assert.strictEqual(retrieved.stepId, artifact.stepId);
    assert.strictEqual(retrieved.kind, artifact.kind);
    assert.strictEqual(retrieved.storagePath, artifact.storagePath);
    assert.strictEqual(retrieved.fileName, artifact.fileName);
    assert.strictEqual(retrieved.mimeType, artifact.mimeType);
    assert.strictEqual(retrieved.sizeBytes, artifact.sizeBytes);
    assert.strictEqual(retrieved.checksum, artifact.checksum);
    assert.deepStrictEqual(retrieved.lineageJson, artifact.lineageJson);
    assert.strictEqual(retrieved.createdAt, artifact.createdAt);
  } finally {
    ctx.cleanup();
  }
});

test("multiple artifacts with different kinds are stored correctly", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-kinds-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifacts: ArtifactRecord[] = [
      {
        artifactId: "artifact-kind-output",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-1",
        kind: "output",
        storagePath: "/artifacts/output.txt",
        fileName: "output.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        checksum: "checksum-output",
        lineageJson: null,
        createdAt: "2026-04-29T09:00:00.000Z",
      },
      {
        artifactId: "artifact-kind-log",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-1",
        kind: "log",
        storagePath: "/artifacts/log.txt",
        fileName: "log.txt",
        mimeType: "text/plain",
        sizeBytes: 200,
        checksum: "checksum-log",
        lineageJson: null,
        createdAt: "2026-04-29T09:15:00.000Z",
      },
      {
        artifactId: "artifact-kind-snapshot",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-1",
        kind: "snapshot",
        storagePath: "/artifacts/snapshot.json",
        fileName: "snapshot.json",
        mimeType: "application/json",
        sizeBytes: 300,
        checksum: "checksum-snapshot",
        lineageJson: null,
        createdAt: "2026-04-29T09:30:00.000Z",
      },
      {
        artifactId: "artifact-kind-checkpoint",
        taskId: "task-seeded-001",
        executionId: "exec-seeded-001",
        stepId: "step-1",
        kind: "checkpoint",
        storagePath: "/artifacts/checkpoint.json",
        fileName: "checkpoint.json",
        mimeType: "application/json",
        sizeBytes: 400,
        checksum: "checksum-checkpoint",
        lineageJson: null,
        createdAt: "2026-04-29T09:45:00.000Z",
      },
    ];

    for (const artifact of artifacts) {
      repo.insertArtifact(artifact);
    }

    const listed = repo.listArtifactsByTask("task-seeded-001");
    assert.strictEqual(listed.length, 4, "should store all artifact kinds");

    const kinds = listed.map((a) => a.kind).sort();
    assert.deepStrictEqual(kinds, ["checkpoint", "log", "output", "snapshot"], "all kinds should be preserved");
  } finally {
    ctx.cleanup();
  }
});

test("artifact retrieval by ID is idempotent", () => {
  const ctx = createSeededIntegrationContext("aa-artifact-idempotent-");
  try {
    const repo = new ArtifactRepository(ctx.db.connection);

    const artifact: ArtifactRecord = {
      artifactId: "artifact-idempotent-001",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/idempotent.txt",
      fileName: "idempotent.txt",
      mimeType: "text/plain",
      sizeBytes: 128,
      checksum: "checksum-idempotent",
      lineageJson: null,
      createdAt: "2026-04-29T16:00:00.000Z",
    };

    repo.insertArtifact(artifact);

    // Retrieve multiple times
    const first = repo.getArtifact("artifact-idempotent-001");
    const second = repo.getArtifact("artifact-idempotent-001");
    const third = repo.getArtifact("artifact-idempotent-001");

    assert.ok(first, "first retrieval should succeed");
    assert.ok(second, "second retrieval should succeed");
    assert.ok(third, "third retrieval should succeed");

    // All should be equal
    assert.strictEqual(first.artifactId, second.artifactId);
    assert.strictEqual(second.artifactId, third.artifactId);
    assert.strictEqual(first.checksum, second.checksum);
    assert.strictEqual(second.checksum, third.checksum);
  } finally {
    ctx.cleanup();
  }
});

test("integration context isolation between artifact tests", () => {
  const ctx1 = createSeededIntegrationContext("aa-artifact-iso-a-");
  const ctx2 = createSeededIntegrationContext("aa-artifact-iso-b-");
  try {
    const repo1 = new ArtifactRepository(ctx1.db.connection);
    const repo2 = new ArtifactRepository(ctx2.db.connection);

    const artifact1: ArtifactRecord = {
      artifactId: "artifact-iso-001",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/iso-a.txt",
      fileName: "iso-a.txt",
      mimeType: "text/plain",
      sizeBytes: 111,
      checksum: "checksum-iso-a",
      lineageJson: null,
      createdAt: "2026-04-29T17:00:00.000Z",
    };

    const artifact2: ArtifactRecord = {
      artifactId: "artifact-iso-002",
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/iso-b.txt",
      fileName: "iso-b.txt",
      mimeType: "text/plain",
      sizeBytes: 222,
      checksum: "checksum-iso-b",
      lineageJson: null,
      createdAt: "2026-04-29T17:00:00.000Z",
    };

    repo1.insertArtifact(artifact1);
    repo2.insertArtifact(artifact2);

    // Each context should only see its own artifact
    const retrieved1 = repo1.getArtifact("artifact-iso-001");
    const retrieved2 = repo2.getArtifact("artifact-iso-002");

    assert.ok(retrieved1, "context1 should see its artifact");
    assert.ok(retrieved2, "context2 should see its artifact");

    // Cross-context checks should fail
    const cross1 = repo1.getArtifact("artifact-iso-002");
    const cross2 = repo2.getArtifact("artifact-iso-001");

    assert.strictEqual(cross1, null, "context1 should not see context2 artifact");
    assert.strictEqual(cross2, null, "context2 should not see context1 artifact");
  } finally {
    ctx1.cleanup();
    ctx2.cleanup();
  }
});
