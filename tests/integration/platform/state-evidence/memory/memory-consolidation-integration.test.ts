import assert from "node:assert/strict";
import test from "node:test";

import { MemoryService } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { parseStructuredMemoryContent } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-schema.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("consolidation integration: multiple memories aggregate into layer_5 with provenance", () => {
  const workspace = createTempWorkspace("aa-consolidate-multi-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    // Create 4 memories across different times with varying quality scores
    memory.remember({
      taskId: "task-consolidation-1",
      sessionId: "session-alpha",
      scope: "project",
      content: { note: "checkpoint before major refactor" },
      classification: "internal",
      qualityScore: 0.85,
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-consolidation-1",
      sessionId: "session-alpha",
      scope: "project",
      content: { note: "document rollback procedure" },
      classification: "operational",
      qualityScore: 0.9,
      createdAt: "2026-04-10T08:30:00.000Z",
    });
    memory.remember({
      taskId: "task-consolidation-1",
      sessionId: "session-alpha",
      scope: "project",
      content: { note: "verify queue replay ordering" },
      classification: "internal",
      qualityScore: 0.75,
      createdAt: "2026-04-10T09:00:00.000Z",
    });
    memory.remember({
      taskId: "task-consolidation-1",
      sessionId: "session-alpha",
      scope: "project",
      content: { note: "preserve degraded session indicator logic" },
      classification: "operational",
      qualityScore: 0.88,
      createdAt: "2026-04-10T09:30:00.000Z",
    });

    const result = memory.consolidate({
      taskId: "task-consolidation-1",
      sessionId: "session-alpha",
      scopes: ["project"],
      minSourceMemories: 3,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.ok(result.createdMemory !== null);
    assert.equal(result.createdMemory.memoryLayer, "layer_5");
    assert.equal(result.createdMemory.classification, "summary");
    assert.equal(result.sourceMemoryIds.length, 4);

    // Average quality should be ~0.845
    const avgQuality = result.createdMemory.qualityScore;
    assert.ok(avgQuality !== null);
    assert.ok(avgQuality >= 0.84 && avgQuality <= 0.85);

    // Verify structured content
    const payload = parseStructuredMemoryContent(result.createdMemory.contentJson);
    assert.equal(payload.schemaVersion, "memory.v2");
    assert.ok(payload.workContext?.includes("Consolidated 4 memories"));
    assert.ok(payload.facts.length > 0);

    // Verify all sources revoked
    const revokedCheck = result.sourceMemoryIds.every((id) => {
      const mem = store.getMemory(id);
      return mem?.revokedAt !== null;
    });
    assert.ok(revokedCheck, "All source memories should be revoked");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: fails when candidate memories have different scopes", () => {
  const workspace = createTempWorkspace("aa-consolidate-mixed-scope-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    // Create memories with different scopes
    memory.remember({
      taskId: "task-mixed-scope",
      scope: "project",
      content: { note: "project memory one" },
      classification: "internal",
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-mixed-scope",
      scope: "session",
      content: { note: "session memory one" },
      classification: "internal",
      createdAt: "2026-04-10T08:05:00.000Z",
    });
    memory.remember({
      taskId: "task-mixed-scope",
      scope: "project",
      content: { note: "project memory two" },
      classification: "internal",
      createdAt: "2026-04-10T08:10:00.000Z",
    });

    // This should throw due to single-scope requirement - candidates have mixed scopes
    assert.throws(() => {
      memory.consolidate({
        taskId: "task-mixed-scope",
        scopes: ["project", "session"],
      });
    }, (err: unknown) => {
      return (err as { code?: string }).code === "E8memory_consolidation_single_scope_required";
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: olderThanCreatedAt filters eligible sources", () => {
  const workspace = createTempWorkspace("aa-consolidate-age-filter-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    // Old memories
    memory.remember({
      taskId: "task-age-filter",
      scope: "project",
      content: { note: "old memory one" },
      classification: "internal",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    memory.remember({
      taskId: "task-age-filter",
      scope: "project",
      content: { note: "old memory two" },
      classification: "internal",
      createdAt: "2026-04-01T01:00:00.000Z",
    });
    memory.remember({
      taskId: "task-age-filter",
      scope: "project",
      content: { note: "old memory three" },
      classification: "internal",
      createdAt: "2026-04-01T02:00:00.000Z",
    });

    // Recent memories - should be excluded by olderThanCreatedAt
    memory.remember({
      taskId: "task-age-filter",
      scope: "project",
      content: { note: "recent memory one" },
      classification: "internal",
      createdAt: "2026-04-15T10:00:00.000Z",
    });
    memory.remember({
      taskId: "task-age-filter",
      scope: "project",
      content: { note: "recent memory two" },
      classification: "internal",
      createdAt: "2026-04-15T11:00:00.000Z",
    });
    memory.remember({
      taskId: "task-age-filter",
      scope: "project",
      content: { note: "recent memory three" },
      classification: "internal",
      createdAt: "2026-04-15T12:00:00.000Z",
    });

    // Only old memories should be considered
    const result = memory.consolidate({
      taskId: "task-age-filter",
      scopes: ["project"],
      olderThanCreatedAt: "2026-04-10T00:00:00.000Z",
      evaluatedAt: "2026-04-20T00:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.equal(result.sourceMemoryIds.length, 3);

    // Recent memories should still exist
    const recentMemories = memory.recall({
      taskId: "task-age-filter",
      scopes: ["project"],
      memoryLayers: ["layer_3"],
      evaluatedAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(recentMemories.length, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: maxSourceMemories caps source count", () => {
  const workspace = createTempWorkspace("aa-consolidate-max-sources-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    // Create 8 memories (more than maxSourceMemories)
    for (let i = 0; i < 8; i++) {
      memory.remember({
        taskId: "task-max-sources",
        scope: "project",
        content: { note: `memory number ${i}` },
        classification: "internal",
        qualityScore: 0.8 + i * 0.02,
        createdAt: `2026-04-10T0${i}:00:00.000Z`,
      });
    }

    const result = memory.consolidate({
      taskId: "task-max-sources",
      scopes: ["project"],
      maxSourceMemories: 3,
      minSourceMemories: 2,
      evaluatedAt: "2026-04-20T00:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.ok(result.sourceMemoryIds.length <= 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: revokeSourceMemories=false keeps sources active", () => {
  const workspace = createTempWorkspace("aa-consolidate-no-revoke-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    memory.remember({
      taskId: "task-no-revoke",
      scope: "project",
      content: { note: "source memory one" },
      classification: "internal",
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-no-revoke",
      scope: "project",
      content: { note: "source memory two" },
      classification: "internal",
      createdAt: "2026-04-10T08:05:00.000Z",
    });
    memory.remember({
      taskId: "task-no-revoke",
      scope: "project",
      content: { note: "source memory three" },
      classification: "internal",
      createdAt: "2026-04-10T08:10:00.000Z",
    });

    const result = memory.consolidate({
      taskId: "task-no-revoke",
      scopes: ["project"],
      revokeSourceMemories: false,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);

    // Source memories should still be active
    const remaining = memory.recall({
      taskId: "task-no-revoke",
      scopes: ["project"],
      memoryLayers: ["layer_3"],
      includeRevoked: true,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });
    assert.equal(remaining.length, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: insufficient source memories returns skipped result", () => {
  const workspace = createTempWorkspace("aa-consolidate-insufficient-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    // Only 2 memories but minSourceMemories is 3
    memory.remember({
      taskId: "task-insufficient",
      scope: "project",
      content: { note: "only two memories" },
      classification: "internal",
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-insufficient",
      scope: "project",
      content: { note: "still only two" },
      classification: "internal",
      createdAt: "2026-04-10T08:05:00.000Z",
    });

    const result = memory.consolidate({
      taskId: "task-insufficient",
      scopes: ["project"],
      minSourceMemories: 3,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, false);
    assert.equal(result.createdMemory, null);
    assert.equal(result.skippedReason, "insufficient_source_memories");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: targetMemoryLayer layer_4 creates correct layer", () => {
  const workspace = createTempWorkspace("aa-consolidate-layer4-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    for (let i = 0; i < 3; i++) {
      memory.remember({
        taskId: "task-layer4",
        scope: "project",
        content: { note: `memory for layer 4 consolidation ${i}` },
        classification: "internal",
        createdAt: `2026-04-10T0${i}:00:00.000Z`,
      });
    }

    const result = memory.consolidate({
      taskId: "task-layer4",
      scopes: ["project"],
      targetMemoryLayer: "layer_4" as const,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.equal(result.createdMemory?.memoryLayer, "layer_4");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: classification filters correctly", () => {
  const workspace = createTempWorkspace("aa-consolidate-class-filter-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    memory.remember({
      taskId: "task-class-filter",
      scope: "project",
      content: { note: "operational memory one" },
      classification: "operational",
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-class-filter",
      scope: "project",
      content: { note: "operational memory two" },
      classification: "operational",
      createdAt: "2026-04-10T08:05:00.000Z",
    });
    memory.remember({
      taskId: "task-class-filter",
      scope: "project",
      content: { note: "operational memory three" },
      classification: "operational",
      createdAt: "2026-04-10T08:10:00.000Z",
    });
    memory.remember({
      taskId: "task-class-filter",
      scope: "project",
      content: { note: "internal memory one" },
      classification: "internal",
      createdAt: "2026-04-10T08:15:00.000Z",
    });
    memory.remember({
      taskId: "task-class-filter",
      scope: "project",
      content: { note: "internal memory two" },
      classification: "internal",
      createdAt: "2026-04-10T08:20:00.000Z",
    });
    memory.remember({
      taskId: "task-class-filter",
      scope: "project",
      content: { note: "internal memory three" },
      classification: "internal",
      createdAt: "2026-04-10T08:25:00.000Z",
    });

    // Only consolidate operational memories
    const result = memory.consolidate({
      taskId: "task-class-filter",
      scopes: ["project"],
      classifications: ["operational"],
      minSourceMemories: 2,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.equal(result.sourceMemoryIds.length, 3);

    // All source memory classifications should be "operational"
    const allOperational = result.sourceMemoryIds.every((id) => {
      const mem = store.getMemory(id);
      return mem?.classification === "operational";
    });
    assert.ok(allOperational);

    // Internal memories should remain unconsolidated
    const internalMemories = memory.recall({
      taskId: "task-class-filter",
      scopes: ["project"],
      classifications: ["internal"],
      memoryLayers: ["layer_3"],
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });
    assert.equal(internalMemories.length, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: sourceTrustLevels filter correctly", () => {
  const workspace = createTempWorkspace("aa-consolidate-trust-filter-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    memory.remember({
      taskId: "task-trust-filter",
      scope: "project",
      content: { note: "trusted memory one" },
      sourceTrustLevel: "trusted",
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-trust-filter",
      scope: "project",
      content: { note: "trusted memory two" },
      sourceTrustLevel: "trusted",
      createdAt: "2026-04-10T08:05:00.000Z",
    });
    memory.remember({
      taskId: "task-trust-filter",
      scope: "project",
      content: { note: "trusted memory three" },
      sourceTrustLevel: "trusted",
      createdAt: "2026-04-10T08:10:00.000Z",
    });
    memory.remember({
      taskId: "task-trust-filter",
      scope: "project",
      content: { note: "untrusted memory one" },
      sourceTrustLevel: "untrusted",
      createdAt: "2026-04-10T08:15:00.000Z",
    });
    memory.remember({
      taskId: "task-trust-filter",
      scope: "project",
      content: { note: "untrusted memory two" },
      sourceTrustLevel: "untrusted",
      createdAt: "2026-04-10T08:20:00.000Z",
    });
    memory.remember({
      taskId: "task-trust-filter",
      scope: "project",
      content: { note: "untrusted memory three" },
      sourceTrustLevel: "untrusted",
      createdAt: "2026-04-10T08:25:00.000Z",
    });

    // Only consolidate trusted memories
    const result = memory.consolidate({
      taskId: "task-trust-filter",
      scopes: ["project"],
      sourceTrustLevels: ["trusted"],
      minSourceMemories: 2,
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.equal(result.sourceMemoryIds.length, 3);

    // All source memory trust levels should be "trusted"
    const allTrusted = result.sourceMemoryIds.every((id) => {
      const mem = store.getMemory(id);
      return mem?.sourceTrustLevel === "trusted";
    });
    assert.ok(allTrusted);

    // Untrusted memories should remain unconsolidated
    const untrustedMemories = memory.recall({
      taskId: "task-trust-filter",
      scopes: ["project"],
      sourceTrustLevels: ["untrusted"],
      memoryLayers: ["layer_3"],
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });
    assert.equal(untrustedMemories.length, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: sessionId boundary allows consolidation without taskId", () => {
  const workspace = createTempWorkspace("aa-consolidate-session-boundary-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    memory.remember({
      sessionId: "session-boundary-test",
      scope: "project",
      content: { note: "session-scoped memory one" },
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      sessionId: "session-boundary-test",
      scope: "project",
      content: { note: "session-scoped memory two" },
      createdAt: "2026-04-10T08:05:00.000Z",
    });
    memory.remember({
      sessionId: "session-boundary-test",
      scope: "project",
      content: { note: "session-scoped memory three" },
      createdAt: "2026-04-10T08:10:00.000Z",
    });

    // Consolidate using sessionId as boundary
    const result = memory.consolidate({
      sessionId: "session-boundary-test",
      scopes: ["project"],
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);
    assert.ok(result.createdMemory !== null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("consolidation integration: facts deduplicated in consolidated output", () => {
  const workspace = createTempWorkspace("aa-consolidate-dedup-");
  const dbPath = `${workspace}/consolidation.db`;

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const memory = new MemoryService(store);

    // Memories with duplicate facts
    memory.remember({
      taskId: "task-dedup",
      scope: "project",
      content: {
        facts: [
          { content: "queue replay must preserve order", category: "ordering", confidence: 0.9 },
          { content: "checkpoint before refactor", category: "procedure", confidence: 0.85 },
        ],
      },
      classification: "operational",
      createdAt: "2026-04-10T08:00:00.000Z",
    });
    memory.remember({
      taskId: "task-dedup",
      scope: "project",
      content: {
        facts: [
          { content: "queue replay must preserve order", category: "ordering", confidence: 0.9 }, // duplicate
          { content: "degraded session indicator logic", category: "procedure", confidence: 0.88 },
        ],
      },
      classification: "operational",
      createdAt: "2026-04-10T08:05:00.000Z",
    });
    memory.remember({
      taskId: "task-dedup",
      scope: "project",
      content: {
        facts: [
          { content: "queue replay must preserve order", category: "ordering", confidence: 0.9 }, // duplicate again
          { content: "rollback procedure documented", category: "procedure", confidence: 0.87 },
        ],
      },
      classification: "operational",
      createdAt: "2026-04-10T08:10:00.000Z",
    });

    const result = memory.consolidate({
      taskId: "task-dedup",
      scopes: ["project"],
      evaluatedAt: "2026-04-10T12:00:00.000Z",
    });

    assert.equal(result.consolidated, true);

    const payload = parseStructuredMemoryContent(result.createdMemory?.contentJson ?? "{}");

    // Fact about "queue replay must preserve order" should appear only once
    const queueFacts = payload.facts.filter((f) => f.content === "queue replay must preserve order");
    assert.equal(queueFacts.length, 1, "Duplicate facts should be deduplicated");

    // All three unique procedure facts should be present
    const procedureFacts = payload.facts.filter((f) => f.category === "procedure");
    assert.ok(procedureFacts.length >= 3, "Should have multiple unique procedure facts");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
