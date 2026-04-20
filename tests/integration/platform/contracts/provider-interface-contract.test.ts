/**
 * Contract Test: Provider Interface Contract
 *
 * Verifies that all chat provider implementations (Anthropic, OpenAI, MiniMax)
 * conform to the expected interface contract for the UnifiedChatProvider facade.
 *
 * These tests verify configuration detection, routing logic, and request structure
 * without making actual API calls.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  UnifiedChatProvider,
  type ChatCompletionRequest,
  type ChatMessage,
  type ChatTool,
  type ChatProviderType,
} from "../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

/**
 * Common request factory for testing all providers consistently
 */
function createTestRequest(model: string): ChatCompletionRequest {
  return {
    model,
    messages: [
      { role: "system" as const, content: "You are a helpful assistant." },
      { role: "user" as const, content: "Hello." },
    ],
    maxTokens: 50,
    temperature: 0.7,
  };
}

/**
 * Test that provider detection is consistent
 */
test("contract: hasProvider returns consistent results for fully configured provider", () => {
  const fullyConfigured = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key-anthropic" },
    openai: { apiKey: "test-key-openai" },
    minimax: { apiKey: "test-key-minimax" },
  });

  // All providers should be detected as available
  assert.equal(fullyConfigured.hasProvider("anthropic"), true, "Anthropic should be detected");
  assert.equal(fullyConfigured.hasProvider("openai"), true, "OpenAI should be detected");
  assert.equal(fullyConfigured.hasProvider("minimax"), true, "MiniMax should be detected");
});

/**
 * Test that provider detection works for partially configured provider
 */
test("contract: hasProvider returns correct status for partially configured provider", () => {
  const anthropicOnly = new UnifiedChatProvider({
    anthropic: { apiKey: "test-key" },
  });

  assert.equal(anthropicOnly.hasProvider("anthropic"), true, "Anthropic should be available");
  assert.equal(anthropicOnly.hasProvider("openai"), false, "OpenAI should not be available");
  assert.equal(anthropicOnly.hasProvider("minimax"), false, "MiniMax should not be available");

  const openaiOnly = new UnifiedChatProvider({
    openai: { apiKey: "test-key" },
  });

  assert.equal(openaiOnly.hasProvider("anthropic"), false);
  assert.equal(openaiOnly.hasProvider("openai"), true);
  assert.equal(openaiOnly.hasProvider("minimax"), false);

  const minimaxOnly = new UnifiedChatProvider({
    minimax: { apiKey: "test-key" },
  });

  assert.equal(minimaxOnly.hasProvider("anthropic"), false);
  assert.equal(minimaxOnly.hasProvider("openai"), false);
  assert.equal(minimaxOnly.hasProvider("minimax"), true);
});

/**
 * Test that unconfigured provider is correctly detected
 */
test("contract: hasProvider returns false for unconfigured provider", () => {
  const unconfigured = new UnifiedChatProvider({});

  assert.equal(unconfigured.hasProvider("anthropic"), false, "Anthropic should not be available");
  assert.equal(unconfigured.hasProvider("openai"), false, "OpenAI should not be available");
  assert.equal(unconfigured.hasProvider("minimax"), false, "MiniMax should not be available");
});

/**
 * Test ChatCompletionRequest structure validation
 */
test("contract: ChatCompletionRequest has all required fields", () => {
  const request: ChatCompletionRequest = {
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
    maxTokens: 100,
  };

  assert.equal(typeof request.model, "string", "model should be a string");
  assert.equal(typeof request.messages, "object", "messages should be an object");
  assert.equal(Array.isArray(request.messages), true, "messages should be an array");
  assert.equal(typeof request.maxTokens, "number", "maxTokens should be a number");
  assert.equal(request.maxTokens, 100, "maxTokens should be 100");
});

/**
 * Test ChatMessage role validation
 */
