import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChatCompletionResult,
  ChatMessage,
  ChatProviderType,
  ChatTool,
  UnifiedProviderConfig,
} from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";
import type { CircuitBreakerMetrics } from "../../../../../src/platform/model-gateway/provider-registry/circuit-breaker.js";

test("ChatProviderType accepts all valid values", () => {
  const types: ChatProviderType[] = ["anthropic", "openai", "minimax"];
  assert.equal(types.length, 3);
});

test("ChatMessage role type accepts all valid roles", () => {
  const roles: ChatMessage["role"][] = ["system", "user", "assistant"];
  assert.equal(roles.length, 3);
});

test("ChatTool minimal definition", () => {
  const tool: ChatTool = {
    type: "function",
    name: "test_tool",
    parameters: {},
  };
  assert.equal(tool.type, "function");
  assert.equal(tool.name, "test_tool");
  assert.equal(tool.description, undefined);
});

test("ChatCompletionResult with all fields", () => {
  const result: ChatCompletionResult = {
    id: "test-id",
    requestId: "test-id",
    content: "test content",
    refusal: "some refusal",
    reasoningContent: "some reasoning",
    finishReason: "stop",
    stopSequence: "stop",
    toolCalls: [
      {
        id: "call_123",
        type: "function",
        function: { name: "test", arguments: "{}" },
      },
    ],
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    estimatedCostUsd: 0.001,
    latencyMs: 100,
    model: "test-model",
    provider: "test-provider",
  };

  assert.equal(result.id, "test-id");
  assert.equal(result.refusal, "some refusal");
  assert.equal(result.reasoningContent, "some reasoning");
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.usage.totalTokens, 30);
});

test("UnifiedProviderConfig with all options", () => {
  const config: UnifiedProviderConfig = {
    anthropic: {
      apiKey: "key1",
      baseUrl: "https://anthropic.example.com",
    },
    openai: {
      apiKey: "key2",
      baseUrl: "https://openai.example.com",
      organization: "org-123",
    },
    minimax: {
      apiKey: "key3",
      baseUrl: "https://minimax.example.com",
      region: "global",
    },
  };

  assert.equal(config.anthropic?.baseUrl, "https://anthropic.example.com");
  assert.equal(config.openai?.organization, "org-123");
  assert.equal(config.minimax?.region, "global");
});

test("UnifiedProviderConfig partial configuration", () => {
  const config: UnifiedProviderConfig = {
    openai: {
      apiKey: "key",
    },
  };

  assert.equal(config.anthropic, undefined);
  assert.equal(config.openai?.apiKey, "key");
  assert.equal(config.minimax, undefined);
});

test("CircuitBreakerMetrics structure", () => {
  const metrics: CircuitBreakerMetrics = {
    state: "closed",
    totalRequests: 0,
    failures: 0,
    successes: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    nextAttemptAt: null,
    recentFailureRate: 0,
  };

  assert.equal(metrics.state, "closed");
  assert.equal(metrics.failures, 0);
});
