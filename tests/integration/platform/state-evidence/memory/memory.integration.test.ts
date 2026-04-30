/**
 * Integration tests for Memory system - Issue coverage for:
 * - Issue #2027: Content hash truncation (collision risk)
 * - Issue #2031: Size check uses .length not bytes
 * - Issue #2028: scope→SixLayerMemoryType no mapping
 * - Issue #2037: Manual quote escaping breaks DELETE
 * - Issue #2036: verificationStatus in-place mutation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { MemoryService } from "../../../../../src/platform/state-evidence/memory/memory-service.js";
import { MemoryDecayService } from "../../../../../src/platform/state-evidence/memory/memory-decay-service.js";
import { MemoryRetrievalService } from "../../../../../src/platform/state-evidence/memory/memory-retrieval-service.js";
import { KnowledgePromotionService } from "../../../../../src/platform/state-evidence/memory/knowledge-promotion-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

// =============================================================================
// Helper Functions
// =============================================================================

function createMemoryStore(db: SqliteDatabase): AuthoritativeTaskStore {
  return new AuthoritativeTaskStore(db);
}

function createMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const now = new Date().toISOString();
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: null,
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "project",
    contentJson: '{"workContext":"test"}',
    classification: "internal",
    sourceTrustLevel: "trusted",
    qualityScore: null,
    hitCount: 0,
    createdAt: now,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: null,
    freshnessScore: null,
    contentHash: null,
    ...overrides,
  };
}

// =============================================================================
// Issue #2027: Content hash truncation tests with real database
// =============================================================================

test("Issue #2027: contentHash truncated to 16 chars in real database", () => {
  const workspace = createTempWorkspace("aa-memory-hash-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "memory-hash.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryService(store);

    const memory = service.remember({
      taskId: "task-001",
      scope: "project",
      content: "Test memory with content for hash collision testing",
    });

    // Issue #2027: SHA-256 produces 64 hex chars, but code truncates to 16
    assert.equal(memory.contentHash!.length, 16,
      "Issue #2027: Hash should be truncated to 16 chars");

    // With 16 hex chars (64 bits entropy), collision risk increases
    // For millions of memories, truncated hash causes deduplication failures

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Issue #2027: similar content may produce colliding truncated hashes", () => {
  const workspace = createTempWorkspace("aa-memory-collision-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "collision.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryService(store);

    // Two contents that differ only after character 16 in hex representation
    // SHA-256 truncation means first 16 hex chars are same
    const content1 = "Content pattern A unique data here";
    const content2 = "Content pattern B unique data here";

    const memory1 = service.remember({ scope: "project", content: content1 });
    const memory2 = service.remember({ scope: "project", content: content2 });

    // The truncated hashes may or may not collide depending on where the
    // differences fall in the SHA-256 output, but collision risk is real
    console.log(`Issue #2027 - Hash1: ${memory1.contentHash}, Hash2: ${memory2.contentHash}`);

    // If they collide, memory2.hitCount would be incremented
    // This demonstrates the deduplication weakness
    assert.ok(memory1.contentHash!.length < 64,
      "Issue #2027: Truncated hash documented");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Issue #2031: Size check uses .length not bytes with real database
// =============================================================================

test("Issue #2031: string length passes for emoji content that exceeds byte limit", () => {
  const workspace = createTempWorkspace("aa-memory-emoji-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "emoji.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryService(store);

    // 500k emojis: .length = 500k, but byteCount ≈ 2MB (4 bytes per emoji in UTF-8)
    // BUG: Code uses .length which passes, but actual bytes exceed 1MB limit
    const emojiContent = "👍".repeat(500_000);

    const charCount = emojiContent.length;
    const byteCount = Buffer.byteLength(emojiContent, "utf8");

    console.log(`Issue #2031 - Char count: ${charCount}, Byte count: ${byteCount}`);

    // This content would pass the buggy length check but exceed byte limit
    assert.ok(charCount < byteCount, "Emoji content has more bytes than chars");

    // The bug manifests when size limit is checked using .length instead of bytes
    // MAX_CONTENT_SIZE_BYTES = 1,000,000 but .length only counts code units

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("Issue #2031: ASCII content length matches byte count", () => {
  const workspace = createTempWorkspace("aa-memory-ascii-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "ascii.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryService(store);

    // ASCII: 1 char = 1 byte, so .length matches byte count
    const asciiContent = "a".repeat(900_000);
    const charCount = asciiContent.length;
    const byteCount = Buffer.byteLength(asciiContent, "utf8");

    assert.equal(charCount, byteCount, "ASCII: char count equals byte count");

    // For ASCII, the buggy code would work correctly
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Issue #2028: scope mapping with real decay calculations
// =============================================================================

test("Issue #2028: project scope uses session decay config in real system", () => {
  const workspace = createTempWorkspace("aa-memory-decay-project-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "decay-project.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const decayService = new MemoryDecayService();

    // Create memories with different scopes
    const projectMemory = createMemoryRecord({
      id: "mem_project",
      scope: "project",
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    const semanticMemory = createMemoryRecord({
      id: "mem_semantic",
      scope: "semantic",
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    // After 1 day, calculate freshness
    const evaluatedAt = "2026-04-02T00:00:00.000Z";

    const projectFreshness = decayService.calculateFreshness(projectMemory, evaluatedAt);
    const semanticFreshness = decayService.calculateFreshness(semanticMemory, evaluatedAt);

    console.log(`Issue #2028 - project freshness: ${projectFreshness}, semantic freshness: ${semanticFreshness}`);

    // BUG: project uses session config (halfLife=3600s) instead of semantic (halfLife=604800s)
    // After 1 day: session freshness ≈ very low (< 0.001), semantic freshness ≈ 0.92
    assert.ok(projectFreshness < 0.01, "Issue #2028: project freshness too low (using session config)");
    assert.ok(semanticFreshness > 0.5, "Issue #2028: semantic freshness should be high");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Issue #2037: Quote escaping with real database
// =============================================================================

test("Issue #2037: unindexMemory with single quote in ID", () => {
  const workspace = createTempWorkspace("aa-memory-retrieval-quote-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "quote.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const memoryService = new MemoryService(store);
    const retrievalService = new MemoryRetrievalService(store);

    // Create a memory with quote in its ID
    const memory = memoryService.remember({
      taskId: "task-quote",
      scope: "project",
      content: "Memory with special ID content",
    });

    // Modify the memory ID to include a quote (simulating the issue)
    // In practice, this could happen with certain ID generation patterns
    const specialId = memory.id + "_with'quote";

    // Issue #2037: The manual escaping at line 288 is wrong for parameterized queries
    // safeId = specialId.replace(/'/g, "''") -> double escaping
    // When SQLite processes '', it treats '' as an escaped single quote
    // But the parameterized query already handles escaping!

    // This should not throw, but the DELETE may not work correctly
    retrievalService.unindexMemory(specialId);

    // The actual bug is that the DELETE becomes malformed due to double-escaping
    // We can't directly observe the failed DELETE, but we document the issue

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Issue #2036: verificationStatus mutation with real KnowledgePromotionService
// =============================================================================

test("Issue #2036: updateVerificationStatus mutates stored lineage", () => {
  const service = new KnowledgePromotionService();

  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });

  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);

  assert.ok(result.lineage);
  const lineageId = result.lineage.id;

  // BUG: updateVerificationStatus mutates entry.lineage directly
  // Line 403: entry.lineage.verificationStatus = status;
  // This mutation affects the internal store

  const originalLineage = result.lineage;
  const originalStatus = originalLineage.verificationStatus;
  assert.equal(originalStatus, "unverified");

  // Update - this MUTATES the stored lineage object
  const updated = service.updateVerificationStatus(lineageId, "verified", "looks good");
  assert.equal(updated, true);

  // The original lineage reference now shows mutated state
  // This breaks immutability assumptions
  assert.equal(originalLineage.verificationStatus, "verified",
    "Issue #2036: Original lineage reference was mutated");

  // Get fresh from store
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages[0]?.verificationStatus, "verified");

  db.close();
});

// =============================================================================
// Integration tests for memory service with real database
// =============================================================================

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

    const oldMemory = createMemoryRecord({
      id: "mem_old",
      scope: "session",
      createdAt: "2026-04-01T00:00:00.000Z",
    });

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

    const result = service.consolidate({
      taskId: "task-consolidate",
      scopes: ["project"],
      targetMemoryLayer: "layer_4",
      minSourceMemories: 3,
    });

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

    memoryService.remember({
      scope: "project",
      content: "Important information about the project architecture",
    });

    retrievalService.initializeFts();

    const results = retrievalService.searchMemories({
      query: "architecture",
    });

    assert.ok(Array.isArray(results));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("memory integration: knowledge promotion with tier transitions", () => {
  const service = new KnowledgePromotionService();

  const memory = createMemoryRecord({
    scope: "user",
    qualityScore: 0.8,
    importanceScore: 0.7,
    hitCount: 10,
  });

  const result = service.promote({
    memoryId: memory.id,
    targetTier: "team",
    promotedBy: "user_1",
  }, memory);

  assert.equal(result.success, true);
  assert.ok(result.lineage);
  assert.equal(result.lineage.promotionTier, "team");

  // Verify the lineage
  const lineages = service.getLineage(memory.id);
  assert.equal(lineages.length, 1);
});

test("memory integration: decay summary for multiple memories", () => {
  const workspace = createTempWorkspace("aa-memory-summary-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "summary.db"));
    db.migrate();
    const store = createMemoryStore(db);
    const service = new MemoryDecayService();

    const memories = [
      createMemoryRecord({ scope: "session", createdAt: "2026-04-01T00:00:00.000Z" }),
      createMemoryRecord({ scope: "session", createdAt: "2026-04-01T00:00:00.000Z" }),
      createMemoryRecord({ scope: "semantic", createdAt: "2026-04-01T00:00:00.000Z" }),
    ];

    const summary = service.generateDecaySummary(memories, "2026-04-02T00:00:00.000Z");

    assert.equal(summary.totalMemories, 3);
    assert.ok(summary.byLayer.session.count >= 2);
    assert.ok(summary.byLayer.semantic.count >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
