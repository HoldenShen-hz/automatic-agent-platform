import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker, CircuitBreakerOpenError, UnifiedChatProvider } from "../../../../src/platform/model-gateway/provider-registry/index.js";
import { ModelGatewayCacheService, ModelGatewayFallbackService } from "../../../../src/platform/model-gateway/router/index.js";
import {
  DegradationController,
  DegradationLevel,
  type LLMDegradationRequest,
  type ProviderMetrics,
} from "../../../../src/platform/model-gateway/degradation/index.js";
import { ModelRoutingService } from "../../../../src/platform/model-gateway/index.js";

test("ModelGateway: UnifiedChatProvider multi-provider circuit breaker integration", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-anthropic-key" },
    openai: { apiKey: "test-openai-key" },
    minimax: { apiKey: "test-minimax-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);
  assert.equal(provider.hasProvider("minimax"), true);

  provider.dispose();

  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("ModelGateway: CircuitBreaker state transitions", () => {
  const breaker = new CircuitBreaker({ name: "test-breaker", failureThreshold: 3 });

  assert.equal(breaker.getState(), "closed");

  breaker.onFailure();
  assert.equal(breaker.getMetrics().consecutiveFailures, 1);

  breaker.onFailure();
  assert.equal(breaker.getMetrics().consecutiveFailures, 2);

  breaker.onFailure();
  assert.equal(breaker.getMetrics().consecutiveFailures, 3);
  assert.equal(breaker.getState(), "open");

  // Open circuit should reject execution
  assert.rejects(
    () => breaker.execute(async () => "should not execute"),
    (err: unknown) => err instanceof CircuitBreakerOpenError && err.circuitName === "test-breaker",
  );

  // After onSuccess from open state, goes to half_open (not closed directly)
  breaker.onSuccess();
  // In open state, onSuccess just records the success; state stays open
  // until execute() is called after resetTimeout
  // Verify the state hasn't changed to closed yet
  assert.equal(breaker.getMetrics().state, "open");

  // Verify circuit breaker correctly tracks success/failure counts
  const metrics = breaker.getMetrics();
  assert.equal(metrics.successes, 1);
  assert.equal(metrics.failures, 3);
});

test("ModelGateway: CircuitBreaker half-open recovery", async () => {
  const breaker = new CircuitBreaker({
    name: "test-recovery",
    failureThreshold: 2,
    resetTimeoutMs: 50,
    halfOpenSuccessThreshold: 2,
  });

  // Trigger open state
  breaker.onFailure();
  breaker.onFailure();
  assert.equal(breaker.getState(), "open");

  // Wait for recovery attempt
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(breaker.getState(), "half_open");

  // Two successes should close the circuit
  breaker.onSuccess();
  breaker.onSuccess();
  assert.equal(breaker.getState(), "closed");
});

test("ModelGateway: Cache service stores and retrieves entries", () => {
  const cache = new ModelGatewayCacheService<string>();

  const cacheKey = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "hello world" }],
  });

  cache.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "reasoning",
    value: "cached response content",
    ttlMs: 60000,
  });

  const entry = cache.get(cacheKey);
  assert.notEqual(entry, null);
  assert.equal(entry?.value, "cached response content");
  assert.equal(entry?.model, "gpt-4o");
});

test("ModelGateway: Cache service expires entries", () => {
  const cache = new ModelGatewayCacheService<string>();

  const cacheKey = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "claude-opus",
    routeClass: "coding",
    messages: [{ role: "user", content: "expire test" }],
  });

  // Put entry with very short TTL
  cache.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "claude-opus",
    routeClass: "coding",
    value: "should be expired",
    ttlMs: 10,
  });

  // Entry should be present immediately
  assert.notEqual(cache.get(cacheKey), null);

  // Wait for expiration
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(cache.get(cacheKey), null);
      resolve();
    }, 20);
  });
});

test("ModelGateway: Fallback service selects cheapest healthy candidate", () => {
  const fallback = new ModelGatewayFallbackService();

  const decision = fallback.selectFallback({
    primaryProfileName: "premium-model",
    candidates: [
      { profileName: "premium-model", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 10.0 },
      { profileName: "balanced-model", provider: "openai", tier: "balanced", healthy: true, inputCostPer1kUsd: 2.0 },
      { profileName: "fast-model", provider: "anthropic", tier: "fast", healthy: true, inputCostPer1kUsd: 0.5 },
    ],
  });

  assert.equal(decision.selectedProfileName, "fast-model");
  assert.equal(decision.reasonCode, "fallback.healthy_alternative_selected");
  assert.ok(decision.attemptedProfiles.includes("premium-model"));
});

test("ModelGateway: Fallback service returns no candidate when none healthy", () => {
  const fallback = new ModelGatewayFallbackService();

  const decision = fallback.selectFallback({
    primaryProfileName: "premium-model",
    candidates: [
      { profileName: "premium-model", provider: "openai", tier: "reasoning", healthy: false, inputCostPer1kUsd: 10.0 },
      { profileName: "another-model", provider: "openai", tier: "balanced", healthy: false, inputCostPer1kUsd: 2.0 },
    ],
  });

  assert.equal(decision.selectedProfileName, null);
  assert.equal(decision.reasonCode, "fallback.no_candidate_available");
});

test("ModelGateway: DegradationController D0 routes to primary provider", () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({ openai: { apiKey: "test-key" } });

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
  assert.equal(controller.getLastEscalationReason(), null);
});

