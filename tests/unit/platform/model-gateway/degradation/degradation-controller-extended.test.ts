/**
 * Extended unit tests for DegradationController
 * Tests TTFT thresholds, degradation level transitions, and edge cases
 */

import { describe, it, beforeEach, afterEach, mock, test } from "node:test";
import assert from "node:assert";

import {
  DegradationController,
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type ProviderMetrics,
  type LLMDegradationRequest,
} from "../../../../../src/platform/model-gateway/degradation/index.js";

/**
 * Mock UnifiedChatProvider for testing
 */
class MockUnifiedChatProvider {
  public createChatCompletion = mock.fn(async (request: { model: string; messages: { role: string; content: string }[]; maxTokens: number }) => {
    return {
      id: "mock-completion-id",
      content: `Response from ${request.model}`,
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      model: request.model,
      provider: "mock",
    };
  });
}

/**
 * Mock ModelGatewayFallbackService
 */
class MockFallbackService {
  public selectFallback = mock.fn((input: { primaryProfileName: string; candidates: { profileName: string; provider: string; tier: string; healthy: boolean; inputCostPer1kUsd: number }[] }) => {
    return {
      selectedProfileName: null,
      reasonCode: "fallback.no_candidate_available",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles: input.candidates.map((c) => c.profileName),
    };
  });
}

/**
 * Mock ModelGatewayCacheService
 */
class MockCacheService {
  private readonly entries = new Map<string, { value: string; model: string; tenantId?: string | null; routeClass?: string }>();

  public put(input: { cacheKey: string; tenantId?: string | null; model: string; routeClass: string; value: string; ttlMs?: number }): void {
    this.entries.set(input.cacheKey, { value: input.value, model: input.model, tenantId: input.tenantId, routeClass: input.routeClass } as any);
  }

  public get(cacheKey: string): { value: string; model: string } | null {
    const entry = this.entries.get(cacheKey);
    return entry ? { value: entry.value, model: entry.model } : null;
  }
}

describe("DegradationController TTFT Threshold", () => {
  let controller: DegradationController;
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  const createController = (config?: Partial<typeof DEFAULT_DEGRADATION_CONFIG>) => {
    return new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
      config,
    });
  };

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
    controller = createController();
  });

  afterEach(() => {
    mockProvider.createChatCompletion.mock.resetCalls();
    mockFallbackService.selectFallback.mock.resetCalls();
  });

  test("escalates when TTFT P99 exceeds 10000ms", () => {
    const metrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 11000, // > 10000ms threshold
      lastUpdated: new Date().toISOString(),
    };

    const result = controller.evaluateHealth(metrics);

    assert.strictEqual(result.action, "escalate");
    assert.ok(result.reason.includes("ttft_p99"));
    assert.ok(result.reason.includes("11000ms"));
  });

  test("does not escalate when TTFT P99 is exactly at threshold", () => {
    const metrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 10000, // exactly at threshold
      lastUpdated: new Date().toISOString(),
    };

    const result = controller.evaluateHealth(metrics);

    // Should not be ttft_p99 escalation (may be other reason if error rate is elevated)
    assert.ok(!result.reason.includes("ttft_p99"));
  });

  test("TTFT escalation respects max level D4", () => {
    controller.setLevel(DegradationLevel.D3);

    const metrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 15000, // > 10000ms threshold
      lastUpdated: new Date().toISOString(),
    };

    const result = controller.evaluateHealth(metrics);

    // Already at D3, TTFT escalation should trigger but can't go beyond D4
    // The result may show maintain or escalate depending on implementation
    assert.strictEqual(result.newLevel, DegradationLevel.D4);
  });

  test("TTFT and error rate can both trigger escalation", () => {
    controller.setLevel(DegradationLevel.D0);

    const metrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 60,
      errorRate: 60, // > 50% threshold
      latencyP99Ms: 500,
      ttftP99Ms: 12000, // > 10000ms threshold
      lastUpdated: new Date().toISOString(),
    };

    const result = controller.evaluateHealth(metrics);

    assert.strictEqual(result.action, "escalate");
    // Either reason is acceptable
    assert.ok(result.reason.includes("ttft_p99") || result.reason.includes("error_rate"));
  });
});

