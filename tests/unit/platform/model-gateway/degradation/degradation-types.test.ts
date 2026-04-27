import test from "node:test";
import assert from "node:assert/strict";

import {
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type ProviderMetrics,
  type DegradationConfig,
  type LLMDegradationRequest,
  type LLMDegradationResponse,
} from "../../../../../src/platform/model-gateway/degradation/index.js";

test("degradation: DegradationLevel enum values", () => {
  assert.equal(DegradationLevel.D0, 0);
  assert.equal(DegradationLevel.D1, 1);
  assert.equal(DegradationLevel.D2, 2);
  assert.equal(DegradationLevel.D3, 3);
  assert.equal(DegradationLevel.D4, 4);
});

test("degradation: DEFAULT_DEGRADATION_CONFIG structure", () => {
  const config = DEFAULT_DEGRADATION_CONFIG;
  assert.equal(config.escalateErrorRateThreshold, 50);
  assert.equal(config.deescalateErrorRateThreshold, 5);
  assert.equal(config.escalateLatencyP99Ms, 5000);
  assert.equal(config.deescalateMinHealthyCount, 3);
  assert.equal(config.maxAutoDeescalateLevel, DegradationLevel.D0);
});

test("degradation: DEFAULT_TEMPLATE_RESPONSES has expected keys", () => {
  const keys = Object.keys(DEFAULT_TEMPLATE_RESPONSES);
  assert.ok(keys.includes("default"));
  assert.ok(keys.includes("coding"));
  assert.ok(keys.includes("reasoning"));
  assert.ok(keys.includes("classification"));
  assert.ok(keys.includes("writing"));
});

test("degradation: DEFAULT_TEMPLATE_RESPONSES default message is not empty", () => {
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.default.length > 0);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES.default.includes("apologize"));
});

test("degradation: ProviderMetrics interface structure", () => {
  const metrics: ProviderMetrics = {
    provider: "anthropic",
    profileName: "claude-3-5-sonnet",
    totalRequests: 1000,
    failedRequests: 50,
    errorRate: 0.05,
    latencyP99Ms: 450,
    ttftP99Ms: 800,
    lastUpdated: "2026-04-26T10:00:00Z",
  };
  assert.equal(metrics.provider, "anthropic");
  assert.equal(metrics.totalRequests, 1000);
  assert.equal(metrics.errorRate, 0.05);
  assert.equal(metrics.latencyP99Ms, 450);
});

test("degradation: DegradationConfig interface structure", () => {
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

test("degradation: LLMDegradationRequest interface structure", () => {
  const request: LLMDegradationRequest = {
    model: "claude-3-5-sonnet-20241022",
    routeClass: "reasoning",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
    tenantId: "tenant_123",
    taskType: "reasoning",
    semanticKey: "key_456",
  };
  assert.equal(request.model, "claude-3-5-sonnet-20241022");
  assert.equal(request.messages.length, 2);
  assert.equal(request.tenantId, "tenant_123");
});

test("degradation: LLMDegradationRequest with minimal fields", () => {
  const request: LLMDegradationRequest = {
    model: "test-model",
    routeClass: "default",
    messages: [{ role: "user", content: "Test" }],
  };
  assert.equal(request.model, "test-model");
  assert.equal(request.tenantId, undefined);
  assert.equal(request.taskType, undefined);
});

test("degradation: LLMDegradationResponse interface structure", () => {
  const response: LLMDegradationResponse = {
    content: "Hello, how can I help?",
    model: "claude-3-5-sonnet",
    degradationLevel: DegradationLevel.D0,
    cached: false,
    fromCache: false,
  };
  assert.equal(response.content, "Hello, how can I help?");
  assert.equal(response.degradationLevel, DegradationLevel.D0);
  assert.equal(response.cached, false);
});

test("degradation: LLMDegradationResponse with cached content", () => {
  const response: LLMDegradationResponse = {
    content: "Cached response",
    model: "claude-3-5-sonnet",
    degradationLevel: DegradationLevel.D2,
    cached: true,
    fromCache: true,
  };
  assert.equal(response.degradationLevel, DegradationLevel.D2);
  assert.equal(response.cached, true);
  assert.equal(response.fromCache, true);
});

test("degradation: DegradationLevel ordinality check", () => {
  assert.ok(DegradationLevel.D0 < DegradationLevel.D1);
  assert.ok(DegradationLevel.D1 < DegradationLevel.D2);
  assert.ok(DegradationLevel.D2 < DegradationLevel.D3);
  assert.ok(DegradationLevel.D3 < DegradationLevel.D4);
});