import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChatMessage,
  ChatTool,
  ChatCompletionUsage,
  ChatCompletionResult,
  ChatCompletionRequest,
  ChatProviderType,
  UnifiedProviderConfig,
} from "../../../../../src/platform/model-gateway/provider-registry/unified-chat-provider.js";

test("ChatMessage structure is correct", () => {
  const message: ChatMessage = {
    role: "user",
    content: "Hello, world!",
  };
  assert.equal(message.role, "user");
  assert.equal(message.content, "Hello, world!");
});

test("ChatMessage role accepts all valid values", () => {
  const roles: ChatMessage["role"][] = ["system", "user", "assistant"];
  assert.equal(roles.length, 3);
});

test("ChatTool structure is correct", () => {
  const tool: ChatTool = {
    type: "function",
    name: "read_file",
    description: "Read a file from the filesystem",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  };
  assert.equal(tool.type, "function");
  assert.equal(tool.name, "read_file");
});

test("ChatTool allows minimal definition", () => {
  const tool: ChatTool = {
    type: "function",
    name: "minimal_tool",
    parameters: {},
  };
  assert.equal(tool.description, undefined);
});

test("ChatCompletionUsage structure is correct", () => {
  const usage: ChatCompletionUsage = {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    estimatedCostUsd: 0.0025,
  };
  assert.equal(usage.promptTokens, 100);
  assert.equal(usage.totalTokens, 150);
  assert.equal(usage.estimatedCostUsd, 0.0025);
});

test("ChatCompletionResult structure is correct", () => {
  const result: ChatCompletionResult = {
    id: "chatcmpl_123",
    requestId: "chatcmpl_123",
    content: "Hello! How can I help you?",
    refusal: null,
    reasoningContent: null,
    finishReason: "stop",
    stopSequence: null,
    toolCalls: [],
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    estimatedCostUsd: 0.0012,
    latencyMs: 120,
    model: "claude-3-5-sonnet",
    provider: "anthropic",
  };
  assert.equal(result.content, "Hello! How can I help you?");
  assert.equal(result.finishReason, "stop");
});

test("ChatCompletionResult allows tool calls", () => {
  const result: ChatCompletionResult = {
    id: "chatcmpl_456",
    requestId: "chatcmpl_456",
    content: "",
    refusal: null,
    reasoningContent: null,
    finishReason: "tool_calls",
    stopSequence: null,
    toolCalls: [
      {
        id: "call_abc",
        type: "function",
        function: { name: "read_file", arguments: '{"path":"/tmp/test.txt"}' },
      },
    ],
    usage: {
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
    },
    estimatedCostUsd: 0.003,
    latencyMs: 95,
    model: "gpt-4o",
    provider: "openai",
  };
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0]?.function.name, "read_file");
});

test("ChatCompletionResult allows reasoning content", () => {
  const result: ChatCompletionResult = {
    id: "chatcmpl_reasoning",
    requestId: "chatcmpl_reasoning",
    content: "Let me think about this...",
    refusal: null,
    reasoningContent: "I need to consider the implications...",
    finishReason: "stop",
    stopSequence: null,
    toolCalls: [],
    usage: {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    },
    estimatedCostUsd: 0.009,
    latencyMs: 180,
    model: "claude-4-sonnet",
    provider: "anthropic",
  };
  assert.equal(result.reasoningContent, "I need to consider the implications...");
});

test("ChatCompletionRequest structure is correct", () => {
  const request: ChatCompletionRequest = {
    model: "claude-3-5-sonnet",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" },
    ],
    system: "You are a helpful assistant.",
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    stream: false,
    tools: [],
    toolChoice: "auto",
    traceId: "trace-1",
    tenantId: "tenant-1",
    costTag: "interactive",
  };
  assert.equal(request.model, "claude-3-5-sonnet");
  assert.equal(request.maxTokens, 4096);
  assert.equal(request.traceId, "trace-1");
  assert.equal(request.tenantId, "tenant-1");
  assert.equal(request.costTag, "interactive");
});

test("ChatCompletionRequest allows minimal definition", () => {
  const request: ChatCompletionRequest = {
    model: "gpt-4",
    messages: [{ role: "user", content: "Hi" }],
    maxTokens: 1024,
    traceId: "trace-min",
    tenantId: null,
    costTag: "batch",
  };
  assert.equal(request.system, undefined);
  assert.equal(request.temperature, undefined);
});

test("ChatProviderType accepts all valid values", () => {
  const types: ChatProviderType[] = ["anthropic", "openai", "minimax"];
  assert.equal(types.length, 3);
});

test("UnifiedProviderConfig structure is correct", () => {
  const config: UnifiedProviderConfig = {
    anthropic: {
      apiKey: "sk-ant-...",
      baseUrl: "https://api.anthropic.com",
    },
    openai: {
      apiKey: "sk-...",
      baseUrl: "https://api.openai.com",
      organization: "org_123",
    },
    minimax: {
      apiKey: "minimax_...",
    },
  };
  assert.equal(config.anthropic?.baseUrl, "https://api.anthropic.com");
  assert.equal(config.openai?.organization, "org_123");
});

test("UnifiedProviderConfig allows partial providers", () => {
  const config: UnifiedProviderConfig = {
    anthropic: {
      apiKey: "sk-ant-...",
    },
  };
  assert.equal(config.openai, undefined);
  assert.equal(config.minimax, undefined);
});
