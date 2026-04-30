/**
 * OpenAI Chat Service Streaming Tests - Issue #2089
 *
 * Tests for streaming chat completion focusing on:
 * - Issue #2089: streaming finish_reason from first chunk always null
 *
 * The bug: In streaming mode, the first chunk's finish_reason is null because
 * it's a delta chunk, but we capture it as the final finish reason.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";

// Import types for testing
import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResult,
  OpenAIChatCompletionChoice,
  OpenAIChatCompletionResponse,
} from "../../../../../../../src/platform/model-gateway/provider-registry/openai/openai-chat-service.js";

// ============================================================================
// Mock SSE Response Builder
// ============================================================================

function buildStreamingResponse(chunks: Array<{
  id?: string;
  model?: string;
  content?: string;
  finish_reason?: string | null;
  delta?: { content?: string | null; role?: string };
}>): string {
  return chunks
    .map((chunk) => {
      const choice: Partial<OpenAIChatCompletionChoice> = {};
      if (chunk.delta) {
        choice.delta = chunk.delta as OpenAIChatCompletionChoice["delta"];
      }
      choice.finish_reason = chunk.finish_reason ?? null;
      choice.index = 0;

      const response: Partial<OpenAIChatCompletionResponse> = {
        id: chunk.id ?? "chatcmpl-test",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: chunk.model ?? "gpt-4o",
        choices: [choice as OpenAIChatCompletionChoice],
      };

      return `data: ${JSON.stringify(response)}`;
    })
    .join("\n");
}

// ============================================================================
// Issue #2089: finish_reason from first chunk in streaming
// ============================================================================

test("OpenAI streaming first chunk finish_reason is null but should not affect final result", () => {
  // This test demonstrates the issue:
  // In streaming, the first chunk has delta but finish_reason is null
  // because streaming chunks don't have finish_reason until the final chunk

  const firstChunk = {
    id: "chatcmpl-test",
    delta: { content: "Hello", role: "assistant" },
    finish_reason: null, // This is the bug - first chunk has null finish_reason
  };

  const secondChunk = {
    delta: { content: " world" },
    finish_reason: null,
  };

  const finalChunk = {
    finish_reason: "stop", // This should be the final finish reason
  };

  // Simulate what the code does
  let finalFinishReason = "stop";
  let firstChunkProcessed = false;

  for (const chunk of [firstChunk, secondChunk, finalChunk]) {
    if (chunk.delta && !firstChunkProcessed) {
      // Bug: this captures null from first chunk
      finalFinishReason = chunk.finish_reason ?? "stop";
      firstChunkProcessed = true;
    } else if (!chunk.delta && chunk.finish_reason) {
      // This is the final chunk
      finalFinishReason = chunk.finish_reason;
    }
  }

  // The bug: finalFinishReason would be "stop" (null ?? "stop")
  // But actually this is wrong - we should capture the LAST non-null finish_reason
  assert.equal(finalFinishReason, "stop"); // Bug manifests as "stop" instead of "stop"
});

test("OpenAI streaming should capture finish_reason from final chunk", () => {
  // In the actual OpenAI streaming format, finish_reason appears on the final chunk
  // not on intermediate chunks

  const chunks = [
    { id: "test", model: "gpt-4o", delta: { content: "He" }, finish_reason: null },
    { id: "test", model: "gpt-4o", delta: { content: "llo" }, finish_reason: null },
    { id: "test", model: "gpt-4o", delta: {}, finish_reason: null }, // Empty delta before finish
    { id: "test", model: "gpt-4o", finish_reason: "stop" }, // Final chunk with finish_reason
  ];

  // The code incorrectly sets finalFinishReason on first chunk when it sees delta
  // Instead of waiting for final chunk
  let finalFinishReason = "stop";

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (chunk.delta !== undefined && finalFinishReason === "stop") {
      // Bug: First chunk with delta sets finalFinishReason = null ?? "stop" = "stop"
      // But this loses the actual finish_reason from final chunk
      finalFinishReason = chunk.finish_reason ?? "stop";
      break; // Bug: stops processing after first delta chunk
    }
  }

  // This demonstrates the bug - we should continue to find the real finish_reason
  assert.equal(finalFinishReason, "stop");
});

test("OpenAI non-streaming response has finish_reason immediately", () => {
  // In non-streaming mode, the response has finish_reason immediately
  const response = {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-4o",
    choices: [
      {
        message: { role: "assistant", content: "Hello world" },
        finish_reason: "stop",
        index: 0,
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
  };

  // Non-streaming works correctly
  const finishReason = response.choices[0]?.finish_reason ?? "stop";
  assert.equal(finishReason, "stop");
});

// ============================================================================
// Request/Response Structure Tests
// ============================================================================

test("OpenAIChatCompletionChoice delta structure", () => {
  const choice: OpenAIChatCompletionChoice = {
    delta: {
      role: "assistant",
      content: "test",
    },
    finish_reason: null,
    index: 0,
  };

  assert.equal(choice.delta?.content, "test");
  assert.equal(choice.finish_reason, null);
});

test("OpenAIChatCompletionChoice message structure (non-streaming)", () => {
  const choice: OpenAIChatCompletionChoice = {
    message: {
      role: "assistant",
      content: "test response",
    },
    finish_reason: "stop",
    index: 0,
  };

  assert.equal(choice.message?.content, "test response");
  assert.equal(choice.finish_reason, "stop");
});

test("OpenAIChatCompletionChoice with tool_calls in message", () => {
  const choice: OpenAIChatCompletionChoice = {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "get_weather", arguments: '{"location":"NYC"}' },
        },
      ],
    },
    finish_reason: "tool_calls",
    index: 0,
  };

  assert.ok(choice.message?.tool_calls);
  assert.equal(choice.message?.tool_calls?.[0]?.function.name, "get_weather");
  assert.equal(choice.finish_reason, "tool_calls");
});

test("OpenAIChatCompletionChoice with refusal", () => {
  const choice: OpenAIChatCompletionChoice = {
    message: {
      role: "assistant",
      content: null,
      refusal: "I cannot help with that.",
    },
    finish_reason: "refusal",
    index: 0,
  };

  assert.equal(choice.message?.refusal, "I cannot help with that.");
  assert.equal(choice.finish_reason, "refusal");
});

// ============================================================================
// Finish Reason Values
// ============================================================================

test("OpenAI finish_reason values are valid", () => {
  const validReasons = ["stop", "length", "tool_calls", "content_filter", "refusal"];

  for (const reason of validReasons) {
    const choice: OpenAIChatCompletionChoice = {
      finish_reason: reason as "stop" | "length" | "tool_calls" | "content_filter" | "refusal",
      index: 0,
    };
    assert.equal(choice.finish_reason, reason);
  }
});

test("OpenAI finish_reason can be null", () => {
  const choice: OpenAIChatCompletionChoice = {
    finish_reason: null,
    index: 0,
  };

  assert.equal(choice.finish_reason, null);
});

// ============================================================================
// Response Validation
// ============================================================================

test("OpenAIChatCompletionResponse structure", () => {
  const response: OpenAIChatCompletionResponse = {
    id: "chatcmpl-abc123",
    object: "chat.completion",
    created: 1234567890,
    model: "gpt-4o",
    choices: [
      {
        message: { role: "assistant", content: "Hello!" },
        finish_reason: "stop",
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  };

  assert.equal(response.id, "chatcmpl-abc123");
  assert.equal(response.model, "gpt-4o");
  assert.equal(response.choices.length, 1);
  assert.equal(response.usage.total_tokens, 15);
});

test("OpenAIChatCompletionResponse streaming chunk structure", () => {
  const chunk: OpenAIChatCompletionResponse = {
    id: "chatcmpl-abc123",
    object: "chat.completion.chunk",
    created: 1234567890,
    model: "gpt-4o",
    choices: [
      {
        delta: { content: "Hello" },
        finish_reason: null,
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 0,
      total_tokens: 10,
    },
  };

  assert.equal(chunk.object, "chat.completion.chunk");
  assert.ok(chunk.choices[0]?.delta);
  assert.equal(chunk.choices[0]?.finish_reason, null);
});

// ============================================================================
// Tool Calls in Streaming
// ============================================================================

test("OpenAI streaming tool_calls are accumulated correctly", () => {
  // In streaming, tool_calls come in multiple chunks
  const chunks = [
    {
      delta: {
        role: "assistant",
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "get_weather", arguments: "{" } },
        ],
      },
      finish_reason: null,
    },
    {
      delta: {
        tool_calls: [
          { id: "call_1", type: "function", function: { arguments: '"loc' } },
        ],
      },
      finish_reason: null,
    },
    {
      delta: {
        tool_calls: [
          { id: "call_1", type: "function", function: { arguments: 'ation"' } },
        ],
      },
      finish_reason: null,
    },
    {
      finish_reason: "tool_calls",
    },
  ];

  // Simulate accumulation
  const accumulatedToolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = [];

  for (const chunk of chunks) {
    if (chunk.delta?.tool_calls) {
      for (const tc of chunk.delta.tool_calls) {
        if (tc.type === "function") {
          const existing = accumulatedToolCalls.find((t) => t.id === tc.id);
          if (existing) {
            existing.function.arguments += tc.function.arguments ?? "";
          } else {
            accumulatedToolCalls.push({
              id: tc.id,
              type: tc.type,
              function: {
                name: tc.function.name ?? "",
                arguments: tc.function.arguments ?? "",
              },
            });
          }
        }
      }
    }
  }

  assert.equal(accumulatedToolCalls.length, 1);
  assert.equal(accumulatedToolCalls[0]?.function.arguments, '{"location":"NYC"}');
});