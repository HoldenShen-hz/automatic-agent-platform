import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { LeaseRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/lease-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { LeaseAuditRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { LeaseAuditEventType } from "../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(db: SqliteDatabase, taskId: string, now: string): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    tenantId: null,
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

function createTestExecution(db: SqliteDatabase, execId: string, taskId: string, now: string): void {
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
    status: "executing",
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

test("LeaseRepository listLeaseAudits returns audits for execution", () => {
  const workspace = createTempWorkspace("aa-lease-repo-");
  const dbPath = join(workspace, "lease-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LeaseRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-lease-1", "task-lease-1", now);

    // Create lease first (required by foreign key)
    const expiresAt = "2026-04-14T12:00:00.000Z";
    db.connection.exec(`
      INSERT INTO execution_leases (id, execution_id, worker_id, attempt, fencing_token, queue_name, status, leased_at, expires_at, last_heartbeat_at, released_at, reason_code)
      VALUES ('lease-1', 'exec-lease-1', 'worker-1', 1, 1, NULL, 'active', '${now}', '${expiresAt}', '${now}', NULL, NULL)
    `);

    // Insert lease audit records directly via raw SQL since there's no insert method
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-1', 'exec-lease-1', 'lease-1', 'worker-1', 1, 'lease_granted', 'initial_grant', '${now}')
    `);
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-2', 'exec-lease-1', 'lease-1', 'worker-1', 2, 'lease_renewed', 'heartbeat_ok', '${now}')
    `);

    const audits = repo.listLeaseAudits("exec-lease-1");

    assert.equal(audits.length, 2);
    assert.equal(audits[0]!.id, "audit-1");
    assert.equal(audits[0]!.executionId, "exec-lease-1");
    assert.equal(audits[0]!.leaseId, "lease-1");
    assert.equal(audits[0]!.workerId, "worker-1");
    assert.equal(audits[0]!.fencingToken, 1);
    assert.equal(audits[0]!.eventType, "lease_granted");
    assert.equal(audits[1]!.fencingToken, 2);
    assert.equal(audits[1]!.eventType, "lease_renewed");
  } finally {
    cleanupPath(workspace);
  }
});

test("LeaseRepository listLeaseAudits returns empty array for non-existent execution", () => {
  const workspace = createTempWorkspace("aa-lease-repo-");
  const dbPath = join(workspace, "lease-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LeaseRepository(db.connection);

    const audits = repo.listLeaseAudits("non-existent-exec");
    assert.equal(audits.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("LeaseRepository listLeaseAudits returns audits in chronological order", () => {
  const workspace = createTempWorkspace("aa-lease-repo-");
  const dbPath = join(workspace, "lease-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LeaseRepository(db.connection);

    const now1 = "2026-04-14T10:00:00.000Z";
    const now2 = "2026-04-14T10:01:00.000Z";
    const now3 = "2026-04-14T10:02:00.000Z";
    const expiresAt = "2026-04-14T12:00:00.000Z";
    createTestExecution(db, "exec-lease-ordered", "task-lease-ordered", now1);

    // Create lease first (required by foreign key)
    db.connection.exec(`
      INSERT INTO execution_leases (id, execution_id, worker_id, attempt, fencing_token, queue_name, status, leased_at, expires_at, last_heartbeat_at, released_at, reason_code)
      VALUES ('lease-1', 'exec-lease-ordered', 'worker-1', 1, 1, NULL, 'active', '${now1}', '${expiresAt}', '${now1}', NULL, NULL)
    `);

    // Insert in non-chronological order
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-c', 'exec-lease-ordered', 'lease-1', 'worker-1', 3, 'lease_expired', 'timeout', '${now3}')
    `);
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-a', 'exec-lease-ordered', 'lease-1', 'worker-1', 1, 'lease_granted', 'initial', '${now1}')
    `);
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-b', 'exec-lease-ordered', 'lease-1', 'worker-1', 2, 'lease_renewed', 'keepalive', '${now2}')
    `);

    const audits = repo.listLeaseAudits("exec-lease-ordered");

    assert.equal(audits.length, 3);
    assert.equal(audits[0]!.id, "audit-a");
    assert.equal(audits[1]!.id, "audit-b");
    assert.equal(audits[2]!.id, "audit-c");
    // Verify chronological order by recordedAt
    assert.ok(audits[0]!.recordedAt < audits[1]!.recordedAt);
    assert.ok(audits[1]!.recordedAt < audits[2]!.recordedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("LeaseRepository handles different lease event types", () => {
  const workspace = createTempWorkspace("aa-lease-repo-");
  const dbPath = join(workspace, "lease-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LeaseRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const expiresAt = "2026-04-14T12:00:00.000Z";

    const eventTypes: LeaseAuditEventType[] = [
      "lease_granted",
      "lease_renewed",
      "lease_expired",
      "lease_reclaimed",
      "stale_write_rejected",
      "lease_released",
      "lease_handover",
    ];

    // Create separate execution and lease for each event type
    eventTypes.forEach((eventType, index) => {
      const execId = `exec-lease-events-${index}`;
      const leaseId = `lease-${index}`;
      createTestExecution(db, execId, `task-lease-events-${index}`, now);

      db.connection.exec(`
        INSERT INTO execution_leases (id, execution_id, worker_id, attempt, fencing_token, queue_name, status, leased_at, expires_at, last_heartbeat_at, released_at, reason_code)
        VALUES ('${leaseId}', '${execId}', 'worker-${index}', 1, ${index + 1}, NULL, 'active', '${now}', '${expiresAt}', '${now}', NULL, NULL)
      `);

      db.connection.exec(`
        INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
        VALUES ('audit-evt-${index}', '${execId}', '${leaseId}', 'worker-${index}', ${index + 1}, '${eventType}', 'test_reason', '${now}')
      `);
    });

    // Get audits for all the executions
    const allAudits: LeaseAuditRecord[] = [];
    eventTypes.forEach((_, index) => {
      const audits = repo.listLeaseAudits(`exec-lease-events-${index}`);
      allAudits.push(...audits);
    });

    assert.equal(allAudits.length, eventTypes.length);
    const returnedEventTypes = allAudits.map((a) => a.eventType);
    assert.deepEqual(returnedEventTypes, eventTypes);
  } finally {
    cleanupPath(workspace);
  }
});

test("LeaseRepository listLeaseAudits with multiple executions returns only matching execution", () => {
  const workspace = createTempWorkspace("aa-lease-repo-");
  const dbPath = join(workspace, "lease-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new LeaseRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const expiresAt = "2026-04-14T12:00:00.000Z";
    createTestExecution(db, "exec-lease-1", "task-lease-1", now);
    createTestExecution(db, "exec-lease-2", "task-lease-2", now);

    // Create leases first (required by foreign key)
    db.connection.exec(`
      INSERT INTO execution_leases (id, execution_id, worker_id, attempt, fencing_token, queue_name, status, leased_at, expires_at, last_heartbeat_at, released_at, reason_code)
      VALUES ('lease-1', 'exec-lease-1', 'worker-1', 1, 1, NULL, 'active', '${now}', '${expiresAt}', '${now}', NULL, NULL)
    `);
    db.connection.exec(`
      INSERT INTO execution_leases (id, execution_id, worker_id, attempt, fencing_token, queue_name, status, leased_at, expires_at, last_heartbeat_at, released_at, reason_code)
      VALUES ('lease-2', 'exec-lease-2', 'worker-2', 1, 1, NULL, 'active', '${now}', '${expiresAt}', '${now}', NULL, NULL)
    `);

    // Insert audits for both executions
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-exec1', 'exec-lease-1', 'lease-1', 'worker-1', 1, 'lease_granted', NULL, '${now}')
    `);
    db.connection.exec(`
      INSERT INTO lease_audits (id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at)
      VALUES ('audit-exec2', 'exec-lease-2', 'lease-2', 'worker-2', 1, 'lease_granted', NULL, '${now}')
    `);

    const auditsForExec1 = repo.listLeaseAudits("exec-lease-1");
    const auditsForExec2 = repo.listLeaseAudits("exec-lease-2");

    assert.equal(auditsForExec1.length, 1);
    assert.equal(auditsForExec1[0]!.executionId, "exec-lease-1");
    assert.equal(auditsForExec2.length, 1);
    assert.equal(auditsForExec2[0]!.executionId, "exec-lease-2");
  } finally {
    cleanupPath(workspace);
  }
});
