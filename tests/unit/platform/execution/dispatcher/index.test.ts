import assert from "node:assert/strict";
import test from "node:test";

import {
  getToolRegistry,
  resetToolRegistry,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
  type MultiStepToolDefinition,
} from "../../../../../src/platform/five-plane-execution/dispatcher/index.js";

// ---------------------------------------------------------------------------
// Test setup and teardown
// ---------------------------------------------------------------------------

test.afterEach(() => {
  // Reset tool registry between tests to ensure isolation
  resetMultiStepToolRegistryForTests();
});

// ---------------------------------------------------------------------------
// Singleton behavior
// ---------------------------------------------------------------------------

test("getToolRegistry returns a singleton instance", () => {
  const registry1 = getToolRegistry();
  const registry2 = getToolRegistry();
  assert.strictEqual(registry1, registry2, "getToolRegistry should return the same instance");
});

test("resetToolRegistry clears the singleton", () => {
  const registry1 = getToolRegistry();
  resetToolRegistry();
  const registry2 = getToolRegistry();
  assert.notStrictEqual(registry1, registry2, "After reset, getToolRegistry should return a new instance");
});

test("resetMultiStepToolRegistryForTests clears the singleton (test-only export)", () => {
  const registry1 = getToolRegistry();
  resetMultiStepToolRegistryForTests();
  const registry2 = getToolRegistry();
  assert.notStrictEqual(registry1, registry2, "After reset, getToolRegistry should return a new instance");
});

// ---------------------------------------------------------------------------
// Tool registry interface
// ---------------------------------------------------------------------------

test("tool registry has executeToolCall method", () => {
  const registry = getToolRegistry();
  assert.equal(typeof registry.executeToolCall, "function", "Registry should have executeToolCall method");
});

// ---------------------------------------------------------------------------
// executeToolCall - question tool (skipped implementation)
// ---------------------------------------------------------------------------

test("executeToolCall handles question tool and returns skipped status", async () => {
  const result = await executeMultiStepToolCallForTests("question", JSON.stringify({
    question: "What is the meaning of life?",
    context: "I'm writing a test",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
  assert.equal(parsed.answer, null);
});

// ---------------------------------------------------------------------------
// executeToolCall - web_search tool with missing query
// ---------------------------------------------------------------------------

test("executeToolCall returns error for web_search with missing query", async () => {
  const result = await executeMultiStepToolCallForTests("web_search", JSON.stringify({}));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "query is required");
  assert.equal(parsed.errorCode, "MISSING_QUERY");
});

// ---------------------------------------------------------------------------
// executeToolCall - web_fetch tool with missing url
// ---------------------------------------------------------------------------

test("executeToolCall returns error for web_fetch with missing url", async () => {
  const result = await executeMultiStepToolCallForTests("web_fetch", JSON.stringify({}));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "url is required");
  assert.equal(parsed.errorCode, "MISSING_URL");
});

// ---------------------------------------------------------------------------
// executeToolCall - git tool with missing args
// ---------------------------------------------------------------------------

test("executeToolCall returns error for git with missing args", async () => {
  const result = await executeMultiStepToolCallForTests("git", JSON.stringify({}));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "git args are required");
  assert.equal(parsed.errorCode, "MISSING_GIT_ARGS");
});

// ---------------------------------------------------------------------------
// executeToolCall - repo-map tool with missing query
// ---------------------------------------------------------------------------

test("executeToolCall returns error for repo-map with missing query", async () => {
  const result = await executeMultiStepToolCallForTests("repo-map", JSON.stringify({
    query: "",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "query is required");
  assert.equal(parsed.errorCode, "MISSING_QUERY");
});

// ---------------------------------------------------------------------------
// executeToolCall - spawn-agent with new agent
// ---------------------------------------------------------------------------

test("executeToolCall spawn-agent creates new agent and executes", async () => {
  const result = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "test-agent-1",
    request: "Hello, agent!",
    stepId: "test-step",
    roleId: "test-role",
    routingReason: "testing",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "succeeded");
  assert.equal(parsed.agentId, "test-agent-1");
});

// ---------------------------------------------------------------------------
// executeToolCall - spawn-agent with existing agent returns cached
// ---------------------------------------------------------------------------

test("executeToolCall spawn-agent returns cached result for existing agent", async () => {
  // First spawn
  const result1 = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "test-agent-cached",
    request: "First request",
  }));

  const parsed1 = JSON.parse(result1);
  const messageCount1 = parsed1.messageCount;

  // Second spawn with same agentId should return cached
  const result2 = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "test-agent-cached",
    request: "Second request",
  }));

  const parsed2 = JSON.parse(result2);
  assert.equal(parsed2.success, true);
  assert.equal(parsed2.agentId, "test-agent-cached");
  // The messageCount should be the same since it returns cached state
  assert.equal(parsed2.messageCount, messageCount1);
});

