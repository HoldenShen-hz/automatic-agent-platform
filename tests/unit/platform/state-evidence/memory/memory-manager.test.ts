import assert from "node:assert/strict";
import test from "node:test";

import { MemoryPlaneService, type MemoryPlaneView } from "../../../../../src/platform/state-evidence/memory/memory-plane-service.js";
import type {
  MemoryProvider,
  MemoryProviderPrefetchResult,
  MemoryProviderQuery,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
} from "../../../../../src/platform/state-evidence/memory/memory-provider.js";
import type { CacheOrchestrationService } from "../../../../../src/platform/shared/cache/cache-orchestration-service.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

// =============================================================================
// Mock Factories
// =============================================================================

function createMockMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_test123",
    taskId: "task_abc",
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

function createMockProvider(): MemoryProvider {
  return {
    initialize: async () => ({
      providerId: "test-provider",
      initializedAt: "2026-04-01T00:00:00.000Z",
      authoritativeSource: "builtin",
      augmentationMode: "authoritative",
    }),
    systemPromptBlock: async () => ({
      providerId: "test-provider",
      generatedAt: "2026-04-01T00:00:00.000Z",
      memoryIds: [],
      experienceIds: [],
      block: "",
    }),
    prefetch: async (_query: MemoryProviderQuery) => createMockPrefetchResult(),
    queuePrefetch: async () => ({
      providerId: "test-provider",
      requestId: "req_123",
      queuedAt: "2026-04-01T00:00:00.000Z",
      state: "queued",
    }),
    syncTurn: async () => createMockSyncResult(),
    shutdown: async () => ({
      providerId: "test-provider",
      shutdownAt: "2026-04-01T00:00:00.000Z",
      pendingPrefetches: 0,
    }),
  };
}

function createMockPrefetchResult(overrides: Partial<MemoryProviderPrefetchResult> = {}): MemoryProviderPrefetchResult {
  return {
    providerId: "test-provider",
    requestId: "req_123",
    generatedAt: "2026-04-01T00:00:00.000Z",
    degraded: false,
    queued: false,
    query: {},
    memories: [createMockMemoryRecord()],
    fewShotExamples: [],
    experienceIds: [],
    promptBlock: "Test prompt block",
    ...overrides,
  };
}

function createMockSyncResult(overrides: Partial<MemoryTurnSyncResult> = {}): MemoryTurnSyncResult {
  return {
    providerId: "test-provider",
    syncedAt: "2026-04-01T00:00:00.000Z",
    rememberedMemoryIds: [],
    recordedExperienceId: null,
    ...overrides,
  };
}

// =============================================================================
// Constructor Tests
// =============================================================================

test("MemoryManager accepts provider only", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);
  assert.ok(service !== undefined);
});

test("MemoryManager accepts provider and cache", () => {
  const provider = createMockProvider();
  const cacheMock = {
    getOrComputeMemoryRetrieval: async (
      _query: unknown,
      loader: () => Promise<MemoryProviderPrefetchResult>,
      _tags: string[],
    ) => {
      const result = await loader();
      return { value: result, fromCache: false };
    },
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);
  assert.ok(service !== undefined);
});

test("MemoryManager uses default promotion engine when not provided", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);
  const result = service.evaluatePromotion([]);
  assert.ok(result !== undefined);
});

// =============================================================================
// buildView Layer Categorization Tests
// =============================================================================

test("buildView categorizes task_runtime scope into runtime layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "task_runtime" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.runtime.length, 1);
  assert.equal(result.layers.session.length, 0);
  assert.equal(result.layers.agent.length, 0);
  assert.equal(result.layers.project.length, 0);
  assert.equal(result.layers.user.length, 0);
  assert.equal(result.layers.evolution.length, 0);
});

test("buildView categorizes session scope into session layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "session" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.session.length, 1);
  assert.equal(result.layers.runtime.length, 0);
});

