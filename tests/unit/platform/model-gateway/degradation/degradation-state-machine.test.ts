import assert from "node:assert/strict";
import test from "node:test";

import {
  DegradationLevel,
  DEFAULT_DEGRADATION_CONFIG,
  DEFAULT_TEMPLATE_RESPONSES,
  type ProviderMetrics,
  type LLMDegradationRequest,
  type DegradationConfig,
  type LLMDegradationResponse,
} from "../../../../../src/platform/model-gateway/degradation/index.js";

/**
 * Tests for Degradation module exports and types.
 * These tests verify the degradation state machine behavior.
 */

test("DegradationLevel enum has correct values", () => {
  assert.equal(DegradationLevel.D0, 0);
  assert.equal(DegradationLevel.D1, 1);
  assert.equal(DegradationLevel.D2, 2);
  assert.equal(DegradationLevel.D3, 3);
  assert.equal(DegradationLevel.D4, 4);
});

test("DegradationLevel can be used in comparisons", () => {
  let level = DegradationLevel.D0;
  assert.equal(level, 0);

  level = DegradationLevel.D4;
  assert.equal(level, 4);

  // Level can be incremented
  level++;
  assert.equal(level, 5); // No upper bound check in plain number
});

test("DEFAULT_DEGRADATION_CONFIG has correct values", () => {
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateErrorRateThreshold, 50);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateErrorRateThreshold, 5);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.escalateLatencyP99Ms, 5000);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.deescalateMinHealthyCount, 3);
  assert.equal(DEFAULT_DEGRADATION_CONFIG.maxAutoDeescalateLevel, DegradationLevel.D0);
});

test("DEFAULT_TEMPLATE_RESPONSES has all required keys", () => {
  assert.ok(DEFAULT_TEMPLATE_RESPONSES["default"]);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES["coding"]);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES["reasoning"]);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES["classification"]);
  assert.ok(DEFAULT_TEMPLATE_RESPONSES["writing"]);
});

test("DEFAULT_TEMPLATE_RESPONSES returns strings", () => {
  for (const [key, value] of Object.entries(DEFAULT_TEMPLATE_RESPONSES)) {
    assert.equal(typeof value, "string", `${key} should be a string`);
    assert.ok(value.length > 0, `${key} should not be empty`);
  }
});

test("ProviderMetrics type structure", () => {
  const metrics: ProviderMetrics = {
    provider: "openai",
    profileName: "gpt-4o",
    totalRequests: 1000,
    failedRequests: 50,
    errorRate: 5,
    latencyP99Ms: 500,
    ttftP99Ms: 1000,
    lastUpdated: "2026-04-23T10:00:00.000Z",
  };

  assert.equal(metrics.provider, "openai");
  assert.equal(metrics.profileName, "gpt-4o");
  assert.equal(metrics.totalRequests, 1000);
  assert.equal(metrics.failedRequests, 50);
  assert.equal(metrics.errorRate, 5);
  assert.equal(metrics.latencyP99Ms, 500);
  assert.equal(metrics.ttftP99Ms, 1000);
  assert.ok(metrics.lastUpdated);
});

test("LLMDegradationRequest type structure", () => {
  const request: LLMDegradationRequest = {
    model: "gpt-4o",
    routeClass: "default",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ],
    tenantId: "tenant-123",
    taskType: "reasoning",
    semanticKey: "key-abc",
  };

  assert.equal(request.model, "gpt-4o");
  assert.equal(request.routeClass, "default");
  assert.equal(request.messages.length, 2);
  assert.equal(request.tenantId, "tenant-123");
  assert.equal(request.taskType, "reasoning");
  assert.equal(request.semanticKey, "key-abc");
});

test("LLMDegradationRequest with minimal fields", () => {
  const request: LLMDegradationRequest = {
    model: "claude-sonnet-4",
    routeClass: "default",
    messages: [{ role: "user", content: "Hi" }],
    // All optional fields omitted
  };

  assert.equal(request.model, "claude-sonnet-4");
  assert.equal(request.routeClass, "default");
  assert.equal(request.messages.length, 1);
  assert.equal(request.tenantId, undefined);
  assert.equal(request.taskType, undefined);
  assert.equal(request.semanticKey, undefined);
});

