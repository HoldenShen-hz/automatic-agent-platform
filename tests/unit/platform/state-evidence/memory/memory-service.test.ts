import test from "node:test";
import assert from "node:assert/strict";

import { MemoryService, type RememberMemoryInput, type ConsolidateMemoriesInput } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { MemoryError } from "../../../../../src/platform/contracts/errors.js";
import type { MemoryRecord, MemoryKind, MemorySourceTrustLevel } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

function createMockMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_test123",
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "project",
    contentJson: '{"content":"test memory","classification":"internal","facts":[]}',
    classification: "internal",
    sourceTrustLevel: "trusted",
    qualityScore: null,
    hitCount: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: "abc123",
    ...overrides,
  };
}

function createMockStore(): AuthoritativeTaskStore {
  const memories: Map<string, MemoryRecord> = new Map();
  let nextId = 1;

  return {
    memory: {
      insertMemory: (record: MemoryRecord) => {
        memories.set(record.id, { ...record });
      },
      listMemories: (query: any = {}) => {
        let result = Array.from(memories.values());
        if (query.scopes && query.scopes.length > 0) {
          result = result.filter(m => query.scopes.includes(m.scope));
        }
        if (query.taskId != null) {
          result = result.filter(m => m.taskId === query.taskId);
        }
        if (query.sessionId != null) {
          result = result.filter(m => m.sessionId === query.sessionId);
        }
        if (query.agentId != null) {
          result = result.filter(m => m.agentId === query.agentId);
        }
        if (query.executionId != null) {
          result = result.filter(m => m.executionId === query.executionId);
        }
        if (query.memoryLayers && query.memoryLayers.length > 0) {
          result = result.filter(m => query.memoryLayers.includes(m.memoryLayer));
        }
        if (query.classifications && query.classifications.length > 0) {
          result = result.filter(m => query.classifications.includes(m.classification));
        }
        if (query.sourceTrustLevels && query.sourceTrustLevels.length > 0) {
          result = result.filter(m => query.sourceTrustLevels.includes(m.sourceTrustLevel));
        }
        return result;
      },
      getMemory: (id: string) => memories.get(id) ?? null,
      recordMemoryAccess: () => {},
      revokeMemory: (id: string, revokedAt: string, reason: string) => {
        const existing = memories.get(id);
        if (existing) {
          memories.set(id, { ...existing, revokedAt, revocationReason: reason });
        }
      },
      findMemoryByContentHash: (_contentHash: string, _scope: string) => null,
      getMemoryQualityReport: () => ({
        totalCount: 0,
        activeCount: 0,
        expiredCount: 0,
        revokedCount: 0,
        averageQualityScore: null,
        byScope: [],
        byLayer: [],
        byClassification: [],
        recallStats: { totalHits: 0, averageHits: 0, memoriesNeverAccessed: 0 },
      }),
    },
  } as any;
}

// =============================================================================
// remember (store) tests
// =============================================================================

test("remember stores memory with string content", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "This is a test memory with sufficient length",
  });

  assert.ok(result.id.startsWith("mem_"));
  assert.equal(result.scope, "project");
  assert.equal(result.status, "active");
});

test("remember stores memory with object content", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: { text: "Object content memory", metadata: { key: "value" } },
  });

  assert.ok(result.id.startsWith("mem_"));
  assert.equal(result.status, "active");
});

test("remember stores memory with structured content", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: {
      content: "Structured content",
      classification: "internal",
      facts: [],
    },
  });

  assert.ok(result.id.startsWith("mem_"));
  assert.equal(result.status, "active");
});

test("remember throws MemoryError when content exceeds size limit", () => {
  const store = createMockStore();
  const service = new MemoryService(store);
  const largeContent = "x".repeat(1_000_001); // Exceeds 1MB limit

  assert.throws(() => {
    service.remember({ scope: "project", content: largeContent });
  }, (err: any) => {
    return err.code === "E8memory.content_too_large";
  });
});

