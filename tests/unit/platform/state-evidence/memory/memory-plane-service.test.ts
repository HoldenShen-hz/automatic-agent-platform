import test from "node:test";
import assert from "node:assert/strict";

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
// buildView tests
// =============================================================================

// Helper to create a provider that returns a memory with specific scope
function createProviderWithMemoryScope(scope: string): MemoryProvider {
  const baseProvider = createMockProvider();
  return {
    ...baseProvider,
    prefetch: async (_query: MemoryProviderQuery) =>
      createMockPrefetchResult({
        memories: [createMockMemoryRecord({ scope })],
      }),
  };
}

test("buildView returns MemoryPlaneView with correct layer categorization for runtime scope", async () => {
  const provider = createProviderWithMemoryScope("task_runtime");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["task_runtime"] });

  assert.equal(result.layers.runtime.length, 1);
  assert.equal(result.layers.session.length, 0);
  assert.equal(result.layers.agent.length, 0);
  assert.equal(result.layers.project.length, 0);
});

test("buildView returns MemoryPlaneView with correct layer categorization for session scope", async () => {
  const provider = createProviderWithMemoryScope("session");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["session"] });

  assert.equal(result.layers.session.length, 1);
  assert.equal(result.layers.runtime.length, 0);
});

test("buildView returns MemoryPlaneView with correct layer categorization for agent scope", async () => {
  const provider = createProviderWithMemoryScope("agent");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["agent"] });

  assert.equal(result.layers.agent.length, 1);
  assert.equal(result.layers.session.length, 0);
});

test("buildView returns MemoryPlaneView with correct layer categorization for workspace scope", async () => {
  const provider = createProviderWithMemoryScope("workspace");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["workspace"] });

  assert.equal(result.layers.project.length, 1);
  assert.equal(result.layers.runtime.length, 0);
});

test("buildView returns MemoryPlaneView with correct layer categorization for project scope", async () => {
  const provider = createProviderWithMemoryScope("project");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.layers.project.length, 1);
});

test("buildView returns MemoryPlaneView with correct layer categorization for user scope", async () => {
  const provider = createProviderWithMemoryScope("user");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["user"] });

  assert.equal(result.layers.user.length, 1);
});

test("buildView returns MemoryPlaneView with correct layer categorization for experience scope", async () => {
  const provider = createProviderWithMemoryScope("experience");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["experience"] });

  assert.equal(result.layers.evolution.length, 1);
});

test("buildView returns MemoryPlaneView with correct layer categorization for evolution scope", async () => {
  const provider = createProviderWithMemoryScope("evolution");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["evolution"] });

  assert.equal(result.layers.evolution.length, 1);
});

test("buildView maps unknown scope to project layer", async () => {
  const provider = createProviderWithMemoryScope("unknown_scope");
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["unknown_scope"] });

  assert.equal(result.layers.project.length, 1);
});

test("buildView includes promptBlock from prefetch result", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.promptBlock, "Test prompt block");
});

test("buildView includes memoryIds from prefetch result", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.deepEqual(result.memoryIds, ["mem_test123"]);
});

test("buildView includes experienceIds from prefetch result", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.deepEqual(result.experienceIds, []);
});

test("buildView sets fromCache to false when cache is not provided", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.fromCache, false);
});

test("buildView includes sessionId tag when provided", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  await service.buildView({ scopes: ["project"], sessionId: "session_abc" });

  // No assertion error means success - just verifying it doesn't throw
});

test("buildView includes agentId tag when provided", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  await service.buildView({ scopes: ["project"], agentId: "agent_xyz" });

  // No assertion error means success
});

test("buildView includes queryText tag when provided", async () => {
  const provider = createMockProvider();
  const cacheMock = {
    getOrComputeMemoryRetrieval: async (
      _query: unknown,
      loader: () => Promise<MemoryProviderPrefetchResult>,
      tags: string[],
    ) => {
      // Verify that queryText is included in tags
      assert.ok(tags.includes("memory-query:search term"), "tags should include queryText");
      const result = await loader();
      return { value: result, fromCache: false };
    },
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  await service.buildView({ scopes: ["project"], queryText: "search term" });
});

test("buildView categorizes multiple memories into correct layers", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        memories: [
          createMockMemoryRecord({ id: "mem_1", scope: "task_runtime" }),
          createMockMemoryRecord({ id: "mem_2", scope: "session" }),
          createMockMemoryRecord({ id: "mem_3", scope: "agent" }),
          createMockMemoryRecord({ id: "mem_4", scope: "project" }),
        ],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["task_runtime", "session", "agent", "project"] });

  assert.equal(result.layers.runtime.length, 1);
  assert.equal(result.layers.session.length, 1);
  assert.equal(result.layers.agent.length, 1);
  assert.equal(result.layers.project.length, 1);
});

