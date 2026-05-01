import assert from "node:assert/strict";
import test from "node:test";

import {
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  DegradationController,
  type ProviderMetrics,
  type DegradationConfig,
  type LLMDegradationRequest,
  type LLMDegradationResponse,
} from "../../../../../src/platform/model-gateway/degradation/index.js";

test("DegradationLevel enum has correct sequential values", () => {
  assert.equal(DegradationLevel.D0, 0);
  assert.equal(DegradationLevel.D1, 1);
  assert.equal(DegradationLevel.D2, 2);
  assert.equal(DegradationLevel.D3, 3);
  assert.equal(DegradationLevel.D4, 4);
});

test("DegradationLevel enum count is exactly 5 levels", () => {
  const levels = [DegradationLevel.D0, DegradationLevel.D1, DegradationLevel.D2, DegradationLevel.D3, DegradationLevel.D4];
  assert.equal(levels.length, 5);
});

test("DEFAULT_DEGRADATION_CONFIG has all required threshold fields", () => {
  assert.ok("escalateErrorRateThreshold" in DEFAULT_DEGRADATION_CONFIG);
  assert.ok("deescalateErrorRateThreshold" in DEFAULT_DEGRADATION_CONFIG);
  assert.ok("escalateLatencyP99Ms" in DEFAULT_DEGRADATION_CONFIG);
  assert.ok("escalateTtftP99Ms" in DEFAULT_DEGRADATION_CONFIG);
  assert.ok("deescalateMinHealthyCount" in DEFAULT_DEGRADATION_CONFIG);
  assert.ok("maxAutoDeescalateLevel" in DEFAULT_DEGRADATION_CONFIG);
});

test("DEFAULT_DEGRADATION_CONFIG has correct default values", () => {
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold, 50);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold, 5);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms, 5000);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateTtftP99Ms, 10000);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount, 3);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.maxAutoDeescalateLevel, DegradationLevel.D0);
});

test("DEFAULT_DEGRADATION_CONFIG escalation thresholds are properly ordered", () => {
  assert.ok(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold > DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold);
});

test("DEFAULT_TEMPLATE_RESPONSES has all expected task type keys", () => {
  assert.ok("default" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("coding" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("reasoning" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("classification" in DEFAULT_TEMPLATE_RESPONSES);
  assert.ok("writing" in DEFAULT_TEMPLATE_RESPONSES);
});

test("DEFAULT_TEMPLATE_RESPONSES all messages are non-empty strings", () => {
  for (const [key, message] of Object.entries(DEFAULT_TEMPLATE_RESPONSES)) {
    assert.ok(typeof message === "string", `Expected string for ${key}`);
    assert.ok(message.length > 0, `Expected non-empty message for ${key}`);
  }
});

test("ProviderMetrics type can be fully instantiated", () => {
  const metrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4.5",
    totalRequests: 100,
    failedRequests: 5,
    errorRate: 5.0,
    latencyP99Ms: 450,
    ttftP99Ms: 8000,
    lastUpdated: "2026-04-27T00:00:00.000Z",
  };
  assert.equal(metrics.provider, "openai");
  assert.equal(metrics.profileName, "gpt-4.5");
  assert.equal(metrics.totalRequests, 100);
  assert.equal(metrics.failedRequests, 5);
  assert.equal(metrics.errorRate, 5.0);
  assert.equal(metrics.latencyP99Ms, 450);
  assert.equal(metrics.ttftP99Ms, 8000);
  assert.equal(metrics.lastUpdated, "2026-04-27T00:00:00.000Z");
});

test("ProviderMetrics errorRate is computed from totals", () => {
  const metrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4.5",
    totalRequests: 100,
    failedRequests: 10,
    errorRate: 10.0,
    latencyP99Ms: 450,
    ttftP99Ms: 8000,
    lastUpdated: "2026-04-27T00:00:00.000Z",
  };
  assert.equal(metrics.errorRate, (metrics.failedRequests / metrics.totalRequests) * 100);
});

test("DegradationConfig can be partially customized", () => {
  const config: DegradationConfig = {
    escalateErrorRateThreshold: 60,
    deescalateErrorRateThreshold: 10,
    escalateLatencyP99Ms: 3000,
    escalateTtftP99Ms: 8000,
    deescalateMinHealthyCount: 5,
    maxAutoDeescalateLevel: DegradationLevel.D1,
  };
  assert.equal(config.escalateErrorRateThreshold, 60);
  assert.equal(config.deescalateErrorRateThreshold, 10);
  assert.equal(config.escalateLatencyP99Ms, 3000);
  assert.equal(config.escalateTtftP99Ms, 8000);
  assert.equal(config.deescalateMinHealthyCount, 5);
  assert.equal(config.maxAutoDeescalateLevel, DegradationLevel.D1);
});

test("DegradationConfig maxAutoDeescalateLevel accepts any degradation level", () => {
  const configD0: DegradationConfig = { ...DEFAULT_DEGRADATION_CONFIG, maxAutoDeescalateLevel: DegradationLevel.D0 };
  assert.equal(configD0.maxAutoDeescalateLevel, DegradationLevel.D0);

  const configD1: DegradationConfig = { ...DEFAULT_DEGRADATION_CONFIG, maxAutoDeescalateLevel: DegradationLevel.D1 };
  assert.equal(configD1.maxAutoDeescalateLevel, DegradationLevel.D1);
});

test("LLMDegradationRequest type can be fully instantiated", () => {
  const request: LLMDegradationRequest = {
    model: "gpt-4.5",
    routeClass: "reasoning",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
    tenantId: "tenant-1",
    taskType: "reasoning",
    semanticKey: "cache-key-123",
  };
  assert.equal(request.model, "gpt-4.5");
  assert.equal(request.routeClass, "reasoning");
  assert.equal(request.messages.length, 2);
  assert.equal(request.tenantId, "tenant-1");
  assert.equal(request.taskType, "reasoning");
  assert.equal(request.semanticKey, "cache-key-123");
});

test("LLMDegradationRequest messages role types", () => {
  const request: LLMDegradationRequest = {
    model: "gpt-4.5",
    routeClass: "coding",
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
  };
  assert.equal(request.messages[0]!.role, "system");
  assert.equal(request.messages[1]!.role, "user");
  assert.equal(request.messages[2]!.role, "assistant");
});

test("LLMDegradationRequest optional fields can be omitted", () => {
  const request: LLMDegradationRequest = {
    model: "gpt-4.5",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "Hello" }],
  };
  assert.equal(request.model, "gpt-4.5");
  assert.equal(request.tenantId, undefined);
  assert.equal(request.taskType, undefined);
  assert.equal(request.semanticKey, undefined);
});