test("remember measures UTF-8 bytes instead of UTF-16 code units for size limit", () => {
  const store = createMockStore();
  const service = new MemoryService(store);
  const largeCjkContent = "你".repeat(400_000);

  assert.throws(() => {
    service.remember({ scope: "project", content: largeCjkContent });
  }, (err: any) => err.code === "E8memory.content_too_large");
});

test("remember throws MemoryError when content is too short", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  assert.throws(() => {
    service.remember({ scope: "project", content: "short" });
  }, (err: any) => {
    return err.code === "E8memory.content_too_short";
  });
});

test("remember throws MemoryError when object content serializes to too short", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  assert.throws(() => {
    service.remember({ scope: "project", content: { a: "b" } });
  }, (err: any) => {
    return err.code === "E8memory.content_too_short";
  });
});

test("remember returns existing memory on content hash collision", () => {
  const existingMemory = createMockMemoryRecord({
    hitCount: 5,
    lastAccessedAt: "2026-04-01T00:00:00.000Z",
  });
  const store = createMockStore();
  store.memory.insertMemory(existingMemory);
  store.memory.findMemoryByContentHash = () => existingMemory;
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "This is a test memory with sufficient length",
  });

  assert.equal(result.id, existingMemory.id);
  assert.equal(result.hitCount, 6); // Incremented
});

test("remember uses provided taskId", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    taskId: "task_abc",
    scope: "project",
    content: "Memory with task context",
  });

  assert.equal(result.taskId, "task_abc");
});

test("remember uses provided sessionId", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    sessionId: "session_xyz",
    scope: "session",
    content: "Memory with session context",
  });

  assert.equal(result.sessionId, "session_xyz");
});

test("remember uses provided agentId", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    agentId: "agent_123",
    scope: "agent",
    content: "Memory with agent context",
  });

  assert.equal(result.agentId, "agent_123");
});

test("remember uses provided executionId", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    executionId: "exec_456",
    scope: "project",
    content: "Memory with execution context",
  });

  assert.equal(result.executionId, "exec_456");
});

test("remember uses provided memoryLayer", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    memoryLayer: "layer_5",
    scope: "project",
    content: "Long term memory",
  });

  assert.equal(result.memoryLayer, "layer_5");
});

test("remember defaults memoryLayer to layer_3", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "Short term memory",
  });

  assert.equal(result.memoryLayer, "layer_3");
});

test("remember uses provided classification", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    classification: "operational",
    scope: "project",
    content: "Operational memory",
  });

  assert.equal(result.classification, "operational");
});

test("remember defaults classification to internal", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "Internal memory",
  });

  assert.equal(result.classification, "internal");
});

test("remember uses provided sourceTrustLevel", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    sourceTrustLevel: "untrusted",
    scope: "project",
    content: "Untrusted source memory",
  });

  assert.equal(result.sourceTrustLevel, "untrusted");
});

test("remember defaults sourceTrustLevel to trusted", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "Trusted memory",
  });

  assert.equal(result.sourceTrustLevel, "trusted");
});

test("remember uses provided qualityScore", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    qualityScore: 0.85,
    scope: "project",
    content: "High quality memory",
  });

  assert.equal(result.qualityScore, 0.85);
});

test("remember uses provided kind", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    kind: "fact",
    scope: "project",
    content: "Fact memory",
  });

  assert.equal(result.kind, "fact");
});

test("remember defaults kind to general", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "General memory",
  });

  assert.equal(result.kind, "general");
});

test("remember uses provided createdAt", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    createdAt: "2025-01-01T00:00:00.000Z",
    scope: "project",
    content: "Backdated memory",
  });

  assert.equal(result.createdAt, "2025-01-01T00:00:00.000Z");
});

test("remember uses provided expiresAt", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    expiresAt: "2026-05-01T00:00:00.000Z",
    scope: "project",
    content: "Expiring memory",
  });

  assert.equal(result.expiresAt, "2026-05-01T00:00:00.000Z");
});

test("remember computes contentHash", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.remember({
    scope: "project",
    content: "Memory for hashing",
  });

  assert.ok(result.contentHash != null);
  assert.equal(result.contentHash!.length, 16);
});

// =============================================================================
// recall (retrieve) tests
// =============================================================================