test("ModelGateway: DegradationController escalates on error", () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({ openai: { apiKey: "invalid-key" } });

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
  });

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);

  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("ModelGateway: DegradationController maximum level is D4", () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({});

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
  });

  // Escalate beyond D4
  controller.escalate();
  controller.escalate();
  controller.escalate();
  controller.escalate();
  controller.escalate(); // Should not go beyond D4

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D4);
});

test("ModelGateway: DegradationController deescalates when health recovers", () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({});

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
    config: {
      escalateErrorRateThreshold: 50,
      deescalateErrorRateThreshold: 5,
      escalateLatencyP99Ms: 5000,
      deescalateMinHealthyCount: 2,
      maxAutoDeescalateLevel: DegradationLevel.D0,
    },
  });

  // Start at D2
  controller.setLevel(DegradationLevel.D2);

  // Provide healthy metrics
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

  const result1 = controller.evaluateHealth(healthyMetrics);
  assert.equal(result1.action, "maintain");

  const result2 = controller.evaluateHealth(healthyMetrics);
  assert.equal(result2.action, "deescalate");
  assert.equal(result2.newLevel, DegradationLevel.D1);
});

test("ModelGateway: DegradationController D4 throws service unavailable", async () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({});

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
  });

  controller.setLevel(DegradationLevel.D4);

  const request: LLMDegradationRequest = {
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "hello" }],
  };

  await assert.rejects(
    () => controller.route(request),
    /LLM service is currently unavailable/,
  );
});

test("ModelGateway: DegradationController D3 returns template response", async () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({});

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
    templates: {
      default: "Custom unavailable message",
      coding: "Coding service temporarily unavailable",
    },
  });

  controller.setLevel(DegradationLevel.D3);

  const request: LLMDegradationRequest = {
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "hello" }],
    taskType: "default",
  };

  const response = await controller.route(request);

  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.equal(response.content, "Custom unavailable message");
  assert.equal(response.model, "template");
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("ModelGateway: DegradationController TTFT >10s triggers escalation", () => {
  const cache = new ModelGatewayCacheService<string>();
  const fallback = new ModelGatewayFallbackService();
  const provider = new UnifiedChatProvider({});

  const controller = new DegradationController({
    primaryProvider: provider,
    fallbackService: fallback,
    cacheService: cache,
  });

  // High TTFT metric
  const badMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 100,
    failedRequests: 5,
    errorRate: 5,
    latencyP99Ms: 3000,
    ttftP99Ms: 15000, // >10s triggers escalation per spec
    lastUpdated: new Date().toISOString(),
  };

  controller.setLevel(DegradationLevel.D0);
  const result = controller.evaluateHealth(badMetrics);

  assert.equal(result.action, "escalate");
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);
  assert.ok(result.reason.includes("ttft_p99"));
});

test("ModelGateway: Cache key building is deterministic", () => {
  const cache = new ModelGatewayCacheService<string>();

  const key1 = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "hello" }],
  });

  const key2 = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "hello" }],
  });

  assert.equal(key1, key2);

  // Different messages should produce different keys
  const key3 = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "different" }],
  });

  assert.notEqual(key1, key3);
});

test("ModelGateway: Cache invalidation works", () => {
  const cache = new ModelGatewayCacheService<string>();

  const cacheKey = cache.buildCacheKey({
    tenantId: "tenant-1",
    model: "claude-opus",
    routeClass: "coding",
    messages: [{ role: "user", content: "test" }],
  });

  cache.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "claude-opus",
    routeClass: "coding",
    value: "test-value",
  });

  assert.notEqual(cache.get(cacheKey), null);

  const removed = cache.invalidate(cacheKey);
  assert.equal(removed, true);
  assert.equal(cache.get(cacheKey), null);

  // Second invalidation returns false
  const removedAgain = cache.invalidate(cacheKey);
  assert.equal(removedAgain, false);
});

test("ModelGateway: Provider dispose clears all state", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
    openai: { apiKey: "test-key" },
    minimax: { apiKey: "test-key" },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);
  assert.equal(provider.hasProvider("minimax"), true);

  provider.dispose();

  assert.equal(provider.hasProvider("anthropic"), false);
  assert.equal(provider.hasProvider("openai"), false);
  assert.equal(provider.hasProvider("minimax"), false);
});

test("ModelGateway: UnifiedChatProvider complete uses configured model", async () => {
  const provider = new UnifiedChatProvider({
    // Only configured with anthropic, not openai
    anthropic: { apiKey: "test-key" },
  });

  // complete() with no model specified uses the bundled MiniMax default model.
  // Since minimax is not configured, it should throw provider not configured.
  await assert.rejects(
    () => provider.complete("test prompt"),
    /MiniMax provider is not configured/,
  );
});

test("ModelGateway: CircuitBreaker preserves success/failure counts across state transitions", () => {
  const breaker = new CircuitBreaker({ name: "counter-test", failureThreshold: 3 });

  breaker.onSuccess();
  breaker.onSuccess();
  breaker.onFailure();

  const metrics = breaker.getMetrics();

  assert.equal(metrics.successes, 2);
  assert.equal(metrics.failures, 1);
  assert.equal(metrics.consecutiveFailures, 1);
  assert.equal(metrics.consecutiveSuccesses, 0);
});
