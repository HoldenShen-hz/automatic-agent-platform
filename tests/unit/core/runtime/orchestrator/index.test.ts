import assert from "node:assert/strict";
import test from "node:test";

import {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
} from "../../../../../src/core/runtime/orchestrator/index.js";

import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "../../../../../src/core/runtime/orchestrator/types.js";

test("core/runtime/orchestrator shim exports runMultiStepOrchestration", () => {
  assert.equal(typeof runMultiStepOrchestration, "function", "runMultiStepOrchestration should be a function");
});

test("core/runtime/orchestrator shim exports executeMultiStepToolCallForTests", () => {
  assert.equal(typeof executeMultiStepToolCallForTests, "function", "executeMultiStepToolCallForTests should be a function");
});

test("core/runtime/orchestrator shim exports resetMultiStepToolRegistryForTests", () => {
  assert.equal(typeof resetMultiStepToolRegistryForTests, "function", "resetMultiStepToolRegistryForTests should be a function");
});

test("core/runtime/orchestrator shim re-exports same implementation as platform", async () => {
  const shim = await import("../../../../../src/core/runtime/orchestrator/index.js");
  const platform = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js");

  assert.equal(shim.runMultiStepOrchestration, platform.runMultiStepOrchestration, "runMultiStepOrchestration should point to platform implementation");
  assert.equal(shim.executeMultiStepToolCallForTests, platform.executeMultiStepToolCallForTests, "executeMultiStepToolCallForTests should point to platform implementation");
  assert.equal(shim.resetMultiStepToolRegistryForTests, platform.resetMultiStepToolRegistryForTests, "resetMultiStepToolRegistryForTests should point to platform implementation");
});

test("MultiStepToolExecutionInput type is usable with required fields", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Test Task",
    request: "Test request string",
  };

  assert.equal(input.dbPath, "/tmp/test.db");
  assert.equal(input.title, "Test Task");
  assert.equal(input.request, "Test request string");
});

test("MultiStepToolExecutionInput type accepts optional fields", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Test with options",
    request: "Request with options",
    contextBudgetTokens: 1000,
    stepFailureInjection: new Set(["step_1"]),
  };

  assert.equal(input.contextBudgetTokens, 1000);
  assert.ok(input.stepFailureInjection instanceof Set);
});

test("StepFailurePlan type structure", () => {
  const plan: StepFailurePlan = {
    errorCode: "tool.execution_failed",
    summary: "Step failed",
    message: "Tool execution timed out",
  };

  assert.equal(plan.errorCode, "tool.execution_failed");
  assert.equal(plan.summary, "Step failed");
  assert.equal(plan.message, "Tool execution timed out");
});

test("StepFailurePlan type allows partial fields", () => {
  const planMinimal: StepFailurePlan = { errorCode: "error.code" };
  assert.equal(planMinimal.errorCode, "error.code");
  assert.equal(planMinimal.summary, undefined);

  const planWithSummary: StepFailurePlan = { errorCode: "error", summary: "Short" };
  assert.equal(planWithSummary.summary, "Short");
});

test("MultiStepOrchestrationResult type structure", () => {
  const result: MultiStepOrchestrationResult = {
    snapshot: {
      task: {} as any,
      workflow: null,
      execution: null,
      session: null,
      stepOutputs: [],
      artifacts: [],
      events: [],
      consistency: "authoritative",
      observedAt: new Date().toISOString(),
    },
    streamFrames: [],
    routing: {
      workflowId: "wf_test",
      divisionId: "div_test",
      routeReason: "test",
      routeTrace: [],
      requiresOrchestration: true,
      classification: {
        intent: "query",
        confidence: 0.9,
        continuation: "new_task",
        matchedRules: [],
      },
    },
    plannedWorkflow: {
      workflow: {} as any,
      executionSteps: [],
      planReason: "test",
      dependencyEdges: [],
    },
    compaction: null,
  };

  assert.ok(result.snapshot !== null);
  assert.ok(Array.isArray(result.streamFrames));
  assert.ok(result.routing !== null);
  assert.ok(result.plannedWorkflow !== null);
  assert.equal(result.compaction, null);
});

test("resetMultiStepToolRegistryForTests resets tool registry", () => {
  assert.doesNotThrow(() => {
    // Call the reset function - it should not throw
    resetMultiStepToolRegistryForTests();
    // Calling it again should also be safe
    resetMultiStepToolRegistryForTests();
  });
});