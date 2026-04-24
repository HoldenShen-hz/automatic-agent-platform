import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStepOutput,
  fallbackStepOutput,
  type AgentRoundLoopInput,
  type AgentRoundLoopResult,
} from "../../../../../src/platform/execution/execution-engine/multi-step-agent-round-loop.js";

// ---------------------------------------------------------------------------
// parseStepOutput
// ---------------------------------------------------------------------------

test("parseStepOutput parses JSON with summary and result", () => {
  const content = JSON.stringify({ summary: "Test summary", result: "Test result" });
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Test summary");
  assert.equal(result.result, "Test result");
});

test("parseStepOutput falls back to line parsing when not JSON", () => {
  const content = "First line summary\nSecond line content\nThird line content";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "First line summary");
  assert.equal(result.result, "Second line content\nThird line content");
});

test("parseStepOutput strips markdown bullets from summary", () => {
  const content = "- This is a summary\nThis is the result";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "This is a summary");
});

test("parseStepOutput handles invalid JSON gracefully", () => {
  const content = "not json at all {broken";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Step step1 completed");
});

test("parseStepOutput handles empty content", () => {
  const result = parseStepOutput("", "step1");
  assert.equal(result.summary, "Step step1 completed");
  assert.equal(result.result, "Step executed: step1");
});

test("parseStepOutput handles missing fields in JSON", () => {
  const content = JSON.stringify({});
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Step step1 completed");
  assert.equal(result.result, "{}");
});

test("parseStepOutput handles single line content returns default", () => {
  const content = "Single line content";
  const result = parseStepOutput(content, "step1");
  // Single line falls back to default since it doesn't have 2+ lines
  assert.equal(result.summary, "Step step1 completed");
});

test("parseStepOutput handles multi-line with bullets", () => {
  const content = "* Summary line\nResult line 1\nResult line 2";
  const result = parseStepOutput(content, "step1");
  assert.equal(result.summary, "Summary line");
  assert.equal(result.result, "Result line 1\nResult line 2");
});

// ---------------------------------------------------------------------------
// fallbackStepOutput
// ---------------------------------------------------------------------------

test("fallbackStepOutput handles intake_triage step", () => {
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

test("fallbackStepOutput handles draft_solution step", () => {
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

test("fallbackStepOutput handles final_review step", () => {
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

test("fallbackStepOutput handles unknown step", () => {
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

test("fallbackStepOutput returns correct structure", () => {
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
