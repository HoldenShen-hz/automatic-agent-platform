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

/**
 * Mock UnifiedChatProvider for testing
 */
class MockUnifiedChatProvider {
  public chat = mock.fn(async (request: { model: string; messages: readonly { role: string; content: string }[] }) => {
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
  public selectFallback = mock.fn(() => null);
}

/**
 * Mock ModelGatewayCacheService
 */
class MockCacheService {
  private readonly entries = new Map<string, { value: string; model: string }>();

  public put(input: { cacheKey: string; value: string; model: string }): void {
    this.entries.set(input.cacheKey, { value: input.value, model: input.model });
  }

  public get(cacheKey: string): { value: string; model: string } | null {
    return this.entries.get(cacheKey) ?? null;
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

    it("should cache successful response for D2 fallback", async () => {
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
    });
  });

  describe("escalation", () => {
    it("should escalate to D1 when primary provider fails", async () => {
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
    });

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
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "escalate");
      assert.ok(result.newLevel > DegradationLevel.D0);
    });

    it("should escalate when latency P99 exceeds threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 5,
        errorRate: 5,
        latencyP99Ms: 6000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "escalate");
    });

    it("should maintain level when error rate is below threshold", () => {
      const metrics: ProviderMetrics = {
        provider: "openai",
        profileName: "gpt-4o",
        totalRequests: 100,
        failedRequests: 2,
        errorRate: 2,
        latencyP99Ms: 1000,
        lastUpdated: new Date().toISOString(),
      };

      const result = controller.evaluateHealth(metrics);

      assert.strictEqual(result.action, "maintain");
      assert.strictEqual(result.newLevel, DegradationLevel.D0);
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
        lastUpdated: new Date().toISOString(),
      };

      // First healthy check
      let result = controller.evaluateHealth(healthyMetrics);
      assert.strictEqual(result.action, "maintain");

      // Second healthy check
      result = controller.evaluateHealth(healthyMetrics);
      assert.strictEqual(result.action, "maintain");

      // Third healthy check - should deescalate
      result = controller.evaluateHealth(healthyMetrics);
      assert.strictEqual(result.action, "deescalate");
      assert.strictEqual(result.newLevel, DegradationLevel.D1);
    });
  });

  describe("reset", () => {
    it("should reset to D0", () => {
      controller.setLevel(DegradationLevel.D4);
      controller.reset();

      assert.strictEqual(controller.getCurrentLevel(), DegradationLevel.D0);
      assert.strictEqual(controller.getLastEscalationReason(), null);
    });
  });

  describe("setLevel validation", () => {
    it("should reject invalid degradation levels", () => {
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
  });
});
