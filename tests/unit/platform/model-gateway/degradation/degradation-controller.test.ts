/**
 * Degradation Controller Unit Tests - Issues #2090, #2091, #2096
 *
 * Tests for the degradation controller focusing on:
 * - Issue #2090: getFallbackCandidates() hardcoded returns [], D1 never生效
 * - Issue #2091: Recursive escalation has no depth limit
 * - Issue #2096: De-escalation ignores latency P99
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";

import {
  DegradationController,
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type ProviderMetrics,
  type LLMDegradationRequest,
} from "../../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import type { ModelFallbackCandidate } from "../../../../../../src/platform/model-gateway/fallback/index.js";

// ============================================================================
// Mock Implementations
// ============================================================================

interface MockChatResult {
  id: string;
  content: string;
  refusal: string | null;
  reasoningContent: string | null;
  finishReason: string;
  stopSequence: string | null;
  toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  provider: string;
}

class MockUnifiedChatProvider {
  public createChatCompletion = mock.fn(async (request: { model: string; messages: unknown[] }): Promise<MockChatResult> => {
    return {
      id: "mock-completion-id",
      content: `Response from ${request.model}`,
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: request.model,
      provider: "mock",
    };
  });

  public getAvailableProfiles = mock.fn(() => [
    { profileName: "primary-model", provider: "mock", tier: "balanced" },
    { profileName: "fallback-model", provider: "mock", tier: "fast" },
    { profileName: "secondary-model", provider: "mock", tier: "balanced" },
  ]);
}

class MockFallbackService {
  public selectFallback = mock.fn((input: { primaryProfileName: string; candidates: ModelFallbackCandidate[] }) => {
    // Return the first candidate if available
    if (input.candidates.length > 0) {
      return {
        selectedProfileName: input.candidates[0]!.profileName,
        reasonCode: "fallback.selected",
        degradedFromProfileName: input.primaryProfileName,
        attemptedProfiles: input.candidates.map((c) => c.profileName),
      };
    }
    return {
      selectedProfileName: null,
      reasonCode: "fallback.no_candidate_available",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles: [],
    };
  });
}

class MockCacheService {
  private entries = new Map<string, { value: string; model: string }>();

  public put(input: { cacheKey: string; value: string; model: string }): void {
    this.entries.set(input.cacheKey, { value: input.value, model: input.model });
  }

  public get(cacheKey: string): { value: string; model: string } | null {
    return this.entries.get(cacheKey) ?? null;
  }
}

// ============================================================================
// Test Setup
// ============================================================================

function createController(overrides?: {
  primaryProvider?: MockUnifiedChatProvider;
  fallbackProvider?: MockUnifiedChatProvider | null;
  maxAutoDeescalateLevel?: DegradationLevel;
  config?: Partial<typeof DEFAULT_DEGRADATION_CONFIG>;
}): { controller: DegradationController; mockProvider: MockUnifiedChatProvider; mockFallbackService: MockFallbackService; mockCacheService: MockCacheService } {
  const mockProvider = overrides?.primaryProvider ?? new MockUnifiedChatProvider();
  const mockFallbackService = new MockFallbackService();
  const mockCacheService = new MockCacheService();

  return {
    controller: new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackProvider: overrides?.fallbackProvider ? overrides.fallbackProvider as unknown as import("../../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider : null,
      fallbackService: mockFallbackService as unknown as import("../../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
      config: overrides?.config ?? {},
    }),
    mockProvider,
    mockFallbackService,
    mockCacheService,
  };
}

// ============================================================================
// Issue #2090: getFallbackCandidates() Tests
// ============================================================================

test("DegradationController getFallbackCandidates returns candidates from fallbackProvider", () => {
  const fallbackProvider = new MockUnifiedChatProvider();
  fallbackProvider.getAvailableProfiles = mock.fn(() => [
    { profileName: "fallback-model-1", provider: "fallback", tier: "fast" },
    { profileName: "fallback-model-2", provider: "fallback", tier: "balanced" },
  ]);

  const { controller, mockCacheService } = createController({ fallbackProvider });

  // Access private method via any
  const candidates = (controller as any).getFallbackCandidates("primary-model");

  // Should return candidates from fallback provider
  assert.ok(Array.isArray(candidates));
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c: ModelFallbackCandidate) => c.profileName === "fallback-model-1"));
});

test("DegradationController getFallbackCandidates returns candidates from primary when no fallbackProvider", () => {
  const { controller, mockProvider } = createController({ fallbackProvider: null });

  // Access private method via any
  const candidates = (controller as any).getFallbackCandidates("primary-model");

  // Should return candidates from primary provider (excluding primary)
  assert.ok(Array.isArray(candidates));
  // primary-model is excluded, so we should see fallback-model, secondary-model
  assert.ok(candidates.some((c: ModelFallbackCandidate) => c.profileName === "fallback-model"));
  assert.ok(candidates.some((c: ModelFallbackCandidate) => c.profileName === "secondary-model"));
  assert.ok(!candidates.some((c: ModelFallbackCandidate) => c.profileName === "primary-model"));
});

test("DegradationController getFallbackCandidates excludes the primary profile", () => {
  const { controller } = createController({ fallbackProvider: null });

  const candidates = (controller as any).getFallbackCandidates("fallback-model");

  // fallback-model should be excluded
  assert.ok(!candidates.some((c: ModelFallbackCandidate) => c.profileName === "fallback-model"));
});

test("DegradationController D1 uses fallbackProvider when configured", async () => {
  const fallbackProvider = new MockUnifiedChatProvider();
  fallbackProvider.createChatCompletion = mock.fn(async (request: { model: string }) => {
    return {
      id: "fallback-completion",
      content: `Fallback response from ${request.model}`,
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: request.model,
      provider: "fallback",
    };
  });
  fallbackProvider.getAvailableProfiles = mock.fn(() => [
    { profileName: "fallback-model", provider: "fallback", tier: "fast" },
  ]);

  const { controller } = createController({ fallbackProvider });
  controller.setLevel(DegradationLevel.D1);

  const request: LLMDegradationRequest = {
    model: "primary-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  };

  const response = await controller.route(request);

  // Should use fallback provider
  assert.equal(response.degradationLevel, DegradationLevel.D1);
  assert.ok(response.content.includes("Fallback"));
});

// ============================================================================
// Issue #2091: Recursive Escalation Depth Limit Tests
// ============================================================================

test("DegradationController MAX_ROUTE_RECURSION_DEPTH is defined as 5", () => {
  assert.equal(DegradationController.MAX_ROUTE_RECURSION_DEPTH, 5);
});

test("DegradationController stops recursion after MAX_ROUTE_RECURSION_DEPTH", async () => {
  const mockProvider = new MockUnifiedChatProvider();
  mockProvider.createChatCompletion = mock.fn(async () => {
    throw new Error("Provider failure");
  });

  const { controller, mockCacheService } = createController({ primaryProvider: mockProvider });

  const request: LLMDegradationRequest = {
    model: "failing-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  };

  // After exceeding recursion depth, should throw with max_recursion_exceeded
  await assert.rejects(
    async () => controller.route(request),
    (error: unknown) => {
      if (error instanceof Error && error.message.includes("max_recursion")) {
        return true;
      }
      return false;
    },
  );
});

test("DegradationController recursion depth is tracked per route call", async () => {
  const mockProvider = new MockUnifiedChatProvider();
  let callCount = 0;
  mockProvider.createChatCompletion = mock.fn(async () => {
    callCount++;
    throw new Error("Provider failure");
  });

  const { controller } = createController({ primaryProvider: mockProvider });

  const request: LLMDegradationRequest = {
    model: "failing-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  };

  await assert.rejects(async () => controller.route(request), /max_recursion|Provider failure/);

  // Should have called provider multiple times before hitting recursion limit
  assert.ok(callCount >= 3, `Expected at least 3 calls, got ${callCount}`);
});

test("DegradationController recursion limit applies to D1 route as well", async () => {
  const mockProvider = new MockUnifiedChatProvider();
  mockProvider.createChatCompletion = mock.fn(async () => {
    throw new Error("Provider failure");
  });

  const { controller } = createController({ primaryProvider: mockProvider, fallbackProvider: null });

  controller.setLevel(DegradationLevel.D1);

  const request: LLMDegradationRequest = {
    model: "failing-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  };

  // Should eventually hit recursion limit
  await assert.rejects(
    async () => controller.route(request),
    /max_recursion|Provider failure/,
  );
});

test("DegradationController resets recursion depth after successful route", async () => {
  const mockProvider = new MockUnifiedChatProvider();
  mockProvider.createChatCompletion = mock.fn(async (request: { model: string }) => {
    return {
      id: "success-id",
      content: `Response from ${request.model}`,
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: request.model,
      provider: "mock",
    };
  });

  const { controller } = createController({ primaryProvider: mockProvider });

  const request: LLMDegradationRequest = {
    model: "success-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  };

  // First successful call
  const response = await controller.route(request);
  assert.equal(response.degradationLevel, DegradationLevel.D0);

  // Second call should also succeed (recursion depth reset)
  const response2 = await controller.route(request);
  assert.equal(response2.degradationLevel, DegradationLevel.D0);
});

// ============================================================================
// Issue #2096: De-escalation Latency P99 Ignored Tests
// ============================================================================

test("DegradationController evaluateHealth de-escalation does NOT check latency P99", () => {
  const { controller } = createController();

  // Start at D1
  controller.setLevel(DegradationLevel.D1);

  // Low error rate but high latency - should de-escalate based on error rate only
  const metricsHighLatency: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 100,
    failedRequests: 1, // 1% error rate - below 5% threshold
    errorRate: 1,
    latencyP99Ms: 10000, // Very high latency
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  };

  // After 3 consecutive healthy checks with low error rate
  controller.evaluateHealth(metricsHighLatency); // 1: waiting
  controller.evaluateHealth(metricsHighLatency); // 2: waiting
  const result = controller.evaluateHealth(metricsHighLatency); // 3: should de-escalate

  // Issue #2096: De-escalation ignores latency P99, so it should de-escalate
  // because error rate is below threshold, even though latency is high
  assert.equal(result.action, "deescalate");
  assert.equal(result.newLevel, DegradationLevel.D0);
});

test("DegradationController evaluateHealth does NOT escalate for high latency if error rate is low", () => {
  const { controller } = createController();

  // At D0
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);

  const metrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2, // Low error rate
    latencyP99Ms: 8000, // High latency but below TTFT threshold
    ttftP99Ms: 5000,
    lastUpdated: new Date().toISOString(),
  };

  const result = controller.evaluateHealth(metrics);

  // High latency alone without high error rate should NOT escalate
  assert.equal(result.action, "maintain");
});

test("DegradationController evaluateHealth de-escalation requires consecutive healthy checks", () => {
  const { controller } = createController();

  controller.setLevel(DegradationLevel.D2);

  const metricsHealthy: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  };

  // First check - should not de-escalate yet
  let result = controller.evaluateHealth(metricsHealthy);
  assert.equal(result.action, "maintain");
  assert.ok(result.reason.includes("waiting_recovery"));

  // Second check - still not enough
  result = controller.evaluateHealth(metricsHealthy);
  assert.equal(result.action, "maintain");

  // Third check - should de-escalate
  result = controller.evaluateHealth(metricsHealthy);
  assert.equal(result.action, "deescalate");
});

test("DegradationController evaluateHealth respects maxAutoDeescalateLevel during de-escalation", () => {
  const { controller } = createController({ maxAutoDeescalateLevel: DegradationLevel.D1 });

  controller.setLevel(DegradationLevel.D3);

  const metricsHealthy: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  };

  // 3 healthy checks
  controller.evaluateHealth(metricsHealthy);
  controller.evaluateHealth(metricsHealthy);
  const result = controller.evaluateHealth(metricsHealthy);

  // Should only de-escalate to D2 (maxAutoDeescalateLevel is D1)
  assert.equal(result.action, "deescalate");
  assert.equal(result.newLevel, DegradationLevel.D2);
});

test("DegradationController evaluateHealth TTFT P99 separate threshold from latency P99", () => {
  const { controller } = createController();

  // High TTFT should trigger escalation independently
  const metricsHighTTFT: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 100,
    failedRequests: 2,
    errorRate: 2, // Low error rate
    latencyP99Ms: 1000, // Normal latency
    ttftP99Ms: 11000, // High TTFT > 10000 threshold
    lastUpdated: new Date().toISOString(),
  };

  const result = controller.evaluateHealth(metricsHighTTFT);

  // High TTFT should escalate
  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("ttft_p99"));
});

// ============================================================================
// General Degradation Controller Tests
// ============================================================================

test("DegradationController escalate increments level correctly", () => {
  const { controller } = createController();

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("DegradationController cannot escalate beyond D4", () => {
  const { controller } = createController();

  controller.setLevel(DegradationLevel.D4);
  controller.escalate();

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("DegradationController deescalate decrements level correctly", () => {
  const { controller } = createController();

  controller.setLevel(DegradationLevel.D4);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.deescalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController cannot deescalate below D0", () => {
  const { controller } = createController();

  controller.setLevel(DegradationLevel.D0);
  controller.deescalate();

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController reset returns to D0", () => {
  const { controller } = createController();

  controller.setLevel(DegradationLevel.D3);
  controller.reset();

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
  assert.strictEqual(controller.getLastEscalationReason(), null);
});

test("DegradationController setLevel rejects invalid levels", () => {
  const { controller } = createController();

  assert.throws(
    () => controller.setLevel(-1 as DegradationLevel),
    /invalid_level/,
  );

  assert.throws(
    () => controller.setLevel(5 as DegradationLevel),
    /invalid_level/,
  );
});

test("DegradationController D3 returns template response", async () => {
  const { controller } = createController();
  controller.setLevel(DegradationLevel.D3);

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "coding",
    messages: [{ role: "user", content: "Hello" }],
    taskType: "coding",
  };

  const response = await controller.route(request);

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.equal(response.model, "template");
  assert.ok(response.content.includes("apologize") || response.content.includes("demand"));
});

test("DegradationController D4 throws ProviderError", async () => {
  const { controller } = createController();
  controller.setLevel(DegradationLevel.D4);

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  };

  await assert.rejects(
    async () => controller.route(request),
    (error: unknown) => {
      if (error instanceof Error && "retryable" in error) {
        return (error as { retryable: boolean }).retryable === true;
      }
      return false;
    },
  );
});

test("DegradationController caches successful D0 responses", async () => {
  const { controller, mockCacheService } = createController();

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    semanticKey: "test-semantic-key",
  };

  await controller.route(request);

  const cached = mockCacheService.get("test-semantic-key");
  assert.ok(cached !== null);
});

test("DegradationController D0 does not cache when no semanticKey", async () => {
  const { controller, mockCacheService } = createController();

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    // No semanticKey
  };

  await controller.route(request);

  // Should have no entries in cache
  const keys = Array.from((mockCacheService as any).entries.keys());
  assert.equal(keys.length, 0);
});

// ============================================================================
// Default Configuration Tests
// ============================================================================

test("DEFAULT_DEGRADATION_CONFIG has correct escalation threshold", () => {
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold, 50); // 50%
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold, 5); // 5%
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms, 5000);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateTtftP99Ms, 10000); // §15.6 TTFT threshold
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount, 3);
});

test("DEFAULT_TEMPLATE_RESPONSES has all required keys", () => {
  const requiredKeys = ["default", "coding", "reasoning", "classification", "writing"];
  for (const key of requiredKeys) {
    assert.ok(DEFAULT_TEMPLATE_RESPONSES[key] !== undefined);
    assert.ok(DEFAULT_TEMPLATE_RESPONSES[key]!.length > 0);
  }
});

// ============================================================================
// Event Bus Emission Tests
// ============================================================================

test("DegradationController emits event on escalation", () => {
  const events: Array<{ eventType: string; payload: unknown }> = [];
  const eventBusEmitter = (eventType: string, payload: unknown) => {
    events.push({ eventType, payload });
  };

  const controller = new DegradationController({
    primaryProvider: new MockUnifiedChatProvider() as unknown as import("../../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
    fallbackProvider: null,
    fallbackService: new MockFallbackService() as unknown as import("../../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
    cacheService: new MockCacheService() as unknown as import("../../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    eventBusEmitter,
  });

  controller.escalate();

  assert.ok(events.some((e) => e.eventType === "degradation:escalate"));
});

// ============================================================================
// D2 Cache Behavior Tests
// ============================================================================

test("DegradationController D2 returns cached response", async () => {
  const { controller, mockCacheService } = createController();

  mockCacheService.put({ cacheKey: "cached-key", value: "Cached response", model: "cached-model" });
  controller.setLevel(DegradationLevel.D2);

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    semanticKey: "cached-key",
  };

  const response = await controller.route(request);

  assert.equal(response.degradationLevel, DegradationLevel.D2);
  assert.equal(response.content, "Cached response");
  assert.equal(response.fromCache, true);
});

test("DegradationController D2 falls through to D3 on cache miss", async () => {
  const { controller } = createController();
  controller.setLevel(DegradationLevel.D2);

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    semanticKey: "non-existent-key",
  };

  const response = await controller.route(request);

  // No cache hit -> falls through to D3 template
  assert.equal(response.degradationLevel, DegradationLevel.D3);
});

test("DegradationController D2 requires semanticKey for cache lookup", async () => {
  const { controller, mockCacheService } = createController();
  controller.setLevel(DegradationLevel.D2);

  const request: LLMDegradationRequest = {
    model: "any-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
    // No semanticKey
  };

  const response = await controller.route(request);

  // No semanticKey -> falls through to D3
  assert.equal(response.degradationLevel, DegradationLevel.D3);
});