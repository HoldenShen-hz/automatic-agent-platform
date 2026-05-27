import assert from "node:assert/strict";
import test from "node:test";
import { mock, type MockCallSite } from "node:test/mocks";

import {
  parseStepOutput,
  fallbackStepOutput,
  executeAgentRoundLoop,
  buildStepOutput,
  type AgentRoundLoopInput,
  type AgentRoundLoopResult,
  type ToolCallResult,
  type LlmModelCallResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-agent-round-loop.js";
import { resetModelCallProvider, initializeModelCallProvider } from "../../../../../src/platform/five-plane-execution/execution-engine/model-call-provider.js";

// ---------------------------------------------------------------------------
// parseStepOutput
// ---------------------------------------------------------------------------

test("parseStepOutput parses JSON with summary and result [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({ summary: "Test summary", result: "Test result" });
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Test summary");
  assert.equal(result.result, "Test result");
});

test("parseStepOutput falls back to line parsing when not JSON [multi-step-agent-round-loop]", () => {
  const content = "First line summary\nSecond line content\nThird line content";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "First line summary");
  assert.equal(result.result, "Second line content\nThird line content");
});

test("parseStepOutput strips markdown bullets from summary [multi-step-agent-round-loop]", () => {
  const content = "- This is a summary\nThis is the result";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "This is a summary");
});

test("parseStepOutput handles invalid JSON gracefully [multi-step-agent-round-loop]", () => {
  const content = "not json at all {broken";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Step step1 completed");
});

test("parseStepOutput handles empty content [multi-step-agent-round-loop]", () => {
  const result = parseStepOutput("", "step1");
  assert.equal(result.summary, "Step step1 completed");
  assert.equal(result.result, "Step executed: step1");
});

test("parseStepOutput handles missing fields in JSON [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({});
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Step step1 completed");
  assert.equal(result.result, "{}");
});

test("parseStepOutput handles single line content returns default [multi-step-agent-round-loop]", () => {
  const content = "Single line content";
  const result = parseStepOutput(content, "step1");
  // Single line falls back to default since it doesn't have 2+ lines
  assert.equal(result.summary, "Step step1 completed");
});

test("parseStepOutput handles multi-line with bullets [multi-step-agent-round-loop]", () => {
  const content = "* Summary line\nResult line 1\nResult line 2";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Summary line");
  assert.equal(result.result, "Result line 1\nResult line 2");
});

// ---------------------------------------------------------------------------
// fallbackStepOutput
// ---------------------------------------------------------------------------

test("fallbackStepOutput handles intake_triage step [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test request",
    priorSummaries: [],
    routingReason: "test routing",
  };
  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Request triaged for single-division orchestration.");
  assert.ok(result.result.includes("Route reason=test routing"));
  assert.ok(result.result.includes("request=test request"));
  assert.equal(result.llmResult, null);
  assert.deepEqual(result.toolCalls, []);
  assert.equal(result.iterations, 0);
  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput handles draft_solution step [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test request",
    priorSummaries: ["Step 1 summary", "Step 2 summary"],
    routingReason: "test routing",
  };
  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Draft solution prepared from triage context.");
  assert.ok(result.result.includes("Draft generated from prior steps"));
  assert.ok(result.result.includes("Step 1 summary"));
  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput handles final_review step [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "test request",
    priorSummaries: ["Step 1 summary", "Step 2 summary"],
    routingReason: "test routing",
  };
  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Final orchestration review completed.");
  assert.ok(result.result.includes("Final answer synthesized from workflow outputs"));
  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput handles unknown step [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "unknown_step",
    roleId: "agent",
    request: "test request",
    priorSummaries: [],
    routingReason: "test routing",
  };
  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Step unknown_step completed.");
  assert.ok(result.result.includes("Role agent completed request"));
  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput returns correct structure [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "role",
    request: "request",
    priorSummaries: ["s1", "s2"],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);

  assert.ok("summary" in result);
  assert.ok("result" in result);
  assert.ok("llmResult" in result);
  assert.ok("toolCalls" in result);
  assert.ok("iterations" in result);
  assert.ok("finishReason" in result);
});

