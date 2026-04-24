// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncArtifactRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/artifact-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { AsyncExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/execution-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { ArtifactRecord, ExecutionRecord, TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.describe("AsyncArtifactRepository", () => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    artifactRepo: AsyncArtifactRepository;
    taskRepo: AsyncTaskRepository;
    executionRepo: AsyncExecutionRepository;
    cleanup: () => void;
  };

  test.beforeEach(async () => {
    const workspace = createTempWorkspace("aa-async-artifact-repo-");
    const dbPath = join(workspace, "artifact-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const artifactRepo = new AsyncArtifactRepository(adapter.asyncConnection);
    const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
    const executionRepo = new AsyncExecutionRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      artifactRepo,
      taskRepo,
      executionRepo,
      cleanup() {
        db.close();
        cleanupPath(workspace);
      },
    };
  });

  test.afterEach(() => {
    harness.cleanup();
  });

  async function insertTestTask(taskId: string, tenantId: string): Promise<void> {
    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId,
      title: "Test Task",
      status: "completed",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      completedAt: "2026-04-23T12:00:00.000Z",
    };
    await harness.taskRepo.insertTask(task);
  }

  async function insertTestExecution(executionId: string, taskId: string, tenantId: string, attempt: number = 1): Promise<void> {
    await insertTestTask(taskId, tenantId);
    const execution: ExecutionRecord = {
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: "general_executor",
      runKind: "task_run",
      status: "completed",
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: "2026-04-23T10:00:00.000Z",
      finishedAt: "2026-04-23T12:00:00.000Z",
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    };
    await harness.executionRepo.insertExecution(execution);
  }

  test("insertArtifact and getArtifact roundtrip", async () => {
    await insertTestExecution("exec-artifact-001", "task-artifact-001", "tenant-artifact");

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
    await insertTestExecution("exec-list-001", "task-artifact-list", "tenant-artifact-list");

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
    await insertTestExecution("exec-tenant", "task-artifact-tenant", "tenant-a");

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
    await insertTestExecution("exec-order", "task-artifact-order", "tenant-artifact-order");

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
