/**
 * Unit Tests: Phase1B Utils
 *
 * Tests for Phase1B aliases in phase1b-utils.ts:
 * - runPhase1BOrchestration (alias for runMultiStepOrchestration)
 * - executePhase1BToolCallForTests (alias for executeMultiStepToolCallForTests)
 * - resetPhase1BToolRegistryForTests (alias for resetMultiStepToolRegistryForTests)
 * - Phase1BOrchestrationResult type (alias for MultiStepOrchestrationResult)
 * - Phase1BOrchestrationInput type (alias for MultiStepToolExecutionInput)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
  type MultiStepOrchestrationResult,
  type MultiStepToolExecutionInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import {
  runPhase1BOrchestration,
  executePhase1BToolCallForTests,
  resetPhase1BToolRegistryForTests,
  type Phase1BOrchestrationResult,
  type Phase1BOrchestrationInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/phase1b-utils.js";

// =============================================================================
// Function alias tests
// =============================================================================

test("runPhase1BOrchestration is identical to runMultiStepOrchestration", () => {
  assert.strictEqual(runPhase1BOrchestration, runMultiStepOrchestration);
});

test("executePhase1BToolCallForTests is identical to executeMultiStepToolCallForTests", () => {
  assert.strictEqual(executePhase1BToolCallForTests, executeMultiStepToolCallForTests);
});

test("resetPhase1BToolRegistryForTests is identical to resetMultiStepToolRegistryForTests", () => {
  assert.strictEqual(resetPhase1BToolRegistryForTests, resetMultiStepToolRegistryForTests);
});

// =============================================================================
// Type alias tests
// =============================================================================

test("Phase1BOrchestrationResult is identical to MultiStepOrchestrationResult", () => {
  // Both types should be compatible - verify through assignment
  const result: MultiStepOrchestrationResult = {
    success: true,
    stepsCompleted: 0,
    finalOutput: undefined,
  } as MultiStepOrchestrationResult;

  const phase1bResult: Phase1BOrchestrationResult = result;
  assert.ok(phase1bResult);
});

test("Phase1BOrchestrationInput is identical to MultiStepOrchestrationInput", () => {
  // Both types should be compatible - verify through assignment
  const input: MultiStepToolExecutionInput = {
    taskId: "test-task",
    request: "test request",
    agentId: "test-agent",
  } as MultiStepToolExecutionInput;

  const phase1bInput: Phase1BOrchestrationInput = input;
  assert.ok(phase1bInput);
});

// =============================================================================
// Type structure tests (compile-time validation)
// =============================================================================

test("Phase1BOrchestrationResult can hold valid result structure", () => {
  const result: Phase1BOrchestrationResult = {
    success: true,
    stepsCompleted: 3,
    finalOutput: { message: "done" },
    toolCalls: [],
  } as Phase1BOrchestrationResult;

  assert.equal(result.success, true);
  assert.equal(result.stepsCompleted, 3);
});

test("Phase1BOrchestrationInput can hold valid input structure", () => {
  const input: Phase1BOrchestrationInput = {
    taskId: "task-123",
    request: "Execute test task",
    agentId: "agent-456",
    context: {},
    maxIterations: 10,
  } as Phase1BOrchestrationInput;

  assert.equal(input.taskId, "task-123");
  assert.equal(input.request, "Execute test task");
});

// =============================================================================
// Backward compatibility tests
// =============================================================================

test("Type re-exports allow old Phase1B code to work", () => {
  // This tests that the type exports work correctly for backward compatibility
  type OldPhase1BResult = Phase1BOrchestrationResult;
  type OldPhase1BInput = Phase1BOrchestrationInput;

  // Verify the types can be used in type annotations
  const mockInput: OldPhase1BInput = {
    taskId: "legacy-task",
    request: "legacy request",
    agentId: "legacy-agent",
  } as OldPhase1BInput;

  assert.equal(mockInput.taskId, "legacy-task");
});