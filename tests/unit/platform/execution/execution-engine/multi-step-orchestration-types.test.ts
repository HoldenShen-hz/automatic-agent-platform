import assert from "node:assert/strict";
import test from "node:test";

import type { StepFailurePlan, MultiStepToolExecutionInput, MultiStepOrchestrationResult } from "../../../../../src/platform/execution/execution-engine/multi-step-orchestration-types.js";
import type { ContextCompactionResult } from "../../../../../src/platform/execution/execution-engine/context-compaction-service.js";

// =============================================================================
// Phase1B Re-Export Verification Tests
// =============================================================================

test("phase1b-orchestration exports runPhase1BOrchestration alias", async () => {
  const { runPhase1BOrchestration } = await import("../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js");
  const { runMultiStepOrchestration } = await import("../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js");

  assert.equal(runPhase1BOrchestration, runMultiStepOrchestration, "runPhase1BOrchestration should be an alias for runMultiStepOrchestration");
});

test("phase1b-orchestration exports executePhase1BToolCallForTests alias", async () => {
  const { executePhase1BToolCallForTests } = await import("../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js");
  const { executeMultiStepToolCallForTests } = await import("../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js");

  assert.equal(executePhase1BToolCallForTests, executeMultiStepToolCallForTests, "executePhase1BToolCallForTests should be an alias for executeMultiStepToolCallForTests");
});

test("phase1b-orchestration exports resetPhase1BToolRegistryForTests alias", async () => {
  const { resetPhase1BToolRegistryForTests } = await import("../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js");
  const { resetMultiStepToolRegistryForTests } = await import("../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js");

  assert.equal(resetPhase1BToolRegistryForTests, resetMultiStepToolRegistryForTests, "resetPhase1BToolRegistryForTests should be an alias for resetMultiStepToolRegistryForTests");
});

test("phase1b-orchestration exports Phase1BOrchestrationResult type alias", async () => {
  const phase1b = await import("../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js");
  assert.ok("Phase1BOrchestrationResult" in phase1b, "Phase1B should export Phase1BOrchestrationResult type alias");
});

test("phase1b-orchestration exports Phase1BOrchestrationInput type alias", async () => {
  const phase1b = await import("../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js");
  assert.ok("Phase1BOrchestrationInput" in phase1b, "Phase1B should export Phase1BOrchestrationInput type alias");
});

test("phase1b-tool-definitions exports PHASE1B_TOOL_DEFINITIONS alias", async () => {
  const { PHASE1B_TOOL_DEFINITIONS } = await import("../../../../../src/platform/execution/execution-engine/phase1b-tool-definitions.js");
  const { MULTI_STEP_TOOL_DEFINITIONS } = await import("../../../../../src/platform/execution/execution-engine/multi-step-tool-definitions.js");

  assert.equal(PHASE1B_TOOL_DEFINITIONS, MULTI_STEP_TOOL_DEFINITIONS, "PHASE1B_TOOL_DEFINITIONS should be an alias for MULTI_STEP_TOOL_DEFINITIONS");
});

test("phase1b-tool-definitions exports getPhase1BToolDefinitions alias", async () => {
  const { getPhase1BToolDefinitions } = await import("../../../../../src/platform/execution/execution-engine/phase1b-tool-definitions.js");
  const { getMultiStepToolDefinitions } = await import("../../../../../src/platform/execution/execution-engine/multi-step-tool-definitions.js");

  assert.equal(getPhase1BToolDefinitions, getMultiStepToolDefinitions, "getPhase1BToolDefinitions should be an alias for getMultiStepToolDefinitions");
});

test("phase1b-tool-definitions exports Phase1BToolDefinition type alias", async () => {
  const phase1b = await import("../../../../../src/platform/execution/execution-engine/phase1b-tool-definitions.js");
  assert.ok("Phase1BToolDefinition" in phase1b, "Phase1B should export Phase1BToolDefinition type alias");
});

test("phase1b-utils exports resolvePhase1BToolPath alias", async () => {
  const { resolvePhase1BToolPath } = await import("../../../../../src/platform/execution/execution-engine/phase1b-utils.js");
  const { resolveMultiStepToolPath } = await import("../../../../../src/platform/execution/execution-engine/multi-step-utils.js");

  assert.equal(resolvePhase1BToolPath, resolveMultiStepToolPath, "resolvePhase1BToolPath should be an alias for resolveMultiStepToolPath");
});

