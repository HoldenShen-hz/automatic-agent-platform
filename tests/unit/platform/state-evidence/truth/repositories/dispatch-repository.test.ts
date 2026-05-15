import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DispatchRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/dispatch-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { ExecutionRecord, SessionRecord, MessageRecord, GatewayTargetRecord, WorkerSnapshotRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { ExecutionStatus } from "../../../../../../src/platform/contracts/types/status.js";

function createTestTask(db: SqliteDatabase, taskId: string, now: string, tenantId: string | null = null): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId,
    title: "Test task",
    status: "in_progress",
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

function createTestExecution(db: SqliteDatabase, execId: string, taskId: string, now: string, status: ExecutionStatus = "executing"): void {
  const execRepo = new ExecutionRepository(db.connection);
  createTestTask(db, taskId, now);
  execRepo.insertExecution({
    id: execId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status,
    inputRef: null,
    traceId: `trace-${execId}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
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
}

// DispatchRepository tests

test("DispatchRepository listExecutionsByStatuses returns executions with matching statuses", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-d1", "task-d1", now, "executing");
    createTestExecution(db, "exec-d2", "task-d2", now, "prechecking");
    createTestExecution(db, "exec-d3", "task-d3", now, "succeeded");

    const results = repo.listExecutionsByStatuses(["executing"]);
    assert.equal(results.length, 1, "should return 1 executing execution");
    assert.equal(results[0]?.id, "exec-d1");

    const precheckingResults = repo.listExecutionsByStatuses(["prechecking"]);
    assert.equal(precheckingResults.length, 1, "should return 1 prechecking execution");

    const multiStatusResults = repo.listExecutionsByStatuses(["executing", "prechecking"]);
    assert.equal(multiStatusResults.length, 2, "should return 2 executions");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository listExecutionsByStatuses with empty array returns empty", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const results = repo.listExecutionsByStatuses([]);
    assert.equal(results.length, 0, "should return empty array for empty statuses");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getExecution returns execution by ID", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-get-d", "task-get-d", now);

    const result = repo.getExecution("exec-get-d");
    assert.ok(result);
    assert.equal(result.id, "exec-get-d");
    assert.equal(result.taskId, "task-get-d");
    assert.equal(result.status, "executing");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getExecution returns null for non-existent execution", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const result = repo.getExecution("nonexistent-exec");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getSession returns session by ID", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-session-d", now);

    db.connection.exec(`
      INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
      VALUES ('session-d-001', 'task-session-d', 'cli', 'open', NULL, '${now}', '${now}')
    `);

    const result = repo.getSession("session-d-001");
    assert.ok(result);
    assert.equal(result.id, "session-d-001");
    assert.equal(result.taskId, "task-session-d");
    assert.equal(result.channel, "cli");
    assert.equal(result.status, "open");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository selectLatestSessionByTask returns latest session", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T11:00:00.000Z";
    createTestTask(db, "task-latest-session", now);

    db.connection.exec(`
      INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
      VALUES ('session-old', 'task-latest-session', 'cli', 'open', NULL, '${now}', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
      VALUES ('session-new', 'task-latest-session', 'api', 'streaming', NULL, '${later}', '${later}')
    `);

    const result = repo.selectLatestSessionByTask("task-latest-session");
    assert.ok(result);
    assert.equal(result.id, "session-new");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getGatewayTarget returns target by ID", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    db.connection.exec(`
      INSERT INTO gateway_targets (target_id, channel, target_kind, external_target_id, display_name, aliases_json, metadata_json, source, last_seen_at, created_at, updated_at)
      VALUES ('target-d-001', 'slack', 'room', 'C0123456789', 'general', '[]', '{}', 'directory', '${now}', '${now}', '${now}')
    `);

    const result = repo.getGatewayTarget("target-d-001");
    assert.ok(result);
    assert.equal(result.targetId, "target-d-001");
    assert.equal(result.channel, "slack");
    assert.equal(result.targetKind, "room");
    assert.equal(result.displayName, "general");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getGatewayTarget returns null for non-existent target", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const result = repo.getGatewayTarget("nonexistent-target");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository listGatewayTargets returns targets with optional channel filter", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    db.connection.exec(`
      INSERT INTO gateway_targets (target_id, channel, target_kind, external_target_id, display_name, aliases_json, metadata_json, source, last_seen_at, created_at, updated_at)
      VALUES ('target-slack-1', 'slack', 'room', 'C001', 'general', '[]', '{}', 'directory', '${now}', '${now}', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO gateway_targets (target_id, channel, target_kind, external_target_id, display_name, aliases_json, metadata_json, source, last_seen_at, created_at, updated_at)
      VALUES ('target-slack-2', 'slack', 'room', 'C002', 'random', '[]', '{}', 'directory', '${now}', '${now}', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO gateway_targets (target_id, channel, target_kind, external_target_id, display_name, aliases_json, metadata_json, source, last_seen_at, created_at, updated_at)
      VALUES ('target-discord-1', 'discord', 'channel', 'D001', 'general', '[]', '{}', 'directory', '${now}', '${now}', '${now}')
    `);

    const slackTargets = repo.listGatewayTargets(100, "slack");
    assert.equal(slackTargets.length, 2, "should return 2 slack targets");

    const allTargets = repo.listGatewayTargets(100);
    assert.equal(allTargets.length, 3, "should return all 3 targets");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository listMessagesBySession returns messages for a session", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-msg-session", now);

    db.connection.exec(`
      INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
      VALUES ('session-msg-d', 'task-msg-session', 'cli', 'open', NULL, '${now}', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO messages (id, session_id, direction, message_type, content, parts_json, attachments_json, created_at)
      VALUES ('msg-d-1', 'session-msg-d', 'inbound', 'text', 'Hello', NULL, NULL, '${now}')
    `);

    db.connection.exec(`
      INSERT INTO messages (id, session_id, direction, message_type, content, parts_json, attachments_json, created_at)
      VALUES ('msg-d-2', 'session-msg-d', 'outbound', 'text', 'Hi there', NULL, NULL, '${now}')
    `);

    const results = repo.listMessagesBySession("session-msg-d");
    assert.equal(results.length, 2, "should return 2 messages");
    assert.equal(results[0]?.content, "Hello");
    assert.equal(results[1]?.content, "Hi there");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getWorkerSnapshot returns worker snapshot", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    db.connection.exec(`
      INSERT INTO worker_snapshots (worker_id, status, placement, isolation_level, repo_version, remote_session_status, last_acknowledged_stream_offset, stream_resume_success_rate, credential_refresh_success_rate, session_consistency_check_status, session_consistency_checked_at, workspace_sync_status, workspace_sync_checked_at, saturation, active_lease_count, mean_startup_latency_ms, sandbox_success_rate, repo_cache_hit_rate, registration_verified_at, registration_challenge_id, capabilities_json, running_executions_json, max_concurrency, queue_affinity, runtime_instance_id, restarted_from_runtime_instance_id, restart_generation, cpu_pct, memory_mb, tool_backlog_count, current_step_id, last_progress_at, last_heartbeat_at, updated_at)
      VALUES ('worker-d-001', 'running', 'balanced', 'shared', 'v1.0.0', 'connected', '100', 0.95, 1.0, 'passed', '${now}', 'synced', '${now}', 0.5, 3, 150, 0.98, 0.85, '${now}', 'challenge-123', '["code_edit"]', '["exec-1"]', 10, NULL, NULL, NULL, 0, 10.5, 256, 0, NULL, '${now}', '${now}', '${now}')
    `);

    const result = repo.getWorkerSnapshot("worker-d-001");
    assert.ok(result);
    assert.equal(result.workerId, "worker-d-001");
    assert.equal(result.status, "running");
    assert.equal(result.repoVersion, "v1.0.0");
    assert.equal(result.activeLeaseCount, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getWorkerSnapshot returns null for non-existent worker", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const result = repo.getWorkerSnapshot("nonexistent-worker");
    assert.strictEqual(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getExecutionPrecheck returns precheck by execution ID", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-precheck-d", "task-precheck-d", now);

    db.connection.exec(`
      INSERT INTO execution_prechecks (id, execution_id, allowed, reason_code, resolved_budget_usd, resolved_timeout_ms, resolved_sandbox_mode, resolved_tools_json, resolved_paths_json, checked_at)
      VALUES ('precheck-d-001', 'exec-precheck-d', 1, 'budget_sufficient', 0.5, 60000, 'workspace_write', '[]', '[]', '${now}')
    `);

    const result = repo.getExecutionPrecheck("exec-precheck-d");
    assert.ok(result);
    assert.equal(result.executionId, "exec-precheck-d");
    assert.equal(result.allowed, 1);
    assert.equal(result.reasonCode, "budget_sufficient");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getDeadLetterByExecutionId returns dead letter", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-deadletter-d", "task-deadletter-d", now, "failed");

    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-d-001', 'exec-deadletter-d', 'task-deadletter-d', 'timeout', 3, 'Execution timed out', '${now}')
    `);

    const result = repo.getDeadLetterByExecutionId("exec-deadletter-d");
    assert.ok(result);
    assert.equal(result.executionId, "exec-deadletter-d");
    assert.equal(result.finalReasonCode, "timeout");
    assert.equal(result.retryCount, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository listDeadLettersByTask returns dead letters for task", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    // Create task once
    createTestTask(db, "task-dl-list", now);
    // Create first execution and dead letter
    const execRepo = new ExecutionRepository(db.connection);
    execRepo.insertExecution({
      id: "exec-dl-task-1",
      taskId: "task-dl-list",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "failed",
      inputRef: null,
      traceId: "trace-dl-1",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
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
    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-task-1', 'exec-dl-task-1', 'task-dl-list', 'timeout', 1, 'Timed out', '${now}')
    `);

    // Create second execution for same task
    execRepo.insertExecution({
      id: "exec-dl-task-2",
      taskId: "task-dl-list",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "failed",
      inputRef: null,
      traceId: "trace-dl-2",
      attempt: 2,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
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
    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-task-2', 'exec-dl-task-2', 'task-dl-list', 'budget_exceeded', 2, 'Budget exceeded', '${now}')
    `);

    const results = repo.listDeadLettersByTask("task-dl-list");
    assert.equal(results.length, 2, "should return 2 dead letters");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository column mapping snake_case to camelCase is correct", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-cols-d", "task-cols-d", now);

    const result = repo.getExecution("exec-cols-d");
    assert.ok(result);
    assert.equal(result.taskId, "task-cols-d");
    assert.equal(result.workflowId, "single_agent_minimal");
    assert.equal(result.agentId, "agent-1");
    assert.equal(result.roleId, "general_executor");
    assert.equal(result.runKind, "task_run");
    assert.equal(result.inputRef, null);
    assert.equal(result.timeoutMs, 60000);
    assert.equal(result.budgetUsdLimit, 1.0);
    assert.equal(result.requiresApproval, 0);
    assert.equal(result.sandboxMode, "workspace_write");
    assert.equal(result.maxRetries, 0);
    assert.equal(result.retryBackoff, "none");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getExecution with tenantId returns execution for matching tenant", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);
    const execRepo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    db.connection.exec(`
      INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
      VALUES ('task-tenant-exec-a', NULL, 'task-tenant-exec-a', 'general_ops', 'tenant-a', 'Test task', 'in_progress', 'user', 'normal', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', NULL)
    `);
    db.connection.exec(`
      INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
      VALUES ('task-tenant-exec-b', NULL, 'task-tenant-exec-b', 'general_ops', 'tenant-b', 'Test task', 'in_progress', 'user', 'normal', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', NULL)
    `);
    execRepo.insertExecution({
      id: "exec-tenant-a",
      taskId: "task-tenant-exec-a",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-a",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
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
    execRepo.insertExecution({
      id: "exec-tenant-b",
      taskId: "task-tenant-exec-b",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-b",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
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

    const resultA = repo.getExecution("exec-tenant-a", "tenant-a");
    assert.ok(resultA, "should find execution with matching tenant");
    assert.equal(resultA.taskId, "task-tenant-exec-a");

    const resultB = repo.getExecution("exec-tenant-b", "tenant-b");
    assert.ok(resultB, "should find execution with matching tenant");
    assert.equal(resultB.taskId, "task-tenant-exec-b");

    const wrongTenant = repo.getExecution("exec-tenant-a", "tenant-b");
    assert.strictEqual(wrongTenant, null, "should not find execution with wrong tenant");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository getDeadLetterByExecutionId with tenantId returns dead letter for matching tenant", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);
    const execRepo = new ExecutionRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    db.connection.exec(`
      INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
      VALUES ('task-dl-tenant-a', NULL, 'task-dl-tenant-a', 'general_ops', 'tenant-a', 'Test task', 'in_progress', 'user', 'normal', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', NULL)
    `);
    db.connection.exec(`
      INSERT INTO tasks (id, parent_id, root_id, division_id, tenant_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at)
      VALUES ('task-dl-tenant-b', NULL, 'task-dl-tenant-b', 'general_ops', 'tenant-b', 'Test task', 'in_progress', 'user', 'normal', '{}', NULL, NULL, NULL, 0, NULL, '${now}', '${now}', NULL)
    `);
    execRepo.insertExecution({
      id: "exec-dl-a",
      taskId: "task-dl-tenant-a",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "failed",
      inputRef: null,
      traceId: "trace-dl-a",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
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
    execRepo.insertExecution({
      id: "exec-dl-b",
      taskId: "task-dl-tenant-b",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "failed",
      inputRef: null,
      traceId: "trace-dl-b",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
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

    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-tenant-a', 'exec-dl-a', 'task-dl-tenant-a', 'timeout', 1, 'Timed out', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-tenant-b', 'exec-dl-b', 'task-dl-tenant-b', 'error', 2, 'Error', '${now}')
    `);

    const resultA = repo.getDeadLetterByExecutionId("exec-dl-a", "tenant-a");
    assert.ok(resultA, "should find dead letter with matching tenant");
    assert.equal(resultA.finalReasonCode, "timeout");

    const wrongTenant = repo.getDeadLetterByExecutionId("exec-dl-a", "tenant-b");
    assert.strictEqual(wrongTenant, null, "should not find dead letter with wrong tenant");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository listDeadLettersByTask with tenantId returns only tenant dead letters", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestTask(db, "task-dl-tenant-a1", now, "tenant-a");
    createTestTask(db, "task-dl-tenant-b1", now, "tenant-b");

    db.connection.exec(`
      INSERT INTO executions (id, task_id, workflow_id, parent_execution_id, agent_id, role_id, run_kind, status, input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval, sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff, last_error_code, last_error_message, started_at, finished_at, created_at, updated_at)
      VALUES ('exec-multi-a', 'task-dl-tenant-a1', 'single_agent_minimal', NULL, 'agent-1', 'general_executor', 'task_run', 'failed', NULL, 'trace-a', 1, 60000, 1.0, 0, 'workspace_write', '[]', '[]', 0, 'none', NULL, NULL, '${now}', NULL, '${now}', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO executions (id, task_id, workflow_id, parent_execution_id, agent_id, role_id, run_kind, status, input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval, sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff, last_error_code, last_error_message, started_at, finished_at, created_at, updated_at)
      VALUES ('exec-multi-b', 'task-dl-tenant-b1', 'single_agent_minimal', NULL, 'agent-1', 'general_executor', 'task_run', 'failed', NULL, 'trace-b', 1, 60000, 1.0, 0, 'workspace_write', '[]', '[]', 0, 'none', NULL, NULL, '${now}', NULL, '${now}', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-multi-a', 'exec-multi-a', 'task-dl-tenant-a1', 'timeout', 1, 'Timed out', '${now}')
    `);

    db.connection.exec(`
      INSERT INTO dead_letters (id, execution_id, task_id, final_reason_code, retry_count, last_error_message, moved_at)
      VALUES ('dl-multi-b', 'exec-multi-b', 'task-dl-tenant-b1', 'error', 2, 'Error', '${now}')
    `);

    const resultsTenantA = repo.listDeadLettersByTask("task-dl-tenant-a1", "tenant-a");
    const resultsTenantB = repo.listDeadLettersByTask("task-dl-tenant-b1", "tenant-b");

    assert.equal(resultsTenantA.length, 1, "should return 1 dead letter for tenant-a");
    assert.equal(resultsTenantB.length, 1, "should return 1 dead letter for tenant-b");
    assert.equal(resultsTenantA[0]?.finalReasonCode, "timeout");
    assert.equal(resultsTenantB[0]?.finalReasonCode, "error");
  } finally {
    cleanupPath(workspace);
  }
});

test("DispatchRepository listGatewayTargets with limit respects limit parameter", () => {
  const workspace = createTempWorkspace("aa-dispatch-repo-");
  const dbPath = join(workspace, "dispatch-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new DispatchRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    for (let i = 0; i < 5; i++) {
      db.connection.exec(`
        INSERT INTO gateway_targets (target_id, channel, target_kind, external_target_id, display_name, aliases_json, metadata_json, source, last_seen_at, created_at, updated_at)
        VALUES ('target-limit-${i}', 'slack', 'room', 'C${String(i).padStart(10, '0')}', 'room-${i}', '[]', '{}', 'directory', '${now}', '${now}', '${now}')
      `);
    }

    const resultsLimit2 = repo.listGatewayTargets(2);
    assert.equal(resultsLimit2.length, 2, "should return only 2 targets when limit is 2");

    const resultsLimit10 = repo.listGatewayTargets(10);
    assert.equal(resultsLimit10.length, 5, "should return all 5 targets when limit exceeds count");
  } finally {
    cleanupPath(workspace);
  }
});