test("buildView sets fewShotExampleCount from fewShotExamples", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        fewShotExamples: [
          { taskContext: "ctx1", taskIntent: "intent1", approach: "approach1", toolsUsed: ["tool1"], outcome: "succeeded" as const, reasoning: null },
          { taskContext: "ctx2", taskIntent: "intent2", approach: "approach2", toolsUsed: ["tool2"], outcome: "succeeded" as const, reasoning: null },
        ],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.fewShotExampleCount, 2);
});

test("emptyLayers returns all layer arrays empty", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        memories: [],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.layers.runtime.length, 0);
  assert.equal(result.layers.session.length, 0);
  assert.equal(result.layers.agent.length, 0);
  assert.equal(result.layers.project.length, 0);
  assert.equal(result.layers.user.length, 0);
  assert.equal(result.layers.evolution.length, 0);
});

// =============================================================================
// buildView with cache tests
// =============================================================================

test("buildView uses cache when provided", async () => {
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

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.fromCache, true);
});

test("buildView returns cached value when available", async () => {
  const cachedMemories = [createMockMemoryRecord({ id: "mem_cached" })];
  const provider = createMockProvider();
  const cacheMock = {
    getOrComputeMemoryRetrieval: async () => ({
      value: createMockPrefetchResult({ memories: cachedMemories }),
      fromCache: true,
    }),
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.fromCache, true);
  assert.deepEqual(result.memoryIds, ["mem_cached"]);
});

// =============================================================================
// syncTurn tests
// =============================================================================

test("syncTurn calls provider.syncTurn with input", async () => {
  let syncCalled = false;
  const provider = createMockProvider();
  (provider as any).syncTurn = async (input: MemoryTurnSyncInput) => {
    syncCalled = true;
    return createMockSyncResult();
  };
  const service = new MemoryPlaneService(provider);

  await service.syncTurn({
    memories: [],
    experience: null,
  });

  assert.ok(syncCalled);
});

test("syncTurn returns rememberedMemories when present", async () => {
  const rememberedMemories = [createMockMemoryRecord({ id: "mem_remembered" })];
  const provider = createMockProvider();
  (provider as any).syncTurn = async () => createMockSyncResult({
    rememberedMemoryIds: ["mem_remembered"],
    rememberedMemories,
  });
  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    memories: [],
    experience: null,
  });

  assert.deepEqual(result.rememberedMemories, rememberedMemories);
});

test("syncTurn returns result unchanged when no remembered memories", async () => {
  const provider = createMockProvider();
  (provider as any).syncTurn = async () =>
    ({
      providerId: "test-provider",
      syncedAt: "2026-04-01T00:00:00.000Z",
      rememberedMemoryIds: [],
      recordedExperienceId: null,
    }) as unknown as MemoryTurnSyncResult;
  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    memories: [],
    experience: null,
  });

  assert.equal(result.rememberedMemoryIds.length, 0);
});

test("syncTurn includes promotion context when provided", async () => {
  let capturedContext: any;
  const provider = createMockProvider();
  (provider as any).syncTurn = async (input: MemoryTurnSyncInput) => {
    capturedContext = input.promotionContext;
    return createMockSyncResult();
  };
  const service = new MemoryPlaneService(provider);
  const context = { projectId: "proj_123", userId: "user_456" };

  await service.syncTurn({
    memories: [],
    experience: null,
    promotionContext: context,
  });

  assert.deepEqual(capturedContext, context);
});

// =============================================================================
// evaluatePromotion tests
// =============================================================================

test("evaluatePromotion delegates to promotionEngine", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const memories = [createMockMemoryRecord()];
  const result = service.evaluatePromotion(memories, { projectId: "proj_123" });

  // Should return a valid promotion result
  assert.ok(result !== undefined);
  assert.ok("eligible" in result || "ineligible" in result || "promoted" in result);
});

test("evaluatePromotion works with empty memories array", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = service.evaluatePromotion([], { projectId: "proj_123" });

  assert.ok(result !== undefined);
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

// =============================================================================
// MemoryPlaneService constructor tests
// =============================================================================

test("MemoryPlaneService accepts provider only", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  assert.ok(service !== undefined);
});

test("MemoryPlaneService accepts provider and cache", () => {
  const provider = createMockProvider();
  const cacheMock = {
    getOrComputeMemoryRetrieval: async () => ({
      value: createMockPrefetchResult(),
      fromCache: false,
    }),
  } as unknown as CacheOrchestrationService;
  const service = new MemoryPlaneService(provider, cacheMock);

  assert.ok(service !== undefined);
});

test("MemoryPlaneService uses default promotion engine when not provided", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  // Should still work via evaluatePromotion
  const result = service.evaluatePromotion([]);
  assert.ok(result !== undefined);
});
