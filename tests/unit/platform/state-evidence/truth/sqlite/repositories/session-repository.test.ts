import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SessionRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/session-repository.js";
import { TaskRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { SessionRecord, MessageRecord, GatewayTargetRecord, SessionEventRecord, CompactionRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(
  db: SqliteDatabase,
  taskId: string,
  now = "2026-04-14T10:00:00.000Z",
): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    tenantId: null,
    title: "Test session task",
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

test("SessionRepository insertSession and getSession work", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-session-1", now);

    const session: SessionRecord = {
      id: "session-1",
      taskId: "task-session-1",
      channel: "console",
      status: "open",
      externalSessionId: "ext-session-1",
      createdAt: now,
      updatedAt: now,
    };

    repo.insertSession(session);

    const result = repo.getSession("session-1");
    assert.ok(result);
    assert.equal(result.id, "session-1");
    assert.equal(result.status, "open");
    assert.equal(result.channel, "console");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository getSession returns undefined for non-existent", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);

    const result = repo.getSession("nonexistent");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository listSessionsByTask returns sessions", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-list-sessions-1", now);

    repo.insertSession({
      id: "session-list-1",
      taskId: "task-list-sessions-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    repo.insertSession({
      id: "session-list-2",
      taskId: "task-list-sessions-1",
      channel: "webhook",
      status: "completed",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listSessionsByTask("task-list-sessions-1");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository updateSessionStatus updates status", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T11:00:00.000Z";

    createTestTask(db, "task-update-status-1", now);

    repo.insertSession({
      id: "session-update-status-1",
      taskId: "task-update-status-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    repo.updateSessionStatus("session-update-status-1", "completed", later);

    const result = repo.getSession("session-update-status-1");
    assert.ok(result);
    assert.equal(result.status, "completed");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository updateSessionStatusCas returns 1 on success", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T11:00:00.000Z";

    createTestTask(db, "task-cas-status-1", now);

    repo.insertSession({
      id: "session-cas-status-1",
      taskId: "task-cas-status-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const updated = repo.updateSessionStatusCas("session-cas-status-1", "open", "completed", later);
    assert.equal(updated, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository updateSessionStatusCas returns 0 on CAS failure", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T11:00:00.000Z";

    createTestTask(db, "task-cas-status-fail-1", now);

    repo.insertSession({
      id: "session-cas-status-fail-1",
      taskId: "task-cas-status-fail-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    // Try with wrong expected status
    const updated = repo.updateSessionStatusCas("session-cas-status-fail-1", "completed", "completed", later);
    assert.equal(updated, 0);

    // Status should remain unchanged
    const result = repo.getSession("session-cas-status-fail-1");
    assert.ok(result);
    assert.equal(result.status, "open");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository insertMessage and listMessagesBySession work", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-message-1", now);

    repo.insertSession({
      id: "session-message-1",
      taskId: "task-message-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const message: MessageRecord = {
      id: "message-1",
      sessionId: "session-message-1",
      direction: "incoming",
      messageType: "text",
      content: "Hello world",
      partsJson: null,
      attachmentsJson: null,
      createdAt: now,
    };

    repo.insertMessage(message);

    const results = repo.listMessagesBySession("session-message-1");
    assert.equal(results.length, 1);
    assert.equal(results[0].content, "Hello world");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository upsertGatewayTarget and getGatewayTarget work", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    const target: GatewayTargetRecord = {
      targetId: "gateway-target-1",
      channel: "slack",
      targetKind: "channel",
      externalTargetId: "C012345",
      displayName: "#general",
      aliasesJson: "[]",
      metadataJson: "{}",
      source: "workspace",
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    repo.upsertGatewayTarget(target);

    const result = repo.getGatewayTarget("gateway-target-1");
    assert.ok(result);
    assert.equal(result.displayName, "#general");
    assert.equal(result.channel, "slack");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository upsertGatewayTarget updates existing target", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const later = "2026-04-14T12:00:00.000Z";

    repo.upsertGatewayTarget({
      targetId: "gateway-upsert-1",
      channel: "slack",
      targetKind: "channel",
      externalTargetId: "C111",
      displayName: "#old-name",
      aliasesJson: "[]",
      metadataJson: "{}",
      source: "workspace",
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertGatewayTarget({
      targetId: "gateway-upsert-1",
      channel: "slack",
      targetKind: "channel",
      externalTargetId: "C111",
      displayName: "#new-name",
      aliasesJson: "[]",
      metadataJson: "{}",
      source: "workspace",
      lastSeenAt: later,
      createdAt: now,
      updatedAt: later,
    });

    const result = repo.getGatewayTarget("gateway-upsert-1");
    assert.ok(result);
    assert.equal(result.displayName, "#new-name");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository listGatewayTargetsByChannel returns targets", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    repo.upsertGatewayTarget({
      targetId: "gateway-list-1",
      channel: "slack",
      targetKind: "channel",
      externalTargetId: "C001",
      displayName: "#engineering",
      aliasesJson: "[]",
      metadataJson: "{}",
      source: "workspace",
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertGatewayTarget({
      targetId: "gateway-list-2",
      channel: "slack",
      targetKind: "channel",
      externalTargetId: "C002",
      displayName: "#general",
      aliasesJson: "[]",
      metadataJson: "{}",
      source: "workspace",
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertGatewayTarget({
      targetId: "gateway-list-3",
      channel: "teams",
      targetKind: "channel",
      externalTargetId: "T001",
      displayName: "General",
      aliasesJson: "[]",
      metadataJson: "{}",
      source: "workspace",
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listGatewayTargetsByChannel("slack");
    assert.equal(results.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository insertSessionEvent and listSessionEvents work", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-event-1", now);

    repo.insertSession({
      id: "session-event-1",
      taskId: "task-event-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const event: SessionEventRecord = {
      id: "event-1",
      sessionId: "session-event-1",
      eventType: "session.started",
      payloadJson: '{"source":"user"}',
      createdAt: now,
    };

    repo.insertSessionEvent(event);

    const results = repo.listSessionEvents("session-event-1");
    assert.equal(results.length, 1);
    assert.equal(results[0].eventType, "session.started");
  } finally {
    cleanupPath(workspace);
  }
});

test("SessionRepository insertCompactionRecord works", () => {
  const workspace = createTempWorkspace("aa-session-repo-");
  const dbPath = join(workspace, "session.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new SessionRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestTask(db, "task-compaction-1", now);

    repo.insertSession({
      id: "session-compaction-1",
      taskId: "task-compaction-1",
      channel: "console",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    const compaction: CompactionRecord = {
      id: "compaction-1",
      sessionId: "session-compaction-1",
      taskId: "task-compaction-1",
      stage: "eager",
      sourceMessageIdsJson: '["msg-1","msg-2"]',
      summaryText: "Conversation summary",
      summaryRef: null,
      compactionReason: "token_limit",
      overflowTriggered: 1,
      autoTriggered: 0,
      tokenReductionEstimate: 500,
      createdAt: now,
    };

    repo.insertCompactionRecord(compaction);

    const results = repo.listCompactionRecordsBySession("session-compaction-1");
    assert.equal(results.length, 1);
    assert.equal(results[0].compactionReason, "token_limit");
  } finally {
    cleanupPath(workspace);
  }
});
