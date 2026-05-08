import assert from "node:assert/strict";
import test from "node:test";

import {
  OpenAIMessage,
  OpenAIFunction,
  OpenAIChatCompletionRequest,
} from "../../../../../../src/platform/model-gateway/provider-registry/openai/openai-chat-service.js";

test("OpenAIMessage role accepts valid values", () => {
  const userMsg: OpenAIMessage = { role: "user", content: "Hello" };
  assert.equal(userMsg.role, "user");
  assert.equal(userMsg.content, "Hello");

  const assistantMsg: OpenAIMessage = { role: "assistant", content: "Hi there" };
  assert.equal(assistantMsg.role, "assistant");

  const systemMsg: OpenAIMessage = { role: "system", content: "You are helpful" };
  assert.equal(systemMsg.role, "system");
});

test("OpenAIMessage with name property is valid", () => {
  const msg: OpenAIMessage = { role: "user", content: "Hello", name: "user_123" };
  assert.equal(msg.name, "user_123");
});

test("OpenAIFunction type is function", () => {
  const fn: OpenAIFunction = {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
  };
  assert.equal(fn.type, "function");
  assert.equal(fn.function.name, "get_weather");
});

test("OpenAIChatCompletionRequest accepts valid structure", () => {
  const request: OpenAIChatCompletionRequest = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ],
    temperature: 0.7,
    max_tokens: 1024,
    stream: false,
  };
  assert.equal(request.model, "gpt-4o");
  assert.equal(request.temperature, 0.7);
  assert.equal(request.max_tokens, 1024);
});

test("OpenAIChatCompletionRequest with tool_choice", () => {
  const request: OpenAIChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    tool_choice: "auto",
  };
  assert.equal(request.tool_choice, "auto");
});

test("OpenAIChatCompletionRequest with json_object response_format", () => {
  const request: OpenAIChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Return JSON" }],
    response_format: { type: "json_object" },
  };
  assert.deepEqual(request.response_format, { type: "json_object" });
});

test("OpenAIMessage with empty content is valid", () => {
  const msg: OpenAIMessage = { role: "user", content: "" };
  assert.equal(msg.content, "");
});

test("OpenAIFunction without description is valid", () => {
  const fn: OpenAIFunction = {
    type: "function",
    function: {
      name: "simple_function",
      parameters: { type: "object" },
    },
  };
  assert.equal(fn.function.name, "simple_function");
  assert.equal(fn.function.description, undefined);
});

test("OpenAIChatCompletionRequest with tools", () => {
  const request: OpenAIChatCompletionRequest = {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Use a tool" }],
    tools: [
      {
        type: "function",
        function: {
          name: "test_tool",
          parameters: { type: "object" },
        },
      },
    ],
  };
  assert.equal(request.tools?.length, 1);
  assert.equal(request.tools?.[0]?.function.name, "test_tool");
});