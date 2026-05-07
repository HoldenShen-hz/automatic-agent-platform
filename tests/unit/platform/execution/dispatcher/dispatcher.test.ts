import assert from "node:assert/strict";
import test from "node:test";

// Test the dispatcher index exports
// The index module provides multi-step tool dispatch functionality

import {
  getToolRegistry,
  resetToolRegistry,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
  setToolRegistryBudgetLedger,
  type MultiStepToolDefinition,
} from "../../../../../src/platform/five-plane-execution/dispatcher/index.js";
import { createBudgetLedger } from "../../../../../src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Test setup and teardown
// ---------------------------------------------------------------------------

test.beforeEach(() => {
  // R4-25: Set up budget ledger for tool execution tests
  const ledger = createBudgetLedger({
    tenantId: "tenant:dispatcher-test",
    harnessRunId: "harness_run:dispatcher-test",
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
  });
  setToolRegistryBudgetLedger(ledger);
});

test.afterEach(() => {
  resetMultiStepToolRegistryForTests();
});

// ---------------------------------------------------------------------------
// Singleton behavior tests
// ---------------------------------------------------------------------------

test("getToolRegistry returns consistent singleton", () => {
  const registry1 = getToolRegistry();
  const registry2 = getToolRegistry();
  assert.strictEqual(registry1, registry2);
});

test("resetToolRegistry clears singleton instance", () => {
  const registry1 = getToolRegistry();
  resetToolRegistry();
  const registry2 = getToolRegistry();
  assert.notStrictEqual(registry1, registry2);
});

test("resetMultiStepToolRegistryForTests clears singleton (test export)", () => {
  const registry1 = getToolRegistry();
  resetMultiStepToolRegistryForTests();
  const registry2 = getToolRegistry();
  assert.notStrictEqual(registry1, registry2);
});

// ---------------------------------------------------------------------------
// MultiStepToolDefinition type export
// ---------------------------------------------------------------------------

test("MultiStepToolDefinition type is exported and usable", () => {
  const toolDef: MultiStepToolDefinition = {
    name: "test_tool",
    description: "A test tool definition",
    inputSchema: {
      type: "object",
      properties: {
        param1: { type: "string" },
        param2: { type: "number" },
      },
      required: ["param1"],
    },
  };
  assert.equal(toolDef.name, "test_tool");
  assert.equal(toolDef.description, "A test tool definition");
  assert.ok(toolDef.inputSchema.properties);
  assert.ok(Array.isArray(toolDef.inputSchema.required));
});

// ---------------------------------------------------------------------------
// question tool (no-op/skipped implementation)
// ---------------------------------------------------------------------------