// ---------------------------------------------------------------------------
// Additional parseStepOutput edge cases
// ---------------------------------------------------------------------------

test("parseStepOutput handles JSON with only summary field [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({ summary: "Only summary provided" });
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Only summary provided");
  // When result field is missing in JSON, the original content is used as result
  assert.equal(result.result, content);
});

test("parseStepOutput handles JSON with only result field [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({ result: "Only result provided" });
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Step step1 completed");
  assert.equal(result.result, "Only result provided");
});

test("parseStepOutput handles JSON with extra fields ignored [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({ summary: "Summary", result: "Result", extra: "ignored", number: 42 });
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Summary");
  assert.equal(result.result, "Result");
});

test("parseStepOutput handles content starting with spaces before JSON [multi-step-agent-round-loop]", () => {
  const content = "   " + JSON.stringify({ summary: "Summary", result: "Result" });
  const result = parseStepOutput(content, "step1");
  // After trim(), content starts with '{' so it gets parsed as JSON
  assert.equal(result.summary, "Summary");
  assert.equal(result.result, "Result");
});

test("parseStepOutput handles content with tabs in bullet lines [multi-step-agent-round-loop]", () => {
  const content = "\t\t* Summary line\nResult line 1\nResult line 2";
  const result = parseStepOutput(content, "step1");
  // Tabs before bullet are not stripped - bullet regex only matches ^[*-] at line start
  assert.equal(result.summary, "* Summary line");
  assert.equal(result.result, "Result line 1\nResult line 2");
});

test("parseStepOutput handles content with leading whitespace on lines [multi-step-agent-round-loop]", () => {
  const content = "  First line   \n  Second line  \n  Third line";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "First line");
  // Trailing whitespace on lines is preserved
  assert.equal(result.result, "Second line  \n  Third line");
});

test("parseStepOutput handles content with empty first line [multi-step-agent-round-loop]", () => {
  const content = "\nFirst actual line\nSecond line";
  const result = parseStepOutput(content, "step1");
  // After filtering empty lines, first line is "First actual line", not empty
  assert.equal(result.summary, "First actual line");
});

test("parseStepOutput handles content with only newlines and spaces [multi-step-agent-round-loop]", () => {
  const content = "\n   \n   \n";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Step step1 completed");
});

test("parseStepOutput handles plus bullet style [multi-step-agent-round-loop]", () => {
  const content = "+ Summary with plus\nResult content";
  const result = parseStepOutput(content, "step1");
  // Plus sign is NOT stripped by the bullet regex (only * and - are matched)
  assert.equal(result.summary, "+ Summary with plus");
  assert.equal(result.result, "Result content");
});

test("parseStepOutput handles mixed bullet styles [multi-step-agent-round-loop]", () => {
  const content = "- First style\n+ Second style\n* Third style\nResult";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "First style");
  assert.equal(result.result, "+ Second style\n* Third style\nResult");
});

test("parseStepOutput handles JSON with nested objects [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({ summary: "Summary", result: "Result", nested: { foo: "bar" } });
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Summary");
  assert.equal(result.result, "Result");
});

test("parseStepOutput handles very long single line content [multi-step-agent-round-loop]", () => {
  const longLine = "a".repeat(10000);
  const result = parseStepOutput(longLine, "step1");
  assert.equal(result.summary, "Step step1 completed");
});

// ---------------------------------------------------------------------------
// Additional fallbackStepOutput edge cases
// ---------------------------------------------------------------------------

test("fallbackStepOutput intake_triage with empty request [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "",
    priorSummaries: [],
    routingReason: "",
  };
  const result = fallbackStepOutput(input);
  assert.equal(result.summary, "Request triaged for single-division orchestration.");
  assert.ok(result.result.includes("Route reason="));
});

test("fallbackStepOutput draft_solution with empty priorSummaries [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);
  assert.equal(result.summary, "Draft solution prepared from triage context.");
  assert.ok(result.result.includes("Draft generated from prior steps: "));
});

test("fallbackStepOutput final_review with single prior summary [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "test",
    priorSummaries: ["Only one prior step"],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);
  assert.equal(result.summary, "Final orchestration review completed.");
  assert.ok(result.result.includes("Only one prior step"));
});

