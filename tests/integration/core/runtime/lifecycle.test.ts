/**
 * Integration tests for Lifecycle Management - Storage-backed operations
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("ContextCompactionService integration with real storage", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "lifecycle-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js"
    );
    const { ContextCompactionService } = await import(
      "../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const db = storage.sql;
    const store = storage.store;

    const { newId, nowIso } = await import("../../../../src/platform/contracts/types/ids.js");

    const taskId = newId("task");
    const sessionId = newId("sess");

    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "test_division",
      title: "Test Task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });

    store.session.insertSession({
      id: sessionId,
      taskId,
      channel: "test",
      status: "streaming",
      externalSessionId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const compaction = new ContextCompactionService(db, store);

    const result = compaction.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 8000,
    });

    assert.ok(typeof result.usageBeforeTokens === "number");
    assert.ok(typeof result.usageAfterStage1Tokens === "number");
    assert.ok(typeof result.stage1Triggered === "boolean");
    assert.ok(typeof result.stage2Triggered === "boolean");
    assert.ok(Array.isArray(result.contextMessages));
    assert.ok(Array.isArray(result.persistedRecords));

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("ContextCompactionService stage 1 does not trigger with empty session", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "compaction-stage1-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js"
    );
    const { ContextCompactionService } = await import(
      "../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const db = storage.sql;
    const store = storage.store;

    const { newId, nowIso } = await import("../../../../src/platform/contracts/types/ids.js");

    const taskId = newId("task");
    const sessionId = newId("sess");

    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "test",
      title: "Test",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });

    store.session.insertSession({
      id: sessionId,
      taskId,
      channel: "test",
      status: "streaming",
      externalSessionId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const compaction = new ContextCompactionService(db, store);

    const result = compaction.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 8000,
      stage1TriggerRatio: 0.5,
    });

    // Without messages, stage1Triggered should be false
    assert.strictEqual(result.stage1Triggered, false);
    assert.strictEqual(result.stage2Triggered, false);

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("ContextCompactionService records are persisted to storage", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "compaction-records-test-"));

  try {
    const { openAuthoritativeStorageContext } = await import(
      "../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js"
    );
    const { ContextCompactionService } = await import(
      "../../../../src/platform/five-plane-execution/execution-engine/context-compaction-service.js"
    );

    const dbPath = join(tmpDir, "test.db");
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.migrate();

    const db = storage.sql;
    const store = storage.store;

    const { newId, nowIso } = await import("../../../../src/platform/contracts/types/ids.js");

    const taskId = newId("task");
    const sessionId = newId("sess");

    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "test",
      title: "Test",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0.01,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    });

    store.session.insertSession({
      id: sessionId,
      taskId,
      channel: "test",
      status: "streaming",
      externalSessionId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const compaction = new ContextCompactionService(db, store);

    compaction.compactContext({
      taskId,
      sessionId,
      maxContextTokens: 8000,
    });

    const records = store.session.listCompactionRecordsBySession(sessionId);
    assert.ok(Array.isArray(records));

    storage.close();
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});