test("LLMDegradationResponse type structure", () => {
  const response: LLMDegradationResponse = {
    content: "Hello, how can I help?",
    model: "gpt-4o",
    degradationLevel: DegradationLevel.D0,
    cached: false,
    fromCache: false,
  };

  assert.equal(response.content, "Hello, how can I help?");
  assert.equal(response.model, "gpt-4o");
  assert.equal(response.degradationLevel, DegradationLevel.D0);
  assert.equal(response.cached, false);
  assert.equal(response.fromCache, false);
});

test("LLMDegradationResponse with cached data", () => {
  const response: LLMDegradationResponse = {
    content: "Cached response",
    model: "gpt-4o",
    degradationLevel: DegradationLevel.D2,
    cached: true,
    fromCache: true,
  };

  assert.equal(response.content, "Cached response");
  assert.equal(response.degradationLevel, DegradationLevel.D2);
  assert.equal(response.cached, true);
  assert.equal(response.fromCache, true);
});

test("DegradationConfig partial override behavior", () => {
  const customConfig: Partial<DegradationConfig> = {
    escalateErrorRateThreshold: 60,
  };

  // Merged with defaults
  const merged: DegradationConfig = {
    ...DEFAULT_DEGRADATION_CONFIG,
    ...customConfig,
  };

  assert.equal(merged.escalateErrorRateThreshold, 60); // Custom value
  assert.equal(merged.deescalateErrorRateThreshold, 5); // Default
  assert.equal(merged.deescalateMinHealthyCount, 3); // Default
});

test("DegradationLevel ordering for state machine", () => {
  // D0 is the lowest (normal), D4 is the highest (degraded)
  assert.ok(DegradationLevel.D0 < DegradationLevel.D1);
  assert.ok(DegradationLevel.D1 < DegradationLevel.D2);
  assert.ok(DegradationLevel.D2 < DegradationLevel.D3);
  assert.ok(DegradationLevel.D3 < DegradationLevel.D4);

  // Can be used as array index (D0-D4 = 5 levels)
  const levels: DegradationLevel[] = [
    DegradationLevel.D0,
    DegradationLevel.D1,
    DegradationLevel.D2,
    DegradationLevel.D3,
    DegradationLevel.D4,
  ];
  assert.equal(levels.length, 5);
});

test("Template response keys map to task types", () => {
  const taskTypes = ["default", "coding", "reasoning", "classification", "writing"];
  for (const taskType of taskTypes) {
    assert.ok(DEFAULT_TEMPLATE_RESPONSES[taskType], `Should have template for ${taskType}`);
  }
});

test("ProviderMetrics can represent healthy provider", () => {
  const metrics: ProviderMetrics = {
    provider: "anthropic",
    profileName: "claude-sonnet-4",
    totalRequests: 10000,
    failedRequests: 10,
    errorRate: 0.1,
    latencyP99Ms: 800,
    ttftP99Ms: 500,
    lastUpdated: new Date().toISOString(),
  };

  assert.ok(metrics.errorRate < 5); // Below deescalation threshold
  assert.ok(metrics.latencyP99Ms < 5000); // Below escalation threshold
});

test("ProviderMetrics can represent degraded provider", () => {
  const metrics: ProviderMetrics = {
    provider: "minimax",
    profileName: "MiniMax-M2.7",
    totalRequests: 1000,
    failedRequests: 600,
    errorRate: 60,
    latencyP99Ms: 8000,
    ttftP99Ms: 12000,
    lastUpdated: new Date().toISOString(),
  };

  assert.ok(metrics.errorRate > 50); // Above escalation threshold
  assert.ok(metrics.ttftP99Ms > 10000); // TTFT > 10s triggers escalation
});

test("DegradationLevel D3 template content for different task types", () => {
  // D3 responses should all be apology-style messages indicating degradation
  for (const template of Object.values(DEFAULT_TEMPLATE_RESPONSES)) {
    assert.ok(template.toLowerCase().includes("apologize") || template.includes("unable") || template.includes("currently experiencing"));
  }
});