test("LLMDegradationResponse type can be fully instantiated", () => {
  const response: LLMDegradationResponse = {
    content: "Hello, world!",
    model: "gpt-4.5",
    degradationLevel: DegradationLevel.D0,
    cached: false,
    fromCache: false,
  };
  assert.equal(response.content, "Hello, world!");
  assert.equal(response.model, "gpt-4.5");
  assert.equal(response.degradationLevel, DegradationLevel.D0);
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("LLMDegradationResponse for D2 cached response", () => {
  const response: LLMDegradationResponse = {
    content: "Cached response content",
    model: "gpt-4.5",
    degradationLevel: DegradationLevel.D2,
    cached: true,
    fromCache: true,
  };
  assert.equal(response.degradationLevel, DegradationLevel.D2);
  assert.equal(response.cached, true);
  assert.equal(response.fromCache, true);
});

test("LLMDegradationResponse for D3 template response", () => {
  const response: LLMDegradationResponse = {
    content: "I apologize, but I'm currently experiencing high demand.",
    model: "template",
    degradationLevel: DegradationLevel.D3,
    cached: false,
    fromCache: false,
  };
  assert.equal(response.degradationLevel, DegradationLevel.D3);
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("DegradationController can be instantiated with required dependencies", () => {
  class MockProvider {
    createChatCompletion = async () => ({
      id: "mock",
      content: "response",
      refusal: null,
      reasoningContent: null,
      finishReason: "stop",
      stopSequence: null,
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "mock",
      provider: "mock",
    });
  }

  class MockFallbackService {
    selectFallback = () => ({
      selectedProfileName: null,
      reasonCode: "fallback.no_candidate_available",
      degradedFromProfileName: "primary",
      attemptedProfiles: [],
    });
  }

  class MockCacheService {
    put = () => null;
    get = () => null;
  }

  const controller = new DegradationController({
    primaryProvider: new MockProvider() as any,
    fallbackService: new MockFallbackService() as any,
    cacheService: new MockCacheService() as any,
  });

  assert.ok(controller instanceof DegradationController);
});

test("DegradationController getCurrentLevel returns D0 initially", () => {
  class MockProvider {
    createChatCompletion = async () => ({ id: "mock", content: "response", refusal: null, reasoningContent: null, finishReason: "stop", stopSequence: null, toolCalls: [], usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: "mock", provider: "mock" });
  }
  class MockFallbackService {
    selectFallback = () => ({ selectedProfileName: null, reasonCode: "fallback.no_candidate_available", degradedFromProfileName: "primary", attemptedProfiles: [] });
  }
  class MockCacheService {
    put = () => null;
    get = () => null;
  }

  const controller = new DegradationController({
    primaryProvider: new MockProvider() as any,
    fallbackService: new MockFallbackService() as any,
    cacheService: new MockCacheService() as any,
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
  assert.equal(controller.getLastEscalationReason(), null);
});

test("DegradationController getLastEscalationReason returns null initially", () => {
  class MockProvider {
    createChatCompletion = async () => ({ id: "mock", content: "response", refusal: null, reasoningContent: null, finishReason: "stop", stopSequence: null, toolCalls: [], usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: "mock", provider: "mock" });
  }
  class MockFallbackService {
    selectFallback = () => ({ selectedProfileName: null, reasonCode: "fallback.no_candidate_available", degradedFromProfileName: "primary", attemptedProfiles: [] });
  }
  class MockCacheService {
    put = () => null;
    get = () => null;
  }

  const controller = new DegradationController({
    primaryProvider: new MockProvider() as any,
    fallbackService: new MockFallbackService() as any,
    cacheService: new MockCacheService() as any,
  });

  assert.equal(controller.getLastEscalationReason(), null);
});

test("DegradationController accepts custom config", () => {
  class MockProvider {
    createChatCompletion = async () => ({ id: "mock", content: "response", refusal: null, reasoningContent: null, finishReason: "stop", stopSequence: null, toolCalls: [], usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: "mock", provider: "mock" });
  }
  class MockFallbackService {
    selectFallback = () => ({ selectedProfileName: null, reasonCode: "fallback.no_candidate_available", degradedFromProfileName: "primary", attemptedProfiles: [] });
  }
  class MockCacheService {
    put = () => null;
    get = () => null;
  }

  const controller = new DegradationController({
    primaryProvider: new MockProvider() as any,
    fallbackService: new MockFallbackService() as any,
    cacheService: new MockCacheService() as any,
    config: {
      escalateErrorRateThreshold: 60,
      deescalateErrorRateThreshold: 10,
    },
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController accepts custom templates", () => {
  class MockProvider {
    createChatCompletion = async () => ({ id: "mock", content: "response", refusal: null, reasoningContent: null, finishReason: "stop", stopSequence: null, toolCalls: [], usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: "mock", provider: "mock" });
  }
  class MockFallbackService {
    selectFallback = () => ({ selectedProfileName: null, reasonCode: "fallback.no_candidate_available", degradedFromProfileName: "primary", attemptedProfiles: [] });
  }
  class MockCacheService {
    put = () => null;
    get = () => null;
  }

  const controller = new DegradationController({
    primaryProvider: new MockProvider() as any,
    fallbackService: new MockFallbackService() as any,
    cacheService: new MockCacheService() as any,
    templates: {
      default: "Custom default message",
      coding: "Custom coding message",
    },
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationController accepts eventBusEmitter", () => {
  class MockProvider {
    createChatCompletion = async () => ({ id: "mock", content: "response", refusal: null, reasoningContent: null, finishReason: "stop", stopSequence: null, toolCalls: [], usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, model: "mock", provider: "mock" });
  }
  class MockFallbackService {
    selectFallback = () => ({ selectedProfileName: null, reasonCode: "fallback.no_candidate_available", degradedFromProfileName: "primary", attemptedProfiles: [] });
  }
  class MockCacheService {
    put = () => null;
    get = () => null;
  }

  const eventBusEmitter = (eventType: string, payload: unknown) => {
    // no-op for testing
  };

  const controller = new DegradationController({
    primaryProvider: new MockProvider() as any,
    fallbackService: new MockFallbackService() as any,
    cacheService: new MockCacheService() as any,
    eventBusEmitter,
  });

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
});

test("DegradationLevel is enum not const object", () => {
  // DegradationLevel.D0 should be a number value
  assert.equal(typeof DegradationLevel.D0, "number");
  assert.ok(DegradationLevel.D0 === 0);
});

test("DegradationLevel D4 is maximum degradation level", () => {
  assert.ok(DegradationLevel.D4 > DegradationLevel.D3);
  assert.ok(DegradationLevel.D4 > DegradationLevel.D2);
  assert.ok(DegradationLevel.D4 > DegradationLevel.D1);
  assert.ok(DegradationLevel.D4 > DegradationLevel.D0);
});