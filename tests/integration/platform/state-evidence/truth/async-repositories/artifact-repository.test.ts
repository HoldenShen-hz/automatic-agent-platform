import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncArtifactRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/artifact-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { ArtifactRecord, TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.group("AsyncArtifactRepository", (group) => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    artifactRepo: AsyncArtifactRepository;
    taskRepo: AsyncTaskRepository;
    cleanup: () => void;
  };

  group.beforeEach(async () => {
    const workspace = createTempWorkspace("aa-async-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const artifactRepo = new AsyncArtifactRepository(adapter.asyncConnection);
    const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      artifactRepo,
      taskRepo,
      cleanup() {
        db.close();
        cleanupPath(workspace);
      },
    };
  });

  group.afterEach(() => {
    harness.cleanup();
  });

  async function insertTestTask(taskId: string, tenantId: string): Promise<void> {
    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: null,
      divisionId: "div-001",
      tenantId,
      title: "Test Task",
      status: "completed",
      source: "test",
      priority: "medium",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: null,
      errorCode: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      completedAt: "2026-04-23T12:00:00.000Z",
    };
    await harness.taskRepo.insertTask(task);
  }

  test("insertArtifact and getArtifact roundtrip", async () => {
    await insertTestTask("task-artifact-001", "tenant-artifact");

    const artifact: ArtifactRecord = {
      artifactId: "artifact-001",
      taskId: "task-artifact-001",
      executionId: "exec-artifact-001",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/output-001.txt",
      fileName: "output-001.txt",
      mimeType: "text/plain",
      sizeBytes: 1024,
      checksum: "abc123def456",
      lineageJson: null,
      createdAt: "2026-04-23T12:00:00.000Z",
    };

    await harness.artifactRepo.insertArtifact(artifact);
    const retrieved = await harness.artifactRepo.getArtifact("artifact-001");

    assert.equal(retrieved?.artifactId, "artifact-001");
    assert.equal(retrieved?.taskId, "task-artifact-001");
    assert.equal(retrieved?.fileName, "output-001.txt");
    assert.equal(retrieved?.sizeBytes, 1024);
    assert.equal(retrieved?.mimeType, "text/plain");
  });

  test("getArtifact returns null for non-existent artifact", async () => {
    const result = await harness.artifactRepo.getArtifact("non-existent-artifact");
    assert.equal(result, null);
  });

  test("listArtifactsByTask returns all artifacts for a task", async () => {
    await insertTestTask("task-artifact-list", "tenant-artifact-list");

    const artifacts: ArtifactRecord[] = [
      {
        artifactId: "artifact-list-001",
        taskId: "task-artifact-list",
        executionId: "exec-list-001",
        stepId: "step-1",
        kind: "output",
        storagePath: "/artifacts/output-001.txt",
        fileName: "output-001.txt",
        mimeType: "text/plain",
        sizeBytes: 512,
        checksum: "checksum-001",
        lineageJson: null,
        createdAt: "2026-04-23T11:00:00.000Z",
      },
      {
        artifactId: "artifact-list-002",
        taskId: "task-artifact-list",
        executionId: "exec-list-001",
        stepId: "step-2",
        kind: "log",
        storagePath: "/artifacts/log-001.txt",
        fileName: "log-001.txt",
        mimeType: "text/plain",
        sizeBytes: 2048,
        checksum: "checksum-002",
        lineageJson: null,
        createdAt: "2026-04-23T11:30:00.000Z",
      },
    ];

    for (const artifact of artifacts) {
      await harness.artifactRepo.insertArtifact(artifact);
    }

    const listed = await harness.artifactRepo.listArtifactsByTask("task-artifact-list", "tenant-artifact-list");
    assert.equal(listed.length, 2);
  });

  test("listArtifactsByTask with tenant scoping returns null when tenant mismatch", async () => {
    await insertTestTask("task-artifact-tenant", "tenant-a");

    const artifact: ArtifactRecord = {
      artifactId: "artifact-tenant-001",
      taskId: "task-artifact-tenant",
      executionId: "exec-tenant",
      stepId: "step-1",
      kind: "output",
      storagePath: "/artifacts/output.txt",
      fileName: "output.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      checksum: "checksum-tenant",
      lineageJson: null,
      createdAt: "2026-04-23T12:00:00.000Z",
    };

    await harness.artifactRepo.insertArtifact(artifact);

    const listed = await harness.artifactRepo.listArtifactsByTask("task-artifact-tenant", "tenant-b");
    assert.equal(listed.length, 0);
  });

  test("listArtifactsByTask orders by created_at asc", async () => {
    await insertTestTask("task-artifact-order", "tenant-artifact-order");

    const artifacts: ArtifactRecord[] = [
      {
        artifactId: "artifact-order-002",
        taskId: "task-artifact-order",
        executionId: "exec-order",
        stepId: "step-2",
        kind: "output",
        storagePath: "/artifacts/second.txt",
        fileName: "second.txt",
        mimeType: "text/plain",
        sizeBytes: 200,
        checksum: "checksum-002",
        lineageJson: null,
        createdAt: "2026-04-23T11:00:00.000Z",
      },
      {
        artifactId: "artifact-order-001",
        taskId: "task-artifact-order",
        executionId: "exec-order",
        stepId: "step-1",
        kind: "output",
        storagePath: "/artifacts/first.txt",
        fileName: "first.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        checksum: "checksum-001",
        lineageJson: null,
        createdAt: "2026-04-23T10:00:00.000Z",
      },
    ];

    for (const artifact of artifacts) {
      await harness.artifactRepo.insertArtifact(artifact);
    }

    const listed = await harness.artifactRepo.listArtifactsByTask("task-artifact-order", "tenant-artifact-order");
    assert.equal(listed.length, 2);
    assert.equal(listed[0].artifactId, "artifact-order-001");
    assert.equal(listed[1].artifactId, "artifact-order-002");
  });
});