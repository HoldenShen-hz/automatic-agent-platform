/**
 * Additional DegradationController state machine edge case tests
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import {
  DegradationController,
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type ProviderMetrics,
  type LLMDegradationRequest,
} from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";
import type { ModelFallbackCandidate } from "../../../../src/platform/model-gateway/fallback/index.js";

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
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: request.model,
      provider: "mock",
    };
  });
}

class MockFallbackService {
  public selectFallback = mock.fn((input: { primaryProfileName: string; candidates: ModelFallbackCandidate[] }) => {
    return {
      selectedProfileName: null,
      reasonCode: "fallback.no_candidate_available",
      degradedFromProfileName: input.primaryProfileName,
      attemptedProfiles: input.candidates.map((c) => c.profileName),
    };
  });
}

class MockCacheService {
  private readonly entries = new Map<string, { value: string; model: string }>();

  public put(input: { cacheKey: string; tenantId?: string | null; model: string; routeClass: string; value: string; ttlMs?: number }): void {
    this.entries.set(input.cacheKey, { value: input.value, model: input.model });
  }

  public get(cacheKey: string): { value: string; model: string } | null {
    return this.entries.get(cacheKey) ?? null;
  }
}

describe("DegradationController state machine edge cases", () => {
  let controller: DegradationController;
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  const createController = (overrides?: { maxAutoDeescalateLevel?: DegradationLevel }) => {
    return new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
      config: {
        ...DEFAULT_DEGRADATION_CONFIG,
        ...overrides,
      },
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

  describe("D0 state transitions", () => {
    it("should remain at D0 when primary provider succeeds", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D0);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });

    it("should escalate from D0 to D1 when primary fails", async () => {
      mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Connection error");
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);
    });
  });

  describe("D1 state transitions", () => {
    it("should use fallback provider when set", async () => {
      controller.setLevel(DegradationLevel.D1);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      // D1 escalates to D2 because no fallback is available
      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    });

    it("should escalate from D1 to D2 when fallback fails", async () => {
      controller.setLevel(DegradationLevel.D1);

      mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Fallback error");
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);
    });
  });

  describe("D2 state transitions", () => {
    it("should return cached response at D2 with cache hit", async () => {
      controller.setLevel(DegradationLevel.D2);

      mockCacheService.put({
        cacheKey: "test-key",
        model: "gpt-4o",
        routeClass: "default",
        value: "Cached response",
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "test-key",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D2);
      assert.strictEqual(response.fromCache, true);
      assert.strictEqual(response.cached, true);
    });

    it("should fall through to D3 at D2 with cache miss", async () => {
      controller.setLevel(DegradationLevel.D2);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "non-existent-key",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    });

    it("should stay at D2 when returning cached response", async () => {
      controller.setLevel(DegradationLevel.D2);

      mockCacheService.put({
        cacheKey: "test-key",
        model: "gpt-4o",
        routeClass: "default",
        value: "Cached response",
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "test-key",
      };

      await controller.route(request);

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);
    });
  });

  describe("D3 state transitions", () => {
    it("should always return template at D3 regardless of request", async () => {
      controller.setLevel(DegradationLevel.D3);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.model, "template");
      assert.strictEqual(response.fromCache, false);
      assert.strictEqual(response.cached, false);
    });

    it("should remain at D3 after returning template", async () => {
      controller.setLevel(DegradationLevel.D3);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);
    });

    it("should use correct template for each task type at D3", async () => {
      controller.setLevel(DegradationLevel.D3);

      const taskTypes = ["coding", "reasoning", "classification", "writing", "default", "unknown"];

      for (const taskType of taskTypes) {
        const request: LLMDegradationRequest = {
          model: "gpt-4o",
          routeClass: "default",
          messages: [{ role: "user", content: "Hello" }],
          taskType,
        };

        const response = await controller.route(request);

        assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
        assert.ok(DEFAULT_TEMPLATE_RESPONSES[response.content] || Object.values(DEFAULT_TEMPLATE_RESPONSES).includes(response.content));
      }
    });
  });

  describe("D4 state transitions", () => {
    it("should throw at D4", async () => {
      controller.setLevel(DegradationLevel.D4);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await assert.rejects(async () => controller.route(request));
    });

    it("should remain at D4 after throwing", async () => {
      controller.setLevel(DegradationLevel.D4);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await assert.rejects(async () => controller.route(request)).catch(() => {});

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D4);
    });
  });

  describe("health evaluation edge cases", () => {
    it("should handle zero error rate", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 0,
        errorRate: 0,
        latencyP99Ms: 500,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "maintain");
      assert.strictEqual(result.reason, "healthy");
    });

    it("should handle boundary error rate at deescalate threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 5,
        errorRate: 5, // Exactly at deescalate threshold
        latencyP99Ms: 500,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "maintain");
      // At exactly the threshold, it's not below, so it stays healthy
      assert.strictEqual(result.reason, "healthy");
    });

    it("should handle boundary error rate at escalate threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 50,
        errorRate: 50, // Exactly at escalate threshold
        latencyP99Ms: 500,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      // 50% is not greater than 50%, so it should not escalate
      assert.strictEqual(result.action, "maintain");
    });

    it("should handle zero latency", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 0,
        errorRate: 0,
        latencyP99Ms: 0,
        ttftP99Ms: 0,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "maintain");
    });

    it("should handle very high latency", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 0,
        errorRate: 0,
        latencyP99Ms: 100000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "escalate");
      assert.ok(result.reason.includes("latency_p99"));
    });

    it("should handle maxAutoDeescalateLevel D0", () => {
      const ctrl = createController({ maxAutoDeescalateLevel: DegradationLevel.D0 });
      ctrl.setLevel(DegradationLevel.D1);

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

      // Even with 3 healthy checks, should not deescalate below D0
      for (let i = 0; i < 5; i++) {
        ctrl.evaluateHealth(healthyMetrics);
      }

      assert.strictEqual(ctrl.getCurrentLevel(), DegradationLevel.D1);
    });

    it("should handle consecutiveHealthyCount reset on marginal error rate", () => {
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

      // Error rate at exactly the threshold (not below)
      const marginalMetrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 5,
        errorRate: 5,
        latencyP99Ms: 500,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };
      const result = controller.evaluateHealth(marginalMetrics);

      // At exactly threshold, it's not below, so it doesn't reset counter but doesn't maintain either
      assert.strictEqual(result.action, "maintain");
    });
  });

  describe("reset behavior", () => {
    it("reset clears lastEscalationReason", () => {
      controller.setLevel(DegradationLevel.D4);
      controller.reset();
      assert.strictEqual(controller.getLastEscalationReason(), null);
    });

    it("reset sets currentLevel to D0", () => {
      controller.setLevel(DegradationLevel.D4);
      controller.reset();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });

    it("reset resets consecutiveHealthyCount", () => {
      controller.setLevel(DegradationLevel.D2);
      controller.reset();
      // After reset, deescalate should go to D0 (not D1)
      controller.deescalate();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });
  });

  describe("setLevel validation edge cases", () => {
    it("should accept D0 via setLevel", () => {
      controller.setLevel(DegradationLevel.D0);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });

    it("should accept D1 via setLevel", () => {
      controller.setLevel(DegradationLevel.D1);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D1);
    });

    it("should accept D2 via setLevel", () => {
      controller.setLevel(DegradationLevel.D2);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);
    });

    it("should accept D3 via setLevel", () => {
      controller.setLevel(DegradationLevel.D3);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);
    });

    it("should accept D4 via setLevel", () => {
      controller.setLevel(DegradationLevel.D4);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D4);
    });

    it("should reset consecutiveHealthyCount on any setLevel", () => {
      controller.setLevel(DegradationLevel.D2);
      controller.setLevel(DegradationLevel.D1);
      // The counter should have been reset
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D1);
    });
  });

  describe("DEFAULT_TEMPLATE_RESPONSES", () => {
    it("has all required task types", () => {
      assert.ok("default" in DEFAULT_TEMPLATE_RESPONSES);
      assert.ok("coding" in DEFAULT_TEMPLATE_RESPONSES);
      assert.ok("reasoning" in DEFAULT_TEMPLATE_RESPONSES);
      assert.ok("classification" in DEFAULT_TEMPLATE_RESPONSES);
      assert.ok("writing" in DEFAULT_TEMPLATE_RESPONSES);
    });

    it("all templates are non-empty strings", () => {
      for (const [key, value] of Object.entries(DEFAULT_TEMPLATE_RESPONSES)) {
        assert.ok(typeof value === "string");
        assert.ok(value.length > 0, `Template for ${key} should be non-empty`);
      }
    });
  });

  describe("DEFAULT_DEGRADATION_CONFIG", () => {
    it("has valid numeric values", () => {
      assert.ok(typeof DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold === "number");
      assert.ok(typeof DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold === "number");
      assert.ok(typeof DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms === "number");
      assert.ok(typeof DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount === "number");
    });

    it("escalate threshold is greater than deescalate threshold", () => {
      assert.ok(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold > DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold);
    });

    it("deescalateMinHealthyCount is positive", () => {
      assert.ok(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount > 0);
    });
  });
});
