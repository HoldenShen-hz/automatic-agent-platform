/**
 * Model Health Check Tests
 * Tests circuit breaker state machine, health metrics, degradation level
 * transitions, TTFT thresholds, and health evaluation logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CIRCUIT_BREAKER_EVENTS,
  type CircuitBreakerState,
  type CircuitBreakerOptions,
  type CircuitBreakerMetrics,
  type CircuitBreakerStateChangePayload,
} from "../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";
import {
  DegradationController,
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  type ProviderMetrics,
  type LLMDegradationRequest,
} from "../../../../src/platform/model-gateway/degradation/degradation-controller.js";

test("CircuitBreaker starts in closed state", () => {
  const cb = new CircuitBreaker({ name: "test" });
  assert.equal(cb.getState(), "closed");
});

test("CircuitBreaker execute succeeds in closed state", async () => {
  const cb = new CircuitBreaker({ name: "test" });
  const result = await cb.execute(async () => "success");
  assert.equal(result, "success");
});

test("CircuitBreaker transitions to open after failure threshold", async () => {
  const cb = new CircuitBreaker({
    name: "test",
    failureThreshold: 3,
    resetTimeoutMs: 1000,
  });

  for (let i = 0; i < 3; i++) {
    try {
      await cb.execute(async () => { throw new Error("fail"); });
    } catch {
      // Expected
    }
  }

  assert.equal(cb.getState(), "open");
});

test("CircuitBreakerExecute throws CircuitBreakerOpenError when open", async () => {
  const cb = new CircuitBreaker({
    name: "test",
    failureThreshold: 1,
    resetTimeoutMs: 60000,
  });

  try {
    await cb.execute(async () => { throw new Error("fail"); });
  } catch {
    // Expected failure
  }

  // Now circuit is open
  try {
    await cb.execute(async () => "should fail");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof CircuitBreakerOpenError);
    assert.equal(err.circuitName, "test");
  }
});

test("CircuitBreaker transitions to half_open after reset timeout", async () => {
  const cb = new CircuitBreaker({
    name: "test",
    failureThreshold: 1,
    resetTimeoutMs: 10,
  });

  try {
    await cb.execute(async () => { throw new Error("fail"); });
  } catch {
    // Expected
  }

  assert.equal(cb.getState(), "open");

  // Wait for reset timeout
  await new Promise(resolve => setTimeout(resolve, 20));

  // Transition should happen on next getState call
  assert.equal(cb.getState(), "half_open");
});

test("CircuitBreaker transitions to closed after success threshold in half_open", async () => {
  const cb = new CircuitBreaker({
    name: "test",
    failureThreshold: 1,
    resetTimeoutMs: 10,
    halfOpenSuccessThreshold: 2,
  });

  // Open the circuit
  try {
    await cb.execute(async () => { throw new Error("fail"); });
  } catch {
    // Expected
  }

  // Wait for reset timeout
  await new Promise(resolve => setTimeout(resolve, 20));

  // Get state to trigger transition to half_open
  cb.getState();

  // Now succeed in half_open
  await cb.execute(async () => "success1");
  await cb.execute(async () => "success2");

  assert.equal(cb.getState(), "closed");
});

test("CircuitBreaker records success and updates metrics", async () => {
  const cb = new CircuitBreaker({ name: "test" });
  await cb.execute(async () => "success");

  const metrics = cb.getMetrics();
  assert.equal(metrics.successes, 1);
  assert.equal(metrics.failures, 0);
  assert.equal(metrics.consecutiveSuccesses, 0);
  assert.equal(metrics.consecutiveFailures, 0);
});

test("CircuitBreaker records failure and updates metrics", async () => {
  const cb = new CircuitBreaker({ name: "test" });

  try {
    await cb.execute(async () => { throw new Error("fail"); });
  } catch {
    // Expected
  }

  const metrics = cb.getMetrics();
  assert.equal(metrics.failures, 1);
  assert.equal(metrics.successes, 0);
  assert.equal(metrics.consecutiveFailures, 1);
});

test("CircuitBreaker getMetrics returns correct state", () => {
  const cb = new CircuitBreaker({ name: "test" });

  const metrics = cb.getMetrics();
  assert.equal(metrics.state, "closed");
  assert.equal(metrics.totalRequests, 0);
  assert.ok(metrics.recentFailureRate >= 0);
});

test("CircuitBreaker emits state change event", () => {
  let eventPayload: CircuitBreakerStateChangePayload | null = null;

  const cb = new CircuitBreaker({
    name: "test",
    onStateChange: (payload) => {
      eventPayload = payload;
    },
  });

  // Open the circuit
  for (let i = 0; i < 5; i++) {
    try {
      cb.onFailure();
    } catch {
      // Expected after circuit opens
    }
  }

  assert.ok(eventPayload != null);
  assert.equal(eventPayload.circuitName, "test");
  assert.equal(eventPayload.oldState, "closed");
  assert.equal(eventPayload.newState, "open");
});

test("CircuitBreaker with custom options works correctly", () => {
  const cb = new CircuitBreaker({
    name: "custom-test",
    failureThreshold: 10,
    resetTimeoutMs: 60000,
    halfOpenSuccessThreshold: 5,
    monitorWindowMs: 30000,
    minSampleSize: 5,
  });

  assert.equal(cb.getState(), "closed");

  const metrics = cb.getMetrics();
  assert.equal(metrics.state, "closed");
});

test("CircuitBreaker recent failure rate calculation", async () => {
  const cb = new CircuitBreaker({
    name: "test",
    monitorWindowMs: 1000,
    minSampleSize: 2,
  });

  // Record some successes and failures
  await cb.execute(async () => "success");
  try {
    await cb.execute(async () => { throw new Error("fail"); });
  } catch {
    // Expected
  }

  const metrics = cb.getMetrics();
  assert.ok(metrics.recentFailureRate >= 0);
  assert.ok(metrics.recentFailureRate <= 1);
});

test("DegradationController evaluates health with TTFT threshold", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  // TTFT healthy
  const healthyMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 5,
    errorRate: 5,
    latencyP99Ms: 1000,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  };

  const healthyResult = controller.evaluateHealth(healthyMetrics);
  assert.equal(healthyResult.newLevel, DegradationLevel.D0);
});

test("DegradationController escalates on TTFT threshold exceeded", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  // TTFT exceeds 10000ms threshold
  const badMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 5,
    errorRate: 5,
    latencyP99Ms: 1000,
    ttftP99Ms: 15000,
    lastUpdated: new Date().toISOString(),
  };

  controller.reset();
  const result = controller.evaluateHealth(badMetrics);
  assert.equal(result.action, "escalate");
});

test("DegradationController escalates on error rate threshold", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  // Error rate > 50%
  const badMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 60,
    errorRate: 60,
    latencyP99Ms: 1000,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  };

  controller.reset();
  const result = controller.evaluateHealth(badMetrics);
  assert.equal(result.action, "escalate");
});

test("DegradationController escalates on latency threshold", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  // Latency P99 > 5000ms
  const badMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 5,
    errorRate: 5,
    latencyP99Ms: 6000,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  };

  controller.reset();
  const result = controller.evaluateHealth(badMetrics);
  assert.equal(result.action, "escalate");
});

test("DegradationController deescalates after consecutive healthy checks", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
    config: {
      deescalateMinHealthyCount: 3,
    },
  });

  // First, escalate to D1
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);

  // Then evaluate healthy multiple times
  const healthyMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 200,
    lastUpdated: new Date().toISOString(),
  };

  controller.evaluateHealth(healthyMetrics);
  controller.evaluateHealth(healthyMetrics);
  const result = controller.evaluateHealth(healthyMetrics);

  assert.equal(result.action, "deescalate");
});

test("DegradationController reset returns to D0", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  controller.escalate();
  controller.escalate();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D2);

  controller.reset();
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController setLevel forces specific level", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  controller.setLevel(DegradationLevel.D3);
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D3);

  controller.setLevel(DegradationLevel.D1);
  assert.equal(controller.getCurrentLevel(), DegradationLevel.D1);
});

test("DegradationController setLevel rejects invalid levels", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
  });

  assert.throws(() => {
    controller.setLevel(5 as DegradationLevel);
  }, /Invalid degradation level/);

  assert.throws(() => {
    controller.setLevel(-1 as DegradationLevel);
  }, /Invalid degradation level/);
});

test("DegradationController maintains consecutive healthy count", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
    config: {
      deescalateMinHealthyCount: 3,
    },
  });

  const healthyMetrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 200,
    lastUpdated: new Date().toISOString(),
  };

  controller.evaluateHealth(healthyMetrics);
  controller.evaluateHealth(healthyMetrics);

  // Unhealthy check resets counter
  const unhealthyMetrics: ProviderMetrics = {
    ...healthyMetrics,
    errorRate: 10,
  };
  controller.evaluateHealth(unhealthyMetrics);

  // After unhealthy, need 3 more healthy checks
  controller.evaluateHealth(healthyMetrics);
  controller.evaluateHealth(healthyMetrics);
  const result = controller.evaluateHealth(healthyMetrics);

  // Still maintaining, not yet recovered
  assert.equal(result.action, "maintain");
});

test("CircuitBreakerOpenError has correct properties", async () => {
  const cb = new CircuitBreaker({ name: "test-circuit" });
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();
  cb.onFailure();

  try {
    await cb.execute(async () => "fail");
    assert.fail("Should throw");
  } catch (err) {
    if (err instanceof CircuitBreakerOpenError) {
      assert.equal(err.circuitName, "test-circuit");
      assert.ok(err.retryAfterMs !== null);
    }
  }
});

test("DegradationController TTFT threshold from config", () => {
  const mockProvider = createMockProvider();
  const mockFallback = createMockFallbackService();
  const mockCache = createMockCacheService();

  const controller = new DegradationController({
    primaryProvider: mockProvider as any,
    fallbackService: mockFallback as any,
    cacheService: mockCache as any,
    config: {
      escalateTtftMs: 5000,
    },
  });

  const metrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4",
    totalRequests: 100,
    failedRequests: 1,
    errorRate: 1,
    latencyP99Ms: 500,
    ttftP99Ms: 6000,
    lastUpdated: new Date().toISOString(),
  };

  controller.reset();
  const result = controller.evaluateHealth(metrics);
  assert.equal(result.action, "escalate");
  assert.ok(result.reason.includes("ttft_p99"));
});

function createMockProvider() {
  return {
    createChatCompletion: async () => ({
      content: "mock response",
      model: "mock",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      id: "mock-id",
      provider: "mock",
    }),
  };
}

function createMockFallbackService() {
  return {
    selectFallback: () => ({
      selectedProfileName: null,
      reasonCode: "no_candidate",
      degradedFromProfileName: "primary",
      attemptedProfiles: [],
    }),
  };
}

function createMockCacheService() {
  const entries = new Map();
  return {
    put: (input: { cacheKey: string; value: string }) => {
      entries.set(input.cacheKey, input.value);
    },
    get: (key: string) => {
      return entries.get(key) ? { value: entries.get(key), model: "mock" } : null;
    },
  };
}
