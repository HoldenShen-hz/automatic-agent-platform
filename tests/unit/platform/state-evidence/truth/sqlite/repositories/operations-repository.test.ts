import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { OperationsRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/operations-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { TaskRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { TaskStatus } from "../../../../../../../src/platform/contracts/types/status.js";

function createTestTask(
  taskRepo: TaskRepository,
  taskId: string,
  now: string,
  tenantId: string | null = null,
  status: TaskStatus = "in_progress",
  divisionId = "general-ops",
): void {
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId,
    tenantId,
    title: `Task ${taskId}`,
    status,
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

function createMockDb() {
  return {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as const;
}

function seedOperationsParents(db: SqliteDatabase, now: string, namespaceId = "ns-001"): void {
  db.connection.exec(`
    INSERT INTO organizations (organization_id, display_name, created_at, updated_at)
    VALUES ('org-001', 'Test Org', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO tenants (
      tenant_id, organization_id, display_name, storage_scope, identity_scope, policy_scope, artifact_scope,
      isolation_mode, deployment_mode, created_at, updated_at
    ) VALUES (
      'tenant-ops', 'org-001', 'Tenant Ops', 'tenant:storage', 'tenant:identity', 'tenant:policy', 'tenant:artifact',
      'shared_logical', 'cloud_shared', '${now}', '${now}'
    )
  `);
  db.connection.exec(`
    INSERT INTO workspaces (workspace_id, owner_id, display_name, plan_id, default_policy_set, organization_id, created_at, updated_at)
    VALUES ('ws-001', 'owner-1', 'Test Workspace', 'plan-1', '{}', 'org-001', '${now}', '${now}')
  `);
  db.connection.exec(`
    INSERT INTO data_namespaces (
      namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, residency_policy, created_at, updated_at
    ) VALUES (
      '${namespaceId}', 'transactional', 'tenant-ops', 'org-001', 'ws-001', 'standard', 'standard', 'us', '${now}', '${now}'
    )
  `);
}

test("OperationsRepository exposes the current read-model surface", () => {
  const repo = new OperationsRepository(createMockDb() as never);

  assert.equal(typeof repo.insertAnalyticsFactRecord, "function");
  assert.equal(typeof repo.listAnalyticsFactRecords, "function");
  assert.equal(typeof repo.insertArchiveBundleRecord, "function");
  assert.equal(typeof repo.listArchiveBundleRecords, "function");
  assert.equal(typeof repo.insertReplayDatasetRecord, "function");
  assert.equal(typeof repo.listReplayDatasetRecords, "function");
  assert.equal(typeof repo.upsertDataMovementJobRecord, "function");
  assert.equal(typeof repo.getDataMovementJobRecord, "function");
  assert.equal(typeof repo.listDataMovementJobRecords, "function");
  assert.equal(typeof repo.listTaskBoardItems, "function");
  assert.equal(typeof repo.listActiveTasksWithoutWorkflow, "function");
  assert.equal(typeof repo.listStaleExecutions, "function");
  assert.equal(typeof repo.listRecoverableExecutingRuns, "function");
  assert.equal(typeof repo.listBlockedRunsAwaitingApproval, "function");
  assert.equal(typeof repo.listStaleRuns, "function");
  assert.equal(typeof repo.listOrphanSessions, "function");
  assert.equal(typeof repo.listWorkflowTerminalMismatches, "function");
  assert.equal(typeof repo.listActiveTasksWithTerminalSessions, "function");
  assert.equal(typeof repo.listActiveExecutionActivity, "function");
  assert.equal(typeof repo.listActiveExecutionConflicts, "function");
  assert.equal(typeof repo.loadTaskSnapshot, "function");
  assert.equal(typeof repo.loadExecutionAuthoritativeView, "function");
});

test("OperationsRepository analytics and data movement records round-trip", () => {
  const workspace = createTempWorkspace("operations-repo-roundtrip-");
  const dbPath = join(workspace, "operations-roundtrip.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    seedOperationsParents(db, "2026-04-27T10:00:00.000Z");
    const repo = new OperationsRepository(db);
    const now = "2026-04-27T10:00:00.000Z";

    repo.insertAnalyticsFactRecord({
      factId: "fact-001",
      namespaceId: "ns-001",
      tenantId: "tenant-ops",
      organizationId: "org-001",
      workspaceId: "ws-001",
      metricName: "task_completion",
      dimensionJson: JSON.stringify({ region: "us-east" }),
      value: 1,
      windowStart: now,
      windowEnd: now,
      sourceRef: "task:task-001",
      capturedAt: now,
    });

    repo.upsertDataMovementJobRecord({
      jobId: "job-001",
      tenantId: "tenant-ops",
      organizationId: "org-001",
      workspaceId: "ws-001",
      sourceNamespaceId: "ns-001",
      targetNamespaceId: "ns-001",
      sourcePlane: "transactional",
      targetPlane: "artifact",
      movementType: "archive_compaction",
      inputRefsJson: "[]",
      status: "running",
      startedAt: now,
      finishedAt: null,
      reportJson: null,
    });

    const facts = repo.listAnalyticsFactRecords({ tenantId: "tenant-ops" });
    const job = repo.getDataMovementJobRecord("job-001");
    const jobs = repo.listDataMovementJobRecords({ movementType: "archive_compaction" });

    assert.equal(facts.length, 1);
    assert.equal(facts[0]?.factId, "fact-001");
    assert.ok(job);
    assert.equal(job?.jobId, "job-001");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.movementType, "archive_compaction");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository active-task read model tolerates current task contract", () => {
  const workspace = createTempWorkspace("operations-repo-active-tasks-");
  const dbPath = join(workspace, "operations-active-tasks.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    seedOperationsParents(db, "2026-04-27T10:00:00.000Z");
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);
    const now = "2026-04-27T10:00:00.000Z";

    createTestTask(taskRepo, "task-ops-001", now, "tenant-ops", "in_progress");

    const items = repo.listTaskBoardItems();
    const activeWithoutWorkflow = repo.listActiveTasksWithoutWorkflow("tenant-ops");

    assert.ok(Array.isArray(items));
    assert.ok(Array.isArray(activeWithoutWorkflow));
  } finally {
    cleanupPath(workspace);
  }
});