test("recall returns empty array when no memories", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.recall();

  assert.deepEqual(result, []);
});

test("recall returns all active memories by default", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2" }));
  const service = new MemoryService(store);

  const result = service.recall();

  assert.equal(result.length, 2);
});

test("recall updates hit count for returned memories", () => {
  const mem1 = createMockMemoryRecord({ id: "mem_1", hitCount: 3 });
  const store = createMockStore();
  store.memory.insertMemory(mem1);
  const service = new MemoryService(store);

  const result = service.recall();

  assert.equal(result.length, 1);
  assert.equal(result[0]!.hitCount, 4);
});

test("recall updates lastAccessedAt for returned memories", () => {
  const mem1 = createMockMemoryRecord({ id: "mem_1", lastAccessedAt: null });
  const store = createMockStore();
  store.memory.insertMemory(mem1);
  const service = new MemoryService(store);

  const result = service.recall();

  assert.equal(result.length, 1);
  assert.ok(result[0]!.lastAccessedAt !== null);
});

test("recall filters by taskId", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", taskId: "task_abc" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", taskId: "task_xyz" }));
  const service = new MemoryService(store);

  const result = service.recall({ taskId: "task_abc" });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "mem_1");
});

test("recall filters by sessionId", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", sessionId: "session_abc" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", sessionId: "session_xyz" }));
  const service = new MemoryService(store);

  const result = service.recall({ sessionId: "session_abc" });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "mem_1");
});

test("recall filters by agentId", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", agentId: "agent_abc" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", agentId: "agent_xyz" }));
  const service = new MemoryService(store);

  const result = service.recall({ agentId: "agent_abc" });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "mem_1");
});

test("recall filters by scopes", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", scope: "project" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", scope: "session" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_3", scope: "agent" }));
  const service = new MemoryService(store);

  const result = service.recall({ scopes: ["project", "session"] });

  assert.equal(result.length, 2);
});

test("recall filters by memoryLayers", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", memoryLayer: "layer_3" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", memoryLayer: "layer_5" }));
  const service = new MemoryService(store);

  const result = service.recall({ memoryLayers: ["layer_3"] });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "mem_1");
});

test("recall filters by classifications", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", classification: "internal" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", classification: "operational" }));
  const service = new MemoryService(store);

  const result = service.recall({ classifications: ["operational"] });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "mem_2");
});

test("recall filters by sourceTrustLevels", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", sourceTrustLevel: "trusted" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", sourceTrustLevel: "untrusted" }));
  const service = new MemoryService(store);

  const result = service.recall({ sourceTrustLevels: ["untrusted"] });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "mem_2");
});

test("recall sorts by createdAt descending", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_old", createdAt: "2026-01-01T00:00:00.000Z" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_new", createdAt: "2026-04-01T00:00:00.000Z" }));
  const service = new MemoryService(store);

  const result = service.recall();

  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, "mem_new");
  assert.equal(result[1]!.id, "mem_old");
});

// =============================================================================
// revoke tests
// =============================================================================

test("revoke returns null for non-existent memory", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.revoke("nonexistent", "no longer needed");

  assert.equal(result, null);
});

test("revoke marks memory as revoked", () => {
  const mem = createMockMemoryRecord({ id: "mem_1" });
  const store = createMockStore();
  store.memory.insertMemory(mem);
  const service = new MemoryService(store);

  const result = service.revoke("mem_1", "no longer needed", "2026-04-17T00:00:00.000Z");

  assert.ok(result !== null);
  assert.equal(result?.revokedAt, "2026-04-17T00:00:00.000Z");
  assert.equal(result?.revocationReason, "no longer needed");
});

test("revoke uses provided revokedAt timestamp", () => {
  const mem = createMockMemoryRecord({ id: "mem_1" });
  const store = createMockStore();
  store.memory.insertMemory(mem);
  const service = new MemoryService(store);

  const result = service.revoke("mem_1", "expired", "2025-01-01T00:00:00.000Z");

  assert.ok(result !== null);
  assert.equal(result?.revokedAt, "2025-01-01T00:00:00.000Z");
});

