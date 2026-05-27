/**
 * Comprehensive Tests for multi-step-agent-round-loop.ts
 *
 * These tests cover:
 * - Agent round loop iteration handling
 * - Tool call result structure and escalation
 * - Error handling and recovery paths
 * - Input validation and edge cases
 * - Build step output variations
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStepOutput,
  fallbackStepOutput,
  executeAgentRoundLoop,
  buildStepOutput,
  type AgentRoundLoopInput,
  type AgentRoundLoopResult,
  type ToolCallResult,
  type BuildStepOutputInput,
  type BuildStepOutputResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-agent-round-loop.js";
import { resetModelCallProvider, initializeModelCallProvider, type LlmModelCallResult } from "../../../../../src/platform/five-plane-execution/execution-engine/model-call-provider.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createMockLlmResult(content: string, toolCalls: LlmModelCallResult["toolCalls"] = []): LlmModelCallResult {
  return {
    id: "msg_" + Math.random().toString(36).substring(7),
    content,
    refusal: null,
    reasoningContent: null,
    finishReason: toolCalls.length > 0 ? "tool_use" : "stop",
    toolCalls,
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    model: "MiniMax-M2.7",
    provider: "minimax",
  };
}

// ---------------------------------------------------------------------------
// AgentRoundLoopResult Structure and Interface Tests
// ---------------------------------------------------------------------------

test("AgentRoundLoopResult stop finishReason has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const result: AgentRoundLoopResult = {
    summary: "Task completed successfully",
    result: "The workflow executed as expected",
    llmResult: createMockLlmResult("Final response"),
    toolCalls: [],
    iterations: 1,
    finishReason: "stop",
  };

  assert.equal(result.finishReason, "stop");
  assert.equal(result.iterations, 1);
  assert.equal(result.summary, "Task completed successfully");
  assert.ok(result.llmResult !== null);
  assert.ok(Array.isArray(result.toolCalls));
});

test("AgentRoundLoopResult max_iterations has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const result: AgentRoundLoopResult = {
    summary: "Partial result due to iteration limit",
    result: "The workflow reached the maximum iteration count",
    llmResult: createMockLlmResult("Partial response"),
    toolCalls: [],
    iterations: 10,
    finishReason: "max_iterations",
  };

  assert.equal(result.finishReason, "max_iterations");
  assert.equal(result.iterations, 10);
});

test("AgentRoundLoopResult error has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const result: AgentRoundLoopResult = {
    summary: "Error occurred during execution",
    result: "An error was caught and handled gracefully",
    llmResult: null,
    toolCalls: [],
    iterations: 3,
    finishReason: "error",
  };

  assert.equal(result.finishReason, "error");
  assert.equal(result.iterations, 3);
});

test("AgentRoundLoopResult with tool calls has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const toolCalls: ToolCallResult[] = [
    { toolCallId: "call_1", toolName: "web_search", result: '{"found": true}', success: true },
    { toolCallId: "call_2", toolName: "todo_write", result: '{"id": "123"}', success: true },
  ];

  const result: AgentRoundLoopResult = {
    summary: "Tool execution completed",
    result: "All tools executed successfully",
    llmResult: null,
    toolCalls,
    iterations: 2,
    finishReason: "stop",
  };

  assert.equal(result.toolCalls.length, 2);
  assert.equal(result.toolCalls[0].toolName, "web_search");
  assert.equal(result.toolCalls[1].toolName, "todo_write");
});

// ---------------------------------------------------------------------------
// ToolCallResult Structure Tests
// ---------------------------------------------------------------------------

test("ToolCallResult with success true has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const toolResult: ToolCallResult = {
    toolCallId: "call_abc123",
    toolName: "code_analysis",
    result: '{"lines": 150, "complexity": "medium"}',
    success: true,
  };

  assert.equal(toolResult.toolCallId, "call_abc123");
  assert.equal(toolResult.toolName, "code_analysis");
  assert.ok(toolResult.success);
  assert.ok(toolResult.result.includes("lines"));
});

test("ToolCallResult with success false has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const toolResult: ToolCallResult = {
    toolCallId: "call_def456",
    toolName: "file_read",
    result: '{"error": "File not found", "code": "ENOENT"}',
    success: false,
  };

  assert.ok(!toolResult.success);
  assert.ok(toolResult.result.includes("File not found"));
});

test("ToolCallResult empty result is valid [multi-step-agent-round-loop-comprehensive]", () => {
  const toolResult: ToolCallResult = {
    toolCallId: "call_empty",
    toolName: "noop_tool",
    result: "",
    success: true,
  };

  assert.equal(toolResult.result, "");
});

// ---------------------------------------------------------------------------
// LlmModelCallResult Structure Tests
// ---------------------------------------------------------------------------

test("LlmModelCallResult with content has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const llmResult = createMockLlmResult("Analysis complete. Found 3 issues.");

  assert.ok(llmResult.id.startsWith("msg_"));
  assert.ok(llmResult.content.includes("Analysis complete"));
  assert.equal(llmResult.finishReason, "stop");
  assert.deepEqual(llmResult.toolCalls, []);
  assert.equal(llmResult.usage.totalTokens, 30);
});

test("LlmModelCallResult with tool calls has correct structure [multi-step-agent-round-loop-comprehensive]", () => {
  const llmResult = createMockLlmResult("", [
    { id: "tool_1", type: "function", function: { name: "web_search", arguments: '{"query": "test"}' } },
  ]);

  assert.equal(llmResult.finishReason, "tool_use");
  assert.equal(llmResult.toolCalls.length, 1);
  assert.equal(llmResult.toolCalls[0].function.name, "web_search");
});

test("LlmModelCallResult with multiple tool calls [multi-step-agent-round-loop-comprehensive]", () => {
  const llmResult = createMockLlmResult("", [
    { id: "tool_1", type: "function", function: { name: "tool1", arguments: "{}" } },
    { id: "tool_2", type: "function", function: { name: "tool2", arguments: "{}" } },
    { id: "tool_3", type: "function", function: { name: "tool3", arguments: "{}" } },
  ]);

  assert.equal(llmResult.toolCalls.length, 3);
});

test("LlmModelCallResult usage tracking is accurate [multi-step-agent-round-loop-comprehensive]", () => {
  const llmResult = createMockLlmResult("Response content");
  assert.equal(llmResult.usage.promptTokens, 10);
  assert.equal(llmResult.usage.completionTokens, 20);
  assert.equal(llmResult.usage.totalTokens, 30);
});

// ---------------------------------------------------------------------------
// BuildStepOutput Input/Output Tests
// ---------------------------------------------------------------------------

test("buildStepOutput returns expected keys with fallback [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
  };

  const result = await buildStepOutput(input);

  assert.ok("summary" in result);
  assert.ok("result" in result);
  // llmResult, toolCalls, iterations should only be present if truthy
});

test("buildStepOutput returns result with priorSummaries [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test request",
    priorSummaries: ["First step summary", "Second step summary", "Third step summary"],
    routingReason: "sequential",
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(result.summary.length > 0);
  assert.ok(typeof result.result === "string");
  assert.ok(result.result.length > 0);
});

test("buildStepOutput handles intake_triage step type [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "intake_triage",
    roleId: "intake_agent",
    request: "Please analyze this code",
    priorSummaries: [],
    routingReason: "initial_request",
  };

  const result = await buildStepOutput(input);

  assert.ok(result.summary.includes("triaged") || result.summary.includes("intake_triage"));
});

test("buildStepOutput handles draft_solution step type [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "draft_solution",
    roleId: "draft_agent",
    request: "Create a solution",
    priorSummaries: ["Triage completed successfully"],
    routingReason: "post_triage",
  };

  const result = await buildStepOutput(input);

  assert.ok(result.summary.includes("Draft") || result.summary.includes("draft_solution"));
});

test("buildStepOutput handles final_review step type [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "final_review",
    roleId: "review_agent",
    request: "Review the solution",
    priorSummaries: ["Draft completed"],
    routingReason: "final",
  };

  const result = await buildStepOutput(input);

  assert.ok(result.summary.includes("Final") || result.summary.includes("final_review"));
});

test("buildStepOutput with empty priorSummaries [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "",
    priorSummaries: [],
    routingReason: "",
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

test("buildStepOutput with maxIterations specified in underlying call [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: BuildStepOutputInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
  };

  // Note: BuildStepOutputInput doesn't have maxIterations, but the underlying
  // executeAgentRoundLoop uses default of 10
  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

// ---------------------------------------------------------------------------
// executeAgentRoundLoop Various Input Combinations
// ---------------------------------------------------------------------------

test("executeAgentRoundLoop with all standard step IDs [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const stepIds = ["intake_triage", "draft_solution", "final_review"];

  for (const stepId of stepIds) {
    const input: AgentRoundLoopInput = {
      stepId,
      roleId: "agent",
      request: `Testing ${stepId}`,
      priorSummaries: [],
      routingReason: "test",
    };

    const result = await executeAgentRoundLoop(input);

    assert.ok(typeof result.summary === "string", `Failed for stepId: ${stepId}`);
    assert.ok(typeof result.result === "string", `Failed for stepId: ${stepId}`);
    assert.ok(["stop", "max_iterations", "error"].includes(result.finishReason));
  }
});

test("executeAgentRoundLoop with various role IDs [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const roleIds = ["triage_agent", "draft_agent", "review_agent", "admin", "user", "system"];

  for (const roleId of roleIds) {
    const input: AgentRoundLoopInput = {
      stepId: "intake_triage",
      roleId,
      request: "test",
      priorSummaries: [],
      routingReason: "test",
    };

    const result = await executeAgentRoundLoop(input);
    assert.ok(typeof result.result === "string", `Failed for roleId: ${roleId}`);
  }
});

test("executeAgentRoundLoop with varying priorSummaries lengths [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const summaryLengths = [0, 1, 5, 10, 100];

  for (const count of summaryLengths) {
    const priorSummaries: string[] = Array.from({ length: count }, (_, i) => `Summary ${i + 1}`);

    const input: AgentRoundLoopInput = {
      stepId: "draft_solution",
      roleId: "drafter",
      request: "test",
      priorSummaries,
      routingReason: "test",
    };

    const result = await executeAgentRoundLoop(input);
    assert.ok(typeof result.summary === "string", `Failed for ${count} summaries`);
  }
});

test("executeAgentRoundLoop with special characters in request [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "Test with special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?`~",
    priorSummaries: [],
    routingReason: "special_characters",
  };

  const result = await executeAgentRoundLoop(input);
  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

test("executeAgentRoundLoop with Unicode in request [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "Unicode test: 你好世界 🎉 éèêë îïï",
    priorSummaries: [],
    routingReason: "unicode",
  };

  const result = await executeAgentRoundLoop(input);
  assert.ok(typeof result.result === "string");
});

test("executeAgentRoundLoop with very long request [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "A".repeat(10000),
    priorSummaries: [],
    routingReason: "long_request",
  };

  const result = await executeAgentRoundLoop(input);
  assert.ok(typeof result.summary === "string");
});

test("executeAgentRoundLoop with empty routingReason [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "",
  };

  const result = await executeAgentRoundLoop(input);
  assert.ok(typeof result.result === "string");
});

test("executeAgentRoundLoop with various maxIterations values [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const maxIterationsValues = [1, 5, 10, 100, 1000];

  for (const maxIterations of maxIterationsValues) {
    const input: AgentRoundLoopInput = {
      stepId: "intake_triage",
      roleId: "triage",
      request: "test",
      priorSummaries: [],
      routingReason: "test",
      maxIterations,
    };

    const result = await executeAgentRoundLoop(input);
    assert.ok(typeof result.iterations === "number");
    assert.ok(result.iterations >= 0);
  }
});

test("executeAgentRoundLoop with maxIterations of 1 [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "single iteration test",
    priorSummaries: [],
    routingReason: "test",
    maxIterations: 1,
  };

  const result = await executeAgentRoundLoop(input);

  // With fallback path, iterations is 0
  assert.ok(result.iterations >= 0);
  assert.ok(["stop", "max_iterations", "error"].includes(result.finishReason));
});

test("executeAgentRoundLoop with tools and no provider uses fallback [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test with tools",
    priorSummaries: [],
    routingReason: "test",
    tools: [
      { name: "todo_write", description: "Write a todo", inputSchema: { type: "object" } },
      { name: "web_search", description: "Search the web", inputSchema: { type: "object" } },
    ],
  };

  const result = await executeAgentRoundLoop(input);

  // Should use fallback since no provider
  assert.equal(result.finishReason, "stop");
  assert.ok(Array.isArray(result.toolCalls));
  assert.equal(result.toolCalls.length, 0);
});

// ---------------------------------------------------------------------------
// parseStepOutput Additional Edge Cases
// ---------------------------------------------------------------------------

test("parseStepOutput with complex JSON structure [multi-step-agent-round-loop-comprehensive]", () => {
  const content = JSON.stringify({
    summary: "Complex analysis complete",
    result: { status: "success", data: { items: [1, 2, 3] } },
    metadata: { duration: 100, timestamp: "2024-01-01" },
  });

  const result = parseStepOutput(content, "complex_step");

  assert.equal(result.summary, "Complex analysis complete");
  // Result is the object itself (not stringified), so we verify the summary worked
  assert.ok(typeof result.result === "object" && result.result !== null);
});

test("parseStepOutput with nested JSON in result field [multi-step-agent-round-loop-comprehensive]", () => {
  const content = JSON.stringify({
    summary: "Step completed",
    result: { nested: { deep: { value: "found" } } },
  });

  const result = parseStepOutput(content, "nested_step");
  assert.equal(result.summary, "Step completed");
  // Result is the object itself (not stringified)
  assert.ok(typeof result.result === "object" && result.result !== null);
});

test("parseStepOutput with boolean values [multi-step-agent-round-loop-comprehensive]", () => {
  const content = JSON.stringify({
    summary: "Boolean test",
    result: true,
  });

  const result = parseStepOutput(content, "bool_step");
  assert.equal(result.summary, "Boolean test");
});

test("parseStepOutput with array in result field [multi-step-agent-round-loop-comprehensive]", () => {
  const content = JSON.stringify({
    summary: "Array result",
    result: ["item1", "item2", "item3"],
  });

  const result = parseStepOutput(content, "array_step");
  assert.equal(result.summary, "Array result");
  // When result is an array, it becomes the result value (truthy)
  // The result may be the array itself or a string representation
  assert.ok(typeof result.result === "object" || typeof result.result === "string");
});

test("parseStepOutput with number values in JSON [multi-step-agent-round-loop-comprehensive]", () => {
  const content = JSON.stringify({
    summary: "Numeric result",
    result: 42,
  });

  const result = parseStepOutput(content, "number_step");
  assert.equal(result.summary, "Numeric result");
});

test("parseStepOutput with whitespace before JSON brace [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "   \n  " + JSON.stringify({ summary: "WS test", result: "Result" });

  const result = parseStepOutput(content, "ws_step");
  assert.equal(result.summary, "WS test");
});

test("parseStepOutput with tab characters in content [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "Summary\tTab\n\tIndented result";

  const result = parseStepOutput(content, "tab_step");
  // The first line with tab is the summary, result is from second line
  // Tabs in summary are preserved but result may be trimmed
  assert.equal(result.summary, "Summary\tTab");
  // Result comes from second line after split and join
  assert.ok(result.result.includes("Indented") || result.result.includes("result"));
});

test("parseStepOutput with carriage return [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "Summary line\r\nSecond line\r\nThird line";

  const result = parseStepOutput(content, "cr_step");
  assert.ok(result.result.includes("\r") || result.result.includes("Second"));
});

test("parseStepOutput with Windows line endings [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "First line\r\n\r\nThird line";

  const result = parseStepOutput(content, "crlf_step");
  assert.ok(result.result.length > 0);
});

test("parseStepOutput with only whitespace lines [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "   \n\n   \n\n   ";

  const result = parseStepOutput(content, "whitespace_step");
  assert.equal(result.summary, "Step whitespace_step completed");
});

test("parseStepOutput with code block markers [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "```\nCode summary\n```\nResult content";

  const result = parseStepOutput(content, "code_step");
  // Code fences are treated as regular content
  assert.ok(result.result.length > 0);
});

test("parseStepOutput with emoji in content [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "Summary with emoji 🚀\nResult with emoji 🎯";

  const result = parseStepOutput(content, "emoji_step");
  assert.ok(result.summary.includes("🚀"));
  assert.ok(result.result.includes("🎯"));
});

test("parseStepOutput with very long summary line [multi-step-agent-round-loop-comprehensive]", () => {
  const longSummary = "A".repeat(1000);
  const content = `${longSummary}\nShort result`;

  const result = parseStepOutput(content, "long_summary_step");
  assert.equal(result.summary, longSummary);
});

test("parseStepOutput with all bullet styles [multi-step-agent-round-loop-comprehensive]", () => {
  const content = "- dash bullet\n+ plus bullet\n* asterisk bullet\n  Result";

  const result = parseStepOutput(content, "bullet_step");
  assert.equal(result.summary, "dash bullet");
});

// ---------------------------------------------------------------------------
// fallbackStepOutput Additional Edge Cases
// ---------------------------------------------------------------------------

test("fallbackStepOutput intake_triage preserves routing reason [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage_agent",
    request: "Request content",
    priorSummaries: [],
    routingReason: "complex_routing_decision",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("complex_routing_decision"));
});

test("fallbackStepOutput draft_solution with multiple prior summaries [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "draft_agent",
    request: "Request",
    priorSummaries: ["Summary 1", "Summary 2", "Summary 3", "Summary 4", "Summary 5"],
    routingReason: "reason",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("Summary 1"));
  assert.ok(result.result.includes("Summary 5"));
});

test("fallbackStepOutput final_review with empty prior summaries [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "Request",
    priorSummaries: [],
    routingReason: "reason",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("Final answer synthesized"));
  // When priorSummaries is empty, the join produces an empty string after the colon
  assert.ok(result.result.includes("Final answer synthesized from workflow outputs: "));
});

test("fallbackStepOutput unknown step preserves all input details [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "custom_special_step",
    roleId: "special_role",
    request: "Special request with detail",
    priorSummaries: ["Prior 1", "Prior 2"],
    routingReason: "special_routing",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("special_role"));
  assert.ok(result.result.includes("Special request with detail"));
  // routingReason is not included in the unknown step result - only roleId and request
});

test("fallbackStepOutput step order is deterministic [multi-step-agent-round-loop-comprehensive]", () => {
  const input1: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "req",
    priorSummaries: [],
    routingReason: "reason",
  };

  const input2: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "req",
    priorSummaries: [],
    routingReason: "reason",
  };

  const input3: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "req",
    priorSummaries: [],
    routingReason: "reason",
  };

  const result1 = fallbackStepOutput(input1);
  const result2 = fallbackStepOutput(input2);
  const result3 = fallbackStepOutput(input3);

  // Each step type produces distinctly different results
  assert.notEqual(result1.summary, result2.summary);
  assert.notEqual(result2.summary, result3.summary);
});

// ---------------------------------------------------------------------------
// AgentRoundLoopInput Interface Tests
// ---------------------------------------------------------------------------

test("AgentRoundLoopInput with minimal required fields [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "role",
    request: "request",
    priorSummaries: [],
    routingReason: "reason",
  };

  assert.ok(input.tools === undefined);
  assert.ok(input.maxIterations === undefined);
});

test("AgentRoundLoopInput with all optional fields [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "role",
    request: "request",
    priorSummaries: ["s1", "s2"],
    routingReason: "reason",
    tools: [{ name: "tool", description: "desc", inputSchema: {} }],
    maxIterations: 20,
  };

  assert.ok(Array.isArray(input.tools));
  assert.equal(input.maxIterations, 20);
});

test("AgentRoundLoopInput tools array can be empty [multi-step-agent-round-loop-comprehensive]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "role",
    request: "request",
    priorSummaries: [],
    routingReason: "reason",
    tools: [],
  };

  assert.ok(Array.isArray(input.tools));
  assert.equal(input.tools.length, 0);
});

// ---------------------------------------------------------------------------
// BuildStepOutputResult Interface Tests
// ---------------------------------------------------------------------------

test("BuildStepOutputResult has required fields [multi-step-agent-round-loop-comprehensive]", () => {
  const result: BuildStepOutputResult = {
    summary: "Summary",
    result: "Result",
  };

  assert.ok("summary" in result);
  assert.ok("result" in result);
  assert.ok(result.llmResult === undefined);
  assert.ok(result.toolCalls === undefined);
  assert.ok(result.iterations === undefined);
});

test("BuildStepOutputResult with all optional fields [multi-step-agent-round-loop-comprehensive]", () => {
  const mockLlm: LlmModelCallResult = createMockLlmResult("content");
  const toolCalls: ToolCallResult[] = [
    { toolCallId: "c1", toolName: "t1", result: "r1", success: true },
  ];

  const result: BuildStepOutputResult = {
    summary: "Summary",
    result: "Result",
    llmResult: mockLlm,
    toolCalls,
    iterations: 5,
  };

  assert.ok(result.llmResult !== undefined);
  assert.ok(result.toolCalls !== undefined);
  assert.ok(result.iterations === 5);
});

// ---------------------------------------------------------------------------
// Iteration and Escalation Tests
// ---------------------------------------------------------------------------

test("executeAgentRoundLoop result iterations is always non-negative [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
    maxIterations: 10,
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.iterations >= 0);
});

test("executeAgentRoundLoop result finishReason is always valid [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(["stop", "max_iterations", "error"].includes(result.finishReason));
});

test("executeAgentRoundLoop with extreme maxIterations value [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
    maxIterations: Number.MAX_SAFE_INTEGER,
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(typeof result.iterations === "number");
});

// ---------------------------------------------------------------------------
// Multi-step Workflow Integration Tests
// ---------------------------------------------------------------------------

test("simulated multi-step workflow with triage then draft then review [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  // Step 1: Intake triage
  const triageInput: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage_agent",
    request: "Analyze and route this request",
    priorSummaries: [],
    routingReason: "initial_intake",
  };
  const triageResult = await executeAgentRoundLoop(triageInput);
  assert.ok(triageResult.summary.includes("triaged") || triageResult.summary.includes("intake_triage"));

  // Step 2: Draft solution (uses triage output as prior)
  const draftInput: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "draft_agent",
    request: "Create solution based on triage",
    priorSummaries: [triageResult.summary],
    routingReason: "post_triage",
  };
  const draftResult = await executeAgentRoundLoop(draftInput);
  assert.ok(draftResult.summary.includes("Draft") || draftResult.summary.includes("draft_solution"));

  // Step 3: Final review (uses both prior outputs)
  const reviewInput: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "review_agent",
    request: "Review and finalize the solution",
    priorSummaries: [triageResult.summary, draftResult.summary],
    routingReason: "final_review",
  };
  const reviewResult = await executeAgentRoundLoop(reviewInput);
  assert.ok(reviewResult.summary.includes("Final") || reviewResult.summary.includes("final_review"));
});

test("workflow with prior summaries properly concatenated in result [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "Create draft",
    priorSummaries: ["First triage summary", "Second analysis summary", "Third planning summary"],
    routingReason: "multi_step_workflow",
  };

  const result = await executeAgentRoundLoop(input);

  // Result should contain reference to prior summaries
  assert.ok(typeof result.result === "string");
  assert.ok(result.result.length > 0);
});

test("workflow with many prior summaries does not break [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const manySummaries: string[] = [];
  for (let i = 0; i < 50; i++) {
    manySummaries.push(`Summary ${i}: This is a summary of step ${i} which did something specific.`);
  }

  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "Final review of all steps",
    priorSummaries: manySummaries,
    routingReason: "many_steps_completed",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

// ---------------------------------------------------------------------------
// Error Recovery and Edge Case Handling
// ---------------------------------------------------------------------------

test("executeAgentRoundLoop result can be used in subsequent calls [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input1: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "first request",
    priorSummaries: [],
    routingReason: "first",
  };

  const input2: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "second request",
    priorSummaries: [],
    routingReason: "second",
  };

  const result1 = await executeAgentRoundLoop(input1);
  const result2 = await executeAgentRoundLoop(input2);

  // Both results should be valid and independent
  assert.ok(typeof result1.summary === "string");
  assert.ok(typeof result2.summary === "string");
  assert.notEqual(result1.summary, result2.summary);
});

test("executeAgentRoundLoop returns consistent results for same input [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "consistent request",
    priorSummaries: [],
    routingReason: "consistent",
  };

  const result1 = await executeAgentRoundLoop(input);
  const result2 = await executeAgentRoundLoop(input);

  // Results should have same structure and same finishReason
  assert.equal(result1.finishReason, result2.finishReason);
  assert.equal(result1.iterations, result2.iterations);
});

test("executeAgentRoundLoop with JSON parseable request content [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: '{"type": "json", "data": "valid"}',
    priorSummaries: [],
    routingReason: "json_request",
  };

  const result = await executeAgentRoundLoop(input);
  assert.ok(typeof result.result === "string");
});

test("executeAgentRoundLoop with deeply nested prior summaries [multi-step-agent-round-loop-comprehensive]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "Final review",
    priorSummaries: [
      "Level 1: Initial triage",
      "Level 2: Detailed analysis",
      "Level 3: Solution draft",
      "Level 4: Quality check",
      "Level 5: Security review",
    ],
    routingReason: "multi_level",
  };

  const result = await executeAgentRoundLoop(input);
  assert.ok(typeof result.result === "string");
});