test("phase1b-utils exports parseOptionalPositiveInteger function", async () => {
  const { parseOptionalPositiveInteger } = await import("../../../../../src/platform/execution/execution-engine/phase1b-utils.js");

  assert.equal(parseOptionalPositiveInteger(42), 42, "parseOptionalPositiveInteger should return 42 for input 42");
  assert.equal(parseOptionalPositiveInteger("not a number"), undefined, "parseOptionalPositiveInteger should return undefined for non-number");
});

test("phase1b-utils exports parseOptionalStringArray function", async () => {
  const { parseOptionalStringArray } = await import("../../../../../src/platform/execution/execution-engine/phase1b-utils.js");

  assert.deepEqual(parseOptionalStringArray(["a", "b", "c"]), ["a", "b", "c"], "parseOptionalStringArray should return array as-is for valid strings");
  assert.deepEqual(parseOptionalStringArray("not an array"), [], "parseOptionalStringArray should return empty array for non-array input");
});

test("phase1b-utils exports safeParseToolResult function", async () => {
  const { safeParseToolResult } = await import("../../../../../src/platform/execution/execution-engine/phase1b-utils.js");

  assert.deepEqual(safeParseToolResult('{"key": "value"}'), { key: "value" }, "safeParseToolResult should parse valid JSON");
  assert.equal(safeParseToolResult("not json"), "not json", "safeParseToolResult should return raw string for invalid JSON");
});

test("StepFailurePlan requires errorCode", () => {
  const plan: StepFailurePlan = {
    errorCode: "step.execution_failed",
  };

  assert.equal(plan.errorCode, "step.execution_failed");
  assert.equal(plan.summary, undefined);
  assert.equal(plan.message, undefined);
});

test("StepFailurePlan with optional fields", () => {
  const plan: StepFailurePlan = {
    errorCode: "validation.schema_mismatch",
    summary: "Schema validation failed",
    message: "The output schema does not match the expected format",
  };

  assert.equal(plan.errorCode, "validation.schema_mismatch");
  assert.equal(plan.summary, "Schema validation failed");
  assert.equal(plan.message, "The output schema does not match the expected format");
});

test("StepFailurePlan allows partial fields - summary only", () => {
  const plan: StepFailurePlan = {
    errorCode: "internal.unexpected_error",
    summary: "Something went wrong",
  };

  assert.equal(plan.errorCode, "internal.unexpected_error");
  assert.equal(plan.summary, "Something went wrong");
  assert.equal(plan.message, undefined);
});

test("StepFailurePlan allows partial fields - message only", () => {
  const plan: StepFailurePlan = {
    errorCode: "tool.execution_failed",
    message: "The tool call timed out",
  };

  assert.equal(plan.errorCode, "tool.execution_failed");
  assert.equal(plan.summary, undefined);
  assert.equal(plan.message, "The tool call timed out");
});

test("MultiStepToolExecutionInput requires core fields", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Test Task",
    request: "Please perform the test task",
  };

  assert.equal(input.dbPath, "/tmp/test.db");
  assert.equal(input.title, "Test Task");
  assert.equal(input.request, "Please perform the test task");
  assert.equal(input.contextBudgetTokens, undefined);
  assert.equal(input.admissionPolicy, undefined);
  assert.equal(input.crashInjection, undefined);
  assert.equal(input.stepFailureInjection, undefined);
  assert.equal(input.stepFailurePlans, undefined);
  assert.equal(input.stepOutputOverrides, undefined);
});

test("MultiStepToolExecutionInput with optional contextBudgetTokens", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Token Budget Test",
    request: "Test request",
    contextBudgetTokens: 50000,
  };

  assert.equal(input.contextBudgetTokens, 50000);
});

test("MultiStepToolExecutionInput with stepFailureInjection", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Failure Injection Test",
    request: "Test request",
    stepFailureInjection: new Set(["step_1", "step_3"]),
  };

  assert.ok(input.stepFailureInjection);
  assert.equal(input.stepFailureInjection.has("step_1"), true);
  assert.equal(input.stepFailureInjection.has("step_3"), true);
  assert.equal(input.stepFailureInjection.has("step_2"), false);
});

test("MultiStepToolExecutionInput with stepFailurePlans using strings", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Step Failure Plans Test",
    request: "Test request",
    stepFailurePlans: {
      step_1: ["tool.execution_failed", "validation.schema_mismatch"],
      step_2: ["internal.unexpected_error"],
    },
  };

  assert.ok(input.stepFailurePlans);
  const step1Plans = input.stepFailurePlans["step_1"];
  const step2Plans = input.stepFailurePlans["step_2"];
  assert.ok(step1Plans);
  assert.ok(step2Plans);
  assert.equal(step1Plans.length, 2);
  assert.equal(step1Plans[0], "tool.execution_failed");
  assert.ok(step2Plans[0] != null);
  assert.equal(step2Plans[0], "internal.unexpected_error");
});

