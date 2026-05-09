import assert from "node:assert/strict";
import test from "node:test";

import { DegradationController, DegradationLevel, DEFAULT_DEGRADATION_CONFIG, DEFAULT_TEMPLATE_RESPONSES } from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import type { ModelGatewayCacheService, UnifiedChatProvider } from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import type { ModelFallbackCandidate } from "../../../../src/platform/model-gateway/fallback/index.js";
import type { ModelGatewayFallbackService } from "../../../../src/platform/model-gateway/fallback/index.js";

function createMockUnifiedChatProvider() {
  return {
    createChatCompletion: async (request: { model: string; messages: { role: string; content: string }[]; maxTokens: number }) => ({
      id: "msg_001",
      content: "Mock response",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: request.model,
      provider: "mock",
    }),
    dispose: () => {},
  } as unknown as UnifiedChatProvider;
}

function createMockFallbackService(): ModelGatewayFallbackService {
  return {
    selectFallback: (input: { primaryProfileName: string; candidates: ModelFallbackCandidate[] }) => ({
      selectedProfileName: input.candidates[0]?.profileName ?? null,
      reasonCode: input.candidates.length > 0 ? "fallback.healthy_alternative_selected" : "fallback.no_candidate_available",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles: input.candidates.map(c => c.profileName),
    }),
  };
}

function createMockCacheService<T>(): ModelGatewayCacheService<T> {
  const store = new Map<string, { value: T; model: string; expiresAt: number }>();

  return {
    put: (input: { cacheKey: string; tenantId: string | null; model: string; routeClass: string; value: T; ttlMs: number }) => {
      const entry = {
        value: input.value,
        model: input.model,
        expiresAt: Date.now() + input.ttlMs,
      };
      store.set(input.cacheKey, entry);
      return entry;
    },
    get: (cacheKey: string) => {
      const entry = store.get(cacheKey);
      if (entry == null || entry.expiresAt < Date.now()) {
        store.delete(cacheKey);
        return null;
      }
      return { ...entry, tenantId: null, routeClass: "" };
    },
    invalidate: (cacheKey: string) => store.delete(cacheKey),
    invalidateByTag: async (_tag: string) => 0,
    invalidateNamespace: async (_namespace: string) => 0,
    cleanupExpired: async () => 0,
    buildCacheKey: (input: { tenantId: string | null; model: string; routeClass: string; messages: { role: string; content: string }[] }) => {
      return `mock_key_${JSON.stringify(input)}`;
    },
  } as unknown as ModelGatewayCacheService<T>;
}

test("DegradationController has default degradation level D0", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationLevel enum has correct values", () => {
  assert.equal(DegradationLevel.D0, 0);
  assert.equal(DegradationLevel.D1, 1);
  assert.equal(DegradationLevel.D2, 2);
  assert.equal(DegradationLevel.D3, 3);
  assert.equal(DegradationLevel.D4, 4);
});

test("DEFAULT_DEGRADATION_CONFIG has correct thresholds", () => {
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold, 50);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold, 5);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms, 5000);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount, 3);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.maxAutoDeescalateLevel, DegradationLevel.D0);
});

test("DEFAULT_TEMPLATE_RESPONSES has responses for all task types", () => {
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.default);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.coding);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.reasoning);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.classification);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.writing);
});

test("DegradationController.escalate increases level", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
});

test("DegradationController.escalate does not exceed D4", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  for (let i = 0; i < 10; i++) {
    controller.escalate();
  }

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("DegradationController.deescalate decreases level", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.escalate();
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController.deescalate does not go below D0", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  for (let i = 0; i < 10; i++) {
    controller.deescalate();
  }

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController.reset returns to D0", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.escalate();
  controller.escalate();
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);

  controller.reset();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController.setLevel sets specific level", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D2);
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.setLevel(DegradationLevel.D4);
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("DegradationController.setLevel throws for invalid level", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  assert.throws(() => {
    controller.setLevel(-1 as DegradationLevel);
  }, /Invalid degradation level/);

  assert.throws(() => {
    controller.setLevel(5 as DegradationLevel);
  }, /Invalid degradation level/);
});

test("DegradationController.getLastEscalationReason returns null initially", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  assert.equal(controller.getLastEscalationReason(), null);
});

test("DegradationController.evaluateHealth escalates on high TTFT", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 0,
    errorRate: 0,
    latencyP99Ms: 1000,
    ttftP99Ms: 15000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("ttft_p99"));
});

test("DegradationController.evaluateHealth escalates on high error rate", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 60,
    errorRate: 60,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("error_rate"));
});

test("DegradationController.evaluateHealth escalates on high latency", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 0,
    errorRate: 0,
    latencyP99Ms: 6000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("latency_p99"));
});

test("DegradationController.evaluateHealth maintains on healthy metrics", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "maintain");
  assert.equal(result.reason, "healthy");
});

