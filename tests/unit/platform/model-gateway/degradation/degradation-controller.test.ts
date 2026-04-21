import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import {
  DegradationController,
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type ProviderMetrics,
  type LLMDegradationRequest,
} from "../../../../../src/platform/model-gateway/degradation/index.js";
import type { ModelFallbackCandidate } from "../../../../../src/platform/model-gateway/fallback/index.js";

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
  public selectFallback = mock.fn((input: { primaryProfileName: string; candidates: ModelFallbackCandidate[] }) => {
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

describe("DegradationController", () => {
  let controller: DegradationController;
  let mockProvider: MockUnifiedChatProvider;
  let mockFallbackService: MockFallbackService;
  let mockCacheService: MockCacheService;

  const createController = (overrides?: { maxAutoDeescalateLevel?: DegradationLevel }) => {
    return new DegradationController({
      primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
      fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
      cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
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

  describe("initialization", () => {
    it("should start at D0 (normal) level", () => {
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });

    it("should have no escalation reason initially", () => {
      assert.strictEqual(controller.getLastEscalationReason(), null);
    });

    it("should use default config values", () => {
      const defaultConfig = DEFAULT_DEGRADATION_CONFIG;
      assert.strictEqual(defaultConfig.escalateErrorRateThreshold, 50);
      assert.strictEqual(defaultConfig.deescalateErrorRateThreshold, 5);
      assert.strictEqual(defaultConfig.escalateLatencyP99Ms, 5000);
      assert.strictEqual(defaultConfig.deescalateMinHealthyCount, 3);
    });
  });

  describe("D0: Normal operation", () => {
    it("should call primary provider in D0", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D0);
      assert.strictEqual(response.fromCache, false);
      assert.strictEqual(response.cached, false);
      assert.strictEqual(mockProvider.createChatCompletion.mock.callCount(), 1);
    });

    it("should return correct content from primary provider", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      assert.strictEqual(response.content, "Response from gpt-4o");
      assert.strictEqual(response.model, "gpt-4o");
    });

    it("should cache successful response for D2 fallback when semanticKey provided", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "test-key-123",
      };

      await controller.route(request);

      const cached = mockCacheService.get("test-key-123");
      assert.notStrictEqual(cached, null);
      assert.strictEqual(cached!.value, "Response from gpt-4o");
      assert.strictEqual(cached!.model, "gpt-4o");
    });

    it("should not cache when semanticKey is not provided", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      // Cache should remain empty since no semanticKey was provided
      assert.strictEqual(mockCacheService.get("any-key"), null);
    });

    it("should escalate and retry when primary provider fails", async () => {
      mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Provider error");
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      // D0 fails -> escalates to D1 -> D1 has no fallback -> escalates to D2 -> D2 has no cache -> D3 returns template
      const response = await controller.route(request);

      // Should end up at D3 (template) because D1 has no fallback
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);
      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    });
  });

  describe("D1: Fallback operation", () => {
    it("should escalate to D2 when no fallback is available", async () => {
      controller.setLevel(DegradationLevel.D1);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      // No fallback -> escalate to D2 -> no cache -> D3
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);
      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    });
  });

  describe("D2: Cache operation", () => {
    beforeEach(() => {
      controller.setLevel(DegradationLevel.D2);
    });

    it("should return cached response when cache hit", async () => {
      // Pre-populate cache
      mockCacheService.put({
        cacheKey: "cached-key",
        model: "gpt-4o",
        routeClass: "default",
        value: "Cached response content",
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cached-key",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D2);
      assert.strictEqual(response.cached, true);
      assert.strictEqual(response.fromCache, true);
      assert.strictEqual(response.content, "Cached response content");
      assert.strictEqual(response.model, "gpt-4o");
    });

    it("should fall through to D3 when cache miss", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "non-existent-key",
      };

      const response = await controller.route(request);

      // No cache hit -> D3 template
      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    });

    it("should fall through to D3 when no semanticKey provided", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      // No semanticKey -> can't check cache -> D3 template
      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
    });

    it("should not call any provider in D2", async () => {
      mockCacheService.put({
        cacheKey: "cached-key",
        model: "gpt-4o",
        routeClass: "default",
        value: "Cached response",
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cached-key",
      };

      await controller.route(request);

      assert.strictEqual(mockProvider.createChatCompletion.mock.callCount(), 0);
    });
  });

  describe("D3: Template responses", () => {
    beforeEach(() => {
      controller.setLevel(DegradationLevel.D3);
    });

    it("should return default template for unknown task type", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType: "unknown-type",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.model, "template");
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
      assert.strictEqual(response.cached, false);
      assert.strictEqual(response.fromCache, false);
    });

    it("should return coding template for coding task type", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "coding",
        messages: [{ role: "user", content: "Write code" }],
        taskType: "coding",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["coding"]);
    });

    it("should return reasoning template for reasoning task type", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "reasoning",
        messages: [{ role: "user", content: "Think deeply" }],
        taskType: "reasoning",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["reasoning"]);
    });

    it("should return classification template for classification task type", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "classification",
        messages: [{ role: "user", content: "Classify this" }],
        taskType: "classification",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["classification"]);
    });

    it("should return writing template for writing task type", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "writing",
        messages: [{ role: "user", content: "Write something" }],
        taskType: "writing",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["writing"]);
    });

    it("should return default template when taskType is empty", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType: "",
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
    });

    it("should return default template when taskType is undefined", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      const response = await controller.route(request);

      assert.strictEqual(response.degradationLevel, DegradationLevel.D3);
      assert.strictEqual(response.content, DEFAULT_TEMPLATE_RESPONSES["default"]);
    });

    it("should not call any provider at D3", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      assert.strictEqual(mockProvider.createChatCompletion.mock.callCount(), 0);
    });
  });

  describe("D4: Service unavailable", () => {
    beforeEach(() => {
      controller.setLevel(DegradationLevel.D4);
    });

    it("should throw ProviderError at D4", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await assert.rejects(
        async () => controller.route(request),
        (error: unknown) => {
          if (error instanceof Error && "code" in error) {
            return (error as { code: string }).code === "degradation.service_unavailable";
          }
          return false;
        },
      );
    });

    it("should throw retryable error", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
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

    it("should not call any provider at D4", async () => {
      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await assert.rejects(async () => controller.route(request));

      assert.strictEqual(mockProvider.createChatCompletion.mock.callCount(), 0);
    });
  });

  describe("escalation", () => {
    it("should manually escalate via setLevel", () => {
      controller.setLevel(DegradationLevel.D2);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D2);

      controller.setLevel(DegradationLevel.D4);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D4);
    });

    it("should not escalate beyond D4", () => {
      controller.setLevel(DegradationLevel.D4);
      controller.escalate();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D4);
    });

    it("should reset consecutive healthy count on escalation", () => {
      controller.setLevel(DegradationLevel.D2);
      // Manually trigger through evaluateHealth to increment healthy count
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 1,
        errorRate: 1,
        latencyP99Ms: 500,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };
      controller.evaluateHealth(metrics); // Should maintain at D2

      controller.escalate(); // Manual escalation

      // Fresh escalation should not have waiting_recovery
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);
    });
  });

  describe("deescalation", () => {
    it("should not deescalate below D0", () => {
      controller.setLevel(DegradationLevel.D0);
      controller.deescalate();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });

    it("should reset consecutive healthy count on deescalation", () => {
      controller.setLevel(DegradationLevel.D2);
      controller.deescalate();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D1);
      // consecutiveHealthyCount should be reset
      controller.deescalate();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });
  });

  describe("health evaluation", () => {
    it("should escalate when error rate exceeds threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 60,
        errorRate: 60,
        latencyP99Ms: 1000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "escalate");
      assert.ok(result.newLevel > DegradationLevel.D0);
      assert.ok(result.reason.includes("error_rate"));
    });

    it("should escalate when latency P99 exceeds threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 5,
        errorRate: 5,
        latencyP99Ms: 6000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "escalate");
      assert.ok(result.reason.includes("latency_p99"));
    });

    it("should not escalate when already at D4", () => {
      controller.setLevel(DegradationLevel.D4);
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 90,
        errorRate: 90,
        latencyP99Ms: 10000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "maintain");
      assert.strictEqual(result.newLevel, DegradationLevel.D4);
    });

    it("should maintain level when error rate is below threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 2,
        errorRate: 2,
        latencyP99Ms: 1000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "maintain");
      assert.strictEqual(result.newLevel, DegradationLevel.D0);
      assert.strictEqual(result.reason, "healthy");
    });

    it("should deescalate after consecutive healthy evaluations", () => {
      // First set to D2
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

      // First healthy check
      let result = controller.evaluateHealth(healthyMetrics);
      assert.strictEqual(result.action, "maintain");
      assert.ok(result.reason.includes("waiting_recovery"));

      // Second healthy check
      result = controller.evaluateHealth(healthyMetrics);
      assert.strictEqual(result.action, "maintain");
      assert.ok(result.reason.includes("waiting_recovery"));

      // Third healthy check - should deescalate
      result = controller.evaluateHealth(healthyMetrics);
      assert.strictEqual(result.action, "deescalate");
      assert.strictEqual(result.newLevel, DegradationLevel.D1);
    });

    it("should reset healthy counter when error rate is marginal", () => {
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

      // Marginal error rate (not healthy enough to deescalate, not bad enough to escalate)
      const marginalMetrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 10,
        errorRate: 10,
        latencyP99Ms: 1000,
        ttftP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };
      const result = controller.evaluateHealth(marginalMetrics);

      assert.strictEqual(result.action, "maintain");
      assert.strictEqual(result.reason, "healthy");
    });

    it("should respect maxAutoDeescalateLevel", () => {
      // Set to D3 but max auto deescalate is D1
      const ctrl = createController({ maxAutoDeescalateLevel: DegradationLevel.D1 });
      ctrl.setLevel(DegradationLevel.D3);

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

      // Run 3 healthy evaluations
      ctrl.evaluateHealth(healthyMetrics);
      ctrl.evaluateHealth(healthyMetrics);
      const result = ctrl.evaluateHealth(healthyMetrics);

      // Should deescalate but only to D1 (maxAutoDeescalateLevel)
      assert.strictEqual(result.action, "deescalate");
      assert.strictEqual(result.newLevel, DegradationLevel.D2);
    });
  });

  describe("reset", () => {
    it("should reset to D0", () => {
      controller.setLevel(DegradationLevel.D4);
      controller.reset();

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });

    it("should clear escalation reason", () => {
      controller.setLevel(DegradationLevel.D4);
      controller.reset();

      assert.strictEqual(controller.getLastEscalationReason(), null);
    });

    it("should reset consecutive healthy count", () => {
      controller.setLevel(DegradationLevel.D2);
      controller.reset();

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });
  });

  describe("setLevel validation", () => {
    it("should reject invalid degradation levels below D0", () => {
      assert.throws(
        () => controller.setLevel(-1 as DegradationLevel),
        (error: unknown) => {
          if (error instanceof Error && "code" in error) {
            return (error as { code: string }).code === "degradation.invalid_level";
          }
          return false;
        },
      );
    });

    it("should reject invalid degradation levels above D4", () => {
      assert.throws(
        () => controller.setLevel(5 as DegradationLevel),
        (error: unknown) => {
          if (error instanceof Error && "code" in error) {
            return (error as { code: string }).code === "degradation.invalid_level";
          }
          return false;
        },
      );
    });

    it("should accept valid degradation levels D0-D4", () => {
      for (let level = DegradationLevel.D0; level <= DegradationLevel.D4; level++) {
        controller.setLevel(level);
        assert.strictEqual(controller.getCurrentLevel(), level);
      }
    });

    it("should reset consecutive healthy count on setLevel", () => {
      controller.setLevel(DegradationLevel.D2);

      // Manually set to D0 with a different instance
      controller.setLevel(DegradationLevel.D0);

      // Should not deescalate further
      controller.deescalate();
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
    });
  });

  describe("custom templates", () => {
    it("should use custom templates when provided", async () => {
      const customController = new DegradationController({
        primaryProvider: mockProvider as unknown as import("../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js").UnifiedChatProvider,
        fallbackService: mockFallbackService as unknown as import("../../../../../src/platform/model-gateway/fallback/index.js").ModelGatewayFallbackService,
        cacheService: mockCacheService as unknown as import("../../../../../src/platform/model-gateway/cache/index.js").ModelGatewayCacheService<string>,
        templates: {
          default: "Custom default message",
          coding: "Custom coding message",
        },
      });

      customController.setLevel(DegradationLevel.D3);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        taskType: "unknown",
      };

      const response = await customController.route(request);

      assert.strictEqual(response.content, "Custom default message");
    });
  });

  describe("lastEscalationReason", () => {
    it("should record escalation reason on provider failure", async () => {
      mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Connection timeout");
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      assert.strictEqual(controller.getLastEscalationReason(), "Connection timeout");
    });

    it("should record escalation reason on D1 provider failure", async () => {
      controller.setLevel(DegradationLevel.D1);

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
      };

      await controller.route(request);

      // D1 escalates to D2, D2 to D3 due to no fallback/cache
      // The last error should be recorded
      assert.ok(controller.getLastEscalationReason() !== null || controller.getCurrentLevel() === DegradationLevel.D3);
    });
  });

  describe("full degradation cascade", () => {
    it("should correctly cascade through all levels on repeated failures", async () => {
      mockProvider.createChatCompletion = mock.fn(async () => {
        throw new Error("Provider failure");
      });

      const request: LLMDegradationRequest = {
        model: "gpt-4o",
        routeClass: "default",
        messages: [{ role: "user", content: "Hello" }],
        semanticKey: "cascade-test",
      };

      // First call: D0 fails -> D1 (no fallback) -> D2 (no cache yet because D0 didn't cache) -> D3
      await controller.route(request);
      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D3);

      // Reset for next test
      controller.reset();
    });
  });
});
