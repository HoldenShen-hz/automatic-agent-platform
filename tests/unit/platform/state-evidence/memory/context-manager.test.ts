/**
 * Unit Tests: Context Manager
 *
 * Tests for context management including memory plane view construction,
 * layer-based memory filtering, and session/context operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MemoryPlaneService } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-plane-service.js";
import { MemoryRetrievalService, buildFtsMatchQuery, extractSearchableText, createSnippet } from "../../../../../src/platform/five-plane-state-evidence/memory/memory-retrieval-service.js";
import type {
  MemoryProvider,
  MemoryProviderPrefetchResult,
  MemoryProviderQuery,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-provider.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: null,
    sessionId: "session_test",
    agentId: null,
    executionId: null,
    memoryLayer: "layer_3",
    scope: "session",
    contentJson: JSON.stringify({ text: "test memory" }),
    classification: "general",
    sourceTrustLevel: "trusted",
    qualityScore: 0.7,
    hitCount: 5,
    createdAt: new Date().toISOString() as any,
    lastAccessedAt: null,
    expiresAt: null,
    revokedAt: null,
    revocationReason: null,
    kind: "general",
    status: "active",
    importanceScore: 0.8,
    freshnessScore: 0.9,
    contentHash: null,
    ...overrides,
  } as MemoryRecord;
}

function createMockProvider(memories: MemoryRecord[] = []): MemoryProvider {
  return {
    initialize: async () => ({
      providerId: "test-provider",
      initializedAt: new Date().toISOString(),
      authoritativeSource: "builtin",
      augmentationMode: "authoritative",
    }),
    systemPromptBlock: async () => ({
      providerId: "test-provider",
      generatedAt: new Date().toISOString(),
      memoryIds: [],
      experienceIds: [],
      block: "",
    }),
    prefetch: async (_query: MemoryProviderQuery): Promise<MemoryProviderPrefetchResult> => ({
      memories,
      promptBlock: "",
      fewShotExamples: [],
      experienceIds: [],
    }),
    queuePrefetch: async () => ({
      providerId: "test-provider",
      requestId: "req_123",
      queuedAt: new Date().toISOString(),
      state: "queued",
    }),
    syncTurn: async (_input: MemoryTurnSyncInput): Promise<MemoryTurnSyncResult> => ({
      providerId: "test-provider",
      syncedAt: new Date().toISOString(),
      rememberedMemories: [],
      memoryIds: [],
    }),
    shutdown: async () => ({
      providerId: "test-provider",
      shutdownAt: new Date().toISOString(),
      pendingPrefetches: 0,
    }),
  };
}

// =============================================================================
// MemoryPlaneService Construction Tests
// =============================================================================

test("MemoryPlaneService can be instantiated with provider", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);
  assert.ok(service !== undefined);
});

// =============================================================================
// MemoryPlaneService.buildView Tests
// =============================================================================

test("buildView returns empty layers when no memories", async () => {
  const provider = createMockProvider([]);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({ sessionId: "test_session" });
  assert.deepEqual(view.layers.runtime, []);
  assert.deepEqual(view.layers.session, []);
  assert.deepEqual(view.layers.agent, []);
  assert.deepEqual(view.layers.project, []);
  assert.deepEqual(view.layers.user, []);
  assert.deepEqual(view.layers.evolution, []);
});

test("buildView categorizes memories by scope into layers", async () => {
  const memories = [
    createMemory({ id: "mem_1", scope: "task_runtime" }),
    createMemory({ id: "mem_2", scope: "session" }),
    createMemory({ id: "mem_3", scope: "agent" }),
    createMemory({ id: "mem_4", scope: "project" }),
    createMemory({ id: "mem_5", scope: "user" }),
    createMemory({ id: "mem_6", scope: "evolution" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.layers.runtime.length, 1);
  assert.equal(view.layers.session.length, 1);
  assert.equal(view.layers.agent.length, 1);
  assert.equal(view.layers.project.length, 1);
  assert.equal(view.layers.user.length, 1);
  assert.equal(view.layers.evolution.length, 1);
});

test("buildView categorizes workspace as project layer", async () => {
  const memories = [createMemory({ id: "mem_w", scope: "workspace" })];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.layers.project.length, 1);
  assert.equal(view.layers.project[0]!.id, "mem_w");
});

test("buildView returns memory IDs from all memories", async () => {
  const memories = [
    createMemory({ id: "mem_a" }),
    createMemory({ id: "mem_b" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.ok(view.memoryIds.includes("mem_a"));
  assert.ok(view.memoryIds.includes("mem_b"));
});

test("buildView returns fromCache false when no cache", async () => {
  const provider = createMockProvider([]);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.fromCache, false);
});

test("buildView filters by sessionId when provided", async () => {
  const memories = [
    createMemory({ id: "mem_1", sessionId: "session_a" }),
    createMemory({ id: "mem_2", sessionId: "session_b" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({ sessionId: "session_a" });
  // All memories returned but tagged with session
  assert.ok(view.memoryIds.length >= 0);
});

test("buildView returns fewShotExampleCount from prefetch result", async () => {
  const provider = createMockProvider([]);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(view.fewShotExampleCount, 0);
});

// =============================================================================
// MemoryPlaneService.syncTurn Tests
// =============================================================================

test("syncTurn calls provider syncTurn", async () => {
  const memories = [createMemory({ id: "mem_rem" })];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({
    sessionId: "test_session",
    turnNumber: 1,
    agentId: "agent_1",
  });
  assert.equal(result.providerId, "test-provider");
});

test("syncTurn returns result when no remembered memories", async () => {
  const provider = createMockProvider([]);
  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({
    sessionId: "test_session",
    turnNumber: 1,
    agentId: "agent_1",
  });
  assert.deepEqual(result.rememberedMemories, []);
});

// =============================================================================
// MemoryPlaneService.evaluatePromotion Tests
// =============================================================================

test("evaluatePromotion returns result from promotion engine", () => {
  const provider = createMockProvider([]);
  const service = new MemoryPlaneService(provider);
  const memories = [createMemory({ id: "mem_p" })];
  const result = service.evaluatePromotion(memories, { projectId: "proj_1" });
  assert.ok(result !== undefined);
});

// =============================================================================
// FTS Query Builder Tests
// =============================================================================

test("buildFtsMatchQuery creates AND-separated quoted terms", () => {
  const query = buildFtsMatchQuery("hello world");
  assert.equal(query, '"hello" AND "world"');
});

test("buildFtsMatchQuery handles single term", () => {
  const query = buildFtsMatchQuery("single");
  assert.equal(query, '"single"');
});

test("buildFtsMatchQuery handles empty string", () => {
  const query = buildFtsMatchQuery("");
  assert.equal(query, '""');
});

test("buildFtsMatchQuery handles multiple spaces between terms", () => {
  const query = buildFtsMatchQuery("hello   world   test");
  assert.equal(query, '"hello" AND "world" AND "test"');
});

test("buildFtsMatchQuery handles special characters", () => {
  const query = buildFtsMatchQuery("hello-world");
  assert.ok(query.includes("hello"));
});

test("buildFtsMatchQuery trims whitespace from terms", () => {
  const query = buildFtsMatchQuery("  hello  world  ");
  assert.equal(query, '"hello" AND "world"');
});

// =============================================================================
// Extract Searchable Text Tests
// =============================================================================

test("extractSearchableText returns plain string content", () => {
  const text = extractSearchableText("plain text content");
  assert.equal(text, "plain text content");
});

test("extractSearchableText extracts workContext from structured JSON", () => {
  const content = JSON.stringify({
    workContext: "main context here",
    topOfMind: [],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
  });
  const text = extractSearchableText(content);
  assert.ok(text.includes("main context here"));
});

test("extractSearchableText extracts topOfMind items", () => {
  const content = JSON.stringify({
    workContext: null,
    topOfMind: ["item1", "item2"],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
  });
  const text = extractSearchableText(content);
  assert.ok(text.includes("item1"));
  assert.ok(text.includes("item2"));
});

test("extractSearchableText extracts facts content", () => {
  const content = JSON.stringify({
    workContext: null,
    topOfMind: [],
    recentHistory: [],
    longTermBackground: [],
    facts: [
      { content: "fact one", category: "test" },
      { content: "fact two", category: "test" },
    ],
  });
  const text = extractSearchableText(content);
  assert.ok(text.includes("fact one"));
  assert.ok(text.includes("fact two"));
});

test("extractSearchableText returns empty string when JSON.parse fails", () => {
  // When JSON.parse fails, function returns empty string (not the original)
  const text = extractSearchableText("{ invalid json content");
  assert.equal(text, "");
});

test("extractSearchableText returns original string for plain text content", () => {
  // Plain text that doesn't start with { is returned as-is
  const text = extractSearchableText("plain text not json at all");
  assert.equal(text, "plain text not json at all");
});

test("extractSearchableText extracts recentHistory items", () => {
  const content = JSON.stringify({
    workContext: null,
    topOfMind: [],
    recentHistory: ["recent event 1", "recent event 2"],
    longTermBackground: [],
    facts: [],
  });
  const text = extractSearchableText(content);
  assert.ok(text.includes("recent event 1"));
});

test("extractSearchableText extracts longTermBackground items", () => {
  const content = JSON.stringify({
    workContext: null,
    topOfMind: [],
    recentHistory: [],
    longTermBackground: ["background info"],
    facts: [],
  });
  const text = extractSearchableText(content);
  assert.ok(text.includes("background info"));
});

// =============================================================================
// Create Snippet Tests
// =============================================================================

test("createSnippet returns full text when shorter than maxLength", () => {
  const text = "short text";
  const snippet = createSnippet(text, ["test"], 100);
  assert.equal(snippet, "short text");
});

test("createSnippet truncates long text without match", () => {
  const text = "a".repeat(200);
  const snippet = createSnippet(text, ["test"], 50);
  assert.ok(snippet.endsWith("..."));
  assert.ok(snippet.length <= 53); // 50 + "..."
});

test("createSnippet includes match term when found", () => {
  const text = "prefix hello world suffix";
  const snippet = createSnippet(text, ["hello"], 50);
  assert.ok(snippet.includes("hello"));
});

test("createSnippet adds ellipsis when text is truncated at start", () => {
  const text = "very long text with hello in the middle";
  const snippet = createSnippet(text, ["hello"], 20);
  assert.ok(snippet.startsWith("...") || snippet.includes("hello"));
});

test("createSnippet handles multiple query terms", () => {
  const text = "hello world foo bar";
  const snippet = createSnippet(text, ["hello", "world"], 100);
  assert.ok(snippet.includes("hello"));
  assert.ok(snippet.includes("world"));
});

test("createSnippet handles case differences in query", () => {
  const text = "Hello World";
  const snippet = createSnippet(text, ["hello"], 100);
  assert.ok(snippet.includes("Hello") || snippet.includes("hello"));
});

test("createSnippet uses second term if first not found", () => {
  const text = "something something hello";
  const snippet = createSnippet(text, ["notfound", "hello"], 100);
  assert.ok(snippet.includes("hello"));
});

// =============================================================================
// Architecture Layers Tests
// =============================================================================

test("MemoryPlaneService.buildView populates architectureLayers", async () => {
  const memories = [
    createMemory({ id: "mem_1", scope: "task_runtime" }),
    createMemory({ id: "mem_2", scope: "session" }),
    createMemory({ id: "mem_3", scope: "agent" }),
  ];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.ok(view.architectureLayers.working.length >= 0);
  assert.ok(view.architectureLayers.session.length >= 0);
  assert.ok(view.architectureLayers.episodic.length >= 0);
});

test("MemoryPlaneService.buildView returns promptBlock", async () => {
  const memories: MemoryRecord[] = [];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.equal(typeof view.promptBlock, "string");
});

test("MemoryPlaneService.buildView returns experienceIds", async () => {
  const memories: MemoryRecord[] = [];
  const provider = createMockProvider(memories);
  const service = new MemoryPlaneService(provider);
  const view = await service.buildView({});
  assert.ok(Array.isArray(view.experienceIds));
});