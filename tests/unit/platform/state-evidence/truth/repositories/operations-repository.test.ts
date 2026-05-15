import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EventRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { OrganizationRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.js";
import { SessionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/session-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { OperationsRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/operations-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

function createNamespace(orgRepo: OrganizationRepository, namespaceId = "ns-1", plane: "analytics" | "replay" | "transactional" | "artifact" | "memory_archive" = "analytics"): void {
  orgRepo.upsertDataNamespaceRecord({
    namespaceId,
    plane,
    tenantId: null,
    organizationId: null,
    workspaceId: null,
    retentionPolicy: "30d",
    encryptionPolicy: "kms",
    residencyPolicy: null,
    createdAt: now,
    updatedAt: now,
  });
}

test("OperationsRepository insertAnalyticsFactRecord and listAnalyticsFactRecords", () => {
  const workspace = createTempWorkspace("aa-operations-analytics-");
  const dbPath = join(workspace, "operations-analytics.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    // Insert parent namespace first
    createNamespace(orgRepo);

    repo.insertAnalyticsFactRecord({
      factId: "fact-1",
      namespaceId: "ns-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      metricName: "throughput",
      dimensionJson: "{}",
      value: 12.5,
      windowStart: "2026-04-15T09:00:00.000Z",
      windowEnd: now,
      sourceRef: "source-1",
      capturedAt: now,
    });

    const results = repo.listAnalyticsFactRecords({ namespaceId: "ns-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.factId, "fact-1");
    assert.equal(results[0]?.metricName, "throughput");
    assert.equal(results[0]?.value, 12.5);
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listAnalyticsFactRecords filters by metricName", () => {
  const workspace = createTempWorkspace("aa-operations-analytics-metric-");
  const dbPath = join(workspace, "operations-analytics-metric.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    createNamespace(orgRepo);

    repo.insertAnalyticsFactRecord({
      factId: "fact-1",
      namespaceId: "ns-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      metricName: "throughput",
      dimensionJson: "{}",
      value: 10,
      windowStart: "2026-04-15T09:00:00.000Z",
      windowEnd: now,
      sourceRef: "source-1",
      capturedAt: now,
    });
    repo.insertAnalyticsFactRecord({
      factId: "fact-2",
      namespaceId: "ns-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      metricName: "latency",
      dimensionJson: "{}",
      value: 50,
      windowStart: "2026-04-15T09:00:00.000Z",
      windowEnd: now,
      sourceRef: "source-1",
      capturedAt: now,
    });

    const throughputResults = repo.listAnalyticsFactRecords({ namespaceId: "ns-1", metricName: "throughput" });
    assert.equal(throughputResults.length, 1);
    assert.equal(throughputResults[0]?.metricName, "throughput");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository insertArchiveBundleRecord and listArchiveBundleRecords", () => {
  const workspace = createTempWorkspace("aa-operations-archive-");
  const dbPath = join(workspace, "operations-archive.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    createNamespace(orgRepo);

    repo.insertArchiveBundleRecord({
      bundleId: "archive-1",
      namespaceId: "ns-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      bundleType: "daily",
      sourceRefsJson: "[]",
      summaryRef: "archive://1",
      createdAt: now,
    });

    const results = repo.listArchiveBundleRecords({ namespaceId: "ns-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.bundleId, "archive-1");
    assert.equal(results[0]?.bundleType, "daily");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository insertReplayDatasetRecord and listReplayDatasetRecords", () => {
  const workspace = createTempWorkspace("aa-operations-replay-");
  const dbPath = join(workspace, "operations-replay.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    createNamespace(orgRepo);

    repo.insertReplayDatasetRecord({
      datasetId: "dataset-1",
      namespaceId: "ns-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      datasetType: "evaluation",
      sampleRefsJson: "[]",
      truthRefsJson: "[]",
      version: "v1",
      createdAt: now,
    });

    const results = repo.listReplayDatasetRecords({ namespaceId: "ns-1" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.datasetId, "dataset-1");
    assert.equal(results[0]?.datasetType, "evaluation");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository upsertDataMovementJobRecord and getDataMovementJobRecord", () => {
  const workspace = createTempWorkspace("aa-operations-movement-");
  const dbPath = join(workspace, "operations-movement.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    createNamespace(orgRepo, "ns-1");
    createNamespace(orgRepo, "ns-2", "replay");

    repo.upsertDataMovementJobRecord({
      jobId: "move-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      sourceNamespaceId: "ns-1",
      targetNamespaceId: "ns-2",
      sourcePlane: "analytics",
      targetPlane: "replay",
      movementType: "replay_dataset_build",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: now,
      finishedAt: now,
      reportJson: "{}",
    });

    const result = repo.getDataMovementJobRecord("move-1");
    assert.ok(result);
    assert.equal(result?.jobId, "move-1");
    assert.equal(result?.status, "completed");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository upsertDataMovementJobRecord updates existing record", () => {
  const workspace = createTempWorkspace("aa-operations-movement-upd-");
  const dbPath = join(workspace, "operations-movement-upd.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    createNamespace(orgRepo, "ns-1");
    createNamespace(orgRepo, "ns-2", "replay");

    repo.upsertDataMovementJobRecord({
      jobId: "move-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      sourceNamespaceId: "ns-1",
      targetNamespaceId: "ns-2",
      sourcePlane: "analytics",
      targetPlane: "replay",
      movementType: "replay_dataset_build",
      inputRefsJson: "[]",
      status: "running",
      startedAt: now,
      finishedAt: null,
      reportJson: "{}",
    });

    repo.upsertDataMovementJobRecord({
      jobId: "move-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      sourceNamespaceId: "ns-1",
      targetNamespaceId: "ns-2",
      sourcePlane: "analytics",
      targetPlane: "replay",
      movementType: "replay_dataset_build",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: now,
      finishedAt: now,
      reportJson: "{\"result\":\"success\"}",
    });

    const result = repo.getDataMovementJobRecord("move-1");
    assert.ok(result);
    assert.equal(result?.status, "completed");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listDataMovementJobRecords filters by movementType", () => {
  const workspace = createTempWorkspace("aa-operations-movement-list-");
  const dbPath = join(workspace, "operations-movement-list.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const orgRepo = new OrganizationRepository(db);

    createNamespace(orgRepo, "ns-1");
    createNamespace(orgRepo, "ns-2", "replay");

    repo.upsertDataMovementJobRecord({
      jobId: "move-1",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      sourceNamespaceId: "ns-1",
      targetNamespaceId: "ns-2",
      sourcePlane: "analytics",
      targetPlane: "replay",
      movementType: "replay_dataset_build",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: now,
      finishedAt: now,
      reportJson: "{}",
    });
    repo.upsertDataMovementJobRecord({
      jobId: "move-2",
      tenantId: null,
      organizationId: null,
      workspaceId: null,
      sourceNamespaceId: "ns-1",
      targetNamespaceId: "ns-2",
      sourcePlane: "analytics",
      targetPlane: "replay",
      movementType: "archive_compaction",
      inputRefsJson: "[]",
      status: "completed",
      startedAt: now,
      finishedAt: now,
      reportJson: "{}",
    });

    const results = repo.listDataMovementJobRecords({ movementType: "replay_dataset_build" });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.jobId, "move-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository insertPmfValidationReport and listPmfValidationReports", () => {
  const workspace = createTempWorkspace("aa-operations-pmf-");
  const dbPath = join(workspace, "operations-pmf.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    repo.insertPmfValidationReport({
      id: "pmf-1",
      profileName: "default",
      windowStart: "2026-04-14T10:00:00.000Z",
      windowEnd: now,
      divisionId: "general_ops",
      verdict: "pass",
      summaryJson: "{}",
      reportJson: "{}",
      generatedAt: now,
    });

    const results = repo.listPmfValidationReports(10);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.id, "pmf-1");
    assert.equal(results[0]?.verdict, "pass");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository getLatestPmfValidationReport returns most recent", () => {
  const workspace = createTempWorkspace("aa-operations-pmf-latest-");
  const dbPath = join(workspace, "operations-pmf-latest.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    repo.insertPmfValidationReport({
      id: "pmf-1",
      profileName: "default",
      windowStart: "2026-04-14T10:00:00.000Z",
      windowEnd: "2026-04-14T12:00:00.000Z",
      divisionId: "general_ops",
      verdict: "pass",
      summaryJson: "{}",
      reportJson: "{}",
      generatedAt: "2026-04-14T12:00:00.000Z",
    });
    repo.insertPmfValidationReport({
      id: "pmf-2",
      profileName: "default",
      windowStart: "2026-04-15T10:00:00.000Z",
      windowEnd: now,
      divisionId: "general_ops",
      verdict: "fail",
      summaryJson: "{}",
      reportJson: "{}",
      generatedAt: now,
    });

    const result = repo.getLatestPmfValidationReport("default");
    assert.ok(result);
    assert.equal(result?.id, "pmf-2");
    assert.equal(result?.verdict, "fail");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listTaskBoardItems returns task board items", () => {
  const workspace = createTempWorkspace("aa-operations-taskboard-");
  const dbPath = join(workspace, "operations-taskboard.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);

    taskRepo.insertTask({
      id: "task-1",
      parentId: null,
      rootId: "task-1",
      divisionId: "general_ops",
      tenantId: "tenant-alpha",
      title: "Test task",
      status: "in_progress",
      source: "user",
      priority: "high",
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

    const results = repo.listTaskBoardItems(10, "tenant-alpha");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.taskId, "task-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listActiveTasksWithoutWorkflow returns tasks without workflows", () => {
  const workspace = createTempWorkspace("aa-operations-no-wf-");
  const dbPath = join(workspace, "operations-no-wf.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);

    taskRepo.insertTask({
      id: "task-1",
      parentId: null,
      rootId: "task-1",
      divisionId: "general_ops",
      tenantId: "tenant-alpha",
      title: "Task without workflow",
      status: "in_progress",
      source: "user",
      priority: "high",
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

    const results = repo.listActiveTasksWithoutWorkflow("tenant-alpha");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.taskId, "task-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository loadTaskSnapshot returns complete snapshot", () => {
  const workspace = createTempWorkspace("aa-operations-snapshot-");
  const dbPath = join(workspace, "operations-snapshot.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);
    const executionRepo = new ExecutionRepository(db.connection);
    const sessionRepo = new SessionRepository(db.connection);
    const eventRepo = new EventRepository(db.connection);

    db.transaction(() => {
      taskRepo.insertTask({
        id: "task-1",
        parentId: null,
        rootId: "task-1",
        divisionId: "general_ops",
        tenantId: "tenant-alpha",
        title: "Runtime task",
        status: "in_progress",
        source: "user",
        priority: "high",
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
      db.connection.prepare(
        `INSERT INTO workflow_state (
          task_id, division_id, workflow_id, current_step_index, status, outputs_json,
          last_error_code, retry_count, resumable_from_step, started_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("task-1", "general_ops", "wf-1", 1, "running", "{}", null, 0, null, now, now);
      executionRepo.insertExecution({
        id: "exec-1",
        taskId: "task-1",
        workflowId: "wf-1",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-1",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 2,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      sessionRepo.insertSession({
        id: "session-1",
        taskId: "task-1",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      eventRepo.insertEvent({
        id: "evt-1",
        taskId: "task-1",
        sessionId: null,
        executionId: "exec-1",
        eventType: "runtime.tick",
        eventTier: "tier_2",
        payloadJson: "{}",
        traceId: "trace-1",
        createdAt: now,
      });
      db.connection.prepare(
        `INSERT INTO workflow_step_outputs (
          id, task_id, step_id, role_id, status, data_json, summary, artifacts_json,
          token_cost, duration_ms, validation_json, produced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("stepout-1", "task-1", "step-1", "general_executor", "succeeded", "{}", "ok", "[]", 10, 1000, null, now);
      db.connection.prepare(
        `INSERT INTO artifacts (
          artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name,
          mime_type, size_bytes, checksum, lineage_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("artifact-1", "task-1", "exec-1", "step-1", "report", "/tmp/report.json", "report.json", "application/json", 12, null, null, now);
    });

    const snapshot = repo.loadTaskSnapshot("task-1", "tenant-alpha");
    assert.ok(snapshot);
    assert.equal(snapshot.task.id, "task-1");
    assert.equal(snapshot.workflow?.workflowId, "wf-1");
    assert.equal(snapshot.execution?.id, "exec-1");
    assert.equal(snapshot.session?.id, "session-1");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.equal(snapshot.artifacts.length, 1);
    assert.equal(snapshot.events.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository loadExecutionAuthoritativeView returns execution view", () => {
  const workspace = createTempWorkspace("aa-operations-exec-view-");
  const dbPath = join(workspace, "operations-exec-view.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);
    const executionRepo = new ExecutionRepository(db.connection);

    db.transaction(() => {
      taskRepo.insertTask({
        id: "task-1",
        parentId: null,
        rootId: "task-1",
        divisionId: "general_ops",
        tenantId: "tenant-alpha",
        title: "Runtime task",
        status: "in_progress",
        source: "user",
        priority: "high",
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
      executionRepo.insertExecution({
        id: "exec-1",
        taskId: "task-1",
        workflowId: "wf-1",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-1",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 2,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      executionRepo.insertExecutionPrecheck({
        id: "precheck-1",
        executionId: "exec-1",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 2,
        resolvedTimeoutMs: 60000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
      });
    });

    const view = repo.loadExecutionAuthoritativeView("exec-1", "tenant-alpha");
    assert.ok(view);
    assert.equal(view?.execution.id, "exec-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listRecoverableExecutingRuns returns recoverable runs", () => {
  const workspace = createTempWorkspace("aa-operations-recoverable-");
  const dbPath = join(workspace, "operations-recoverable.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);
    const executionRepo = new ExecutionRepository(db.connection);

    db.transaction(() => {
      taskRepo.insertTask({
        id: "task-1",
        parentId: null,
        rootId: "task-1",
        divisionId: "general_ops",
        tenantId: "tenant-alpha",
        title: "Runtime task",
        status: "in_progress",
        source: "user",
        priority: "high",
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
      executionRepo.insertExecution({
        id: "exec-1",
        taskId: "task-1",
        workflowId: "wf-1",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-1",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 2,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      executionRepo.insertExecutionPrecheck({
        id: "precheck-1",
        executionId: "exec-1",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 2,
        resolvedTimeoutMs: 60000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
      });
    });

    const results = repo.listRecoverableExecutingRuns("2026-04-15T10:30:00.000Z", "tenant-alpha");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.latestPrecheck?.id, "precheck-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listActiveExecutionActivity returns active executions", () => {
  const workspace = createTempWorkspace("aa-operations-activity-");
  const dbPath = join(workspace, "operations-activity.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);
    const taskRepo = new TaskRepository(db.connection);
    const executionRepo = new ExecutionRepository(db.connection);

    db.transaction(() => {
      taskRepo.insertTask({
        id: "task-1",
        parentId: null,
        rootId: "task-1",
        divisionId: "general_ops",
        tenantId: "tenant-alpha",
        title: "Runtime task",
        status: "in_progress",
        source: "user",
        priority: "high",
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
      executionRepo.insertExecution({
        id: "exec-1",
        taskId: "task-1",
        workflowId: "wf-1",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-1",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 2,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const results = repo.listActiveExecutionActivity();
    assert.equal(results.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("OperationsRepository listActiveExecutionConflicts returns no conflicts", () => {
  const workspace = createTempWorkspace("aa-operations-conflicts-");
  const dbPath = join(workspace, "operations-conflicts.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new OperationsRepository(db);

    const results = repo.listActiveExecutionConflicts();
    assert.equal(results.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});