test("buildView categorizes agent scope into agent layer and episodic architecture layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "agent" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.agent.length, 1);
  assert.equal(result.architectureLayers.episodic.length, 1);
});

test("buildView categorizes workspace scope into project layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "workspace" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.project.length, 1);
  assert.equal(result.architectureLayers.semantic.length, 1);
});

test("buildView categorizes project scope into project layer and semantic architecture layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "project" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.project.length, 1);
  assert.equal(result.architectureLayers.semantic.length, 1);
});

test("buildView categorizes user scope into user layer and procedural architecture layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "user" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.user.length, 1);
  assert.equal(result.architectureLayers.procedural.length, 1);
});

test("buildView categorizes evolution scope into evolution layer and meta architecture layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "evolution" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.evolution.length, 1);
  assert.equal(result.architectureLayers.meta.length, 1);
});

test("buildView categorizes experience scope into evolution layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "experience" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.evolution.length, 1);
});

test("buildView maps unknown scope to project layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "unknown_scope" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.project.length, 1);
});

// =============================================================================
// buildView Return Value Tests
// =============================================================================

test("buildView includes promptBlock from prefetch result", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.promptBlock, "Test prompt block");
});

test("buildView includes memoryIds from prefetch result", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ id: "mem_abc" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.deepEqual(result.memoryIds, ["mem_abc"]);
});

test("buildView includes experienceIds from prefetch result", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ experienceIds: ["exp_1", "exp_2"] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.deepEqual(result.experienceIds, ["exp_1", "exp_2"]);
});

test("buildView sets fromCache to false when cache is not provided", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.fromCache, false);
});

test("buildView sets fewShotExampleCount correctly", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({
      fewShotExamples: [
        { taskContext: "ctx1", taskIntent: "intent1", approach: "approach1", toolsUsed: ["tool1"], outcome: "succeeded" as const, reasoning: null },
        { taskContext: "ctx2", taskIntent: "intent2", approach: "approach2", toolsUsed: ["tool2"], outcome: "succeeded" as const, reasoning: null },
        { taskContext: "ctx3", taskIntent: "intent3", approach: "approach3", toolsUsed: ["tool3"], outcome: "succeeded" as const, reasoning: null },
      ],
    });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.fewShotExampleCount, 3);
});

test("buildView categorizes multiple memories into correct layers", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({
      memories: [
        createMockMemoryRecord({ id: "mem_1", scope: "task_runtime" }),
        createMockMemoryRecord({ id: "mem_2", scope: "session" }),
        createMockMemoryRecord({ id: "mem_3", scope: "agent" }),
        createMockMemoryRecord({ id: "mem_4", scope: "project" }),
        createMockMemoryRecord({ id: "mem_5", scope: "user" }),
      ],
    });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.runtime.length, 1);
  assert.equal(result.layers.session.length, 1);
  assert.equal(result.layers.agent.length, 1);
  assert.equal(result.layers.project.length, 1);
  assert.equal(result.layers.user.length, 1);
  assert.equal(result.layers.evolution.length, 0);
});

test("buildView returns empty layers for empty memories", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.layers.runtime.length, 0);
  assert.equal(result.layers.session.length, 0);
  assert.equal(result.layers.agent.length, 0);
  assert.equal(result.layers.project.length, 0);
  assert.equal(result.layers.user.length, 0);
  assert.equal(result.layers.evolution.length, 0);
});

// =============================================================================
// buildView with Cache Tests
// =============================================================================

test("buildView uses cache when provided and returns fromCache true", async () => {
  const provider = createMockProvider();
  const cacheMock = {
    getOrComputeMemoryRetrieval: async (
      _query: unknown,
      loader: () => Promise<MemoryProviderPrefetchResult>,
      _tags: string[],
    ) => {
      const result = await loader();
      return { value: result, fromCache: true };
    },
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.fromCache, true);
});

