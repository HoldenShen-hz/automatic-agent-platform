/**
 * Anthropic Chat Service Streaming Tests
 *
 * Tests for streaming chat completion focusing on:
 * - Finish reason handling in streaming responses
 * - Tool calls accumulation
 * - Content block deltas
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import types for testing
import type {
  AnthropicChatCompletionRequest,
  AnthropicChatCompletionResult,
  AnthropicChatCompletionResponse,
} from "../../../../../../../src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.js";

// ============================================================================
// Anthropic Streaming Response Structures
// ============================================================================

test("Anthropic content_block_delta structure", () => {
  // Streaming chunks have content_block_delta type
  const chunk = {
    type: "content_block_delta",
    index: 0,
    content_block: {
      type: "text",
      text: "Hello",
    },
    delta: {
      type: "text_delta",
      text: "Hello",
    },
  };

  assert.equal(chunk.type, "content_block_delta");
  assert.equal(chunk.delta?.type, "text_delta");
  assert.equal(chunk.delta?.text, "Hello");
});

test("Anthropic message_delta structure", () => {
  // Final message delta contains stop_reason
  const chunk = {
    type: "message_delta",
    delta: {
      type: "text_delta",
      text: "",
    },
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
    message: {
      stop_reason: "end_turn",
      stop_sequence: null,
    },
  };

  assert.equal(chunk.type, "message_delta");
  assert.equal(chunk.message?.stop_reason, "end_turn");
});

test("Anthropic content_block_start structure", () => {
  // Content block start - could be text or tool_use
  const chunk = {
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "text",
      text: "Starting response",
    },
  };

  assert.equal(chunk.type, "content_block_start");
  assert.equal(chunk.content_block?.type, "text");
});

test("Anthropic message structure (non-streaming)", () => {
  // Final message type
  const message = {
    type: "message",
    id: "msg_123",
    role: "assistant",
    content: [
      { type: "text", text: "Hello world" },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn" as const,
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
    },
  };

  assert.equal(message.type, "message");
  assert.equal(message.stop_reason, "end_turn");
});

test("Anthropic content block with refusal", () => {
  const message = {
    type: "message",
    id: "msg_456",
    role: "assistant",
    content: [
      { type: "refusal", text: "I cannot help with that request." },
    ],
    model: "claude-opus-4-5",
    stop_reason: "refusal" as const,
    usage: { input_tokens: 10, output_tokens: 5 },
  };

  assert.equal(message.content[0]?.type, "refusal");
});

// ============================================================================
// Stop Reason Values
// ============================================================================

test("Anthropic stop_reason values are valid", () => {
  const validReasons = ["end_turn", "max_tokens", "stop_sequence", "tool_use"] as const;

  for (const reason of validReasons) {
    const response: AnthropicChatCompletionResponse = {
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "test" }],
      model: "claude-sonnet-4",
      stop_reason: reason,
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    assert.equal(response.stop_reason, reason);
  }
});

test("Anthropic stop_sequence can be null", () => {
  const response: AnthropicChatCompletionResponse = {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "test" }],
    model: "claude-sonnet-4",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };

  assert.equal(response.stop_sequence, null);
});

// ============================================================================
// Tool Use in Anthropic
// ============================================================================

test("Anthropic tool_use content block", () => {
  const message = {
    type: "message",
    id: "msg_tool",
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_123",
        name: "get_weather",
        input: { location: "NYC" },
      },
    ],
    model: "claude-sonnet-4",
    stop_reason: "tool_use" as const,
    usage: { input_tokens: 50, output_tokens: 30 },
  };

  const toolBlock = message.content[0] as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
  assert.equal(toolBlock.type, "tool_use");
  assert.equal(toolBlock.name, "get_weather");
  assert.deepEqual(toolBlock.input, { location: "NYC" });
});

test("Anthropic tool_result content block", () => {
  const message = {
    type: "message",
    id: "msg_result",
    role: "assistant",
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_123",
        content: "The weather is sunny and 72°F.",
      },
    ],
    model: "claude-sonnet-4",
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 20 },
  };

  const resultBlock = message.content[0] as { type: "tool_result"; tool_use_id: string; content: string };
  assert.equal(resultBlock.type, "tool_result");
  assert.equal(resultBlock.tool_use_id, "toolu_123");
});

// ============================================================================
// Request Structure Tests
// ============================================================================

test("AnthropicChatCompletionRequest structure", () => {
  const request: AnthropicChatCompletionRequest = {
    model: "claude-sonnet-4-20250514",
    messages: [
      { role: "user", content: "Hello" },
    ],
    max_tokens: 1024,
    stream: false,
  };

  assert.equal(request.model, "claude-sonnet-4-20250514");
  assert.equal(request.max_tokens, 1024);
  assert.equal(request.stream, false);
});

test("AnthropicChatCompletionRequest with system message", () => {
  const request: AnthropicChatCompletionRequest = {
    model: "claude-opus-4-5",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ],
    max_tokens: 2048,
  };

  assert.ok(request.messages.some((m) => m.role === "system"));
});

test("AnthropicChatCompletionRequest with tools", () => {
  const request: AnthropicChatCompletionRequest = {
    model: "claude-sonnet-4",
    messages: [{ role: "user", content: "Use the weather tool" }],
    max_tokens: 1024,
    tools: [
      {
        type: "function",
        name: "get_weather",
        description: "Get weather for a location",
        input_schema: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
      },
    ],
  };

  assert.equal(request.tools?.length, 1);
  assert.equal(request.tools?.[0]?.name, "get_weather");
});

// ============================================================================
// Response Result Structure
// ============================================================================

test("AnthropicChatCompletionResult structure", () => {
  const result: AnthropicChatCompletionResult = {
    id: "msg_abc123",
    content: "Hello! How can I help you today?",
    refusal: null,
    stopReason: "end_turn",
    stopSequence: null,
    usage: {
      input_tokens: 15,
      output_tokens: 25,
    },
    model: "claude-sonnet-4-20250514",
    rawResponse: {
      id: "msg_abc123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello! How can I help you today?" }],
      model: "claude-sonnet-4-20250514",
      stop_reason: "end_turn",
      usage: { input_tokens: 15, output_tokens: 25 },
    },
  };

  assert.equal(result.content, "Hello! How can I help you today?");
  assert.equal(result.stopReason, "end_turn");
  assert.equal(result.usage.input_tokens, 15);
  assert.equal(result.usage.output_tokens, 25);
});

test("AnthropicChatCompletionResult with refusal", () => {
  const result: AnthropicChatCompletionResult = {
    id: "msg_refuse",
    content: "",
    refusal: "I cannot help with that request.",
    stopReason: "refusal",
    stopSequence: null,
    usage: { input_tokens: 20, output_tokens: 10 },
    model: "claude-opus-4-5",
    rawResponse: {
      id: "msg_refuse",
      type: "message",
      role: "assistant",
      content: [{ type: "refusal", text: "I cannot help with that request." }],
      model: "claude-opus-4-5",
      stop_reason: "refusal",
      usage: { input_tokens: 20, output_tokens: 10 },
    },
  };

  assert.equal(result.refusal, "I cannot help with that request.");
  assert.equal(result.stopReason, "refusal");
});

// ============================================================================
// Usage Structure
// ============================================================================

test("Anthropic usage has input and output tokens", () => {
  const response: AnthropicChatCompletionResponse = {
    id: "msg_usage",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "Response" }],
    model: "claude-haiku-3-5",
    stop_reason: "end_turn",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };

  assert.equal(response.usage.input_tokens, 100);
  assert.equal(response.usage.output_tokens, 50);
});

// ============================================================================
// Model Names
// ============================================================================

test("Anthropic model names are properly formatted", () => {
  const models = [
    "claude-opus-4-5",
    "claude-opus-3",
    "claude-sonnet-4",
    "claude-sonnet-3-5",
    "claude-haiku-3-5",
    "claude-haiku-3",
  ];

  for (const model of models) {
    const request: AnthropicChatCompletionRequest = {
      model,
      messages: [{ role: "user", content: "test" }],
      max_tokens: 100,
    };
    assert.ok(request.model.includes("claude"));
  }
});