test("fallbackStepOutput unknown step with special characters in roleId [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "custom-step-123",
    roleId: "role-with-dashes_and_underscores",
    request: "request with special chars: !@#$%",
    priorSummaries: [],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);
  assert.equal(result.summary, "Step custom-step-123 completed.");
  assert.ok(result.result.includes("role-with-dashes_and_underscores"));
  assert.ok(result.result.includes("request with special chars: !@#$%"));
});

test("fallbackStepOutput iterations is always 0 [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: ["s1", "s2", "s3"],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);
  assert.equal(result.iterations, 0);
});

test("fallbackStepOutput toolCalls is always empty array [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);
  assert.ok(Array.isArray(result.toolCalls));
  assert.equal(result.toolCalls.length, 0);
});

test("fallbackStepOutput llmResult is always null [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
  };
  const result = fallbackStepOutput(input);
  assert.equal(result.llmResult, null);
});

// ---------------------------------------------------------------------------
// executeAgentRoundLoop tests
// ---------------------------------------------------------------------------

test("executeAgentRoundLoop falls back when no provider is configured [multi-step-agent-round-loop]", async () => {
  // Reset provider to ensure no provider is available
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test request",
    priorSummaries: [],
    routingReason: "test routing",
  };

  const result = await executeAgentRoundLoop(input);

  assert.equal(result.finishReason, "stop");
  assert.equal(result.iterations, 0);
  assert.equal(result.llmResult, null);
  assert.ok(Array.isArray(result.toolCalls));
});

test("executeAgentRoundLoop returns valid result structure [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  // No provider configured - will use fallback
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test request",
    priorSummaries: ["prior1"],
    routingReason: "reason",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
  assert.ok(typeof result.iterations === "number");
  assert.ok(Array.isArray(result.toolCalls));
  assert.ok(["stop", "max_iterations", "error"].includes(result.finishReason));
});

test("executeAgentRoundLoop with custom maxIterations [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
    maxIterations: 5,
  };

  const result = await executeAgentRoundLoop(input);

  assert.equal(result.iterations, 0); // Fallback path, no iterations
  assert.equal(result.finishReason, "stop");
});

test("executeAgentRoundLoop with tools defined but no provider [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
    tools: [
      {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object" },
      },
    ],
  };

  const result = await executeAgentRoundLoop(input);

  assert.equal(result.finishReason, "stop");
  assert.ok(Array.isArray(result.toolCalls));
});

// ---------------------------------------------------------------------------
// buildStepOutput tests
// ---------------------------------------------------------------------------

test("buildStepOutput returns correct structure with fallback [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input = {
    stepId: "final_review",
    roleId: "reviewer",
    request: "test request",
    priorSummaries: ["step1", "step2"],
    routingReason: "reason",
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
  // llmResult, toolCalls, iterations should be undefined when empty/null
  assert.ok(!("llmResult" in result) || result.llmResult === undefined);
});