test("contract: ChatMessage supports all valid role types", () => {
  const validRoles: ChatMessage["role"][] = ["system", "user", "assistant"];

  for (const role of validRoles) {
    const message: ChatMessage = { role, content: "test" };
    assert.ok(
      ["system", "user", "assistant"].includes(message.role),
      `Role ${role} should be valid`,
    );
  }
});

/**
 * Test ChatTool structure for function calling
 */
test("contract: ChatTool has correct structure for function calling", () => {
  const tool: ChatTool = {
    type: "function",
    name: "get_weather",
    description: "Get the current weather",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" },
      },
      required: ["location"],
    },
  };

  assert.equal(tool.type, "function", "Tool type should be 'function'");
  assert.equal(typeof tool.name, "string", "Tool name should be a string");
  assert.equal(typeof tool.description, "string", "Tool description should be a string");
  assert.equal(typeof tool.parameters, "object", "Tool parameters should be an object");
});

/**
 * Test ChatProviderType enumeration values
 */
test("contract: ChatProviderType accepts all expected values", () => {
  const validTypes: ChatProviderType[] = ["anthropic", "openai", "minimax"];

  for (const type of validTypes) {
    assert.ok(
      validTypes.includes(type),
      `Provider type ${type} should be valid`,
    );
  }
});

/**
 * Test request with tools structure
 */
test("contract: request with tools has correct structure", () => {
  const requestWithTools: ChatCompletionRequest = {
    model: "test-model",
    messages: [{ role: "user", content: "Use a tool" }],
    maxTokens: 100,
    tools: [
      {
        type: "function",
        name: "test_tool",
        description: "A test tool",
        parameters: { type: "object", properties: {} },
      },
    ],
    toolChoice: "auto",
  };

  assert.ok(Array.isArray(requestWithTools.tools), "tools should be an array");
  assert.equal(requestWithTools.tools!.length, 1, "should have one tool");
  const firstTool = requestWithTools.tools![0];
  assert.ok(firstTool, "first tool should exist");
  assert.equal(firstTool.name, "test_tool");
  assert.ok(
    ["auto", "none"].includes(requestWithTools.toolChoice!),
    "toolChoice should be 'auto' or 'none'",
  );
});

/**
 * Test streaming request structure
 */
test("contract: streaming request has correct structure", () => {
  const streamingRequest: ChatCompletionRequest = {
    model: "test-model",
    messages: [{ role: "user", content: "Stream response" }],
    maxTokens: 100,
    stream: true,
  };

  assert.equal(streamingRequest.stream, true, "stream should be true");
});

/**
 * Test request with optional fields
 */
test("contract: request with optional fields is valid", () => {
  const fullRequest: ChatCompletionRequest = {
    model: "test-model",
    messages: [{ role: "user", content: "Test" }],
    maxTokens: 100,
    temperature: 0.5,
    topP: 0.9,
    system: "You are helpful.",
    tools: [],
    toolChoice: "none",
  };

  assert.equal(fullRequest.temperature, 0.5);
  assert.equal(fullRequest.topP, 0.9);
  assert.equal(fullRequest.system, "You are helpful.");
  assert.ok(Array.isArray(fullRequest.tools));
  assert.equal(fullRequest.toolChoice, "none");
});

/**
 * Test that different providers have different configurations
 */
test("contract: each provider accepts only its own config keys", () => {
  const provider = new UnifiedChatProvider({
    anthropic: { apiKey: "key", baseUrl: "https://anthropic.com" },
    openai: { apiKey: "key", organization: "my-org" },
    minimax: { apiKey: "key", region: "global" as const },
  });

  assert.equal(provider.hasProvider("anthropic"), true);
  assert.equal(provider.hasProvider("openai"), true);
  assert.equal(provider.hasProvider("minimax"), true);
});

/**
 * Test that provider handles empty API key gracefully in detection
 */
test("contract: provider with empty API key is not considered configured", () => {
  const emptyKeyProvider = new UnifiedChatProvider({
    anthropic: { apiKey: "" },
  });

  // Empty string is not considered a valid API key - provider is not configured
  assert.equal(emptyKeyProvider.hasProvider("anthropic"), false);
});
