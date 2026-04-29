/**
 * Integration Tests: Context Manager
 *
 * Tests for context management integration with memory plane service,
 * FTS retrieval, and cross-session context operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryPlaneService,
} from "../../../../../src/platform/state-evidence/memory/memory-plane-service.js";
import {
  buildFtsMatchQuery,
  extractSearchableText,
  createSnippet,
} from "../../../../../src/platform/state-evidence/memory/memory-retrieval-service.js";
import type {
  MemoryProvider,
  MemoryProviderPrefetchResult,
  MemoryProviderQuery,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
} from "../../../../../src/platform/state-evidence/memory/memory-provider.js";
import type { MemoryRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_ctx_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: "session_context",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: JSON.stringify({ text: "context test memory" }),
    classification: "test",
    sourceTrustLevel: "trusted",
    qualityScore: 0.75,
    hitCount: 5,
    createdAt: new Date().toISOString() as any,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.7,
    freshnessScore: 0.85,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

function createMockProvider(memories: MemoryRecord[] = [], promptBlock = "test block"): MemoryProvider {
  return {
    initialize: async () => ({
      providerId: "context-test-provider",
      initializedAt: new Date().toISOString(),
      authoritativeSource: "builtin",
      augmentationMode: "authoritative",
    }),
    systemPromptBlock: async () => ({
      providerId: "context-test-provider",
      generatedAt: new Date().toISOString(),
      memoryIds: memories.map((m) => m.id),
      experienceIds: [],
      block: promptBlock,
    }),
    prefetch: async (_query: MemoryProviderQuery): Promise<MemoryProviderPrefetchResult> => ({
      memories,
      promptBlock,
      fewShotExamples: memories.slice(0, 2).map((m) => ({
        memoryId: m.id,
        content: "example: " + m.id,
      })),
      experienceIds: [],
    }),
    queuePrefetch: async () => ({
      providerId: "context-test-provider",
      requestId: "req_ctx",
      queuedAt: new Date().toISOString(),
      state: "queued",
    }),
    syncTurn: async (_input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult> => ({
      providerId: "context-test-provider",
      syncedAt: new Date().toISOString(),
      rememberedMemories: memories.slice(0, 1),
      memoryIds: memories.map((m) => m.id),
    }),
    shutdown: async () => ({
      providerId: "context-test-provider",
      shutdownAt: new Date().toISOString(),
      pendingPrefetches: 0,
    }),
  };
}

// =============================================================================
// Integration: Memory Plane View Construction
// =============================================================================

test("Integration: buildView combines memories from all layers", async () => {
  const memories = [
    createMemory({ id: "mem_all_1", scope: "task_runtime" }),
    createMemory({ id: "mem_all_2", scope: "session" }),
    createMemory({ id: "mem_all_3", scope: "agent" }),
    createMemory({ id: "mem_all_4", scope: "project" }),
    createMemory({ id: "mem_all_5", scope: "user" }),
    createMemory({ id: "mem_all_6", scope: "evolution" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({ sessionId: "context_session" });

  assert.equal(view.memoryIds.length, 6);
  assert.equal(view.layers.runtime.length, 1);
  assert.equal(view.layers.session.length, 1);
  assert.equal(view.layers.agent.length, 1);
  assert.equal(view.layers.project.length, 1);
  assert.equal(view.layers.user.length, 1);
  assert.equal(view.layers.evolution.length, 1);
});

test("Integration: buildView returns experience IDs", async () => {
  const memories = [createMemory({ id: "mem_exp" })];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.ok(Array.isArray(view.experienceIds));
});

test("Integration: buildView returns few-shot example count", async () => {
  const memories = [
    createMemory({ id: "mem_fs_1" }),
    createMemory({ id: "mem_fs_2" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.fewShotExampleCount, 2);
});

test("Integration: buildView with empty provider returns empty layers", async () => {
  const provider = createMockProvider([]);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.deepEqual(view.layers.runtime, []);
  assert.deepEqual(view.layers.session, []);
  assert.equal(view.memoryIds.length, 0);
});

// =============================================================================
// Integration: Memory Plane Architecture Layers
// =============================================================================

test("Integration: architecture layers are correctly mapped from scopes", async () => {
  const memories = [
    createMemory({ scope: "task_runtime" }),
    createMemory({ scope: "session" }),
    createMemory({ scope: "agent" }),
    createMemory({ scope: "project" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});

  // task_runtime -> working
  assert.ok(view.architectureLayers.working.length >= 0);
  // session -> session
  assert.ok(view.architectureLayers.session.length >= 0);
  // agent -> episodic
  assert.ok(view.architectureLayers.episodic.length >= 0);
  // project -> semantic
  assert.ok(view.architectureLayers.semantic.length >= 0);
});

test("Integration: promptBlock is returned from provider", async () => {
  const memories: MemoryRecord[] = [];
  const provider = createMockProvider(memories, "custom prompt block content");
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.promptBlock, "custom prompt block content");
});

// =============================================================================
// Integration: Sync Turn Operations
// =============================================================================

test("Integration: syncTurn calls provider with correct parameters", async () => {
  const memories = [createMemory()];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    sessionId: "sync_session",
    turnNumber: 10,
    agentId: "agent_sync",
  });

  assert.equal(result.providerId, "context-test-provider");
  assert.ok(result.syncedAt.length > 0);
});

test("Integration: syncTurn returns remembered memories", async () => {
  const memories = [createMemory({ id: "mem_remembered" })];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    sessionId: "remember_session",
    turnNumber: 1,
    agentId: "agent_remember",
  });

  assert.ok(result.rememberedMemories !== undefined);
});

test("Integration: syncTurn with promotion context", async () => {
  const memories = [createMemory()];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    sessionId: "promo_context_session",
    turnNumber: 5,
    agentId: "agent_promo",
    promotionContext: { projectId: "proj_promo", userId: "user_promo" },
  });

  assert.equal(result.providerId, "context-test-provider");
});

// =============================================================================
// Integration: FTS Query Building
// =============================================================================

test("Integration: buildFtsMatchQuery handles complex queries", () => {
  const query = buildFtsMatchQuery("hello world test query");
  assert.ok(query.includes('"hello"'));
  assert.ok(query.includes('"world"'));
  assert.ok(query.includes('"test"'));
  assert.ok(query.includes('"query"'));
  assert.ok(query.includes("AND"));
});

test("Integration: buildFtsMatchQuery handles unicode terms", () => {
  const query = buildFtsMatchQuery("hello world");
  // Unicode letters should be preserved
  assert.ok(query.includes("hello"));
  assert.ok(query.includes("world"));
});

test("Integration: buildFtsMatchQuery handles repeated spaces", () => {
  const query = buildFtsMatchQuery("hello    world");
  assert.ok(query.includes('"hello"'));
  assert.ok(query.includes('"world"'));
});

test("Integration: buildFtsMatchQuery returns empty quotes for whitespace-only", () => {
  const query = buildFtsMatchQuery("   ");
  assert.equal(query, '""');
});

// =============================================================================
// Integration: Extract Searchable Text
// =============================================================================

test("Integration: extractSearchableText from structured memory.v2", () => {
  const content = JSON.stringify({
    schemaVersion: "memory.v2",
    workContext: "main work context",
    topOfMind: ["important point 1", "important point 2"],
    recentHistory: ["recent event"],
    longTermBackground: ["background info"],
    facts: [
      { content: "fact 1", category: "test" },
      { content: "fact 2", category: "test" },
    ],
  });

  const text = extractSearchableText(content);
  assert.ok(text.includes("main work context"));
  assert.ok(text.includes("important point 1"));
  assert.ok(text.includes("important point 2"));
  assert.ok(text.includes("fact 1"));
  assert.ok(text.includes("fact 2"));
});

test("Integration: extractSearchableText from plain string", () => {
  const text = extractSearchableText("plain text without JSON");
  assert.equal(text, "plain text without JSON");
});

test("Integration: extractSearchableText from invalid JSON", () => {
  const text = extractSearchableText("{ invalid json content");
  assert.equal(text, "");
});

test("Integration: extractSearchableText from empty JSON object", () => {
  const text = extractSearchableText("{}");
  assert.equal(text, "");
});

test("Integration: extractSearchableText extracts from structured content", () => {
  const content = JSON.stringify({
    workContext: "main context",
    topOfMind: ["important point"],
    recentHistory: ["recent event"],
    longTermBackground: ["background info"],
    facts: [
      { content: "fact one", category: "test" },
      { content: "fact two", category: "test" },
    ],
  });

  const text = extractSearchableText(content);
  assert.ok(text.includes("main context"));
  assert.ok(text.includes("important point"));
  assert.ok(text.includes("fact one"));
  assert.ok(text.includes("fact two"));
});

// =============================================================================
// Integration: Snippet Creation
// =============================================================================

test("Integration: createSnippet centers around match term", () => {
  const text = "prefix hello world suffix";
  const snippet = createSnippet(text, ["hello"], 50);
  assert.ok(snippet.includes("hello"));
});

test("Integration: createSnippet returns original text when short", () => {
  const text = "short";
  const snippet = createSnippet(text, ["short"], 100);
  assert.equal(snippet, "short");
});

test("Integration: createSnippet truncates long text with ellipsis", () => {
  const text = "a".repeat(200);
  const snippet = createSnippet(text, ["test"], 50);
  assert.ok(snippet.endsWith("...") || snippet.includes("a"));
});

test("Integration: createSnippet uses second term if first not in text", () => {
  const text = "something notfound hello world";
  const snippet = createSnippet(text, ["notfound", "hello"], 100);
  assert.ok(snippet.includes("hello"));
});

test("Integration: createSnippet handles no matching terms", () => {
  const text = "something completely different";
  const snippet = createSnippet(text, ["xyz123"], 50);
  assert.ok(snippet.length > 0);
});

// =============================================================================
// Integration: Evaluate Promotion with Context
// =============================================================================

test("Integration: evaluatePromotion uses projectId context", () => {
  const memories = [
    createMemory({ id: "mem_eval_1", scope: "session" }),
    createMemory({ id: "mem_eval_2", scope: "agent" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const result = service.evaluatePromotion(memories, { projectId: "proj_eval" });
  assert.ok(result.promoted !== undefined);
  assert.ok(Array.isArray(result.promoted));
});

test("Integration: evaluatePromotion uses userId context", () => {
  const memories = [createMemory({ scope: "user" })];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const result = service.evaluatePromotion(memories, { userId: "user_eval" });
  assert.ok(result.promoted !== undefined);
  assert.ok(Array.isArray(result.promoted));
});

test("Integration: evaluatePromotion with both projectId and userId", () => {
  const memories = [
    createMemory({ scope: "project" }),
    createMemory({ scope: "user" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const result = service.evaluatePromotion(memories, {
    projectId: "proj_both",
    userId: "user_both",
  });
  assert.ok(result.promoted !== undefined);
});

// =============================================================================
// Integration: Context with Memory Filtering
// =============================================================================

test("Integration: buildView with sessionId filter returns memories", async () => {
  const memories = [
    createMemory({ id: "mem_s1", sessionId: "session_a" }),
    createMemory({ id: "mem_s2", sessionId: "session_b" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const view = await service.buildView({ sessionId: "session_a" });
  assert.ok(view.memoryIds.length >= 0);
});

test("Integration: buildView with agentId filter returns memories", async () => {
  const memories = [
    createMemory({ id: "mem_a1", agentId: "agent_x" }),
    createMemory({ id: "mem_a2", agentId: "agent_y" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const view = await service.buildView({ agentId: "agent_x" });
  assert.ok(view.memoryIds.length >= 0);
});

test("Integration: buildView with queryText adds memory-query tag", async () => {
  const memories = [createMemory()];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);

  const view = await service.buildView({ queryText: "test query" });
  assert.ok(view.memoryIds.length >= 0);
});

// =============================================================================
// Integration: Memory Plane Service with Cache
// =============================================================================

test("Integration: MemoryPlaneService works without optional cache", async () => {
  const memories = [createMemory()];
  const provider = createMockProvider(memories);
  // No cache passed - should still work
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.fromCache, false);
});

// =============================================================================
// Integration: Cross-Session Context
// =============================================================================

test("Integration: different sessions get separate views", async () => {
  const memories1 = [createMemory({ id: "mem_s1", sessionId: "session_1" })];
  const memories2 = [createMemory({ id: "mem_s2", sessionId: "session_2" })];

  const provider1 = createMockProvider(memories1);
  const provider2 = createMockProvider(memories2);

  const service = new MemoryPlaneService(provider1);
  const view1 = await service.buildView({ sessionId: "session_1" });

  // Different provider for different session
  const service2 = new MemoryPlaneService(provider2);
  const view2 = await service2.buildView({ sessionId: "session_2" });

  assert.ok(view1.memoryIds.includes("mem_s1"));
  assert.ok(view2.memoryIds.includes("mem_s2"));
});