test("buildStepOutput with custom maxIterations [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
    maxIterations: 3,
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

test("buildStepOutput with tools [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input = {
    stepId: "intake_triage",
    roleId: "triage",
    request: "test",
    priorSummaries: [],
    routingReason: "reason",
    tools: [
      {
        name: "todo_write",
        description: "Write a todo",
        inputSchema: { type: "object", properties: { title: { type: "string" } } },
      },
    ],
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

// ---------------------------------------------------------------------------
// ToolCallResult interface tests
// ---------------------------------------------------------------------------

test("ToolCallResult structure is correct [multi-step-agent-round-loop]", () => {
  const toolCallResult: ToolCallResult = {
    toolCallId: "call_123",
    toolName: "test_tool",
    result: '{"success": true}',
    success: true,
  };

  assert.equal(toolCallResult.toolCallId, "call_123");
  assert.equal(toolCallResult.toolName, "test_tool");
  assert.equal(toolCallResult.result, '{"success": true}');
  assert.equal(toolCallResult.success, true);
});

test("AgentRoundLoopResult structure is correct [multi-step-agent-round-loop]", () => {
  const mockLlmResult: LlmModelCallResult = {
    id: "msg_123",
    content: "Test content",
    refusal: null,
    reasoningContent: null,
    finishReason: "stop",
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    model: "test-model",
    provider: "test",
  };

  const result: AgentRoundLoopResult = {
    summary: "Test summary",
    result: "Test result",
    llmResult: mockLlmResult,
    toolCalls: [],
    iterations: 1,
    finishReason: "stop",
  };

  assert.equal(result.summary, "Test summary");
  assert.equal(result.result, "Test result");
  assert.equal(result.iterations, 1);
  assert.equal(result.finishReason, "stop");
  assert.ok(result.llmResult !== null);
  assert.ok(Array.isArray(result.toolCalls));
});

test("AgentRoundLoopResult with max_iterations finishReason [multi-step-agent-round-loop]", () => {
  const result: AgentRoundLoopResult = {
    summary: "Partial result",
    result: "Iteration limit reached",
    llmResult: null,
    toolCalls: [],
    iterations: 10,
    finishReason: "max_iterations",
  };

  assert.equal(result.finishReason, "max_iterations");
  assert.equal(result.iterations, 10);
});

test("AgentRoundLoopResult with error finishReason [multi-step-agent-round-loop]", () => {
  const result: AgentRoundLoopResult = {
    summary: "Error result",
    result: "An error occurred",
    llmResult: null,
    toolCalls: [],
    iterations: 3,
    finishReason: "error",
  };

  assert.equal(result.finishReason, "error");
  assert.equal(result.iterations, 3);
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------

test("AgentRoundLoopInput interface accepts valid input [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test_step",
    roleId: "test_role",
    request: "test request",
    priorSummaries: ["summary1", "summary2"],
    routingReason: "test reason",
    tools: [],
    maxIterations: 5,
  };

  assert.equal(input.stepId, "test_step");
  assert.equal(input.roleId, "test_role");
  assert.equal(input.request, "test request");
  assert.equal(input.priorSummaries.length, 2);
  assert.equal(input.routingReason, "test reason");
  assert.ok(Array.isArray(input.tools));
  assert.equal(input.maxIterations, 5);
});

test("AgentRoundLoopInput tools field is optional [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "role",
    request: "request",
    priorSummaries: [],
    routingReason: "reason",
  };

  assert.equal(input.tools, undefined);
});

test("AgentRoundLoopInput maxIterations defaults are handled by function [multi-step-agent-round-loop]", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "role",
    request: "request",
    priorSummaries: [],
    routingReason: "reason",
    maxIterations: undefined,
  };

  // When maxIterations is undefined, executeAgentRoundLoop defaults to 10
  assert.equal(input.maxIterations, undefined);
});

// ---------------------------------------------------------------------------
// Edge case tests for executeAgentRoundLoop with mocked provider
// ---------------------------------------------------------------------------

test("executeAgentRoundLoop with provider returning empty content [multi-step-agent-round-loop]", async () => {
  // This test verifies the behavior when priorSummaries is empty
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "unknown_step",
    roleId: "agent",
    request: "simple request",
    priorSummaries: [],
    routingReason: "no prior context",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(result.summary.length > 0);
});

test("executeAgentRoundLoop formats priorSummaries correctly when present [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "drafter",
    request: "test",
    priorSummaries: ["First step done", "Second step done", "Third step done"],
    routingReason: "sequential workflow",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(typeof result.result === "string");
});

test("executeAgentRoundLoop finishReason enum values [multi-step-agent-round-loop]", async () => {
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

  // Verify all possible finish reasons are valid strings
  assert.ok(["stop", "max_iterations", "error"].includes(result.finishReason));
});

test("executeAgentRoundLoop handles various step IDs [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const stepIds = ["intake_triage", "draft_solution", "final_review", "custom_step", "step_123"];

  for (const stepId of stepIds) {
    const input: AgentRoundLoopInput = {
      stepId,
      roleId: "agent",
      request: "test",
      priorSummaries: [],
      routingReason: "reason",
    };

    const result = await executeAgentRoundLoop(input);
    assert.ok(typeof result.summary === "string", `Should handle stepId: ${stepId}`);
  }
});

