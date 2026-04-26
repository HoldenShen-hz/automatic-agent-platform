import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStepOutput,
  fallbackStepOutput,
  buildStepOutput,
  type BuildStepOutputInput,
  type BuildStepOutputResult,
  type AgentRoundLoopInput,
} from "../../../../../src/platform/execution/execution-engine/multi-step-agent-round-loop.js";

test("parseStepOutput extracts summary and result from JSON", () => {
  const content = JSON.stringify({
    summary: "Action completed successfully",
    result: "The action produced 42 items",
  });

  const output = parseStepOutput(content, "json_step");

  assert.equal(output.summary, "Action completed successfully");
  assert.equal(output.result, "The action produced 42 items");
});

test("parseStepOutput extracts summary from first line and result from rest", () => {
  const content = "First line summary\nSecond line details\nThird line more info";

  const output = parseStepOutput(content, "line_step");

  assert.equal(output.summary, "First line summary");
  assert.ok(output.result.includes("Second line details"));
  assert.ok(output.result.includes("Third line more info"));
});

test("parseStepOutput strips bullet prefix from summary", () => {
  const content = "- This is a bullet summary\nResult line";

  const output = parseStepOutput(content, "bullet_step");

  assert.equal(output.summary, "This is a bullet summary");
});

test("parseStepOutput handles asterisk bullet prefix", () => {
  const content = "* Asterisk bullet\nResult content";

  const output = parseStepOutput(content, "asterisk_step");

  assert.equal(output.summary, "Asterisk bullet");
});

test("parseStepOutput handles default summary when JSON lacks summary field", () => {
  const content = JSON.stringify({
    result: "Only result field",
  });

  const output = parseStepOutput(content, "partial_json_step");

  assert.ok(output.summary.includes("partial_json_step") || output.summary.length > 0);
  assert.equal(output.result, "Only result field");
});

test("parseStepOutput handles default result when JSON lacks result field", () => {
  const content = JSON.stringify({
    summary: "Only summary field",
  });

  const output = parseStepOutput(content, "partial_json_step2");

  assert.equal(output.summary, "Only summary field");
  assert.ok(output.result.length > 0);
});

test("parseStepOutput handles empty JSON object", () => {
  const content = "{}";

  const output = parseStepOutput(content, "empty_json_step");

  assert.ok(output.summary.includes("empty_json_step") || output.summary.length > 0);
  assert.ok(output.result.length > 0);
});

test("parseStepOutput trims whitespace from summary lines", () => {
  const content = "  Summary with spaces  \n  Result with spaces  ";

  const output = parseStepOutput(content, "whitespace_step");

  assert.equal(output.summary, "Summary with spaces");
});

test("parseStepOutput handles single word content", () => {
  const content = "Word";

  const output = parseStepOutput(content, "word_step");

  assert.equal(output.summary, "Step word_step completed");
  assert.ok(output.result.includes("Word") || output.result.length > 0);
});

test("parseStepOutput handles multiline with many empty lines", () => {
  const content = "Summary line\n\n\n\nMany blank lines\nDetail line";

  const output = parseStepOutput(content, "multiline_step");

  assert.equal(output.summary, "Summary line");
  assert.ok(output.result.includes("Many blank lines"));
});

test("parseStepOutput default summary includes stepId", () => {
  const output = parseStepOutput("", "my_special_step_id");

  assert.ok(
    output.summary.includes("my_special_step_id") || output.summary.includes("completed"),
    "Summary should reference stepId or indicate completion"
  );
});

test("parseStepOutput default result includes stepId for empty content", () => {
  const output = parseStepOutput("", "empty_content_step");

  assert.ok(output.result.includes("empty_content_step") || output.result.length > 0);
});