test("executeToolCall for question tool returns skipped status", async () => {
  const result = await executeMultiStepToolCallForTests("question", JSON.stringify({
    question: "What is 2+2?",
    context: "testing",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
  assert.equal(parsed.answer, null);
  assert.equal(parsed.durationMs, 0);
});

test("executeToolCall question tool handles empty args", async () => {
  const result = await executeMultiStepToolCallForTests("question", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
});

// ---------------------------------------------------------------------------
// web_search tool validation
// ---------------------------------------------------------------------------

test("executeToolCall web_search requires query parameter", async () => {
  const result = await executeMultiStepToolCallForTests("web_search", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "query is required");
  assert.equal(parsed.errorCode, "MISSING_QUERY");
});

test("executeToolCall web_search handles empty query string", async () => {
  const result = await executeMultiStepToolCallForTests("web_search", JSON.stringify({ query: "" }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "query is required");
});

test("executeToolCall web_search accepts valid query", async () => {
  const result = await executeMultiStepToolCallForTests("web_search", JSON.stringify({
    query: "test search",
    limit: 5,
  }));
  const parsed = JSON.parse(result);
  // May succeed or fail based on actual implementation, but should be valid request format
  assert.ok(typeof parsed.success === "boolean");
});

// ---------------------------------------------------------------------------
// web_fetch tool validation
// ---------------------------------------------------------------------------

test("executeToolCall web_fetch requires url parameter", async () => {
  const result = await executeMultiStepToolCallForTests("web_fetch", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "url is required");
  assert.equal(parsed.errorCode, "MISSING_URL");
});

test("executeToolCall web_fetch handles empty url string", async () => {
  const result = await executeMultiStepToolCallForTests("web_fetch", JSON.stringify({ url: "" }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "url is required");
});

test("executeToolCall web_fetch accepts valid url", async () => {
  const result = await executeMultiStepToolCallForTests("web_fetch", JSON.stringify({
    url: "https://example.com",
  }));
  const parsed = JSON.parse(result);
  // May succeed or fail, but should be valid request format
  assert.ok(typeof parsed.success === "boolean");
});

// ---------------------------------------------------------------------------
// git tool validation
// ---------------------------------------------------------------------------

test("executeToolCall git requires args parameter", async () => {
  const result = await executeMultiStepToolCallForTests("git", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "git args are required");
  assert.equal(parsed.errorCode, "MISSING_GIT_ARGS");
});

test("executeToolCall git handles empty args array", async () => {
  const result = await executeMultiStepToolCallForTests("git", JSON.stringify({ args: [] }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "git args are required");
});

test("executeToolCall git accepts valid args", async () => {
  const result = await executeMultiStepToolCallForTests("git", JSON.stringify({
    args: ["status"],
    cwd: process.cwd(),
  }));
  // May succeed or fail based on git availability
  assert.ok(typeof JSON.parse(result).success === "boolean");
});

// ---------------------------------------------------------------------------
// repo-map tool validation
// ---------------------------------------------------------------------------

test("executeToolCall repo-map requires non-empty query", async () => {
  const result = await executeMultiStepToolCallForTests("repo-map", JSON.stringify({ query: "" }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "query is required");
  assert.equal(parsed.errorCode, "MISSING_QUERY");
});

test("executeToolCall repo-map rejects whitespace-only query", async () => {
  const result = await executeMultiStepToolCallForTests("repo-map", JSON.stringify({ query: "   " }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "query is required");
});

test("executeToolCall repo-map accepts valid query", async () => {
  const result = await executeMultiStepToolCallForTests("repo-map", JSON.stringify({
    query: "test function",
    limit: 10,
  }));
  // May succeed or fail based on repo content
  assert.ok(typeof JSON.parse(result).success === "boolean");
});

// ---------------------------------------------------------------------------
// spawn-agent tool
// ---------------------------------------------------------------------------

test("executeToolCall spawn-agent creates new agent and returns result", async () => {
  const result = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "new-agent-123",
    request: "Initial request",
    stepId: "step-1",
    roleId: "test-role",
    routingReason: "testing spawn",
  }));

  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.agentId, "new-agent-123");
  assert.ok(typeof parsed.status === "string");
  assert.ok(typeof parsed.updatedAt === "string");
});

test("executeToolCall spawn-agent returns existing agent state for duplicate agentId", async () => {
  // Create first agent
  const result1 = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "duplicate-agent-test",
    request: "First request",
  }));
  const parsed1 = JSON.parse(result1);
  const messageCount1 = parsed1.messageCount;

  // Spawn again with same agentId
  const result2 = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "duplicate-agent-test",
    request: "Second request",
  }));
  const parsed2 = JSON.parse(result2);

  assert.equal(parsed2.agentId, "duplicate-agent-test");
  assert.equal(parsed2.messageCount, messageCount1);
});

test("executeToolCall spawn-agent with minimal args", async () => {
  const result = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    request: "Minimal request",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.ok(parsed.agentId.startsWith("agent_"));
});

// ---------------------------------------------------------------------------
// wait-agent tool validation
// ---------------------------------------------------------------------------

test("executeToolCall wait-agent requires agentId", async () => {
  const result = await executeMultiStepToolCallForTests("wait-agent", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "agentId is required");
  assert.equal(parsed.errorCode, "MISSING_AGENT_ID");
});

test("executeToolCall wait-agent returns error for nonexistent agent", async () => {
  const result = await executeMultiStepToolCallForTests("wait-agent", JSON.stringify({
    agentId: "definitely-does-not-exist-12345",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "Agent definitely-does-not-exist-12345 not found");
  assert.equal(parsed.errorCode, "AGENT_NOT_FOUND");
});

test("executeToolCall wait-agent returns state for existing spawned agent", async () => {
  // First spawn an agent
  await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "wait-test-agent",
    request: "Initial",
  }));

  // Now wait for it
  const result = await executeMultiStepToolCallForTests("wait-agent", JSON.stringify({
    agentId: "wait-test-agent",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.agentId, "wait-test-agent");
});

// ---------------------------------------------------------------------------
// send-message tool validation
// ---------------------------------------------------------------------------

test("executeToolCall send-message requires both agentId and message", async () => {
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    agentId: "some-agent",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "agentId and message are required");
  assert.equal(parsed.errorCode, "MISSING_ARGS");
});

test("executeToolCall send-message requires message", async () => {
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    message: "Hello",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "agentId and message are required");
  assert.equal(parsed.errorCode, "MISSING_ARGS");
});

test("executeToolCall send-message returns error for nonexistent agent", async () => {
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    agentId: "nonexistent-msg-agent",
    message: "Hello there",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "Agent nonexistent-msg-agent not found");
  assert.equal(parsed.errorCode, "AGENT_NOT_FOUND");
});

