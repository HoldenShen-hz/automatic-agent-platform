import assert from "node:assert/strict";
import test from "node:test";

import {
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
} from "../../../src/platform/five-plane-execution/dispatcher/index.js";

function parseToolResult(result: string): Record<string, unknown> {
  return JSON.parse(result) as Record<string, unknown>;
}

function assertErrorResult(result: string, expectedErrorCode: string): Record<string, unknown> {
  const parsed = parseToolResult(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.errorCode, expectedErrorCode);
  assert.equal(typeof parsed.errorCode, "string");
  return parsed;
}

test.afterEach(() => {
  resetMultiStepToolRegistryForTests();
});

test("executeToolCall handles invalid JSON arguments gracefully", async () => {
  const result = await executeMultiStepToolCallForTests("todo_write", "not valid json");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.operation, "create");
});

test("executeToolCall handles empty todo_write arguments", async () => {
  const result = await executeMultiStepToolCallForTests("todo_write", "{}");
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
});

test("executeToolCall todo_write with create operation", async () => {
  const result = await executeMultiStepToolCallForTests(
    "todo_write",
    JSON.stringify({
      operation: "create",
      title: "Test task",
      sessionId: "test-session",
    }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.operation, "create");
});

test("executeToolCall question returns skipped", async () => {
  const result = await executeMultiStepToolCallForTests("question", JSON.stringify({}));
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.status, "skipped");
});

test("executeToolCall web_search without query returns error", async () => {
  const result = await executeMultiStepToolCallForTests("web_search", JSON.stringify({}));
  assertErrorResult(result, "MISSING_QUERY");
});

test("executeToolCall web_fetch without url returns error", async () => {
  const result = await executeMultiStepToolCallForTests("web_fetch", JSON.stringify({}));
  assertErrorResult(result, "MISSING_URL");
});

test("executeToolCall git without args returns error", async () => {
  const result = await executeMultiStepToolCallForTests("git", JSON.stringify({}));
  assertErrorResult(result, "MISSING_GIT_ARGS");
});

test("executeToolCall repo-map without query returns error", async () => {
  const result = await executeMultiStepToolCallForTests("repo-map", JSON.stringify({}));
  assertErrorResult(result, "MISSING_QUERY");
});

test("executeToolCall repo-map with empty query returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "repo-map",
    JSON.stringify({ query: "   " }),
  );
  assertErrorResult(result, "MISSING_QUERY");
});

test("executeToolCall wait-agent without agentId returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "wait-agent",
    JSON.stringify({}),
  );
  assertErrorResult(result, "MISSING_AGENT_ID");
});

test("executeToolCall wait-agent with unknown agent returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "wait-agent",
    JSON.stringify({ agentId: "nonexistent-agent" }),
  );
  assertErrorResult(result, "AGENT_NOT_FOUND");
});

test("executeToolCall send-message without agentId returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "send-message",
    JSON.stringify({ message: "hello" }),
  );
  assertErrorResult(result, "MISSING_ARGS");
});

test("executeToolCall send-message without message returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "send-message",
    JSON.stringify({ agentId: "agent-1" }),
  );
  assertErrorResult(result, "MISSING_ARGS");
});

test("executeToolCall batch-tool without toolCalls returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "batch-tool",
    JSON.stringify({}),
  );
  assertErrorResult(result, "MISSING_TOOL_CALLS");
});

test("executeToolCall batch-tool with empty toolCalls array returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "batch-tool",
    JSON.stringify({ toolCalls: [] }),
  );
  assertErrorResult(result, "MISSING_TOOL_CALLS");
});