test("buildView returns cached memories when available", async () => {
  const provider = createMockProvider();
  const cachedMemories = [createMockMemoryRecord({ id: "mem_cached" })];
  const cacheMock = {
    getOrComputeMemoryRetrieval: async () => ({
      value: createMockPrefetchResult({ memories: cachedMemories }),
      fromCache: true,
    }),
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.fromCache, true);
  assert.deepEqual(result.memoryIds, ["mem_cached"]);
});

test("buildView includes queryText in cache tags when provided", async () => {
  const provider = createMockProvider();
  let capturedTags: string[] = [];
  const cacheMock = {
    getOrComputeMemoryRetrieval: async (
      _query: unknown,
      _loader: () => Promise<MemoryProviderPrefetchResult>,
      tags: string[],
    ) => {
      capturedTags = tags;
      return { value: createMockPrefetchResult(), fromCache: false };
    },
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  await service.buildView({ sessionId: "session_1", queryText: "search term" });

  assert.ok(capturedTags.includes("memory-query:search term"));
});

test("buildView includes sessionId in cache tags when provided", async () => {
  const provider = createMockProvider();
  let capturedTags: string[] = [];
  const cacheMock = {
    getOrComputeMemoryRetrieval: async (
      _query: unknown,
      _loader: () => Promise<MemoryProviderPrefetchResult>,
      tags: string[],
    ) => {
      capturedTags = tags;
      return { value: createMockPrefetchResult(), fromCache: false };
    },
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  await service.buildView({ sessionId: "session_abc" });

  assert.ok(capturedTags.includes("session:session_abc"));
});

test("buildView includes agentId in cache tags when provided", async () => {
  const provider = createMockProvider();
  let capturedTags: string[] = [];
  const cacheMock = {
    getOrComputeMemoryRetrieval: async (
      _query: unknown,
      _loader: () => Promise<MemoryProviderPrefetchResult>,
      tags: string[],
    ) => {
      capturedTags = tags;
      return { value: createMockPrefetchResult(), fromCache: false };
    },
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  await service.buildView({ sessionId: "session_1", agentId: "agent_xyz" });

  assert.ok(capturedTags.includes("agent:agent_xyz"));
});

// =============================================================================
// syncTurn Tests
// =============================================================================

test("syncTurn calls provider.syncTurn with input", async () => {
  let syncCalled = false;
  const provider = createMockProvider();
  (provider as any).syncTurn = async (input: MemoryTurnSyncInput) => {
    syncCalled = true;
    return createMockSyncResult();
  };
  const service = new MemoryPlaneService(provider);

  await service.syncTurn({ memories: [], experience: null });

  assert.ok(syncCalled);
});

test("syncTurn returns rememberedMemories when present", async () => {
  const rememberedMemories = [createMockMemoryRecord({ id: "mem_remembered" })];
  const provider = createMockProvider();
  (provider as any).syncTurn = async () =>
    createMockSyncResult({ rememberedMemoryIds: ["mem_remembered"], rememberedMemories });

  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({ memories: [], experience: null });

  assert.deepEqual(result.rememberedMemories, rememberedMemories);
});

test("syncTurn returns result unchanged when no remembered memories", async () => {
  const provider = createMockProvider();
  (provider as any).syncTurn = async () =>
    createMockSyncResult({ rememberedMemoryIds: [] });

  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({ memories: [], experience: null });

  assert.equal(result.rememberedMemoryIds.length, 0);
});

test("syncTurn passes promotion context to provider", async () => {
  let capturedContext: any;
  const provider = createMockProvider();
  (provider as any).syncTurn = async (input: MemoryTurnSyncInput) => {
    capturedContext = input.promotionContext;
    return createMockSyncResult();
  };
  const service = new MemoryPlaneService(provider);
  const context = { projectId: "proj_123", userId: "user_456" };

  await service.syncTurn({ memories: [], experience: null, promotionContext: context });

  assert.deepEqual(capturedContext, context);
});

test("syncTurn does not call promotion engine when no remembered memories", async () => {
  const provider = createMockProvider();
  (provider as any).syncTurn = async () =>
    createMockSyncResult({ rememberedMemoryIds: [] });

  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({ memories: [], experience: null });

  // Result should have empty remembered memories
  assert.equal(result.rememberedMemoryIds.length, 0);
  assert.equal(result.rememberedMemories, undefined);
});

test("syncTurn handles null experience gracefully", async () => {
  const provider = createMockProvider();
  (provider as any).syncTurn = async () =>
    createMockSyncResult({ rememberedMemoryIds: ["mem_1"] });

  const service = new MemoryPlaneService(provider);
  const result = await service.syncTurn({ memories: [], experience: null });

  assert.deepEqual(result.rememberedMemoryIds, ["mem_1"]);
});

// =============================================================================
// evaluatePromotion Tests
// =============================================================================

test("evaluatePromotion returns promotion result with promoted and rejected arrays", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const memories = [createMockMemoryRecord({ scope: "session", hitCount: 5, qualityScore: 0.7, importanceScore: 0.6 })];
  const result = service.evaluatePromotion(memories, { projectId: "proj_123" });

  assert.ok(Array.isArray(result.promoted));
  assert.ok(Array.isArray(result.rejected));
});

test("evaluatePromotion works with empty memories array", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = service.evaluatePromotion([], { projectId: "proj_123" });

  assert.ok(Array.isArray(result.promoted));
  assert.ok(Array.isArray(result.rejected));
  assert.equal(result.promoted.length, 0);
});

test("evaluatePromotion works with undefined context", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const memories = [createMockMemoryRecord()];
  const result = service.evaluatePromotion(memories);

  assert.ok(result !== undefined);
});