// =============================================================================
// getQualityReport tests
// =============================================================================

test("getQualityReport returns report for empty store", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.getQualityReport();

  assert.ok(result !== undefined);
  assert.equal(result.totalCount, 0);
  assert.equal(result.activeCount, 0);
});

test("getQualityReport counts active and revoked memories", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", status: "active" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", status: "active" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_3", status: "active", revokedAt: "2026-04-01T00:00:00.000Z" }));
  const service = new MemoryService(store);

  const result = service.getQualityReport();

  assert.equal(result.totalCount, 3);
  assert.equal(result.activeCount, 2);
  assert.equal(result.revokedCount, 1);
});

test("getQualityReport filters by scope", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", scope: "project" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", scope: "session" }));
  const service = new MemoryService(store);

  const result = service.getQualityReport({ scopes: ["project"] });

  assert.equal(result.totalCount, 1);
});

// =============================================================================
// recordFailureMemory tests
// =============================================================================

test("recordFailureMemory creates memory with operational classification", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.recordFailureMemory({
    taskId: "task_abc",
    executionId: "exec_xyz",
    agentId: "agent_123",
    reasonCode: "ERR_TIMEOUT",
    errorMessage: "Execution timed out",
  });

  assert.ok(result.id.startsWith("mem_"));
  assert.equal(result.taskId, "task_abc");
  assert.equal(result.executionId, "exec_xyz");
  assert.equal(result.classification, "operational");
  assert.equal(result.memoryLayer, "layer_3");
});

test("recordFailureMemory creates memory without errorMessage", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.recordFailureMemory({
    taskId: "task_abc",
    executionId: "exec_xyz",
    agentId: null,
    reasonCode: "ERR_CANCELLED",
    errorMessage: null,
  });

  assert.ok(result.id.startsWith("mem_"));
  // reasonCode is stored inside contentJson, not as a direct property
});

test("recordFailureMemory uses provided occurredAt", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.recordFailureMemory({
    taskId: "task_abc",
    executionId: "exec_xyz",
    agentId: null,
    reasonCode: "ERR_TIMEOUT",
    errorMessage: null,
    occurredAt: "2025-01-01T00:00:00.000Z",
  });

  assert.equal(result.createdAt, "2025-01-01T00:00:00.000Z");
});

test("recordFailureMemory uses provided scope", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.recordFailureMemory({
    taskId: "task_abc",
    executionId: "exec_xyz",
    agentId: null,
    reasonCode: "ERR_TIMEOUT",
    errorMessage: null,
    scope: "session",
  });

  assert.equal(result.scope, "session");
});

// =============================================================================
// consolidate tests
// =============================================================================

test("consolidate throws without explicit memory boundary", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  assert.throws(() => {
    service.consolidate({});
  }, (err: any) => {
    return err.code === "E8memory_consolidation_scope_required";
  });
});

// Note: scopes alone IS a valid explicit boundary per hasExplicitMemoryBoundary
// so consolidate({ scopes: ["project"] }) does NOT throw

test("consolidate returns insufficient_source_memories when fewer than minSourceMemories", () => {
  const store = createMockStore();
  // Only 2 memories, but minSourceMemories defaults to 3
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", scope: "project", memoryLayer: "layer_3" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", scope: "project", memoryLayer: "layer_3" }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
  });

  assert.equal(result.consolidated, false);
  assert.equal(result.skippedReason, "insufficient_source_memories");
  assert.equal(result.createdMemory, null);
});

test("consolidate consolidates when sufficient source memories", () => {
  const store = createMockStore();
  for (let i = 0; i < 3; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "project",
      memoryLayer: "layer_3",
      taskId: "task_abc",
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
  });

  assert.equal(result.consolidated, true);
  assert.ok(result.createdMemory !== null);
  assert.equal(result.createdMemory.memoryLayer, "layer_5"); // Default target
  assert.equal(result.createdMemory.scope, "project");
});

test("consolidate creates memory in specified target layer", () => {
  const store = createMockStore();
  for (let i = 0; i < 3; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "project",
      memoryLayer: "layer_3",
      taskId: "task_abc",
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
    targetMemoryLayer: "layer_7",
  });

  assert.equal(result.consolidated, true);
  assert.equal(result.createdMemory?.memoryLayer, "layer_7");
});

