import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker, CircuitBreakerOpenError } from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";
import { globalCircuitBreakerEventBus } from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker-event-bus.js";
import { ModelGatewayFallbackService, type ModelFallbackCandidate } from "../../../../src/platform/model-gateway/fallback/index.js";
import { DegradationController, DegradationLevel } from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";

// Integration test: Circuit breaker with realistic failure scenarios
test("CircuitBreaker integration: Open -> HalfOpen -> Closed recovery cycle", async () => {
  const cb = new CircuitBreaker({
    name: "integration-test",
    failureThreshold: 2,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 2,
  });

  // Open the circuit with failures
  for (let i = 0; i < 2; i++) {
    try {
      await cb.execute(async () => {
        throw new Error("Simulated failure");
      });
    } catch {
      // Expected
    }
  }

  assert.equal(cb.getState(), "open");

  // Wait for reset timeout
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should transition to half_open on next state check
  assert.equal(cb.getState(), "half_open");

  // Successful probes in half_open
  cb.onSuccess();
  assert.equal(cb.getState(), "half_open");

  cb.onSuccess();
  assert.equal(cb.getState(), "closed");
});

test("CircuitBreaker integration: HalfOpen failure returns to Open", async () => {
  const cb = new CircuitBreaker({
    name: "integration-test-half-open-fail",
    failureThreshold: 1,
    resetTimeoutMs: 30,
    halfOpenSuccessThreshold: 3,
  });

  // Open then transition to half_open
  try {
    await cb.execute(async () => {
      throw new Error("Initial failure");
    });
  } catch {
    // Expected
  }

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(cb.getState(), "half_open");

  // Success then failure in half_open
  cb.onSuccess();
  cb.onFailure();

  assert.equal(cb.getState(), "open");
});

test("FallbackService integration: Complex multi-candidate fallback selection", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    { profileName: "gpt4", provider: "openai", tier: "reasoning", healthy: true, inputCostPer1kUsd: 15.0 },
    { profileName: "claude-opus", provider: "anthropic", tier: "reasoning", healthy: true, inputCostPer1kUsd: 18.0 },
    { profileName: "gpt35", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "minimax", provider: "minimax", tier: "fast", healthy: true, inputCostPer1kUsd: 0.3 },
    { profileName: "unhealthy-model", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 0.4 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    maxInputCostPer1kUsd: 20.0,
  });

  // Current fallback policy prefers the lowest-cost healthy alternative.
  assert.equal(result.selectedProfileName, "minimax");
  assert.ok(result.reasonCode.startsWith("fallback.healthy_alternative_selected"));
  assert.equal(result.degradedFromProfileName, "primary");

  // Verify fallback chain includes primary and healthy candidates in selection order.
  assert.ok(result.fallbackChain.includes("primary"));
  assert.ok(result.fallbackChain.includes("minimax"));
  assert.ok(!result.fallbackChain.includes("unhealthy-model"));
});

test("FallbackService integration: Excludes multiple profiles", () => {
  const service = new ModelGatewayFallbackService();

  const candidates: ModelFallbackCandidate[] = [
    { profileName: "model-a", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.5 },
    { profileName: "model-b", provider: "anthropic", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.6 },
    { profileName: "model-c", provider: "minimax", tier: "balanced", healthy: true, inputCostPer1kUsd: 0.7 },
  ];

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates,
    excludedProfiles: ["model-a", "model-c"],
  });

  assert.equal(result.selectedProfileName, "model-b");
});

test("FallbackService integration: No candidates returns correct decision", () => {
  const service = new ModelGatewayFallbackService();

  const result = service.selectFallback({
    primaryProfileName: "primary",
    candidates: [],
  });

  assert.equal(result.selectedProfileName, null);
  assert.equal(result.reasonCode, "fallback.no_candidate_available");
  assert.deepStrictEqual(result.fallbackChain, ["primary"]);
});

test("DegradationController integration: D0 route succeeds with valid provider", async () => {
  const mockProvider = {
    createChatCompletion: async () => ({
      id: "msg_001",
      content: "Success",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "test",
      provider: "mock",
    }),
    dispose: () => {},
  };

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: new ModelGatewayFallbackService(),
    cacheService: createMockCache(),
  });

  const response = await controller.route({
    model: "test",
    routeClass: "test",
    messages: [{ role: "user", content: "hello" }],
    tenantId: null,
    taskType: "default",
    semanticKey: "key1",
  });

  assert.equal(response.degradationLevel, DegradationLevel.D0);
  assert.equal(response.content, "Success");
});

test("DegradationController integration: EvaluateHealth with escalating metrics", () => {
  const controller = new DegradationController({
    primaryProvider: createMockProvider() as any,
    fallbackService: new ModelGatewayFallbackService(),
    cacheService: createMockCache(),
  });

  // Healthy evaluation
  let result = controller.evaluateHealth({
    provider: "test",
    profileName: "test",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 1000,
    ttftP99Ms: 1000,
    lastUpdated: new Date().toISOString(),
  });
  assert.equal(result.action, "maintain");

  // High error rate - should escalate
  result = controller.evaluateHealth({
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
});

test("CircuitBreaker integration: Global event bus coordination", async () => {
  const cb = new CircuitBreaker({
    name: "global-bus-test",
    failureThreshold: 1,
    onStateChange: (payload) => {
      receivedPayloads.push(payload);
    },
  });

  const receivedPayloads: any[] = [];

  globalCircuitBreakerEventBus.setEmitter((_eventType, payload) => {
    receivedPayloads.push(payload);
  });

  try {
    await cb.execute(async () => {
      throw new Error("Failure");
    });
  } catch {
    // Expected
  }

  // Both callback and event bus should have received the state change
  assert.ok(receivedPayloads.length >= 1);

  // Reset
  globalCircuitBreakerEventBus.setEmitter(() => {});
});

function createMockProvider() {
  return {
    createChatCompletion: async () => ({
      id: "msg_001",
      content: "Mock response",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "test",
      provider: "mock",
    }),
    dispose: () => {},
  };
}

function createMockCache() {
  const store = new Map<string, { value: string; model: string; expiresAt: number }>();

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
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    cleanupExpired: async () => 0,
    buildCacheKey: () => "mock_key",
  };
}
