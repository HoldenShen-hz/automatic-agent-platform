/**
 * [SYS-REL-2.6] Outbox Not In Critical Write Path Tests
 *
 * Tests that task state transitions write outbox entries in the same
 * transaction as the status change.
 *
 * Defect: transition-service.ts task status transitions write events directly
 * to the events table without going through the Outbox pattern.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../../src/platform/execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

test("[SYS-REL-2.6] task state transition writes outbox entry in same transaction", async () => {
  const workspace = createTempWorkspace("aa-outbox-transition-");
  const dbPath = join(workspace, "test.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);

    const transitionService = new TransitionService(db, store, repository);

    const now = new Date().toISOString();

    // Insert a task with queued status
    const taskId = "task-outbox-test-001";
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Outbox transition test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Transition task from queued to in_progress
    // This should write an outbox entry in the same transaction
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId: "exec-outbox-001",
      traceId: "trace-outbox-001",
      correlationId: taskId,
      idempotencyKey: "",
      metadataJson: "",
      reasonCode: "",
      reasonDetail: "",
      actorType: "system",
      actorId: "",
      occurredAt: now,
    });

    // Check if outbox entry was written
    // Note: The defect is that transition-service does NOT write to outbox currently
    // This test will FAIL until the transition-service is updated to use outbox

    // Query outbox table for entries
    const outboxEntries = db.connection
      .prepare("SELECT * FROM outbox WHERE entity_id = ? AND entity_type = ?")
      .all(taskId, "task") as Array<{ id: string; entity_type: string; entity_id: string; event_type: string }>;

    // After fix, there should be an outbox entry
    // Currently (with the bug), outboxEntries will be empty because
    // transition-service writes directly to events table
    assert.ok(
      outboxEntries.length > 0,
      "Outbox entry must exist after task transition (defect: transition-service bypasses outbox)",
    );

    if (outboxEntries.length > 0) {
      assert.equal(outboxEntries[0]!.event_type, "task:status_changed");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.6] outbox table exists and has correct schema", () => {
  const workspace = createTempWorkspace("aa-outbox-schema-");
  const dbPath = join(workspace, "schema-test.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Verify outbox table exists
    const tables = db.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    assert.ok(tableNames.includes("outbox"), "outbox table must exist");

    // Verify outbox has required columns
    const columns = db.connection
      .prepare("PRAGMA table_info(outbox)")
      .all() as Array<{ name: string }>;

    const columnNames = columns.map((c) => c.name);
    assert.ok(columnNames.includes("id"), "outbox must have id column");
    assert.ok(columnNames.includes("entity_type"), "outbox must have entity_type column");
    assert.ok(columnNames.includes("entity_id"), "outbox must have entity_id column");
    assert.ok(columnNames.includes("event_type"), "outbox must have event_type column");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-REL-2.6] multiple transitions write multiple outbox entries", async () => {
  const workspace = createTempWorkspace("aa-outbox-multi-");
  const dbPath = join(workspace, "multi-test.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitionService = new TransitionService(db, store, repository);

    const now = new Date().toISOString();
    const taskId = "task-outbox-multi-001";

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Multi transition test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // First transition: queued -> in_progress
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId: "exec-1",
      traceId: "trace-1",
      correlationId: taskId,
      idempotencyKey: "",
      metadataJson: "",
      reasonCode: "",
      reasonDetail: "",
      actorType: "system",
      actorId: "",
      occurredAt: now,
    });

    // Second transition: in_progress -> done
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "done",
      executionId: "exec-1",
      traceId: "trace-2",
      correlationId: taskId,
      idempotencyKey: "",
      metadataJson: "",
      reasonCode: "",
      reasonDetail: "",
      actorType: "system",
      actorId: "",
      occurredAt: new Date().toISOString(),
    });

    // Check outbox entries
    const outboxEntries = db.connection
      .prepare("SELECT * FROM outbox WHERE entity_id = ? ORDER BY created_at")
      .all(taskId) as Array<{ event_type: string }>;

    // After fix: should have 2 outbox entries
    // Currently (with bug): outboxEntries is empty
    assert.ok(
      outboxEntries.length >= 2,
      `Expected at least 2 outbox entries for 2 transitions, got ${outboxEntries.length}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});