test("consolidate uses minSourceMemories when specified", () => {
  const store = createMockStore();
  // Only 2 memories, but minSourceMemories set to 2
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", scope: "project", memoryLayer: "layer_3", taskId: "task_abc" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", scope: "project", memoryLayer: "layer_3", taskId: "task_abc" }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
    minSourceMemories: 2,
  });

  assert.equal(result.consolidated, true);
  assert.ok(result.createdMemory !== null);
});

test("consolidate revokes source memories by default", () => {
  const store = createMockStore();
  for (let i = 0; i < 3; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "project",
      memoryLayer: "layer_3",
      taskId: "task_abc",
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
    revokeSourceMemories: true,
  });

  assert.equal(result.consolidated, true);
  // Source memories should be revoked
  for (const id of result.sourceMemoryIds) {
    const mem = store.memory.getMemory(id);
    assert.ok(mem?.revokedAt !== null);
  }
});

test("consolidate does not revoke source memories when option is false", () => {
  const store = createMockStore();
  for (let i = 0; i < 3; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "project",
      memoryLayer: "layer_3",
      taskId: "task_abc",
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
    revokeSourceMemories: false,
  });

  assert.equal(result.consolidated, true);
  // Source memories should NOT be revoked
  for (const id of result.sourceMemoryIds) {
    const mem = store.memory.getMemory(id);
    assert.equal(mem?.revokedAt, null);
  }
});

test("consolidate throws when memories have different scopes", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_1", scope: "project", memoryLayer: "layer_3", taskId: "task_abc" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_2", scope: "session", memoryLayer: "layer_3", taskId: "task_abc" }));
  store.memory.insertMemory(createMockMemoryRecord({ id: "mem_3", scope: "project", memoryLayer: "layer_3", taskId: "task_abc" }));
  const service = new MemoryService(store);

  assert.throws(() => {
    service.consolidate({
      taskId: "task_abc",
      scopes: ["project", "session"],
    });
  }, (err: any) => {
    return err.code === "E8memory_consolidation_single_scope_required";
  });
});

test("consolidate filters by olderThanCreatedAt", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_old",
    scope: "project",
    memoryLayer: "layer_3",
    taskId: "task_abc",
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_new",
    scope: "project",
    memoryLayer: "layer_3",
    taskId: "task_abc",
    createdAt: "2026-04-01T00:00:00.000Z",
  }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
    olderThanCreatedAt: "2026-03-01T00:00:00.000Z",
  });

  // Only mem_old should be considered, so insufficient sources
  assert.equal(result.consolidated, false);
  assert.equal(result.skippedReason, "insufficient_source_memories");
});

test("consolidate respects maxSourceMemories limit", () => {
  const store = createMockStore();
  for (let i = 0; i < 10; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "project",
      memoryLayer: "layer_3",
      taskId: "task_abc",
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_abc",
    scopes: ["project"],
    maxSourceMemories: 3,
  });

  assert.equal(result.consolidated, true);
  assert.ok(result.createdMemory !== null);
  assert.ok(result.sourceMemoryIds.length <= 3);
});

test("consolidate filters by sessionId", () => {
  const store = createMockStore();
  // Insert memories with different sessionIds
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_1", scope: "project", memoryLayer: "layer_3", sessionId: "session_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_2", scope: "project", memoryLayer: "layer_3", sessionId: "session_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_3", scope: "project", memoryLayer: "layer_3", sessionId: "session_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_4", scope: "project", memoryLayer: "layer_3", sessionId: "session_xyz",
  }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    sessionId: "session_abc",
    scopes: ["project"],
  });

  assert.equal(result.consolidated, true);
  assert.equal(result.sourceMemoryIds.length, 3);
  assert.ok(result.sourceMemoryIds.includes("mem_1"));
  assert.ok(result.sourceMemoryIds.includes("mem_2"));
  assert.ok(result.sourceMemoryIds.includes("mem_3"));
});