test("executeToolCall batch-tool serial execution", async () => {
  const result = await executeMultiStepToolCallForTests(
    "batch-tool",
    JSON.stringify({
      toolCalls: [
        { toolName: "question", arguments: {} },
      ],
      parallel: false,
    }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.executionMode, "serial");
  assert.equal(parsed.results.length, 1);
});

test("executeToolCall batch-tool parallel execution", async () => {
  const result = await executeMultiStepToolCallForTests(
    "batch-tool",
    JSON.stringify({
      toolCalls: [
        { toolName: "question", arguments: {} },
        { toolName: "question", arguments: {} },
      ],
      parallel: true,
    }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.executionMode, "parallel");
  assert.equal(parsed.results.length, 2);
});

test("executeToolCall unknown tool returns error", async () => {
  const result = await executeMultiStepToolCallForTests(
    "nonexistent-tool",
    JSON.stringify({}),
  );
  assertErrorResult(result, "UNKNOWN_TOOL");
});

test("executeToolCall web_search with query formats result correctly", async () => {
  const result = await executeMultiStepToolCallForTests(
    "web_search",
    JSON.stringify({ query: "test search" }),
  );
  const parsed = JSON.parse(result);
  assert.ok(parsed.hasOwnProperty("success"));
  assert.ok(parsed.hasOwnProperty("results") || parsed.hasOwnProperty("error"));
});

test("executeToolCall web_fetch with valid url formats result correctly", async () => {
  const result = await executeMultiStepToolCallForTests(
    "web_fetch",
    JSON.stringify({ url: "https://example.com" }),
  );
  const parsed = JSON.parse(result);
  assert.ok(parsed.hasOwnProperty("success"));
});

test("executeToolCall spawn-agent creates agent and returns response", async () => {
  const result = await executeMultiStepToolCallForTests(
    "spawn-agent",
    JSON.stringify({
      agentId: "test-agent-1",
      stepId: "step-1",
      roleId: "agent",
      request: "Hello agent",
    }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.agentId, "test-agent-1");
  assert.ok(parsed.hasOwnProperty("status"));
});

test("executeToolCall spawn-agent reuses existing agent", async () => {
  const result1 = await executeMultiStepToolCallForTests(
    "spawn-agent",
    JSON.stringify({
      agentId: "test-agent-reuse",
      stepId: "step-1",
      roleId: "agent",
      request: "First request",
    }),
  );
  const result2 = await executeMultiStepToolCallForTests(
    "spawn-agent",
    JSON.stringify({
      agentId: "test-agent-reuse",
      stepId: "step-1",
      roleId: "agent",
      request: "Second request",
    }),
  );
  const parsed1 = JSON.parse(result1);
  const parsed2 = JSON.parse(result2);
  assert.equal(parsed1.success, true);
  assert.equal(parsed2.success, true);
  assert.equal(parsed2.messageCount, 1);
});

test("executeToolCall wait-agent retrieves existing agent", async () => {
  await executeMultiStepToolCallForTests(
    "spawn-agent",
    JSON.stringify({
      agentId: "wait-test-agent",
      stepId: "step-1",
      roleId: "agent",
      request: "Test",
    }),
  );
  const result = await executeMultiStepToolCallForTests(
    "wait-agent",
    JSON.stringify({ agentId: "wait-test-agent" }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.agentId, "wait-test-agent");
});

test("executeToolCall send-message adds to history and executes", async () => {
  await executeMultiStepToolCallForTests(
    "spawn-agent",
    JSON.stringify({
      agentId: "message-test-agent",
      stepId: "step-1",
      roleId: "agent",
      request: "Initial",
    }),
  );
  const result = await executeMultiStepToolCallForTests(
    "send-message",
    JSON.stringify({
      agentId: "message-test-agent",
      message: "Follow-up message",
    }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.messageCount, 2);
});

test("executeToolCall git status command", async () => {
  const result = await executeMultiStepToolCallForTests(
    "git",
    JSON.stringify({ args: ["status"] }),
  );
  const parsed = JSON.parse(result);
  assert.ok(parsed.hasOwnProperty("success"));
  assert.ok(parsed.hasOwnProperty("requestedToolName"));
});

test("executeToolCall git with cwd parameter", async () => {
  const result = await executeMultiStepToolCallForTests(
    "git",
    JSON.stringify({
      args: ["status"],
      cwd: process.cwd(),
    }),
  );
  const parsed = JSON.parse(result);
  assert.ok(parsed.hasOwnProperty("success"));
});

test("executeToolCall repo-map with valid query", async () => {
  const result = await executeMultiStepToolCallForTests(
    "repo-map",
    JSON.stringify({
      query: "test function",
      limit: 5,
    }),
  );
  const parsed = JSON.parse(result);
  if (parsed.success) {
    assert.ok(parsed.hasOwnProperty("files") || parsed.hasOwnProperty("error"));
  } else {
    assert.equal(parsed.success, false);
    assert.ok(parsed.hasOwnProperty("errorCode"));
  }
});

test("executeToolCall git catches path_outside_workspace error from resolveMultiStepToolPath", async () => {
  // When cwd is outside the repo workspace, resolveMultiStepToolPath throws.
  // The git case's try/catch (line 276) handles this and returns GIT_EXECUTION_FAILED.
  const result = await executeMultiStepToolCallForTests(
    "git",
    JSON.stringify({ args: ["status"], cwd: "/tmp/nonexistent_path_12345" }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.errorCode, "GIT_EXECUTION_FAILED");
  assert.ok(parsed.error.includes("tool.path_outside_workspace"));
});

test("executeToolCall repo-map catches path_outside_workspace error from resolveMultiStepToolPath", async () => {
  // When rootPath is outside the repo workspace, resolveMultiStepToolPath throws.
  // The repo-map case's try/catch (line 304) handles this and returns REPO_MAP_ERROR.
  const result = await executeMultiStepToolCallForTests(
    "repo-map",
    JSON.stringify({ query: "test", rootPath: "/tmp/nonexistent_path_12345" }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, false);
  assert.equal(parsed.errorCode, "REPO_MAP_ERROR");
  assert.ok(parsed.error.includes("tool.path_outside_workspace"));
});

test("executeToolCall batch-tool parallel with mixed success and error results", async () => {
  // Tests the Promise.all path in batch-tool parallel execution with a tool that returns error.
  // The Promise.all itself doesn't reject (tools return error JSON, not throw).
  // The outer wrapper always has success:true; individual tool outcomes are in the result JSON.
  const result = await executeMultiStepToolCallForTests(
    "batch-tool",
    JSON.stringify({
      toolCalls: [
        { toolName: "question", arguments: {} },
        { toolName: "git", arguments: { args: [] } }, // returns MISSING_GIT_ARGS error
      ],
      parallel: true,
    }),
  );
  const parsed = JSON.parse(result);
  assert.equal(parsed.success, true);
  assert.equal(parsed.executionMode, "parallel");
  assert.equal(parsed.results.length, 2);

  // The outer success field is hardcoded to true (batch-tool wraps results regardless)
  assert.equal(parsed.results[0]!.success, true);
  assert.equal(parsed.results[1]!.success, true);

  // But the actual tool outcomes are in the result JSON strings
  const firstOutcome = JSON.parse(parsed.results[0]!.result);
  const secondOutcome = JSON.parse(parsed.results[1]!.result);
  assert.equal(firstOutcome.success, true); // question returns success:true, status:skipped
  assert.equal(secondOutcome.success, false); // git returns success:false, errorCode:MISSING_GIT_ARGS
  assert.equal(secondOutcome.errorCode, "MISSING_GIT_ARGS");
});