test("DegradationController.evaluateHealth deescalates after consecutive healthy checks", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.escalate();
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  for (let i = 0; i < 3; i++) {
    const result = controller.evaluateHealth({
      provider: "openai",
      profileName: "gpt-4",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 500,
      lastUpdated: new Date().toISOString(),
    });

    if (i < 2) {
      assert.equal(result.action, "maintain");
      assert.ok(result.reason.includes("waiting_recovery"));
    } else {
      assert.equal(result.action, "deescalate");
      assert.ok(result.reason.includes("recovered_after"));
    }
  }
});

test("DegradationController.evaluateHealth resets recovery path when latency spike persists", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.escalate();
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  const healthyResult = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  });
  assert.equal(healthyResult.action, "maintain");

  const result = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 6000,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("latency_p99"));
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);

  const recovered = controller.evaluateHealth({
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  });
  assert.equal(recovered.action, "maintain");
  assert.equal(recovered.reason, "waiting_recovery:1/3");
});

test("DegradationController route escalates iteratively without recursive overflow", async () => {
  const failingProvider = {
    createChatCompletion: async () => {
      throw new Error("provider_down");
    },
    getAvailableProfiles: () => ([
      { profileName: "fallback-profile", provider: "mock" },
    ]),
    dispose: () => {},
  } as unknown as UnifiedChatProvider;

  const controller = new DegradationController({
    primaryProvider: failingProvider,
    fallbackProvider: failingProvider,
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);
});

test("DegradationController.route handles D0 successfully", async () => {
  const mockProvider = createMockUnifiedChatProvider();
  const controller = new DegradationController({
    primaryProvider: mockProvider,
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(response.degradationLevel, DegradationLevel.D0);
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("DegradationController.route D3 returns template response", async () => {
  const mockProvider = createMockUnifiedChatProvider();
  const controller = new DegradationController({
    primaryProvider: mockProvider,
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    taskType: "default",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.equal(response.model, "template");
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("DegradationController.route D3 returns coding template for coding task", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "coding",
    messages: [{ role: "user", content: "Write code" }],
    taskType: "coding",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.ok(response.content.includes("coding"));
});

test("DegradationController.route D3 returns reasoning template for reasoning task", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "Solve this problem" }],
    taskType: "reasoning",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.ok(response.content.includes("reasoning"));
});

test("DegradationController.route D3 returns writing template for writing task", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "writing",
    messages: [{ role: "user", content: "Write a story" }],
    taskType: "writing",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.ok(response.content.includes("writing"));
});

test("DegradationController.route D3 returns classification template for classification task", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "classification",
    messages: [{ role: "user", content: "Classify this" }],
    taskType: "classification",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.ok(response.content.includes("classification"));
});

test("DegradationController.route D4 throws service unavailable error", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D4);

  await assert.rejects(
    async () => {
      await controller.route({
        model: "gpt-4",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      });
    },
    (err: unknown) => {
      if (err instanceof Error) {
        return err.message.includes("unavailable");
      }
      return false;
    }
  );
});

test("DegradationController.route D2 uses cache when available", async () => {
  const mockProvider = createMockUnifiedChatProvider();
  const mockCache = createMockCacheService<string>();

  mockCache.put({
    cacheKey: "test_semantic_key",
    tenantId: null,
    model: "gpt-4",
    routeClass: "default",
    value: "Cached response content",
    ttlMs: 60000,
  });

  const controller = new DegradationController({
    primaryProvider: mockProvider,
    fallbackService: createMockFallbackService(),
    cacheService: mockCache,
  });

  controller.setLevel(DegradationLevel.D2);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    semanticKey: "test_semantic_key",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D2);
  assert.equal(response.cached, true);
  assert.equal(response.fromCache, true);
  assert.equal(response.content, "Cached response content");
});

test("DegradationController route D2 falls through to D3 when no cache", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D2);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    semanticKey: "nonexistent_key",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
});

test("DegradationController route D2 without semantic key falls through to D3", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D2);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(response.degradationLevel, DegradationLevel.D3);
});

test("DegradationController uses custom templates when provided", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
    templates: {
      default: "Custom default message",
      coding: "Custom coding message",
      reasoning: "Custom reasoning message",
      classification: "Custom classification message",
      writing: "Custom writing message",
    },
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route({
    model: "gpt-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    taskType: "default",
  });

  assert.equal(response.content, "Custom default message");
});

test("DegradationController uses custom config when provided", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
    config: {
      escalateErrorRateThreshold: 30,
      deescalateErrorRateThreshold: 2,
      escalateLatencyP99Ms: 3000,
      deescalateMinHealthyCount: 5,
      maxAutoDeescalateLevel: DegradationLevel.D1,
    },
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController escalade resets consecutive healthy count", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.escalate();
  controller.escalate();

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.escalate();

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);
});
