/**
 * Unit tests for MemoryService content hashing and size validation.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

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

test("MemoryService contentHash stores the full SHA-256 digest", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const content = "Test content for hash";
  const result = service.remember({
    scope: "project",
    content,
  });

  assert.equal(result.contentHash!.length, 64);
  assert.equal(result.contentHash, createHash("sha256").update(content).digest("hex"));
});

test("MemoryService different contents retain distinct full hashes", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result1 = service.remember({
    scope: "project",
    content: "Content pattern A with specific details here",
  });

  const result2 = service.remember({
    scope: "project",
    content: "Content pattern B with specific details here", // Only first char differs
  });

  assert.notEqual(result1.contentHash, result2.contentHash);
  assert.equal(result1.contentHash?.length, 64);
  assert.equal(result2.contentHash?.length, 64);
});

// =============================================================================
// Issue #2031: Size check uses .length (UTF-16) not byte count
// =============================================================================

test("MemoryService size check uses byte count for multibyte content - Issue #2031", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  // Create content with many emoji (multi-byte UTF-16 characters)
  // Each emoji is 2 code units in UTF-16, but .length counts them as 1
  // So content could pass length check but exceed byte limit
  const emojiContent = "a".repeat(500_000) + "👍".repeat(500_000); // ~1MB in length but ~1.5MB in bytes

  // Issue #2031: .length checks UTF-16 code units, not actual bytes
  // A string with 1M characters passes the 1M limit check, but if they are
  // multi-byte (like emoji), the actual byte size exceeds 1MB
  const charCount = emojiContent.length;
  const byteCount = Buffer.byteLength(emojiContent, 'utf8');

  // With mixed ASCII and emoji, byte count >> char count
  console.log(`Char count: ${charCount}, Byte count: ${byteCount}`);

  assert.ok(byteCount > charCount, "Emoji content has more bytes than characters");
  assert.throws(
    () => service.remember({ scope: "project", content: emojiContent }),
    /exceeds maximum of 1000000 bytes/i,
  );
});

// =============================================================================
// Additional content hash tests
// =============================================================================

test("MemoryService remember computes consistent contentHash", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result1 = service.remember({
    scope: "project",
    content: "Consistent hashing test",
  });

  const result2 = service.remember({
    scope: "project",
    content: "Consistent hashing test",
  });

  // Same content should produce same hash (deduplication)
  assert.equal(result1.contentHash, result2.contentHash);
});

test("MemoryService different content produces different hash", () => {
  const store = createMockStore();
  const service = new MemoryService(store);

  const result1 = service.remember({
    scope: "project",
    content: "First different content",
  });

  const result2 = service.remember({
    scope: "project",
    content: "Second different content",
  });

  assert.notEqual(result1.contentHash, result2.contentHash);
});
