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

test("DegradationLevel enum has correct values", () => {
  assert.equal(DegradationLevel.D0, 0);
  assert.equal(DegradationLevel.D1, 1);
  assert.equal(DegradationLevel.D2, 2);
  assert.equal(DegradationLevel.D3, 3);
  assert.equal(DegradationLevel.D4, 4);
});

test("DEFAULT_DEGRADATION_CONFIG has correct defaults", () => {
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold, 50);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold, 5);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms, 5000);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount, 3);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.maxAutoDeescalateLevel, DegradationLevel.D0);
});

test("DEFAULT_TEMPLATE_RESPONSES has expected task types", () => {
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.default);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.coding);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.reasoning);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.classification);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.writing);
});

test("DEFAULT_TEMPLATE_RESPONSES default message is not empty", () => {
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.default.length > 0);
});

test("ProviderMetrics type can be instantiated", () => {
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
  assert.equal(metrics.totalRequests, 100);
  assert.equal(metrics.errorRate, 5.0);
});

test("DegradationConfig type can be partially customized", () => {
  const config: DegradationConfig = {
    escalateErrorRateThreshold: 60,
    deescalateErrorRateThreshold: 10,
    escalateLatencyP99Ms: 3000,
    deescalateMinHealthyCount: 5,
    maxAutoDeescalateLevel: DegradationLevel.D1,
  };
  assert.equal(config.escalateErrorRateThreshold, 60);
  assert.equal(config.maxAutoDeescalateLevel, DegradationLevel.D1);
});

test("LLMDegradationRequest type can be instantiated", () => {
  const request: LLMDegradationRequest = {
    model: "gpt-4.5",
    routeClass: "reasoning",
    messages: [
      { role: "user", content: "Hello" },
    ],
    tenantId: "tenant-1",
    taskType: "reasoning",
    semanticKey: "cache-key-123",
  };
  assert.equal(request.model, "gpt-4.5");
  assert.equal(request.messages.length, 1);
  assert.equal(request.tenantId, "tenant-1");
});

test("LLMDegradationResponse type can be instantiated", () => {
  const response: LLMDegradationResponse = {
    content: "Hello, world!",
    model: "gpt-4.5",
    degradationLevel: DegradationLevel.D0,
    cached: false,
    fromCache: false,
  };
  assert.equal(response.content, "Hello, world!");
  assert.equal(response.degradationLevel, DegradationLevel.D0);
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

  assert.equal(controller.getCurrentLevel(), DegradationLevel.D0);
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