// ---------------------------------------------------------------------------
// executeToolCall - wait-agent with missing agentId
// ---------------------------------------------------------------------------

test("executeToolCall returns error for wait-agent with missing agentId", async () => {
  const result = await executeMultiStepToolCallForTests("wait-agent", JSON.stringify({}));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "agentId is required");
  assert.equal(parsed.errorCode, "MISSING_AGENT_ID");
});

// ---------------------------------------------------------------------------
// executeToolCall - wait-agent with nonexistent agent
// ---------------------------------------------------------------------------

test("executeToolCall returns error for wait-agent with nonexistent agent", async () => {
  const result = await executeMultiStepToolCallForTests("wait-agent", JSON.stringify({
    agentId: "nonexistent-agent-12345",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "Agent nonexistent-agent-12345 not found");
  assert.equal(parsed.errorCode, "AGENT_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// executeToolCall - send-message with missing args
// ---------------------------------------------------------------------------

test("executeToolCall returns error for send-message with missing agentId", async () => {
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    message: "Hello",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "agentId and message are required");
  assert.equal(parsed.errorCode, "MISSING_ARGS");
});

test("executeToolCall returns error for send-message with missing message", async () => {
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    agentId: "some-agent",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "agentId and message are required");
  assert.equal(parsed.errorCode, "MISSING_ARGS");
});

// ---------------------------------------------------------------------------
// executeToolCall - send-message with nonexistent agent
// ---------------------------------------------------------------------------

test("executeMultiStepToolCallForTests returns error for send-message with nonexistent agent", async () => {
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    agentId: "nonexistent-agent-xyz",
    message: "Hello",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "Agent nonexistent-agent-xyz not found");
  assert.equal(parsed.errorCode, "AGENT_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// executeToolCall - batch-tool with missing toolCalls
// ---------------------------------------------------------------------------

test("executeToolCall returns error for batch-tool with missing toolCalls", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: [],
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "toolCalls array is required");
  assert.equal(parsed.errorCode, "MISSING_TOOL_CALLS");
});

test("executeToolCall returns error for batch-tool with non-array toolCalls", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: "not-an-array",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "toolCalls array is required");
  assert.equal(parsed.errorCode, "MISSING_TOOL_CALLS");
});

// ---------------------------------------------------------------------------
// executeToolCall - batch-tool with valid calls
// ---------------------------------------------------------------------------

test("executeToolCall batch-tool executes tools in serial mode", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: [
      { toolName: "question", arguments: { question: "Test?" } },
    ],
    parallel: false,
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.executionMode, "serial");
  assert.ok(Array.isArray(parsed.results));
});

// ---------------------------------------------------------------------------
// executeToolCall - unknown tool
// ---------------------------------------------------------------------------

test("executeToolCall returns error for unknown tool", async () => {
  const result = await executeMultiStepToolCallForTests("unknown-tool-xyz", JSON.stringify({}));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "Unknown tool: unknown-tool-xyz");
  assert.equal(parsed.errorCode, "UNKNOWN_TOOL");
});

// ---------------------------------------------------------------------------
// executeToolCall - invalid JSON arguments
// ---------------------------------------------------------------------------

test("executeToolCall handles invalid JSON arguments gracefully", async () => {
  const result = await executeMultiStepToolCallForTests("question", "not-valid-json");

  const parsed = JSON.parse(result);
  // Should still process and return a result (uses raw value)
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
});

// ---------------------------------------------------------------------------
// Tool definitions export
// ---------------------------------------------------------------------------

test("MultiStepToolDefinition type is exported", () => {
  // Verify the type exists by creating a valid tool definition
  const toolDef: MultiStepToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: {
      type: "object",
      properties: {
        arg1: { type: "string" },
      },
    },
  };
  assert.equal(toolDef.name, "test_tool");
  assert.equal(toolDef.description, "A test tool");
});