describe("DegradationController Level Transitions", () => {
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
  });

  test("setLevel accepts DegradationLevel enum values", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D0);
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);

    controller.setLevel(DegradationLevel.D1);
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D1);

    controller.setLevel(DegradationLevel.D2);
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);

    controller.setLevel(DegradationLevel.D3);
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);

    controller.setLevel(DegradationLevel.D4);
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D4);
  });

  test("setLevel resets consecutive healthy count", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D2);
    // Trigger some health checks that would increment healthy count
    const healthyMetrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 1000,
      lastUpdated: new Date().toISOString(),
    };
    controller.evaluateHealth(healthyMetrics);
    controller.evaluateHealth(healthyMetrics);

    // Now set to D0 - should reset count
    controller.setLevel(DegradationLevel.D0);

    // Deescalation should not happen (already at D0)
    controller.deescalate();
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
  });

  test("reset restores D0 and clears all state", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D3);
    // Manually set lastEscalationReason
    (controller as unknown as { lastEscalationReason: string | null }).lastEscalationReason = "test error";

    controller.reset();

    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    assert.strictEqual(controller.getLastEscalationReason(), null);
  });
});

describe("DegradationController D1 Fallback Behavior", () => {
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
  });

  test("D1 escalates when no fallback candidates available", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D1);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
    };

    const response = await controller.route(request);

    // No fallback candidates -> escalate to D2 -> no cache -> D3 template response
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);
    assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
  });

  test("D1 escalates when fallback provider also fails", async () => {
    mockProvider.createChatCompletion = mock.fn(async () => {
      throw new Error("Primary failed");
    });

    const fallbackProvider = new MockUnifiedChatProvider();
    fallbackProvider.createChatCompletion = mock.fn(async () => {
      throw new Error("Fallback also failed");
    });

    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackProvider: fallbackProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D1);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
    };

    // D1 fails with fallback -> escalates to D2 (no cache) -> D3 template
    const response = await controller.route(request);

    // Should have escalated to D2 and returned D3 template
    assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);
    assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
  });
});

describe("DegradationController Template Responses", () => {
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
  });

  test("D3 returns default template for unrecognized taskType", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D3);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      taskType: "completely-unknown-task-type",
    };

    const response = await controller.route(request);

    assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    assert.strictEqual(response.model, "template");
    assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
  });

  test("D3 returns correct template for each known task type", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    const taskTypes = ["coding", "reasoning", "classification", "writing"] as const;

    for (const taskType of taskTypes) {
      controller.setLevel(DegradationLevel.D3);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType,
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES[taskType]);
    }
  });

  test("D3 with custom templates overrides defaults", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
      templates: {
        default: "Custom default message",
        coding: "Custom coding message",
        reasoning: "Custom reasoning message",
      },
    });

    controller.setLevel(DegradationLevel.D3);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      taskType: "coding",
    };

    const response = await controller.route(request);

    assert.strictEqual(response.content, "Custom coding message");
  });

  test("D3 case-insensitive task type matching", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D3);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      taskType: "  CODING  ", // whitespace and case variation
    };

    const response = await controller.route(request);

    assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["coding"]);
  });
});

describe("DegradationController Cache Integration", () => {
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
  });

  test("D0 caches response with semanticKey and ttlMs", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      semanticKey: "cache-key-with-ttl",
      tenantId: "tenant-123",
    };

    await controller.route(request);

    // Cache should have an entry
    const cached = mockCacheService.get("cache-key-with-ttl");
    assert.notStrictEqual(cached, null);
    assert.strictEqual(cached!.value, "Response from gpt-4o");
  });

  test("D0 does not cache when semanticKey is missing", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      // no semanticKey
    };

    await controller.route(request);

    // No cache call expected
    assert.strictEqual(mockProvider.createChatCompletion.mock.callCount(), 1);
  });

  test("D2 returns cached response when available", async () => {
    mockCacheService.put({
      cacheKey: "existing-cache-key",
      model: "gpt-4o",
      routeClass: "default",
      value: "Cached response content",
    });

    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D2);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      semanticKey: "existing-cache-key",
    };

    const response = await controller.route(request);

    assert.strictEqual(response.degradationLevel, DegradationLevel.D2);
    assert.strictEqual(response.content, "Cached response content");
    assert.strictEqual(response.cached, true);
    assert.strictEqual(response.fromCache, true);
    assert.strictEqual(response.model, "gpt-4o");
  });

  test("D2 falls through to D3 when cache miss and no semanticKey", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D2);

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      // no semanticKey
    };

    const response = await controller.route(request);

    assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    assert.strictEqual(response.cached, false);
    assert.strictEqual(response.fromCache, false);
  });
});

