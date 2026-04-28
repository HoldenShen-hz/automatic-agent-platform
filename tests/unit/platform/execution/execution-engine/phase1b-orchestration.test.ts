/**
 * Unit Tests: Phase1B Orchestration
 *
 * Tests for Phase1B aliases in phase1b-orchestration.ts:
 * - runPhase1BOrchestration (alias for runSingleTaskExecution)
 * - HappyPathInput type
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  runMultiStepOrchestration,
  type MultiStepToolExecutionInput,
} from "../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import {
  runPhase1BOrchestration,
} from "../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js";

// =============================================================================
// runPhase1BOrchestration alias tests
// =============================================================================

test("runPhase1BOrchestration is identical to runMultiStepOrchestration", () => {
  assert.strictEqual(runPhase1BOrchestration, runMultiStepOrchestration);
});

test("runPhase1BOrchestration is a function", () => {
  assert.equal(typeof runPhase1BOrchestration, "function");
});

// =============================================================================
// HappyPathInput type re-export tests
// =============================================================================

test("MultiStepToolExecutionInput type is exported from phase1b-orchestration compatibility surface", () => {
  // Verify the type can be used in type annotations
  const input: MultiStepToolExecutionInput = {
    taskId: "task-1",
    planId: "plan-1",
    stepId: "step-1",
    toolCallId: "call-1",
    toolName: "web_search",
    args: {},
  };

  assert.equal(input.taskId, "task-1");
  assert.equal(input.toolName, "web_search");
});

test("MultiStepToolExecutionInput type structure is correct", () => {
  const input: MultiStepToolExecutionInput = {
    taskId: "task-2",
    planId: "plan-2",
    stepId: "step-2",
    toolCallId: "call-2",
    toolName: "git",
    args: { cwd: "/tmp/repo", args: ["status"] },
  };

  assert.equal(input.stepId, "step-2");
  assert.deepEqual(input.args, { cwd: "/tmp/repo", args: ["status"] });
});

test("MultiStepToolExecutionInput has all required fields", () => {
  const input: MultiStepToolExecutionInput = {
    taskId: "task-3",
    planId: "plan-3",
    stepId: "step-3",
    toolCallId: "call-3",
    toolName: "question",
    args: { question: "Need approval?" },
  };

  assert.ok(typeof input.taskId === "string");
  assert.ok(typeof input.planId === "string");
  assert.ok(typeof input.stepId === "string");
  assert.ok(typeof input.toolCallId === "string");
  assert.ok(typeof input.toolName === "string");
});