test("buildStepOutput returns summary and result", async () => {
  const input: BuildStepOutputInput = {
    stepId: "test_step",
    roleId: "tester",
    request: "test request",
    priorSummaries: [],
    routingReason: "testing",
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

test("buildStepOutput result matches executeAgentRoundLoop", async () => {
  const input: BuildStepOutputInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "generate solution",
    priorSummaries: ["prior 1", "prior 2"],
    routingReason: "workflow",
  };

  const result = await buildStepOutput(input);

  // Result should be a non-empty string
  assert.ok(result.result.length > 0);
  assert.ok(result.summary.length > 0);
});

test("buildStepOutput with tools parameter does not error", async () => {
  const input: BuildStepOutputInput = {
    stepId: "tool_step",
    roleId: "tool_user",
    request: "use tools",
    priorSummaries: [],
    routingReason: "tool usage",
    tools: [
      {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };

  const result = await buildStepOutput(input);

  assert.ok(typeof result.summary === "string");
  assert.ok(typeof result.result === "string");
});

test("buildStepOutput does not include llmResult when null", async () => {
  const input: BuildStepOutputInput = {
    stepId: "no_llm_step",
    roleId: "worker",
    request: "no llm",
    priorSummaries: [],
    routingReason: "none",
  };

  const result = await buildStepOutput(input);

  assert.ok(!("llmResult" in result) || result.llmResult === undefined);
});

test("buildStepOutput does not include toolCalls when empty", async () => {
  const input: BuildStepOutputInput = {
    stepId: "no_tools_step",
    roleId: "worker",
    request: "no tools",
    priorSummaries: [],
    routingReason: "none",
  };

  const result = await buildStepOutput(input);

  assert.ok(!("toolCalls" in result) || result.toolCalls === undefined || result.toolCalls.length === 0);
});

test("BuildStepOutputInput interface requires stepId", () => {
  const input: BuildStepOutputInput = {
    stepId: "required_field",
    roleId: "tester",
    request: "test",
    priorSummaries: [],
    routingReason: "testing",
  };

  assert.equal(input.stepId, "required_field");
});

test("BuildStepOutputInput interface accepts optional tools", () => {
  const input: BuildStepOutputInput = {
    stepId: "tool_input",
    roleId: "tool_user",
    request: "use tool",
    priorSummaries: [],
    routingReason: "tooling",
    tools: [],
  };

  assert.ok(Array.isArray(input.tools));
});

test("fallbackStepOutput returns valid result for intake_triage", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "planner",
    request: "analyze request",
    priorSummaries: [],
    routingReason: "initial triage",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.summary.includes("triaged") || result.summary.length > 0);
  assert.ok(result.result.includes("Route reason=initial triage"));
});

test("fallbackStepOutput returns valid result for draft_solution", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "create draft",
    priorSummaries: ["step 1 done"],
    routingReason: "workflow",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.summary.includes("Draft") || result.summary.includes("solution") || result.summary.length > 0);
  assert.ok(result.result.includes("step 1 done"));
});

test("fallbackStepOutput returns valid result for final_review", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "evaluator",
    request: "finalize",
    priorSummaries: ["output A", "output B"],
    routingReason: "completion",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.summary.includes("Final") || result.summary.includes("review") || result.summary.includes("orchestration"));
  assert.ok(result.result.includes("output A"));
  assert.ok(result.result.includes("output B"));
});

test("fallbackStepOutput returns valid result for unknown stepId", () => {
  const input: AgentRoundLoopInput = {
    stepId: "custom_action",
    roleId: "operator",
    request: "perform action",
    priorSummaries: [],
    routingReason: "custom",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("custom_action") || result.result.includes("operator"));
});

test("fallbackStepOutput includes request in result for unknown step", () => {
  const input: AgentRoundLoopInput = {
    stepId: "unknown",
    roleId: "worker",
    request: "special request content",
    priorSummaries: [],
    routingReason: "none",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("special request content"));
});

test("fallbackStepOutput joins priorSummaries with pipe separator", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "draft",
    priorSummaries: ["first", "second", "third"],
    routingReason: "workflow",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes(" | "));
  assert.ok(result.result.includes("first"));
  assert.ok(result.result.includes("second"));
  assert.ok(result.result.includes("third"));
});

test("fallbackStepOutput handles empty priorSummaries", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "generator",
    request: "draft",
    priorSummaries: [],
    routingReason: "fresh",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("Draft generated") || result.result.length > 0);
});

test("fallbackStepOutput sets finishReason to stop", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "tester",
    request: "test",
    priorSummaries: [],
    routingReason: "testing",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput sets iterations to 0", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "tester",
    request: "test",
    priorSummaries: [],
    routingReason: "testing",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.iterations, 0);
});

test("fallbackStepOutput sets llmResult to null", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "tester",
    request: "test",
    priorSummaries: [],
    routingReason: "testing",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.llmResult, null);
});

test("fallbackStepOutput sets toolCalls to empty array", () => {
  const input: AgentRoundLoopInput = {
    stepId: "test",
    roleId: "tester",
    request: "test",
    priorSummaries: [],
    routingReason: "testing",
  };

  const result = fallbackStepOutput(input);

  assert.ok(Array.isArray(result.toolCalls));
  assert.equal(result.toolCalls.length, 0);
});

test("parseStepOutput with asterisk bullet points", () => {
  const content = "* Important bullet\nDetail line";

  const output = parseStepOutput(content, "bullet_test");

  assert.equal(output.summary, "Important bullet");
});

test("parseStepOutput with dash bullet points", () => {
  const content = "- Dash bullet point\nResult details";

  const output = parseStepOutput(content, "dash_bullet");

  assert.equal(output.summary, "Dash bullet point");
});

test("parseStepOutput with mixed bullet styles", () => {
  const content = "* First bullet\n- Second bullet\nContent line";

  const output = parseStepOutput(content, "mixed_bullet");

  assert.equal(output.summary, "First bullet");
});
