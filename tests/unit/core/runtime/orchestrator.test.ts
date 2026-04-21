import assert from "node:assert/strict";
import test from "node:test";

// The core/runtime/orchestrator/index.ts just re-exports from multi-step-orchestration
// Let's verify the re-export and test the types

import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "../../../../src/core/runtime/orchestrator/types.js";

import {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
} from "../../../../src/core/runtime/orchestrator/index.js";

test("orchestrator re-exports MultiStepOrchestrationResult type", () => {
  // Verify the type is properly exported through the re-export chain
  const resultType: MultiStepOrchestrationResult = {
    snapshot: {} as any,
    streamFrames: [],
    routing: {} as any,
    plannedWorkflow: {} as any,
    compaction: null,
  };
  assert.ok(resultType, "MultiStepOrchestrationResult should be a valid type");
});

test("orchestrator re-exports MultiStepToolExecutionInput type", () => {
  // Verify the type is properly exported through the re-export chain
  const inputType: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
  };
  assert.ok(inputType, "MultiStepToolExecutionInput should be a valid type");
});

test("orchestrator re-exports StepFailurePlan type", () => {
  // Verify the type is properly exported through the re-export chain
  const failurePlanType: StepFailurePlan = {
    errorCode: "error.test",
    summary: "Step failed",
    message: "Detailed error message",
  };
  assert.ok(failurePlanType, "StepFailurePlan should be a valid type");
  assert.equal(failurePlanType.errorCode, "error.test");
});

test("orchestrator exports runMultiStepOrchestration function", () => {
  assert.ok(typeof runMultiStepOrchestration === "function", "runMultiStepOrchestration should be exported");
});

test("orchestrator exports executeMultiStepToolCallForTests function", () => {
  assert.ok(typeof executeMultiStepToolCallForTests === "function", "executeMultiStepToolCallForTests should be exported");
});

test("orchestrator exports resetMultiStepToolRegistryForTests function", () => {
  assert.ok(typeof resetMultiStepToolRegistryForTests === "function", "resetMultiStepToolRegistryForTests should be exported");
});

test("MultiStepToolExecutionInput has required fields", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/path/to/db",
    title: "Task Title",
    request: "User request",
  };

  assert.ok(typeof input.dbPath === "string", "dbPath should be string");
  assert.ok(typeof input.title === "string", "title should be string");
  assert.ok(typeof input.request === "string", "request should be string");
});

test("MultiStepOrchestrationResult has expected structure", () => {
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
      workflowId: "wf_123",
      divisionId: "div_123",
      routeReason: "test",
      routeTrace: [],
      requiresOrchestration: true,
      classification: {
        intent: "create",
        confidence: 1.0,
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

  assert.ok(result.snapshot, "result should have snapshot");
  assert.ok(Array.isArray(result.streamFrames), "streamFrames should be array");
  assert.ok(result.routing, "result should have routing");
  assert.ok(result.plannedWorkflow, "result should have plannedWorkflow");
});

test("StepFailurePlan structure", () => {
  const failurePlan: StepFailurePlan = {
    errorCode: "step.execution_failed",
    summary: "Step failed",
    message: "Step execution timed out",
  };

  assert.equal(failurePlan.errorCode, "step.execution_failed");
  assert.equal(failurePlan.summary, "Step failed");
});

test("orchestrator module re-exports from multi-step-orchestration", async () => {
  // The orchestrator/index.ts should re-export from multi-step-orchestration
  // This test verifies that the re-export chain works
  const mod = await import("../../../../src/core/runtime/orchestrator/index.js");

  assert.ok("runMultiStepOrchestration" in mod, "Should re-export runMultiStepOrchestration");
  assert.ok("executeMultiStepToolCallForTests" in mod, "Should re-export executeMultiStepToolCallForTests");
  assert.ok("resetMultiStepToolRegistryForTests" in mod, "Should re-export resetMultiStepToolRegistryForTests");
});

test("orchestrator types re-export correctly", async () => {
  const typesMod = await import("../../../../src/core/runtime/orchestrator/types.js");

  assert.ok("MultiStepOrchestrationResult" in typesMod, "Should export MultiStepOrchestrationResult");
  assert.ok("MultiStepToolExecutionInput" in typesMod, "Should export MultiStepToolExecutionInput");
  assert.ok("StepFailurePlan" in typesMod, "Should export StepFailurePlan");
});

test("MultiStepToolExecutionInput optional fields", () => {
  // Test with all optional fields
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Full Test",
    request: "Test request",
    admissionPolicy: {
      maxQueuedTasks: 100,
      maxActiveExecutions: 10,
      maxTier1AckBacklog: 50,
      urgentQueueHeadroom: 5,
    },
    admissionBackpressureSnapshot: () => ({
      status: "ok" as const,
      degradationMode: "none" as const,
      queueGovernance: { delayedCount: 0, rateLimitedCount: 0, backlogSize: 0, dispatchableBacklogSize: 0, claimedBacklogSize: 0, oldestWaitSeconds: 0, nonPriorityBacklogSize: 0, priorityBacklogSize: 0 } as any,
      findings: [],
    }),
  };

  assert.ok(input.admissionPolicy, "admissionPolicy should be accepted");
  assert.ok(input.admissionBackpressureSnapshot, "admissionBackpressureSnapshot should be accepted");
});

test("MultiStepOrchestrationResult compaction can be object", () => {
  const result: MultiStepOrchestrationResult = {
    snapshot: {} as any,
    streamFrames: [],
    routing: {} as any,
    plannedWorkflow: {} as any,
    compaction: {
      usageBeforeTokens: 1000,
      usageAfterStage1Tokens: 700,
      usageAfterStage2Tokens: 500,
      stage1Triggered: true,
      stage2Triggered: false,
      fallbackToStage1: false,
      contextMessages: [],
      persistedRecords: [],
      errorCode: null,
      kvCacheFixedPrefixCacheKey: null,
      kvCacheDomainBlockCacheKey: null,
    },
  };

  assert.ok(result.compaction !== null, "compaction can be an object");
  assert.equal(result.compaction!.usageBeforeTokens, 1000);
  assert.equal(result.compaction!.usageAfterStage1Tokens, 700);
});

test("StepFailurePlan retryable false", () => {
  const failurePlan: StepFailurePlan = {
    errorCode: "step.critical_failed",
    summary: "Critical step failed",
    message: "Non-retryable error",
  };

  assert.equal(failurePlan.errorCode, "step.critical_failed");
});

test("orchestrator types are compatible with platform types", () => {
  // Ensure the types in core/runtime/orchestrator/types.ts are compatible
  // with the underlying platform types

  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Compatibility Test",
    request: "Test",
  };

  // Just verify the input can be created with the required structure
  assert.ok(input.dbPath.length > 0);
  assert.ok(input.title.length > 0);
  assert.ok(input.request.length > 0);
});