test("evaluatePromotion works with empty context", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const memories = [createMockMemoryRecord()];
  const result = service.evaluatePromotion(memories, {});

  assert.ok(result !== undefined);
});

test("evaluatePromotion returns project entries when context has projectId", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  // Memory with enough hits and scores to be promoted to project layer
  const memories = [createMockMemoryRecord({
    scope: "agent",
    hitCount: 10,
    qualityScore: 0.8,
    importanceScore: 0.7,
  })];
  const result = service.evaluatePromotion(memories, { projectId: "proj_promote" });

  assert.ok(result !== undefined);
  // The promotion engine may or may not promote depending on rules
  assert.ok(Array.isArray(result.projectEntries));
});

test("evaluatePromotion returns user entries when context has userId", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  // Memory with enough hits and scores to potentially be promoted
  const memories = [createMockMemoryRecord({
    scope: "project",
    hitCount: 15,
    qualityScore: 0.85,
    importanceScore: 0.8,
  })];
  const result = service.evaluatePromotion(memories, { userId: "user_promote" });

  assert.ok(result !== undefined);
  assert.ok(Array.isArray(result.userEntries));
});

// =============================================================================
// Architecture Layer Mapping Tests
// =============================================================================

test("buildView maps runtime to working architecture layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "task_runtime" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.architectureLayers.working.length, 1);
  assert.equal(result.architectureLayers.session.length, 0);
});

test("buildView maps session scope to session architecture layer", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "session" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  assert.equal(result.architectureLayers.session.length, 1);
});

test("buildView populates all architecture layers in result", async () => {
  const provider = createMockProvider();
  (provider as any).prefetch = async () =>
    createMockPrefetchResult({ memories: [createMockMemoryRecord({ scope: "project" })] });

  const service = new MemoryPlaneService(provider);
  const result = await service.buildView({ sessionId: "session_1" });

  // Verify all architecture layers exist
  assert.ok(result.architectureLayers.working !== undefined);
  assert.ok(result.architectureLayers.session !== undefined);
  assert.ok(result.architectureLayers.episodic !== undefined);
  assert.ok(result.architectureLayers.semantic !== undefined);
  assert.ok(result.architectureLayers.procedural !== undefined);
  assert.ok(result.architectureLayers.meta !== undefined);
});
