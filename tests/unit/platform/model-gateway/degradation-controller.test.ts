import assert from "node:assert/strict";
import test from "node:test";

import {
  DegradationController,
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type LLMDegradationRequest,
  type ProviderMetrics,
} from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import type { ModelGatewayCacheService } from "../../../../src/platform/model-gateway/cache/index.js";
import type { UnifiedChatProvider } from "../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";
import type { ModelFallbackCandidate, ModelGatewayFallbackService } from "../../../../src/platform/model-gateway/fallback/index.js";

interface MockCacheEntry {
  value: string;
  model: string;
  expiresAt: number;
}

function createMockUnifiedChatProvider(shouldFail = false, failCount = 0) {
  let callCount = 0;
  return {
    createChatCompletion: async (request: { model: string; messages: { role: string; content: string }[]; maxTokens: number }) => {
      callCount++;
      if (shouldFail && callCount <= failCount) {
        throw new Error("Provider error");
      }
      return {
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
      };
    },
    dispose: () => {},
  } as unknown as UnifiedChatProvider;
}

function createMockFallbackService(candidates: ModelFallbackCandidate[] = []): ModelGatewayFallbackService {
  return {
    selectFallback: (input: { primaryProfileName: string; candidates: ModelFallbackCandidate[] }) => {
      const selected = candidates.length > 0 ? candidates[0] : null;
      return {
        selectedProfileName: selected?.profileName ?? null,
        reasonCode: selected != null ? "fallback.healthy_alternative_selected" : "fallback.no_candidate_available",
        degradedFromProfileName: input.primaryProfileName,
        attemptedProfiles: candidates.map((c) => c.profileName),
        fallbackChain: [input.primaryProfileName, ...candidates.map((c) => c.profileName)],
      };
    },
  };
}

function createMockCacheService(): ModelGatewayCacheService<string> {
  const store = new Map<string, MockCacheEntry>();

  return {
    put: (input: { cacheKey: string; tenantId: string | null; model: string; routeClass: string; value: string; ttlMs: number }) => {
      store.set(input.cacheKey, {
        value: input.value,
        model: input.model,
        expiresAt: Date.now() + input.ttlMs,
      });
    },
    get: (cacheKey: string) => {
      const entry = store.get(cacheKey);
      if (entry == null || entry.expiresAt < Date.now()) {
        store.delete(cacheKey);
        return null;
      }
      return { cacheKey, tenantId: null, model: entry.model, routeClass: "", value: entry.value, createdAt: "", expiresAt: "" };
    },
    invalidate: (cacheKey: string) => store.delete(cacheKey),
    invalidateByTag: async (_tag: string) => 0,
    invalidateNamespace: async (_namespace: string) => 0,
    cleanupExpired: async () => 0,
    buildCacheKey: (input: { tenantId: string | null; model: string; routeClass: string; messages: { role: string; content: string }[] }) => {
      return `mock_key_${JSON.stringify(input)}`;
    },
  } as unknown as ModelGatewayCacheService<string>;
}

function createTestRequest(overrides?: Partial<LLMDegradationRequest>): LLMDegradationRequest {
  return {
    model: "test-model",
    routeClass: "test",
    messages: [{ role: "user", content: "hello" }],
    tenantId: null,
    taskType: "default",
    semanticKey: "test-key",
    ...overrides,
  };
}

test("DegradationController starts at D0", () => {
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

test("DEFAULT_TEMPLATE_RESPONSES contains expected keys", () => {
  assert.ok("default" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("coding" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("reasoning" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("classification" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("writing" in DEFAULT_TEMPLATE_RESPONSES);
});

test("DegradationController route D0 returns primary provider response", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const response = await controller.route(createTestRequest());

  assert.equal(response.content, "Mock response");
  assert.equal(response.degradationLevel, DegradationLevel.D0);
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("DegradationController route D0 caches successful response", async () => {
  const cache = createMockCacheService();
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: cache,
  });

  await controller.route(createTestRequest({ semanticKey: "cache-key" }));

  const cached = cache.get("cache-key");
  assert.notEqual(cached, null);
  assert.equal(cached?.value, "Mock response");
});

test("DegradationController route escalates on provider failure", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(true, 1),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const response = await controller.route(createTestRequest());

  // Should escalate to D1 (fallback), then D2 (cache miss), then D3 (template)
  assert.ok(response.degradationLevel >= DegradationLevel.D1);
});

test("DegradationController evaluateHealth escalates on high error rate", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 60,
    errorRate: 60,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.newLevel >= DegradationLevel.D1);
});

test("DegradationController evaluateHealth escalates on high latency", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 10,
    errorRate: 10,
    latencyP99Ms: 6000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("latency_p99"));
});

