/**
 * Data Integrity Test: Memory Reference Integrity
 *
 * Verifies that memory records maintain referential integrity
 * with task, session, and execution records.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { MemoryRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/memory-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";
import type { MemoryRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test("data integrity: memory references task correctly", () => {
  const workspace = createTempWorkspace("aa-memory-ref-");
  try {
    const db = new SqliteDatabase(join(workspace, "memory-ref.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryRepo = new MemoryRepository(db.connection);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const executionId = newId("exec");
    const memoryId = newId("mem");
    const now = nowIso();

    // Create task, session, execution, and memory
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Memory reference test",
        status: "in_progress",
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

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-memory",
        attempt: 1,
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
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert memory with references
      db.connection.exec(`
        INSERT INTO memories (id, task_id, session_id, execution_id, memory_layer, scope, classification, content_json, quality_score, created_at)
        VALUES ('${memoryId}', '${taskId}', '${sessionId}', '${executionId}', 'layer_5', 'task_scoped', 'learning', '{}', 0.8, '${now}')
      `);
    });

    // Verify memory references
    const memories = memoryRepo.listMemories({ taskId });
    assert.equal(memories.length, 1, "Should find memory by taskId");
    const memory = memories[0]!;
    assert.equal(memory.taskId, taskId, "Memory should reference correct task");
    assert.equal(memory.sessionId, sessionId, "Memory should reference correct session");
    assert.equal(memory.executionId, executionId, "Memory should reference correct execution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: memory can be retrieved by session", () => {
  const workspace = createTempWorkspace("aa-memory-session-");
  try {
    const db = new SqliteDatabase(join(workspace, "memory-session.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryRepo = new MemoryRepository(db.connection);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Memory session test",
        status: "in_progress",
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

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });

      // Create multiple memories for same session
      for (let i = 0; i < 3; i++) {
        db.connection.exec(`
          INSERT INTO memories (id, task_id, session_id, memory_layer, scope, classification, content_json, quality_score, created_at)
          VALUES ('mem-${i}', '${taskId}', '${sessionId}', 'layer_5', 'task_scoped', 'learning', '{}', 0.8, '${now}')
        `);
      }
    });

    const sessionMemories = memoryRepo.listMemories({ sessionId });
    assert.equal(sessionMemories.length, 3, "Should find all 3 memories by sessionId");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: memory can be filtered by scope", () => {
  const workspace = createTempWorkspace("aa-memory-scope-");
  try {
    const db = new SqliteDatabase(join(workspace, "memory-scope.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryRepo = new MemoryRepository(db.connection);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Memory scope test",
        status: "in_progress",
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

      // Create memories with different scopes
      db.connection.exec(`
        INSERT INTO memories (id, task_id, session_id, memory_layer, scope, classification, content_json, quality_score, created_at)
        VALUES ('mem-task', '${taskId}', NULL, 'layer_5', 'task_scoped', 'learning', '{}', 0.8, '${now}')
      `);

      db.connection.exec(`
        INSERT INTO memories (id, task_id, session_id, memory_layer, scope, classification, content_json, quality_score, created_at)
        VALUES ('mem-global', '${taskId}', NULL, 'layer_3', 'global', 'learning', '{}', 0.9, '${now}')
      `);
    });

    const taskScopedMemories = memoryRepo.listMemories({ taskId, scopes: ["task_scoped"] });
    assert.equal(taskScopedMemories.length, 1, "Should find only task_scoped memory");
    assert.equal(taskScopedMemories[0]!.scope, "task_scoped");

    const globalMemories = memoryRepo.listMemories({ taskId, scopes: ["global"] });
    assert.equal(globalMemories.length, 1, "Should find only global memory");
    assert.equal(globalMemories[0]!.scope, "global");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: memory can be filtered by memory layer", () => {
  const workspace = createTempWorkspace("aa-memory-layer-");
  try {
    const db = new SqliteDatabase(join(workspace, "memory-layer.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryRepo = new MemoryRepository(db.connection);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Memory layer test",
        status: "in_progress",
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

      db.connection.exec(`
        INSERT INTO memories (id, task_id, session_id, memory_layer, scope, classification, content_json, quality_score, created_at)
        VALUES ('mem-session', '${taskId}', NULL, 'layer_5', 'task_scoped', 'learning', '{}', 0.8, '${now}')
      `);

      db.connection.exec(`
        INSERT INTO memories (id, task_id, session_id, memory_layer, scope, classification, content_json, quality_score, created_at)
        VALUES ('mem-experience', '${taskId}', NULL, 'layer_7', 'task_scoped', 'learning', '{}', 0.9, '${now}')
      `);
    });

    const sessionLayerMemories = memoryRepo.listMemories({ taskId, memoryLayers: ["layer_5"] });
    assert.equal(sessionLayerMemories.length, 1, "Should find session layer memory");
    assert.equal(sessionLayerMemories[0]!.memoryLayer, "layer_5");

    const experienceLayerMemories = memoryRepo.listMemories({ taskId, memoryLayers: ["layer_7"] });
    assert.equal(experienceLayerMemories.length, 1, "Should find experience layer memory");
    assert.equal(experienceLayerMemories[0]!.memoryLayer, "layer_7");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("data integrity: memory content JSON is preserved", () => {
  const workspace = createTempWorkspace("aa-memory-content-");
  try {
    const db = new SqliteDatabase(join(workspace, "memory-content.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memoryRepo = new MemoryRepository(db.connection);

    const taskId = newId("task");
    const memoryId = newId("mem");
    const now = nowIso();

    const complexContent = {
      toolCalls: [
        { tool: "read_file", args: { path: "/test.txt" } },
        { tool: "edit_file", args: { path: "/test.txt", replacement: "updated" } },
      ],
      outcome: "Successfully edited file",
      keyDecisions: ["Used edit instead of create for existing file"],
    };

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Memory content test",
        status: "in_progress",
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

      db.connection.exec(`
        INSERT INTO memories (id, task_id, session_id, memory_layer, scope, classification, content_json, quality_score, created_at)
        VALUES ('${memoryId}', '${taskId}', NULL, 'layer_5', 'task_scoped', 'learning', '${JSON.stringify(complexContent)}', 0.9, '${now}')
      `);
    });

    const memories = memoryRepo.listMemories({ taskId });
    assert.equal(memories.length, 1, "Should find the memory");

    const retrievedContent = JSON.parse(memories[0]!.contentJson);
    assert.deepEqual(retrievedContent, complexContent, "Complex content JSON should be preserved");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
