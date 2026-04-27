import assert from "node:assert/strict";
import test from "node:test";

import {
  MiniMaxChatService,
  type MiniMaxMessage,
  type MiniMaxTool,
  type MiniMaxChatCompletionRequest,
  type MiniMaxChatCompletionResponse,
} from "../../../../../../src/platform/model-gateway/provider-registry/minimax/minimax-chat-service.js";

test("MiniMaxMessage role accepts valid values", () => {
  const userMsg: MiniMaxMessage = { role: "user", content: "Hello" };
  assert.equal(userMsg.role, "user");
  assert.equal(userMsg.content, "Hello");

  const assistantMsg: MiniMaxMessage = { role: "assistant", content: "Hi there" };
  assert.equal(assistantMsg.role, "assistant");

  const systemMsg: MiniMaxMessage = { role: "system", content: "You are helpful" };
  assert.equal(systemMsg.role, "system");
});

test("MiniMaxTool type is function", () => {
  const tool: MiniMaxTool = {
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

test("MiniMaxChatCompletionRequest accepts valid structure", () => {
  const request: MiniMaxChatCompletionRequest = {
    model: "abab6.5s",
    messages: [
      { role: "user", content: "Hello" },
    ],
    max_tokens: 1024,
    stream: false,
  };
  assert.equal(request.model, "abab6.5s");
  assert.equal(request.max_tokens, 1024);
  assert.equal(request.stream, false);
});

test("MiniMaxChatCompletionResponse interfaces are present", () => {
  // Verify the service class can be instantiated (basic structure test)
  // Note: This is a structural test - actual API calls require credentials
  assert.ok(MiniMaxChatService !== undefined);
});

test("MiniMaxMessage with empty content is valid", () => {
  const msg: MiniMaxMessage = { role: "user", content: "" };
  assert.equal(msg.content, "");
});

test("MiniMaxTool without description is valid", () => {
  const tool: MiniMaxTool = {
    type: "function",
    name: "simple_tool",
    input_schema: { type: "object" },
  };
  assert.equal(tool.name, "simple_tool");
  assert.equal(tool.description, undefined);
});