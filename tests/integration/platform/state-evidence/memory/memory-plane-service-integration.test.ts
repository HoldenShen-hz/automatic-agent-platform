/**
 * Integration Test: Memory Plane Service
 *
 * Tests the MemoryPlaneService including memory plane view construction,
 * layer categorization, and turn synchronization.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MemoryPlaneService } from "../../../../../src/platform/state-evidence/memory/memory-plane-service.js";
import type {
  MemoryProvider,
  MemoryProviderPrefetchResult,
  MemoryProviderQuery,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
} from "../../../../../src/platform/state-evidence/memory/memory-provider.js";
import type { MemoryRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockMemoryRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_" + Math.random().toString(36).slice(2, 8),
    taskId: "task_test",
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
    contentHash: "testhash",
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
    requestId: "req_" + Math.random().toString(36).slice(2, 6),
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

test("integration: MemoryPlaneService buildView returns view with memories categorized by scope", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.ok(Array.isArray(result.layers.runtime));
  assert.ok(Array.isArray(result.layers.session));
  assert.ok(Array.isArray(result.layers.agent));
  assert.ok(Array.isArray(result.layers.project));
  assert.ok(Array.isArray(result.layers.user));
  assert.ok(Array.isArray(result.layers.evolution));
  assert.equal(typeof result.promptBlock, "string");
  assert.equal(typeof result.fewShotExampleCount, "number");
  assert.ok(Array.isArray(result.memoryIds));
  assert.ok(Array.isArray(result.experienceIds));
  assert.equal(typeof result.fromCache, "boolean");
});

test("integration: MemoryPlaneService buildView categorizes memories into correct layers", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        memories: [
          createMockMemoryRecord({ id: "mem_1", scope: "task_runtime", memoryLayer: "layer_3" }),
          createMockMemoryRecord({ id: "mem_2", scope: "session", memoryLayer: "layer_3" }),
          createMockMemoryRecord({ id: "mem_3", scope: "agent", memoryLayer: "layer_4" }),
          createMockMemoryRecord({ id: "mem_4", scope: "project", memoryLayer: "layer_5" }),
          createMockMemoryRecord({ id: "mem_5", scope: "user", memoryLayer: "layer_3" }),
          createMockMemoryRecord({ id: "mem_6", scope: "evolution", memoryLayer: "layer_4" }),
        ],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["task_runtime", "session", "agent", "project", "user", "evolution"] });

  assert.equal(result.layers.runtime.length, 1);
  assert.equal(result.layers.session.length, 1);
  assert.equal(result.layers.agent.length, 1);
  assert.equal(result.layers.project.length, 1);
  assert.equal(result.layers.user.length, 1);
  assert.equal(result.layers.evolution.length, 1);
});

test("integration: MemoryPlaneService buildView with empty memories returns empty layers", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        memories: [],
        promptBlock: "",
        fewShotExamples: [],
        experienceIds: [],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.layers.project.length, 0);
  assert.equal(result.memoryIds.length, 0);
  assert.equal(result.promptBlock, "");
});

test("integration: MemoryPlaneService buildView includes fewShotExamples count", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        fewShotExamples: [
          { taskContext: "ctx1", taskIntent: "intent1", approach: "approach1", toolsUsed: ["tool1"], outcome: "succeeded" as const, reasoning: null },
          { taskContext: "ctx2", taskIntent: "intent2", approach: "approach2", toolsUsed: ["tool2"], outcome: "succeeded" as const, reasoning: null },
          { taskContext: "ctx3", taskIntent: "intent3", approach: "approach3", toolsUsed: ["tool3"], outcome: "failed" as const, reasoning: "error" },
        ],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.fewShotExampleCount, 3);
});

test("integration: MemoryPlaneService syncTurn returns sync result with remembered memories", async () => {
  const rememberedMemories = [createMockMemoryRecord({ id: "mem_remembered" })];
  const provider = createMockProvider();
  (provider as any).syncTurn = async () =>
    createMockSyncResult({
      rememberedMemoryIds: ["mem_remembered"],
      rememberedMemories,
    });

  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    memories: [createMockMemoryRecord()],
    experience: null,
  });

  assert.equal(result.providerId, "test-provider");
  assert.ok(Array.isArray(result.rememberedMemoryIds));
});

test("integration: MemoryPlaneService syncTurn handles empty memories array", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.syncTurn({
    memories: [],
    experience: null,
  });

  assert.equal(result.providerId, "test-provider");
});

test("integration: MemoryPlaneService evaluatePromotion returns promotion result", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const memories = [createMockMemoryRecord()];
  const result = service.evaluatePromotion(memories, { projectId: "proj_123" });

  assert.ok(result !== undefined);
  assert.ok("eligible" in result || "ineligible" in result || "promoted" in result);
});

test("integration: MemoryPlaneService evaluatePromotion with empty memories", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = service.evaluatePromotion([], { projectId: "proj_123" });

  assert.ok(result !== undefined);
});

test("integration: MemoryPlaneService evaluatePromotion without context", () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const memories = [createMockMemoryRecord()];
  const result = service.evaluatePromotion(memories);

  assert.ok(result !== undefined);
});

test("integration: MemoryPlaneService buildView with multiple experience scopes", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        memories: [
          createMockMemoryRecord({ id: "mem_exp_1", scope: "experience" }),
          createMockMemoryRecord({ id: "mem_exp_2", scope: "evolution" }),
        ],
        experienceIds: ["exp_1", "exp_2"],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["experience", "evolution"] });

  assert.equal(result.layers.evolution.length, 2);
  assert.equal(result.experienceIds.length, 2);
  assert.ok(result.experienceIds.includes("exp_1"));
  assert.ok(result.experienceIds.includes("exp_2"));
});

test("integration: MemoryPlaneService buildView with workspace scope maps to project", async () => {
  const provider = {
    ...createMockProvider(),
    prefetch: async () =>
      createMockPrefetchResult({
        memories: [createMockMemoryRecord({ id: "mem_ws", scope: "workspace" })],
      }),
  };
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["workspace"] });

  assert.equal(result.layers.project.length, 1);
});

test("integration: MemoryPlaneService buildView marks fromCache correctly when not using cache", async () => {
  const provider = createMockProvider();
  const service = new MemoryPlaneService(provider);

  const result = await service.buildView({ scopes: ["project"] });

  assert.equal(result.fromCache, false);
});