test("consolidate filters by agentId", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_1", scope: "project", memoryLayer: "layer_3", agentId: "agent_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_2", scope: "project", memoryLayer: "layer_3", agentId: "agent_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_3", scope: "project", memoryLayer: "layer_3", agentId: "agent_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_4", scope: "project", memoryLayer: "layer_3", agentId: "agent_xyz",
  }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    agentId: "agent_abc",
    scopes: ["project"],
  });

  assert.equal(result.consolidated, true);
  assert.equal(result.sourceMemoryIds.length, 3);
});

test("consolidate filters by executionId", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_1", scope: "project", memoryLayer: "layer_3", executionId: "exec_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_2", scope: "project", memoryLayer: "layer_3", executionId: "exec_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_3", scope: "project", memoryLayer: "layer_3", executionId: "exec_abc",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_4", scope: "project", memoryLayer: "layer_3", executionId: "exec_xyz",
  }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    executionId: "exec_abc",
    scopes: ["project"],
  });

  assert.equal(result.consolidated, true);
  assert.equal(result.sourceMemoryIds.length, 3);
});

test("consolidate filters by classifications", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_1", scope: "project", memoryLayer: "layer_3", classification: "operational",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_2", scope: "project", memoryLayer: "layer_3", classification: "operational",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_3", scope: "project", memoryLayer: "layer_3", classification: "operational",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_4", scope: "project", memoryLayer: "layer_3", classification: "internal",
  }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    scopes: ["project"],
    classifications: ["operational"],
  });

  assert.equal(result.consolidated, true);
  assert.equal(result.sourceMemoryIds.length, 3);
});

test("consolidate filters by sourceTrustLevels", () => {
  const store = createMockStore();
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_1", scope: "project", memoryLayer: "layer_3", sourceTrustLevel: "trusted",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_2", scope: "project", memoryLayer: "layer_3", sourceTrustLevel: "trusted",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_3", scope: "project", memoryLayer: "layer_3", sourceTrustLevel: "trusted",
  }));
  store.memory.insertMemory(createMockMemoryRecord({
    id: "mem_4", scope: "project", memoryLayer: "layer_3", sourceTrustLevel: "untrusted",
  }));
  const service = new MemoryService(store);

  const result = service.consolidate({
    scopes: ["project"],
    sourceTrustLevels: ["trusted"],
  });

  assert.equal(result.consolidated, true);
  assert.equal(result.sourceMemoryIds.length, 3);
});

test("consolidate uses taskId from candidates when input.taskId is null", () => {
  // When input.taskId is not provided, it should use candidates[0]?.taskId
  const store = createMockStore();
  for (let i = 0; i < 3; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "project",
      memoryLayer: "layer_3",
      sessionId: "session_boundary", // Provide sessionId for boundary
      taskId: "task_from_candidate", // Candidates have taskId
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    // No taskId provided in input - but sessionId provides boundary
    sessionId: "session_boundary",
    scopes: ["project"],
  });

  assert.equal(result.consolidated, true);
  assert.ok(result.createdMemory !== null);
  // taskId from candidates should be used when input.taskId is null
  assert.equal(result.createdMemory.taskId, "task_from_candidate");
});

test("consolidate uses distinctScopes[0] fallback for scope", () => {
  // When input.scopes is not provided but candidates have scopes
  const store = createMockStore();
  for (let i = 0; i < 3; i++) {
    store.memory.insertMemory(createMockMemoryRecord({
      id: `mem_${i}`,
      scope: "fallback_scope",
      memoryLayer: "layer_3",
      taskId: "task_boundary", // Need explicit boundary
    }));
  }
  const service = new MemoryService(store);

  const result = service.consolidate({
    taskId: "task_boundary",
    // No scopes provided - should use distinctScopes[0]
  });

  assert.equal(result.consolidated, true);
  assert.ok(result.createdMemory !== null);
  assert.equal(result.createdMemory.scope, "fallback_scope");
});

// =============================================================================
// getStore tests
// =============================================================================

test("getStore returns the underlying store", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result = service.getStore();

  assert.equal(result, store);
});