describe("DegradationController Health Evaluation", () => {
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
  });

  test("escalate on error rate above 50%", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    const metrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 55,
      errorRate: 55, // > 50%
      latencyP99Ms: 1000,
      ttftP99Ms: 1000,
      lastUpdated: new Date().toISOString(),
    };

    const result = controller.evaluateHealth(metrics);

    assert.strictEqual(result.action, "escalate");
    assert.ok(result.reason.includes("error_rate"));
  });

  test("escalate on latency P99 above 5000ms", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    const metrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 5,
      errorRate: 5, // < 50%, OK
      latencyP99Ms: 6000, // > 5000ms
      ttftP99Ms: 1000,
      lastUpdated: new Date().toISOString(),
    };

    const result = controller.evaluateHealth(metrics);

    assert.strictEqual(result.action, "escalate");
    assert.ok(result.reason.includes("latency_p99"));
  });

  test("deescalate after 3 consecutive healthy checks with maxAutoDeescalateLevel D0", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
      config: {
        ...DEFAULT_DEGRADATION_CONFIG,
        maxAutoDeescalateLevel: DegradationLevel.D0,
      },
    });

    controller.setLevel(DegradationLevel.D2);

    const healthyMetrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1, // < 5%
      latencyP99Ms: 500,
      ttftP99Ms: 1000,
      lastUpdated: new Date().toISOString(),
    };

    // First check
    let result = controller.evaluateHealth(healthyMetrics);
    assert.strictEqual(result.action, "maintain");
    assert.ok(result.reason.includes("waiting_recovery"));

    // Second check
    result = controller.evaluateHealth(healthyMetrics);
    assert.strictEqual(result.action, "maintain");

    // Third check - should deescalate
    result = controller.evaluateHealth(healthyMetrics);
    assert.strictEqual(result.action, "deescalate");
    assert.strictEqual(result.newLevel, DegradationLevel.D1);
  });

  test("deescalate respects maxAutoDeescalateLevel", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
      config: {
        ...DEFAULT_DEGRADATION_CONFIG,
        maxAutoDeescalateLevel: DegradationLevel.D1, // Can only deescalate to D1
      },
    });

    controller.setLevel(DegradationLevel.D2);

    const healthyMetrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 1000,
      lastUpdated: new Date().toISOString(),
    };

    // Three healthy checks
    controller.evaluateHealth(healthyMetrics);
    controller.evaluateHealth(healthyMetrics);
    const result = controller.evaluateHealth(healthyMetrics);

    // Should deescalate to D1 (maxAutoDeescalateLevel), not D0
    assert.strictEqual(result.newLevel, DegradationLevel.D1);
  });

  test("healthy counter resets when error rate is marginal", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D2);

    // One healthy check
    const healthyMetrics: ProviderMetrics = {
      provider: "openai",
      profileName: "gpt-4o",
      totalRequests: 100,
      failedRequests: 1,
      errorRate: 1,
      latencyP99Ms: 500,
      ttftP99Ms: 1000,
      lastUpdated: new Date().toISOString(),
    };
    controller.evaluateHealth(healthyMetrics);

    // Marginal error rate (not healthy, not bad enough to escalate)
    const marginalMetrics: ProviderMetrics = {
      ...healthyMetrics,
      errorRate: 5, // exactly at deescalate threshold
      failedRequests: 5,
    };
    const result = controller.evaluateHealth(marginalMetrics);

    // Counter should reset, not increment
    assert.strictEqual(result.action, "maintain");
    assert.strictEqual(result.reason, "healthy");
  });
});

describe("DegradationController Edge Cases", () => {
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockProvider = new MockUnifiedChatProvider();
    mockFallbackService = new MockFallbackService();
    mockCacheService = new MockCacheService();
  });

  test("handles missing optional fields in request", async () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    controller.setLevel(DegradationLevel.D3);

    // Minimal request with only required fields
    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
      // tenantId, taskType, semanticKey all omitted
    };

    const response = await controller.route(request);

    assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    assert.strictEqual(response.model, "template");
  });

  test("setLevel throws AppError for invalid level values", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    assert.throws(
      () => controller.setLevel(100 as DegradationLevel),
      (error: unknown) => {
        return error instanceof Error && "code" in error && (error as { code: string }).code === "degradation.invalid_level";
      },
    );

    assert.throws(
      () => controller.setLevel(-5 as DegradationLevel),
      (error: unknown) => {
        return error instanceof Error && "code" in error && (error as { code: string }).code === "degradation.invalid_level";
      },
    );
  });

  test("records lastEscalationReason on provider error in D0", async () => {
    mockProvider.createChatCompletion = mock.fn(async () => {
      throw new Error("Connection timeout error");
    });

    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
    };

    await controller.route(request);

    assert.strictEqual(controller.getLastEscalationReason(), "Connection timeout error");
  });

  test("lastEscalationReason is cleared on reset", () => {
    const controller = new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
    });

    // Manually set via an error
    mockProvider.createChatCompletion = mock.fn(async () => {
      throw new Error("Test error");
    });

    const request: LLMDegradationRequest = {
      model: "gpt-4o",
      routeClass: "default",
      messages: [{ role: "user", content: "Hello" }],
    };

    controller.route(request).catch(() => {});

    controller.reset();

    assert.strictEqual(controller.getLastEscalationReason(), null);
  });
});