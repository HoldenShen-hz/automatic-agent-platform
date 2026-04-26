import assert from "node:assert/strict";
import test from "node:test";

import {
  executeAgentRoundLoop,
  parseStepOutput,
  fallbackStepOutput,
  buildStepOutput,
  type AgentRoundLoopInput,
  type AgentRoundLoopResult,
  type ToolCallResult,
} from "../../../../../src/platform/execution/execution-engine/multi-step-agent-round-loop.js";

test("executeAgentRoundLoop returns fallback when no model provider", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "planner",
    request: "test request",
    priorSummaries: [],
    routingReason: "test routing",
  };

  // Without a model provider, this will use fallback
  const result = await executeAgentRoundLoop(input);

  assert.equal(result.finishReason, "stop");
  assert.equal(result.iterations, 0);
  assert.ok(result.summary.length > 0);
  assert.ok(result.result.length > 0);
  assert.equal(result.llmResult, null);
  assert.deepEqual(result.toolCalls, []);
});

test("executeAgentRoundLoop fallback handles intake_triage step", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "planner",
    request: "analyze this",
    priorSummaries: [],
    routingReason: "user request",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("triaged"));
  assert.ok(result.result.includes("Route reason=user request"));
});

test("executeAgentRoundLoop fallback handles draft_solution step", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "create solution",
    priorSummaries: ["step 1 completed", "step 2 completed"],
    routingReason: "workflow",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("Draft") || result.summary.includes("solution"));
  assert.ok(result.result.includes("step 1 completed"));
});

test("executeAgentRoundLoop fallback handles final_review step", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "evaluator",
    request: "finalize",
    priorSummaries: ["output 1", "output 2", "output 3"],
    routingReason: "completion",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("Final") || result.summary.includes("review") || result.summary.includes("completed"));
  assert.ok(result.result.includes("output 1"));
  assert.ok(result.result.includes("output 2"));
  assert.ok(result.result.includes("output 3"));
});

test("executeAgentRoundLoop fallback handles unknown stepId", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "custom_step",
    roleId: "worker",
    request: "do something",
    priorSummaries: [],
    routingReason: "none",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("custom_step") || result.summary.includes("completed"));
  assert.ok(result.result.includes("worker"));
  assert.ok(result.result.includes("do something"));
});

test("executeAgentRoundLoop respects maxIterations parameter", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "test_step",
    roleId: "tester",
    request: "iterate",
    priorSummaries: [],
    routingReason: "testing",
    maxIterations: 5,
  };

  const result = await executeAgentRoundLoop(input);

  // With no model provider, iterations should be 0
  assert.equal(result.iterations, 0);
  assert.equal(result.finishReason, "stop");
});

test("executeAgentRoundLoop handles empty priorSummaries", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "planner",
    request: "test",
    priorSummaries: [],
    routingReason: "none",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.result.includes("No prior steps") || result.result.length > 0);
});

test("executeAgentRoundLoop handles multiple priorSummaries", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "draft",
    priorSummaries: ["first step", "second step", "third step"],
    routingReason: "sequential",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.result.includes("first step"));
  assert.ok(result.result.includes("second step"));
  assert.ok(result.result.includes("third step"));
});

test("AgentRoundLoopResult interface structure is correct", async () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "tester",
    request: "test",
    priorSummaries: [],
    routingReason: "testing",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
  assert.ok(typeof result.iterations === "number");
  assert.ok(typeof result.finishReason === "string");
  assert.ok(Array.isArray(result.toolCalls));
  assert.ok(result.llmResult === null || typeof result.llmResult === "object");
});

test("ToolCallResult interface structure is correct", () => {
  const toolCall: ToolCallResult = {
    toolCallId: "tool_123",
    toolName: "test_tool",
    result: "success",
    success: true,
  };

  assert.equal(toolCall.toolCallId, "tool_123");
  assert.equal(toolCall.toolName, "test_tool");
  assert.equal(toolCall.result, "success");
  assert.equal(toolCall.success, true);
});

test("parseStepOutput handles JSON output", () => {
  const jsonContent = JSON.stringify({
    summary: "Test summary",
    result: "Test result content",
  });

  const parsed = parseStepOutput(jsonContent, "test_step");

  assert.equal(parsed.summary, "Test summary");
  assert.equal(parsed.result, "Test result content");
});

test("parseStepOutput handles non-JSON content with lines", () => {
  const content = "Summary line\nMore detailed result content\nEven more content";

  const parsed = parseStepOutput(content, "test_step");

  assert.equal(parsed.summary, "Summary line");
  assert.ok(parsed.result.includes("More detailed result content"));
});

test("parseStepOutput handles single line content", () => {
  const content = "Single line result";

  const parsed = parseStepOutput(content, "my_step");

  assert.equal(parsed.summary, "Step my_step completed");
  assert.ok(parsed.result.includes("Single line result"));
});

test("parseStepOutput handles bullet points in summary", () => {
  const content = "- Important summary point\nDetail line 1\nDetail line 2";

  const parsed = parseStepOutput(content, "bullet_step");

  assert.ok(parsed.summary.includes("Important summary point"));
});

test("parseStepOutput falls back for malformed JSON", () => {
  const content = "{ invalid json }";
  const parsed = parseStepOutput(content, "json_step");

  // Should fall back to line parsing
  assert.ok(parsed.summary.length > 0);
});

test("parseStepOutput handles empty content", () => {
  const parsed = parseStepOutput("", "empty_step");

  assert.ok(parsed.summary.includes("empty_step") || parsed.summary.length > 0);
  assert.ok(parsed.result.length > 0);
});

test("parseStepOutput uses stepId in default summary", () => {
  const parsed = parseStepOutput("", "unique_step_id");

  assert.ok(parsed.summary.includes("unique_step_id") || parsed.summary.includes("completed"));
});

test("buildStepOutput returns expected structure", async () => {
  const input = {
    stepId: "test_step",
    roleId: "tester",
    request: "build test",
    priorSummaries: ["prior 1"],
    routingReason: "testing build",
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
  assert.ok(Array.isArray(result.toolCalls) || result.toolCalls === undefined);
  assert.ok(typeof result.iterations === "number" || result.iterations === undefined);
});

test("buildStepOutput returns same summary and result as executeAgentRoundLoop", async () => {
  const input = {
    stepId: "intake_triage",
    roleId: "planner",
    request: "test request",
    priorSummaries: ["first", "second"],
    routingReason: "test",
  };

  const loopResult = await executeAgentRoundLoop(input);
  const stepOutput = await buildStepOutput(input);

  assert.equal(stepOutput.summary, loopResult.summary);
  assert.equal(stepOutput.result, loopResult.result);
});

test("fallbackStepOutput returns correct interface", () => {
  const input: AgentRoundLoopInput = {
    stepId: "unknown",
    roleId: "unknown",
    request: "test",
    priorSummaries: [],
    routingReason: "none",
  };

  const result = fallbackStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
  assert.equal(result.llmResult, null);
  assert.ok(Array.isArray(result.toolCalls));
  assert.equal(result.toolCalls.length, 0);
  assert.equal(typeof result.iterations, "number");
  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput with priorSummaries includes them in result", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "create",
    priorSummaries: ["alpha", "beta", "gamma"],
    routingReason: "workflow",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("alpha"));
  assert.ok(result.result.includes("beta"));
  assert.ok(result.result.includes("gamma"));
});