test("DegradationController evaluateHealth escalates on high TTFT", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 10,
    errorRate: 10,
    latencyP99Ms: 1000,
    ttftP99Ms: 11000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("ttft_p99"));
});

test("DegradationController evaluateHealth maintains on healthy metrics", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  const result = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result.action, "maintain");
  assert.equal(result.newLevel, DegradationLevel.D0);
});

test("DegradationController reset returns to D0", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.escalate();
  assert.ok(controller.getCurrentLevel() > DegradationLevel.D0);

  controller.reset();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController setLevel forces specific level", () => {
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

test("DegradationController setLevel rejects invalid levels", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  assert.throws(
    () => controller.setLevel(-1 as DegradationLevel),
    /Invalid degradation level/,
  );

  assert.throws(
    () => controller.setLevel(5 as DegradationLevel),
    /Invalid degradation level/,
  );
});

test("DegradationController escalate advances level", () => {
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
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
  // Cannot escalate past D4
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("DegradationController deescalate goes back a level", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D2);
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);

  // Cannot deescalate past D0
  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController route D3 returns template response", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(true, 999),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  // Force D3
  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route(createTestRequest());

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.equal(response.model, "template");
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("DegradationController route D4 throws service unavailable error", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D4);

  let thrownError: Error | null = null;
  try {
    await controller.route(createTestRequest());
  } catch (error) {
    thrownError = error as Error;
  }

  assert.ok(thrownError != null, "Expected an error to be thrown");
  assert.ok(thrownError.message.includes("service_unavailable") || thrownError.message.includes("unavailable"), "Error should indicate service unavailable");
});

test("DegradationController getLastEscalationReason returns last error", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(true, 999),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  controller.setLevel(DegradationLevel.D0);

  // Trigger an error
  controller.route(createTestRequest()).catch(() => {});

  // Reason is set asynchronously, check after a tick
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.ok(controller.getLastEscalationReason() != null);
      resolve();
    }, 10);
  });
});

test("DegradationController with custom templates", async () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(true, 999),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
    templates: {
      default: "Custom default message",
      coding: "Custom coding message",
    },
  });

  controller.setLevel(DegradationLevel.D3);

  const response = await controller.route(createTestRequest({ taskType: "default" }));
  assert.equal(response.content, "Custom default message");

  const codingResponse = await controller.route(createTestRequest({ taskType: "coding" }));
  assert.equal(codingResponse.content, "Custom coding message");
});

test("DegradationController emits event on escalation", () => {
  let eventEmitted = false;
  let eventPayload: unknown = null;

  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
    eventBusEmitter: (_eventType, payload) => {
      eventEmitted = true;
      eventPayload = payload;
    },
  });

  controller.escalate();

  assert.equal(eventEmitted, true);
  assert.ok(eventPayload != null);
});

test("DegradationController evaluateHealth deescalates after recovery", () => {
  const controller = new DegradationController({
    primaryProvider: createMockUnifiedChatProvider(),
    fallbackService: createMockFallbackService(),
    cacheService: createMockCacheService(),
  });

  // Escalate to D1
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  // First healthy evaluation - maintains D1 but increments counter
  const result1 = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result1.action, "maintain");

  // Second healthy evaluation
  controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  // Third healthy evaluation - should deescalate
  const result3 = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });

  assert.equal(result3.action, "deescalate");
  assert.equal(result3.newLevel, DegradationLevel.D0);
});