test("MultiStepToolExecutionInput with stepFailurePlans using StepFailurePlan objects", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Step Failure Plans Objects Test",
    request: "Test request",
    stepFailurePlans: {
      step_1: [
        { errorCode: "planned.failure", summary: "Planned failure for step 1" },
        { errorCode: "planned.failure.2", summary: "Second planned failure", message: "Details here" },
      ],
    },
  };

  assert.ok(input.stepFailurePlans);
  const step1Plans = input.stepFailurePlans["step_1"];
  assert.ok(step1Plans);
  assert.ok(step1Plans.length >= 1);
  const plan0 = step1Plans[0];
  const plan1 = step1Plans[1];
  assert.ok(plan0);
  assert.ok(plan1);
  assert.equal((plan0 as StepFailurePlan).errorCode, "planned.failure");
  assert.equal((plan0 as StepFailurePlan).summary, "Planned failure for step 1");
  assert.equal((plan1 as StepFailurePlan).errorCode, "planned.failure.2");
  assert.equal((plan1 as StepFailurePlan).message, "Details here");
});

test("MultiStepToolExecutionInput with mixed stepFailurePlans (strings and objects)", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Mixed Failure Plans Test",
    request: "Test request",
    stepFailurePlans: {
      step_1: ["tool.execution_failed", { errorCode: "validation.schema_mismatch", summary: "Schema issue" }],
    },
  };

  assert.ok(input.stepFailurePlans);
  const step1Plans = input.stepFailurePlans["step_1"];
  assert.ok(step1Plans);
  assert.ok(step1Plans[0] != null);
  assert.equal(step1Plans[0], "tool.execution_failed");
  const plan1 = step1Plans[1] as StepFailurePlan;
  assert.ok(plan1);
  assert.equal(plan1.errorCode, "validation.schema_mismatch");
});

test("MultiStepToolExecutionInput with stepOutputOverrides", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "Output Overrides Test",
    request: "Test request",
    stepOutputOverrides: {
      step_1: { summary: "Custom summary", result: "Custom result" },
      step_2: { status: "skipped" },
    },
  };

  assert.ok(input.stepOutputOverrides);
  assert.deepEqual(input.stepOutputOverrides["step_1"], { summary: "Custom summary", result: "Custom result" });
  assert.deepEqual(input.stepOutputOverrides["step_2"], { status: "skipped" });
});

test("MultiStepOrchestrationResult type can be instantiated with partial data", () => {
  // This test verifies the type structure without actual implementation
  const mockSnapshot = {} as any;
  const mockRouting = {} as any;
  const mockPlannedWorkflow = {} as any;

  const result: MultiStepOrchestrationResult = {
    snapshot: mockSnapshot,
    streamFrames: [],
    routing: mockRouting,
    plannedWorkflow: mockPlannedWorkflow,
    compaction: null,
  };

  assert.ok(result.snapshot === mockSnapshot);
  assert.ok(Array.isArray(result.streamFrames));
  assert.equal(result.streamFrames.length, 0);
  assert.ok(result.routing === mockRouting);
  assert.ok(result.plannedWorkflow === mockPlannedWorkflow);
  assert.equal(result.compaction, null);
});

test("MultiStepOrchestrationResult with compaction object", () => {
  const compaction: ContextCompactionResult = {
    usageBeforeTokens: 50000,
    usageAfterStage1Tokens: 35000,
    usageAfterStage2Tokens: 25000,
    stage1Triggered: true,
    stage2Triggered: false,
    fallbackToStage1: false,
    contextMessages: [],
    persistedRecords: [],
    errorCode: null,
    kvCacheFixedPrefixCacheKey: "kv_fixed_abc123",
    kvCacheDomainBlockCacheKey: null,
  };

  const result: MultiStepOrchestrationResult = {
    snapshot: {} as any,
    streamFrames: [],
    routing: {} as any,
    plannedWorkflow: {} as any,
    compaction,
  };

  assert.ok(result.compaction !== null);
  assert.equal(result.compaction.usageBeforeTokens, 50000);
  assert.equal(result.compaction.stage1Triggered, true);
  assert.equal(result.compaction.kvCacheFixedPrefixCacheKey, "kv_fixed_abc123");
});
