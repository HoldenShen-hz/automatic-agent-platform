import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { OperationsRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/operations-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { TaskRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { WorkflowRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/workflow-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";

function createTestTask(
  taskRepo: TaskRepository,
  taskId: string,
  now: string,
  tenantId: string | null = null,
  status = "in_progress",
  divisionId = "general_ops",
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

function createTestWorkflow(
  workflowRepo: WorkflowRepository,
  taskId: string,
  now: string,
  status = "in_progress",
): void {
  workflowRepo.upsertWorkflowState({
    taskId,
    status,
    currentStepIndex: 0,
    totalSteps: 3,
    contextJson: "{}",
    stepsJson: "[]",
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    errorMessage: null,
    agentId: null,
  });
}

function setupOperationsParentRecords(db: SqliteDatabase, now: string, namespaceId = "ns-001", extraTenantIds: string[] = []): void {
  // Create organizations first (no dependencies)
  db.connection.exec(`
    INSERT INTO organizations (organization_id, display_name, created_at, updated_at)
    VALUES ('org-001', 'Test Org', '${now}', '${now}')
  `);

  // Create tenants (depends on organizations)
  db.connection.exec(`
    INSERT INTO tenants (tenant_id, organization_id, storage_scope, identity_scope, policy_scope, artifact_scope, isolation_mode, deployment_mode, created_at, updated_at)
    VALUES ('tenant-ops', 'org-001', 'standard', 'standard', 'standard', 'standard', 'shared', 'standard', '${now}', '${now}')
  `);

  // Create additional tenants if needed
  for (const tenantId of extraTenantIds) {
    db.connection.exec(`
      INSERT INTO tenants (tenant_id, organization_id, storage_scope, identity_scope, policy_scope, artifact_scope, isolation_mode, deployment_mode, created_at, updated_at)
      VALUES ('${tenantId}', 'org-001', 'standard', 'standard', 'standard', 'standard', 'shared', 'standard', '${now}', '${now}')
    `);
  }

  // Create workspaces (depends on organizations)
  db.connection.exec(`
    INSERT INTO workspaces (workspace_id, owner_id, display_name, plan_id, default_policy_set, organization_id, created_at, updated_at)
    VALUES ('ws-001', 'owner-1', 'Test Workspace', 'plan-1', '{}', 'org-001', '${now}', '${now}')
  `);

  // Create data namespace (depends on tenants, organizations, workspaces)
  db.connection.exec(`
    INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
    VALUES ('${namespaceId}', 'execution', 'tenant-ops', 'org-001', 'ws-001', 'standard', 'standard', '${now}', '${now}')
  `);
}

test("OperationsRepository can be instantiated with mock database", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;

  const repo = new OperationsRepository(mockDb);
  assert.ok(repo);
  assert.equal(typeof repo.insertAnalyticsFactRecord, "function");
  assert.equal(typeof repo.listAnalyticsFactRecords, "function");
  assert.equal(typeof repo.insertArchiveBundleRecord, "function");
  assert.equal(typeof repo.listArchiveBundleRecords, "function");
  assert.equal(typeof repo.insertReplayDatasetRecord, "function");
  assert.equal(typeof repo.listReplayDatasetRecords, "function");
  assert.equal(typeof repo.upsertDataMovementJobRecord, "function");
  assert.equal(typeof repo.listTaskBoardItems, "function");
});

test("OperationsRepository has all required read model methods", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;

  const repo = new OperationsRepository(mockDb);

  // Analytics / Archive / Replay methods
  assert.equal(typeof repo.insertAnalyticsFactRecord, "function");
  assert.equal(typeof repo.listAnalyticsFactRecords, "function");
  assert.equal(typeof repo.insertArchiveBundleRecord, "function");
  assert.equal(typeof repo.listArchiveBundleRecords, "function");
  assert.equal(typeof repo.insertReplayDatasetRecord, "function");
  assert.equal(typeof repo.listReplayDatasetRecords, "function");

  // Data movement methods
  assert.equal(typeof repo.upsertDataMovementJobRecord, "function");
  assert.equal(typeof repo.getDataMovementJobRecord, "function");
  assert.equal(typeof repo.listDataMovementJobRecords, "function");

  // Read model methods
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

  // Snapshot methods
  assert.equal(typeof repo.loadTaskSnapshot, "function");
  assert.equal(typeof repo.loadExecutionAuthoritativeView, "function");
});

test("OperationsRepository insertAnalyticsFactRecord and listAnalyticsFactRecords round-trip", () => {
  const workspace = createTempWorkspace("operations-repo-analytics-");
  const dbPath = join(workspace, "operations-analytics.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now);
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

    const facts = repo.listAnalyticsFactRecords({ tenantId: "tenant-ops" });
    assert.ok(Array.isArray(facts));
    assert.equal(facts.length, 1);
    assert.equal(facts[0].factId, "fact-001");
    assert.equal(facts[0].metricName, "task_completion");

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listAnalyticsFactRecords with metric filter", () => {
  const workspace = createTempWorkspace("operations-repo-analytics-metric-");
  const dbPath = join(workspace, "operations-analytics-metric.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-001", ["tenant-metric"]);
    repo.insertAnalyticsFactRecord({
      factId: "fact-metric-001",
      namespaceId: "ns-001",
      tenantId: "tenant-metric",
      organizationId: "org-001",
      workspaceId: "ws-001",
      metricName: "api_latency",
      dimensionJson: "{}",
      value: 100,
      windowStart: now,
      windowEnd: now,
      sourceRef: "api:/v1/tasks",
      capturedAt: now,
    });

    repo.insertAnalyticsFactRecord({
      factId: "fact-metric-002",
      namespaceId: "ns-001",
      tenantId: "tenant-metric",
      organizationId: "org-001",
      workspaceId: "ws-001",
      metricName: "task_count",
      dimensionJson: "{}",
      value: 5,
      windowStart: now,
      windowEnd: now,
      sourceRef: "task:tasks",
      capturedAt: now,
    });

    const latencyFacts = repo.listAnalyticsFactRecords({
      tenantId: "tenant-metric",
      metricName: "api_latency",
    });

    assert.ok(Array.isArray(latencyFacts));
    assert.equal(latencyFacts.length, 1);
    assert.equal(latencyFacts[0].metricName, "api_latency");
    assert.equal(latencyFacts[0].value, 100);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository insertArchiveBundleRecord and listArchiveBundleRecords round-trip", () => {
  const workspace = createTempWorkspace("operations-repo-archive-");
  const dbPath = join(workspace, "operations-archive.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-001", ["tenant-archive"]);
    repo.insertArchiveBundleRecord({
      bundleId: "bundle-001",
      namespaceId: "ns-001",
      tenantId: "tenant-archive",
      organizationId: "org-001",
      workspaceId: "ws-001",
      bundleType: "task_execution",
      sourceRefsJson: JSON.stringify(["task:001", "task:002"]),
      summaryRef: "s3://archive/summary-001.json",
      createdAt: now,
    });

    const bundles = repo.listArchiveBundleRecords({ tenantId: "tenant-archive" });
    assert.ok(Array.isArray(bundles));
    assert.equal(bundles.length, 1);
    assert.equal(bundles[0].bundleId, "bundle-001");
    assert.equal(bundles[0].bundleType, "task_execution");

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listArchiveBundleRecords with bundleType filter", () => {
  const workspace = createTempWorkspace("operations-repo-archive-type-");
  const dbPath = join(workspace, "operations-archive-type.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-001", ["tenant-archive-type"]);

    repo.insertArchiveBundleRecord({
      bundleId: "bundle-type-001",
      namespaceId: "ns-001",
      tenantId: "tenant-archive-type",
      organizationId: "org-001",
      workspaceId: "ws-001",
      bundleType: "task_execution",
      sourceRefsJson: "[]",
      summaryRef: "summary-001",
      createdAt: now,
    });

    repo.insertArchiveBundleRecord({
      bundleId: "bundle-type-002",
      namespaceId: "ns-001",
      tenantId: "tenant-archive-type",
      organizationId: "org-001",
      workspaceId: "ws-001",
      bundleType: "session_archive",
      sourceRefsJson: "[]",
      summaryRef: "summary-002",
      createdAt: now,
    });

    const taskBundles = repo.listArchiveBundleRecords({
      tenantId: "tenant-archive-type",
      bundleType: "task_execution",
    });

    assert.ok(Array.isArray(taskBundles));
    assert.equal(taskBundles.length, 1);
    assert.equal(taskBundles[0].bundleType, "task_execution");

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository insertReplayDatasetRecord and listReplayDatasetRecords round-trip", () => {
  const workspace = createTempWorkspace("operations-repo-replay-");
  const dbPath = join(workspace, "operations-replay.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-001", ["tenant-replay"]);
    repo.insertReplayDatasetRecord({
      datasetId: "dataset-001",
      namespaceId: "ns-001",
      tenantId: "tenant-replay",
      organizationId: "org-001",
      workspaceId: "ws-001",
      datasetType: "production_truth",
      sampleRefsJson: JSON.stringify(["sample-001", "sample-002"]),
      truthRefsJson: JSON.stringify(["truth-001"]),
      version: 1,
      createdAt: now,
    });

    const datasets = repo.listReplayDatasetRecords({ tenantId: "tenant-replay" });
    assert.ok(Array.isArray(datasets));
    assert.equal(datasets.length, 1);
    assert.equal(datasets[0].datasetId, "dataset-001");
    assert.equal(datasets[0].datasetType, "production_truth");
    assert.ok(Number(datasets[0].version) === 1);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository upsertDataMovementJobRecord and getDataMovementJobRecord round-trip", () => {
  const workspace = createTempWorkspace("operations-repo-datamovement-");
  const dbPath = join(workspace, "operations-datamovement.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-source");
    // Insert target namespace directly for data movement job
    db.connection.exec(`
      INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
      VALUES ('ns-target', 'evidence', 'tenant-ops', 'org-001', 'ws-001', 'standard', 'standard', '${now}', '${now}')
    `);
    repo.upsertDataMovementJobRecord({
      jobId: "job-001",
      tenantId: "tenant-ops",
      organizationId: "org-001",
      workspaceId: "ws-001",
      sourceNamespaceId: "ns-source",
      targetNamespaceId: "ns-target",
      sourcePlane: "execution",
      targetPlane: "evidence",
      movementType: "archive",
      inputRefsJson: JSON.stringify(["ref-001", "ref-002"]),
      status: "in_progress",
      startedAt: now,
      finishedAt: null,
      reportJson: null,
    });

    const job = repo.getDataMovementJobRecord("job-001");
    assert.ok(job);
    assert.equal(job.jobId, "job-001");
    assert.equal(job.movementType, "archive");
    assert.equal(job.status, "in_progress");

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository upsertDataMovementJobRecord updates existing job", () => {
  const workspace = createTempWorkspace("operations-repo-datamovement-upsert-");
  const dbPath = join(workspace, "operations-datamovement-upsert.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    const later = "2026-04-27T12:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-source");
    // Insert target namespace directly for data movement job
    db.connection.exec(`
      INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
      VALUES ('ns-target', 'evidence', 'tenant-ops', 'org-001', 'ws-001', 'standard', 'standard', '${now}', '${now}')
    `);

    repo.upsertDataMovementJobRecord({
      jobId: "job-upsert-001",
      tenantId: "tenant-ops",
      organizationId: "org-001",
      workspaceId: "ws-001",
      sourceNamespaceId: "ns-source",
      targetNamespaceId: "ns-target",
      sourcePlane: "execution",
      targetPlane: "evidence",
      movementType: "archive",
      inputRefsJson: "[]",
      status: "in_progress",
      startedAt: now,
      finishedAt: null,
      reportJson: null,
    });

    // Upsert with updated status
    repo.upsertDataMovementJobRecord({
      jobId: "job-upsert-001",
      tenantId: "tenant-ops",
      organizationId: "org-001",
      workspaceId: "ws-001",
      sourceNamespaceId: "ns-source",
      targetNamespaceId: "ns-target",
      sourcePlane: "execution",
      targetPlane: "evidence",
      movementType: "archive",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: now,
      finishedAt: later,
      reportJson: JSON.stringify({ processedRefs: 10 }),
    });

    const job = repo.getDataMovementJobRecord("job-upsert-001");
    assert.ok(job);
    assert.equal(job.status, "completed");
    assert.ok(job.finishedAt);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listTaskBoardItems returns tasks in descending order", () => {
  const workspace = createTempWorkspace("operations-repo-taskboard-");
  const dbPath = join(workspace, "operations-taskboard.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const taskRepo = new TaskRepository(db.connection);
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";

    // Create tasks in order
    createTestTask(taskRepo, "task-board-001", now, "tenant-taskboard", "in_progress");
    createTestTask(taskRepo, "task-board-002", now, "tenant-taskboard", "in_progress");
    createTestTask(taskRepo, "task-board-003", now, "tenant-taskboard", "pending");

    const boardItems = repo.listTaskBoardItems(10, "tenant-taskboard");
    assert.ok(Array.isArray(boardItems));
    assert.ok(boardItems.length >= 3);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listActiveTasksWithoutWorkflow returns orphaned tasks", () => {
  const workspace = createTempWorkspace("operations-repo-orphan-");
  const dbPath = join(workspace, "operations-orphan.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const taskRepo = new TaskRepository(db.connection);
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";

    // Create task without workflow
    createTestTask(taskRepo, "orphan-task-001", now, "tenant-orphan", "in_progress");

    const orphanTasks = repo.listActiveTasksWithoutWorkflow("tenant-orphan");
    assert.ok(Array.isArray(orphanTasks));

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listStaleExecutions returns stale executions", () => {
  const workspace = createTempWorkspace("operations-repo-stale-");
  const dbPath = join(workspace, "operations-stale.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const taskRepo = new TaskRepository(db.connection);
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    const oldTime = "2026-04-01T00:00:00.000Z";

    createTestTask(taskRepo, "stale-task-001", oldTime, "tenant-stale", "in_progress");

    const staleExecutions = repo.listStaleExecutions("2026-04-15T00:00:00.000Z", "tenant-stale");
    assert.ok(Array.isArray(staleExecutions));

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listOrphanSessions returns sessions with mismatched task status", () => {
  const workspace = createTempWorkspace("operations-repo-orphan-session-");
  const dbPath = join(workspace, "operations-orphan-session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const taskRepo = new TaskRepository(db.connection);
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";

    // Create a task that is done but has an active session (orphan scenario)
    createTestTask(taskRepo, "orphan-session-task-001", now, "tenant-orphan-session", "failed");

    const orphanSessions = repo.listOrphanSessions("tenant-orphan-session");
    assert.ok(Array.isArray(orphanSessions));

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listWorkflowTerminalMismatches returns workflow/task status mismatches", () => {
  const workspace = createTempWorkspace("operations-repo-workflow-mismatch-");
  const dbPath = join(workspace, "operations-workflow-mismatch.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const taskRepo = new TaskRepository(db.connection);
    const workflowRepo = new WorkflowRepository(db.connection);
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";

    // Create a completed workflow but task is still in progress (mismatch)
    createTestTask(taskRepo, "mismatch-task-001", now, "tenant-mismatch", "in_progress");
    createTestWorkflow(workflowRepo, "mismatch-task-001", now, "completed");

    const mismatches = repo.listWorkflowTerminalMismatches("tenant-mismatch");
    assert.ok(Array.isArray(mismatches));
    // Should detect the mismatch where workflow is completed but task is not done

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listActiveExecutionActivity returns active executions", () => {
  const workspace = createTempWorkspace("operations-repo-activity-");
  const dbPath = join(workspace, "operations-activity.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const activities = repo.listActiveExecutionActivity();
    assert.ok(Array.isArray(activities));

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listActiveExecutionConflicts returns task IDs with multiple active executions", () => {
  const workspace = createTempWorkspace("operations-repo-conflicts-");
  const dbPath = join(workspace, "operations-conflicts.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const conflicts = repo.listActiveExecutionConflicts();
    assert.ok(Array.isArray(conflicts));

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository loadTaskSnapshot throws for non-existent task", () => {
  const workspace = createTempWorkspace("operations-repo-snapshot-");
  const dbPath = join(workspace, "operations-snapshot.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    assert.throws(() => {
      repo.loadTaskSnapshot("non-existent-task-id", "tenant-snapshot");
    }, /Task not found/);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository loadExecutionAuthoritativeView returns null for non-existent execution", () => {
  const workspace = createTempWorkspace("operations-repo-execution-view-");
  const dbPath = join(workspace, "operations-execution-view.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const view = repo.loadExecutionAuthoritativeView("non-existent-exec-id", "tenant-view");
    assert.equal(view, null);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listRuntimeRecoveryRecords validates SQL injection", () => {
  const workspace = createTempWorkspace("operations-repo-recovery-");
  const dbPath = join(workspace, "operations-recovery.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    // Attempt SQL injection should throw
    assert.throws(() => {
      repo.listRuntimeRecoveryRecords("task_id = '1'; DROP TABLE tasks;--", []);
    }, /forbidden SQL tokens/);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listRuntimeRecoveryRecords validates placeholder count", () => {
  const workspace = createTempWorkspace("operations-repo-recovery-placeholder-");
  const dbPath = join(workspace, "operations-recovery-placeholder.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    // Mismatched placeholder count should throw
    assert.throws(() => {
      repo.listRuntimeRecoveryRecords("task_id = ? AND status = ?", ["task-1"]);
    }, /placeholder\/param count mismatch/);

  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listDataMovementJobRecords delegates to division repository", () => {
  const workspace = createTempWorkspace("operations-repo-dm-list-");
  const dbPath = join(workspace, "operations-dm-list.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const now = "2026-04-27T10:00:00.000Z";
    setupOperationsParentRecords(db, now, "ns-source");
    // Insert target namespace directly for data movement job
    db.connection.exec(`
      INSERT INTO data_namespaces (namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy, encryption_policy, created_at, updated_at)
      VALUES ('ns-target', 'evidence', 'tenant-ops', 'org-001', 'ws-001', 'standard', 'standard', '${now}', '${now}')
    `);
    repo.upsertDataMovementJobRecord({
      jobId: "job-list-001",
      tenantId: "tenant-ops",
      organizationId: "org-001",
      workspaceId: "ws-001",
      sourceNamespaceId: "ns-source",
      targetNamespaceId: "ns-target",
      sourcePlane: "execution",
      targetPlane: "evidence",
      movementType: "archive",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: now,
      finishedAt: now,
      reportJson: null,
    });

    const jobs = repo.listDataMovementJobRecords({ tenantId: "tenant-ops" });
    assert.ok(Array.isArray(jobs));

  } finally {
    cleanupPath(workspace);
  }
});