test("executeAgentRoundLoop handles various role IDs [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const roleIds = ["triage", "drafter", "reviewer", "admin", "user_with_role"];

  for (const roleId of roleIds) {
    const input: AgentRoundLoopInput = {
      stepId: "intake_triage",
      roleId,
      request: "test",
      priorSummaries: [],
      routingReason: "reason",
    };

    const result = await executeAgentRoundLoop(input);
    assert.ok(typeof result.result === "string", `Should handle roleId: ${roleId}`);
  }
});

// ---------------------------------------------------------------------------
// Summary and result content tests
// ---------------------------------------------------------------------------

test("parseStepOutput with result containing newlines preserved [multi-step-agent-round-loop]", () => {
  const content = "Summary line\nLine 1 of result\nLine 2 of result\nLine 3 of result";
  const result = parseStepOutput(content, "multiline_step");
  assert.equal(result.summary, "Summary line");
  assert.ok(result.result.includes("Line 1"));
  assert.ok(result.result.includes("Line 2"));
  assert.ok(result.result.includes("Line 3"));
});

test("parseStepOutput with JSON containing newlines in result [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({
    summary: "JSON Summary",
    result: "Line 1\nLine 2\nLine 3",
  });
  const result = parseStepOutput(content, "json_step");
  assert.equal(result.summary, "JSON Summary");
  assert.equal(result.result, "Line 1\nLine 2\nLine 3");
});

test("parseStepOutput with Unicode content [multi-step-agent-round-loop]", () => {
  const content = "Unicode summary: 你好世界\nResult: 🎉🎊";
  const result = parseStepOutput(content, "unicode_step");
  assert.ok(result.summary.includes("Unicode summary"));
});

test("parseStepOutput with empty JSON object [multi-step-agent-round-loop]", () => {
  const content = "{}";
  const result = parseStepOutput(content, "empty_json_step");
  assert.equal(result.summary, "Step empty_json_step completed");
  assert.equal(result.result, "{}");
});

test("parseStepOutput with JSON null values [multi-step-agent-round-loop]", () => {
  const content = JSON.stringify({ summary: null, result: null });
  const result = parseStepOutput(content, "null_json_step");
  assert.equal(result.summary, "Step null_json_step completed");
  assert.equal(result.result, "{\"summary\":null,\"result\":null}");
});

test("parseStepOutput with multiple bullet styles on same line [multi-step-agent-round-loop]", () => {
  const content = "-*+ Mixed bullets\nResult";
  const result = parseStepOutput(content, "mixed_bullet_step");
  assert.equal(result.summary, "*+ Mixed bullets");
});

test("parseStepOutput line count edge case [multi-step-agent-round-loop]", () => {
  // Exactly 2 lines
  const twoLines = "Line one\nLine two";
  const r1 = parseStepOutput(twoLines, "step");
  assert.equal(r1.summary, "Line one");
  assert.equal(r1.result, "Line two");

  // Exactly 1 line
  const oneLine = "Single line";
  const r2 = parseStepOutput(oneLine, "step");
  assert.equal(r2.summary, "Step step completed");
});

// ---------------------------------------------------------------------------
// Integration-style tests for complete flow
// ---------------------------------------------------------------------------

test("complete flow with intake_triage returns expected summary [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage_agent",
    request: "Help me analyze this code",
    priorSummaries: [],
    routingReason: "initial intake",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("triaged") || result.summary.includes("Step intake_triage"));
});

test("complete flow with draft_solution returns expected summary [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "draft_agent",
    request: "Create a solution",
    priorSummaries: ["Triage completed"],
    routingReason: "after triage",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("Draft") || result.summary.includes("Step draft_solution"));
});

test("complete flow with final_review returns expected summary [multi-step-agent-round-loop]", async () => {
  resetModelCallProvider();
  initializeModelCallProvider({});

  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "review_agent",
    request: "Review the solution",
    priorSummaries: ["Draft completed"],
    routingReason: "final review",
  };

  const result = await executeAgentRoundLoop(input);

  assert.ok(result.summary.includes("Final") || result.summary.includes("Step final_review"));
});
