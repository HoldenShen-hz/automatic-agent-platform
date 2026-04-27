import assert from "node:assert/strict";
import test from "node:test";

import {
  AnthropicMessage,
  AnthropicTool,
  AnthropicChatCompletionRequest,
} from "../../../../../../src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.js";

test("AnthropicMessage role accepts valid values", () => {
  const userMsg: AnthropicMessage = { role: "user", content: "Hello" };
  assert.equal(userMsg.role, "user");
  assert.equal(userMsg.content, "Hello");

  const assistantMsg: AnthropicMessage = { role: "assistant", content: "Hi there" };
  assert.equal(assistantMsg.role, "assistant");

  const systemMsg: AnthropicMessage = { role: "system", content: "You are helpful" };
  assert.equal(systemMsg.role, "system");
});

test("AnthropicTool type is function", () => {
  const tool: AnthropicTool = {
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
  };
  assert.equal(tool.type, "function");
  assert.equal(tool.name, "get_weather");
});

test("AnthropicChatCompletionRequest accepts valid structure", () => {
  const request: AnthropicChatCompletionRequest = {
    model: "claude-opus-4-20251120",
    messages: [
      { role: "user", content: "Hello" },
    ],
    system: "You are a helpful assistant.",
    max_tokens: 1024,
    stream: false,
  };
  assert.equal(request.model, "claude-opus-4-20251120");
  assert.equal(request.max_tokens, 1024);
  assert.equal(request.stream, false);
});

test("AnthropicTool without description is valid", () => {
  const tool: AnthropicTool = {
    type: "function",
    name: "simple_tool",
    input_schema: { type: "object" },
  };
  assert.equal(tool.name, "simple_tool");
  assert.equal(tool.description, undefined);
});

test("AnthropicMessage with empty content is valid", () => {
  const msg: AnthropicMessage = { role: "user", content: "" };
  assert.equal(msg.content, "");
});

test("AnthropicChatCompletionRequest with temperature and top_p", () => {
  const request: AnthropicChatCompletionRequest = {
    model: "claude-sonnet-4-20251120",
    messages: [{ role: "user", content: "Hello" }],
    temperature: 0.9,
    top_p: 0.95,
    max_tokens: 512,
  };
  assert.equal(request.temperature, 0.9);
  assert.equal(request.top_p, 0.95);
});

test("AnthropicChatCompletionRequest with tools and tool_choice", () => {
  const request: AnthropicChatCompletionRequest = {
    model: "claude-opus-4-20251120",
    messages: [{ role: "user", content: "Use a tool" }],
    max_tokens: 1024,
    tools: [
      {
        type: "function",
        name: "test_tool",
        input_schema: { type: "object" },
      },
    ],
    tool_choice: "auto",
  };
  assert.equal(request.tools?.length, 1);
  assert.equal(request.tool_choice, "auto");
});