test("executeToolCall send-message updates existing agent and returns result", async () => {
  // Create agent first
  await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    agentId: "msg-test-agent",
    request: "Initial request",
  }));

  // Send message
  const result = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    agentId: "msg-test-agent",
    message: "Follow-up message",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.agentId, "msg-test-agent");
});

// ---------------------------------------------------------------------------
// batch-tool validation
// ---------------------------------------------------------------------------

test("executeToolCall batch-tool requires non-empty toolCalls array", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: [],
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "toolCalls array is required");
  assert.equal(parsed.errorCode, "MISSING_TOOL_CALLS");
});

test("executeToolCall batch-tool rejects non-array toolCalls", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: "not-an-array",
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "toolCalls array is required");
});

test("executeToolCall batch-tool executes in serial mode by default", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: [
      { toolName: "question", arguments: { question: "Test 1" } },
      { toolName: "question", arguments: { question: "Test 2" } },
    ],
    parallel: false,
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.executionMode, "serial");
  assert.ok(Array.isArray(parsed.results));
  assert.equal(parsed.results.length, 2);
});

test("executeToolCall batch-tool executes in parallel mode when specified", async () => {
  const result = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    toolCalls: [
      { toolName: "question", arguments: { question: "Parallel 1" } },
      { toolName: "question", arguments: { question: "Parallel 2" } },
    ],
    parallel: true,
  }));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.executionMode, "parallel");
  assert.ok(Array.isArray(parsed.results));
});

// ---------------------------------------------------------------------------
// unknown tool handling
// ---------------------------------------------------------------------------

test("executeToolCall returns error for unknown tool", async () => {
  const result = await executeMultiStepToolCallForTests("nonexistent_tool_123", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "Unknown tool: nonexistent_tool_123");
  assert.equal(parsed.errorCode, "UNKNOWN_TOOL");
});

test("executeToolCall handles tool name with special characters", async () => {
  const result = await executeMultiStepToolCallForTests("tool-with-dashes_underscores", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.errorCode, "UNKNOWN_TOOL");
});

// ---------------------------------------------------------------------------
// Invalid JSON argument handling
// ---------------------------------------------------------------------------

test("executeToolCall handles completely invalid JSON", async () => {
  const result = await executeMultiStepToolCallForTests("question", "this is not json at all");
  const parsed = JSON.parse(result);
  // Should still process using raw value approach
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
});

test("executeToolCall handles partial JSON", async () => {
  const result = await executeMultiStepToolCallForTests("question", '{invalid');
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
});

test("executeToolCall handles empty string JSON", async () => {
  const result = await executeMultiStepToolCallForTests("question", "");
  const parsed = JSON.parse(result);
  // Should handle gracefully
  assert.ok(typeof parsed.success === "boolean");
});

// ---------------------------------------------------------------------------
// todo_write tool basic tests
// ---------------------------------------------------------------------------

test("executeToolCall todo_write denies write operations without explicit sandbox allow", async () => {
  await assert.rejects(
    () => executeMultiStepToolCallForTests("todo_write", JSON.stringify({
      operation: "create",
      title: "Test Todo",
      sessionId: "test-session",
    })),
    /Sandbox policy denies tool todo_write with operation create/,
  );
});

test("executeToolCall todo_write with list operation", async () => {
  const result = await executeMultiStepToolCallForTests("todo_write", JSON.stringify({
    operation: "list",
    filterStatus: "pending",
  }));
  const parsed = JSON.parse(result);
  assert.ok(typeof parsed === "object");
});

test("executeToolCall todo_write with get operation", async () => {
  const result = await executeMultiStepToolCallForTests("todo_write", JSON.stringify({
    operation: "get",
    todoId: "todo-123",
  }));
  const parsed = JSON.parse(result);
  assert.ok(typeof parsed === "object");
});

test("executeToolCall todo_write update is denied without explicit sandbox allow", async () => {
  await assert.rejects(
    () => executeMultiStepToolCallForTests("todo_write", JSON.stringify({
      operation: "update",
      todoId: "todo-123",
      title: "Updated Title",
    })),
    /Sandbox policy denies tool todo_write with operation update|denied by sandbox policy/,
  );
});

test("executeToolCall todo_write delete is denied without explicit sandbox allow", async () => {
  await assert.rejects(
    () => executeMultiStepToolCallForTests("todo_write", JSON.stringify({
      operation: "delete",
      todoId: "todo-123",
    })),
    /Sandbox policy denies tool todo_write with operation delete|denied by sandbox policy/,
  );
});
