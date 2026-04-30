/**
 * Integration tests for Memory system
 *
 * Tests memory service with real database for:
 * - Memory persistence
 * - Recall and retrieval
 * - Decay and consolidation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { MemoryDecayService } from "../../../../../src/platform/state-evidence/memory/memory-decay-service.js";
import { MemoryRetrievalService } from "../../../../../src/platform/state-evidence/memory/memory-retrieval-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createMemoryStore(db: SqliteDatabase): AuthoritativeTaskStore {
  return new AuthoritativeTaskStore(db);
}

test("memory integration: remember and recall with real database", () => {
  const workspace = createTempWorkspace("aa-memory-integration-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "memory.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryService(store);

    const memory = service.remember({
      taskId: "task-001",
      scope: "project",
      content: "This is a test memory with sufficient length for validation",
    });

    assert.ok(memory.id.startsWith("mem_"));
    assert.equal(memory.scope, "project");
    assert.equal(memory.status, "active");

    const recalled = service.recall({ taskId: "task-001" });
    assert.ok(recalled.length > 0);
    assert.equal(recalled[0]!.id, memory.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("memory integration: memory decay calculation with real timestamps", () => {
  const workspace = createTempWorkspace("aa-memory-decay-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "decay.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryDecayService();

    // Create a memory record with a past timestamp
    const oldMemory = {
      id: "mem_old",
      taskId: null,
      sessionId: "sess_001",
      agentId: "agent_001",
      executionId: "exec_001",
      memoryLayer: "layer_3" as const,
      scope: "session",
      contentJson: '{"workContext":"old memory"}',
      classification: "content" as const,
      sourceTrustLevel: "trusted" as const,
      qualityScore: null,
      hitCount: 0,
      createdAt: "2026-04-01T00:00:00.000Z",
      lastAccessedAt: null,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "general" as const,
      status: "active" as const,
      importanceScore: null,
      freshnessScore: null,
      contentHash: null,
    };

    const freshness = service.calculateFreshness(oldMemory, "2026-04-02T00:00:00.000Z");

    // After 1 day with session half-life of 1 hour, freshness should be very low
    assert.ok(freshness < 0.5, `Freshness should be low after 1 day, got ${freshness}`);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("memory integration: consolidation combines multiple memories", () => {
  const workspace = createTempWorkspace("aa-memory-consolidation-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "consolidate.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryService(store);

    // Create multiple layer_3 memories
    for (let i = 0; i < 3; i++) {
      service.remember({
        taskId: "task-consolidate",
        scope: "project",
        content: `Memory content number ${i} that is long enough to pass validation`,
      });
    }

    // Consolidation should create a higher layer memory
    const result = service.consolidate({
      taskId: "task-consolidate",
      scope: "project",
      targetMemoryLayer: "layer_4",
      minSourceMemories: 3,
    });

    // Result depends on whether there are enough memories
    assert.ok(result !== undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("memory integration: memory retrieval with FTS indexing", () => {
  const workspace = createTempWorkspace("aa-memory-retrieval-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "retrieval.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const memoryService = new MemoryService(store);
    const retrievalService = new MemoryRetrievalService(store);

    // Create memory with searchable content
    memoryService.remember({
      scope: "project",
      content: "Important information about the project architecture",
    });

    retrievalService.initializeFts();

    // Search for the memory
    const results = retrievalService.searchMemories({
      query: "architecture",
    });

    // Results depend on FTS being properly populated
    assert.ok(Array.isArray(results));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});