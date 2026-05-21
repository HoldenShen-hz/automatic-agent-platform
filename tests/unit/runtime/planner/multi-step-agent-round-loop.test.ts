import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStepOutput,
  fallbackStepOutput,
  type AgentRoundLoopInput,
  type BuildStepOutputInput,
} from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-agent-round-loop.js";

test("parseStepOutput should parse JSON content with summary and result", () => {
  const content = '{"summary":"Test summary","result":"Test result"}';
  const result = parseStepOutput(content, "test_step");

  assert.equal(result.summary, "Test summary");
  assert.equal(result.result, "Test result");
});

test("parseStepOutput should handle JSON with missing fields", () => {
  const content = '{"summary":"Only summary"}';
  const result = parseStepOutput(content, "my_step");

  assert.equal(result.summary, "Only summary");
  assert.equal(result.result, content);
});

test("parseStepOutput should fall back to line parsing for non-JSON content", () => {
  const content = "First line summary\nSecond line is result\nThird line also result";
  const result = parseStepOutput(content, "step_123");

  assert.equal(result.summary, "First line summary");
  assert.equal(result.result, "Second line is result\nThird line also result");
});

test("parseStepOutput should strip bullet prefixes from summary", () => {
  const content = "- Summary with bullet\nResult content";
  const result = parseStepOutput(content, "step_id");

  assert.equal(result.summary, "Summary with bullet");
});

test("parseStepOutput should handle summary only content", () => {
  const content = "Only one line in content";
  const result = parseStepOutput(content, "step_id");

  // When there's only one line with no JSON, parseStepOutput returns default summary
  assert.equal(result.summary, "Step step_id completed");
  assert.equal(result.result, "Only one line in content");
});

test("parseStepOutput should handle empty content", () => {
  const result = parseStepOutput("", "step_id");

  assert.equal(result.summary, "Step step_id completed");
  assert.equal(result.result, "Step executed: step_id");
});

test("parseStepOutput should use stepId in default summary", () => {
  const result = parseStepOutput("", "my_test_step");

  assert.equal(result.summary, "Step my_test_step completed");
});

test("parseStepOutput should handle JSON parse failure gracefully", () => {
  const content = '{invalid json "missing quotes}';
  const result = parseStepOutput(content, "step");

  assert.ok(result.summary.startsWith("Step step"));
  assert.equal(result.result, content);
});

test("fallbackStepOutput should return correct output for intake_triage step", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "triage_role",
    request: "Fix login bug",
    priorSummaries: [],
    routingReason: "User reported login issue",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Request triaged for single-division orchestration.");
  assert.ok(result.result.includes("User reported login issue"));
  assert.ok(result.result.includes("Fix login bug"));
  assert.equal(result.llmResult, null);
  assert.deepEqual(result.toolCalls, []);
  assert.equal(result.iterations, 0);
  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput should return correct output for draft_solution step", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "draft_role",
    request: "Create API endpoint",
    priorSummaries: ["Step 1 completed", "Step 2 completed"],
    routingReason: "Needs backend work",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Draft solution prepared from triage context.");
  assert.ok(result.result.includes("Step 1 completed"));
  assert.ok(result.result.includes("Step 2 completed"));
});

test("fallbackStepOutput should return correct output for final_review step", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "review_role",
    request: "Review changes",
    priorSummaries: ["Draft created"],
    routingReason: "Ready for review",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Final orchestration review completed.");
  assert.ok(result.result.includes("Draft created"));
});

test("fallbackStepOutput should handle unknown step IDs", () => {
  const input: AgentRoundLoopInput = {
    stepId: "custom_step",
    roleId: "custom_role",
    request: "Custom request",
    priorSummaries: [],
    routingReason: "Custom routing",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.summary, "Step custom_step completed.");
  assert.ok(result.result.includes("custom_role"));
  assert.ok(result.result.includes("Custom request"));
});

test("fallbackStepOutput should handle empty priorSummaries", () => {
  const input: AgentRoundLoopInput = {
    stepId: "draft_solution",
    roleId: "role",
    request: "Request",
    priorSummaries: [],
    routingReason: "Reason",
  };

  const result = fallbackStepOutput(input);

  assert.ok(result.result.includes("Draft generated from prior steps:"));
});

test("fallbackStepOutput should always return stop finish reason", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "role",
    request: "Request",
    priorSummaries: [],
    routingReason: "Reason",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.finishReason, "stop");
});

test("fallbackStepOutput should always have null llmResult", () => {
  const input: AgentRoundLoopInput = {
    stepId: "final_review",
    roleId: "role",
    request: "Request",
    priorSummaries: [],
    routingReason: "Reason",
  };

  const result = fallbackStepOutput(input);

  assert.equal(result.llmResult, null);
});

test("fallbackStepOutput should always have empty toolCalls", () => {
  const input: AgentRoundLoopInput = {
    stepId: "intake_triage",
    roleId: "role",
    request: "Request",
    priorSummaries: [],
    routingReason: "Reason",
  };

  const result = fallbackStepOutput(input);

  assert.deepEqual(result.toolCalls, []);
});

test("BuildStepOutputInput interface should accept valid input", () => {
  const input: BuildStepOutputInput = {
    stepId: "test_step",
    roleId: "test_role",
    request: "Test request",
    priorSummaries: ["prior1", "prior2"],
    routingReason: "Test reason",
  };

  assert.equal(input.stepId, "test_step");
  assert.equal(input.roleId, "test_role");
  assert.equal(input.request, "Test request");
  assert.equal(input.priorSummaries.length, 2);
  assert.equal(input.routingReason, "Test reason");
});

test("BuildStepOutputInput interface should accept optional tools", () => {
  const input: BuildStepOutputInput = {
    stepId: "test_step",
    roleId: "test_role",
    request: "Test request",
    priorSummaries: [],
    routingReason: "Test reason",
    tools: [
      {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };

  assert.ok(input.tools);
  assert.equal(input.tools.length, 1);
  assert.equal(input.tools[0].name, "test_tool");
});
