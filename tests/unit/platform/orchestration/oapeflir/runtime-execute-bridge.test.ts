import assert from "node:assert/strict";
import test from "node:test";

import {
  MockExecuteBridge,
  mapStepOutputRecord,
  mapToDualChannelStepOutputs,
  extractStepOutputRecords,
  serialiseOapeflirPlan,
  RuntimeExecuteBridge,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { StepOutputRecord } from "../../../../../src/platform/contracts/types/domain/task-types.js";
import type { MultiStepOrchestrationResult } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js";

function createMockPlanStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    stepId: "step_1",
    action: "test_action",
    inputs: {},
    outputs: undefined,
    dependencies: [],
    status: "pending",
    timeout: 120_000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
    ...overrides,
  };
}

test("MockExecuteBridge implements ExecuteBridge interface", () => {
  const bridge = new MockExecuteBridge();
  assert.ok(bridge !== undefined);
  assert.ok(typeof bridge.executeStep === "function");
  assert.ok(typeof bridge.executePlan === "function");
  assert.ok(typeof bridge.toDualChannelStepOutputs === "function");
});

test("MockExecuteBridge.executeStep returns successful result", async () => {
  const bridge = new MockExecuteBridge();
  const step = createMockPlanStep({ stepId: "step_test", action: "test_action" });

  const result = await bridge.executeStep(step, { taskId: "task_123" });

  assert.equal(result.stepId, "step_test");
  assert.equal(result.status, "succeeded");
  assert.equal(result.modelId, "runtime");
  assert.ok(result.durationMs > 0);
  assert.ok(result.tokenCost > 0);
});

test("MockExecuteBridge.executeStep includes step outputs", async () => {
  const bridge = new MockExecuteBridge();
  const step = createMockPlanStep({
    stepId: "step_outputs",
    outputs: ["output1", "output2"],
  });

  const result = await bridge.executeStep(step, { taskId: "task_123" });

  assert.equal(result.artifacts.length, 2);
  assert.ok(result.artifacts.includes("artifact:output1"));
  assert.ok(result.artifacts.includes("artifact:output2"));
});

test("MockExecuteBridge.executePlan returns results for multiple steps", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_test",
    taskId: "task_123",
    version: 1,
    assessmentRef: "assessment_123",
    strategy: "linear" as const,
    steps: [
      createMockPlanStep({ stepId: "step_1", action: "action_1" }),
      createMockPlanStep({ stepId: "step_2", action: "action_2" }),
      createMockPlanStep({ stepId: "step_3", action: "action_3" }),
    ],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_123" });

  assert.equal(result.planId, "plan_test");
  assert.equal(result.results.length, 3);
  assert.ok(result.allSucceeded);
  assert.equal(result.skippedStepIds.length, 0);
  assert.equal(result.failedStepIds.length, 0);
});

test("MockExecuteBridge.executePlan calculates totals correctly", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_totals",
    taskId: "task_456",
    version: 1,
    assessmentRef: "assessment_456",
    strategy: "linear" as const,
    steps: [
      createMockPlanStep({ stepId: "step_1" }),
      createMockPlanStep({ stepId: "step_2" }),
    ],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_456" });

  assert.ok(result.totalDurationMs > 0);
  assert.ok(result.totalTokenCost > 0);
  assert.ok(result.totalDurationMs >= result.results.reduce((s, r) => s + r.durationMs, 0));
  assert.ok(result.totalTokenCost >= result.results.reduce((s, r) => s + r.tokenCost, 0));
});

test("MockExecuteBridge.toDualChannelStepOutputs transforms results", async () => {
  const bridge = new MockExecuteBridge();
  const executionResult = {
    planId: "plan_transform",
    results: [
      {
        stepId: "step_1",
        status: "succeeded" as const,
        durationMs: 100,
        tokenCost: 200,
        summary: "Step 1 completed",
        outputs: {},
        artifacts: ["output1"],
        modelId: "local-simulated",
        retryCount: 0,
        validationPassed: true,
      },
    ],
    totalDurationMs: 100,
    totalTokenCost: 200,
    allSucceeded: true,
    skippedStepIds: [],
    failedStepIds: [],
  };

  const outputs = bridge.toDualChannelStepOutputs(executionResult);

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0]?.stepId, "step_1");
  assert.equal(outputs[0]?.planRef, "plan_transform");
  assert.equal(outputs[0]?.userFacingResult.summary, "Step 1 completed");
  assert.ok(outputs[0]?.userFacingResult.artifacts.includes("artifact:output1"));
});

test("MockExecuteBridge.executePlan handles empty steps", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_empty",
    taskId: "task_empty",
    version: 1,
    assessmentRef: "assessment_empty",
    strategy: "linear" as const,
    steps: [],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_empty" });

  assert.equal(result.results.length, 0);
  assert.ok(result.allSucceeded);
});

test("MockExecuteBridge.executeStep accepts ExecutionContext", async () => {
  const bridge = new MockExecuteBridge();
  const step = createMockPlanStep({ stepId: "step_ctx" });

  const result = await bridge.executeStep(step, {
    taskId: "task_with_context",
    sessionId: "session_123",
    tokenBudget: 5000,
    modelId: "claude-opus-4-6",
  });

  assert.equal(result.stepId, "step_ctx");
  assert.equal(result.status, "succeeded");
});

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

test("mapStepOutputRecord parses dataJson successfully", () => {
  const record: StepOutputRecord = {
    id: "sor_1",
    stepId: "step_1",
    taskId: "task_1",
    roleId: "agent",
    status: "succeeded",
    dataJson: '{"key":"value","count":42}',
    artifactsJson: '["artifact1","artifact2"]',
    summary: "Step completed successfully",
    durationMs: 150,
    tokenCost: 500,
    validationJson: '{"valid":true}',
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.stepId, "step_1");
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.outputs, { key: "value", count: 42 });
  assert.deepEqual(result.artifacts, ["artifact1", "artifact2"]);
  assert.equal(result.summary, "Step completed successfully");
  assert.equal(result.durationMs, 150);
  assert.equal(result.tokenCost, 500);
  assert.equal(result.validationPassed, true);
});

test("mapStepOutputRecord only accepts validationJson when valid===true", () => {
  const invalidRecord: StepOutputRecord = {
    id: "sor_invalid_validation",
    stepId: "step_invalid_validation",
    taskId: "task_1",
    roleId: "agent",
    status: "succeeded",
    dataJson: "{}",
    artifactsJson: null,
    summary: "Step completed with invalid validation payload",
    durationMs: 10,
    tokenCost: 5,
    validationJson: "{\"valid\":false}",
    producedAt: "2026-04-01T00:00:00.000Z",
  };
  const malformedRecord: StepOutputRecord = {
    ...invalidRecord,
    id: "sor_malformed_validation",
    stepId: "step_malformed_validation",
    validationJson: "{not-json",
  };

  assert.equal(mapStepOutputRecord(invalidRecord).validationPassed, false);
  assert.equal(mapStepOutputRecord(malformedRecord).validationPassed, false);
});

test("mapStepOutputRecord handles invalid dataJson gracefully", () => {
  const record: StepOutputRecord = {
    id: "sor_2",
    stepId: "step_2",
    taskId: "task_1",
    roleId: "agent",
    status: "failed",
    dataJson: "not valid json {",
    artifactsJson: null,
    summary: "Step failed",
    durationMs: 100,
    tokenCost: 200,
    validationJson: null,
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.stepId, "step_2");
  assert.equal(result.status, "failed");
  assert.deepEqual(result.outputs, {});
  assert.deepEqual(result.artifacts, []);
  assert.equal(result.validationPassed, false);
});

test("mapStepOutputRecord falls back when dataJson exceeds size guard", () => {
  const record: StepOutputRecord = {
    id: "sor_oversized",
    stepId: "step_oversized",
    taskId: "task_oversized",
    roleId: "agent",
    status: "succeeded",
    dataJson: JSON.stringify({ payload: "x".repeat(300_000) }),
    artifactsJson: null,
    summary: "Oversized payload",
    durationMs: 1,
    tokenCost: 1,
    validationJson: "{\"valid\":true}",
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.deepEqual(result.outputs, {});
  assert.equal(result.validationPassed, true);
});

test("mapStepOutputRecord handles invalid artifactsJson gracefully", () => {
  const record: StepOutputRecord = {
    id: "sor_3",
    stepId: "step_3",
    taskId: "task_1",
    roleId: "agent",
    status: "succeeded",
    dataJson: '{"ok":true}',
    artifactsJson: "also not valid",
    summary: "Step completed",
    durationMs: 80,
    tokenCost: 150,
    validationJson: null,
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.deepEqual(result.outputs, { ok: true });
  assert.deepEqual(result.artifacts, []);
});

test("mapStepOutputRecord normalizes artifact reference objects to string refs", () => {
  const record: StepOutputRecord = {
    id: "sor_artifact_ref_objects",
    stepId: "step_artifact_ref_objects",
    taskId: "task_1",
    roleId: "agent",
    status: "succeeded",
    dataJson: "{\"ok\":true}",
    artifactsJson: JSON.stringify([
      { artifactId: "artifact_1", uri: "artifact://artifact_1", kind: "json" },
      { artifactId: "artifact_2" },
      { ignored: true },
    ]),
    summary: "Step completed",
    durationMs: 80,
    tokenCost: 150,
    validationJson: null,
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.deepEqual(result.artifacts, ["artifact://artifact_1", "artifact:artifact_2"]);
});

test("mapStepOutputRecord maps skipped status correctly", () => {
  const record: StepOutputRecord = {
    id: "sor_skip",
    stepId: "step_skipped",
    taskId: "task_1",
    roleId: "agent",
    status: "skipped",
    dataJson: "{}",
    artifactsJson: null,
    summary: "Step skipped due to dependency",
    durationMs: 0,
    tokenCost: 0,
    validationJson: null,
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.status, "skipped");
});

test("mapStepOutputRecord uses default summary when not provided", () => {
  const record: StepOutputRecord = {
    id: "sor_no_sum",
    stepId: "step_no_summary",
    taskId: "task_1",
    roleId: "agent",
    status: "failed",
    dataJson: "{}",
    artifactsJson: null,
    summary: null,
    durationMs: 50,
    tokenCost: 100,
    validationJson: null,
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.summary, "Step step_no_summary failed");
});

test("mapStepOutputRecord sets modelId to runtime and retryCount to 0", () => {
  const record: StepOutputRecord = {
    id: "sor_1",
    stepId: "step_1",
    taskId: "task_1",
    roleId: "agent",
    status: "succeeded",
    dataJson: "{}",
    artifactsJson: null,
    summary: "Done",
    durationMs: 100,
    tokenCost: 200,
    validationJson: null,
    producedAt: "2026-04-01T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.modelId, "runtime");
  assert.equal(result.retryCount, 0);
});

test("extractStepOutputRecords returns empty array when snapshot is null", () => {
  const result = extractStepOutputRecords({
    snapshot: null as any,
    streamFrames: [],
    routing: null as any,
    plannedWorkflow: null as any,
    compaction: null,
  });

  assert.deepEqual(result, []);
});

test("extractStepOutputRecords returns empty array when executionRecord is missing", () => {
  const result = extractStepOutputRecords({
    snapshot: { task: {} as any } as any,
    streamFrames: [],
    routing: null as any,
    plannedWorkflow: null as any,
    compaction: null,
  });

  assert.deepEqual(result, []);
});

test("extractStepOutputRecords returns empty array when stepOutputs is missing", () => {
  const result = extractStepOutputRecords({
    snapshot: { task: {} as any, executionRecord: {} } as any,
    streamFrames: [],
    routing: null as any,
    plannedWorkflow: null as any,
    compaction: null,
  });

  assert.deepEqual(result, []);
});

test("extractStepOutputRecords returns stepOutputs from executionRecord", () => {
  const stepOutputs: StepOutputRecord[] = [
    {
      id: "sor_1",
      stepId: "step_1",
      taskId: "task_1",
      roleId: "agent",
      status: "succeeded",
      dataJson: "{}",
      artifactsJson: null,
      summary: "Done",
      durationMs: 100,
      tokenCost: 200,
      validationJson: null,
      producedAt: "2026-04-01T00:00:00.000Z",
    },
  ];
  const result = extractStepOutputRecords({
    snapshot: { task: {} as any, executionRecord: { stepOutputs } } as any,
    streamFrames: [],
    routing: null as any,
    plannedWorkflow: null as any,
    compaction: null,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]!.stepId, "step_1");
});

test("serialiseOapeflirPlan serializes steps to oapeflir URL format", () => {
  const steps: PlanStep[] = [
    createMockPlanStep({ stepId: "step_1", action: "test_action" }),
    createMockPlanStep({ stepId: "step_2", action: "another_action" }),
  ];

  const result = serialiseOapeflirPlan(steps);

  assert.ok(result.startsWith("oapeflir://plan "));
  const parsed = JSON.parse(result.slice("oapeflir://plan ".length));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].stepId, "step_1");
  assert.equal(parsed[1].stepId, "step_2");
});

test("serialiseOapeflirPlan handles empty steps array", () => {
  const result = serialiseOapeflirPlan([]);

  assert.ok(result.startsWith("oapeflir://plan "));
  const parsed = JSON.parse(result.slice("oapeflir://plan ".length));
  assert.equal(parsed.length, 0);
});

test("mapToDualChannelStepOutputs transforms records correctly", () => {
  const records: StepOutputRecord[] = [
    {
      id: "sor_1",
      stepId: "step_1",
      taskId: "task_1",
      roleId: "agent",
      status: "succeeded",
      dataJson: '{"result":"ok"}',
      artifactsJson: '["artifact1"]',
      summary: "Completed step 1",
      durationMs: 100,
      tokenCost: 200,
      validationJson: '{"valid":true}',
      producedAt: "2026-04-01T00:00:00.000Z",
    },
  ];

  const result = mapToDualChannelStepOutputs(records, "plan_123");

  assert.equal(result.length, 1);
  assert.equal(result[0]!.stepId, "step_1");
  assert.equal(result[0]!.planRef, "plan_123");
  assert.equal(result[0]!.userFacingResult.summary, "Completed step 1");
  assert.ok(result[0]!.userFacingResult.artifacts.includes("artifact:artifact1"));
  assert.equal(result[0]!.systemTelemetry.durationMs, 100);
  assert.equal(result[0]!.systemTelemetry.tokensUsed, 200);
});

test("RuntimeExecuteBridge.toDualChannelStepOutputs transforms ExecutionResult", () => {
  const bridge = new RuntimeExecuteBridge("/fake/db/path");
  const executionResult = {
    planId: "plan_transform_test",
    results: [
      {
        stepId: "step_1",
        status: "succeeded" as const,
        durationMs: 100,
        tokenCost: 200,
        summary: "Step 1 completed",
        outputs: { key: "value" },
        artifacts: ["artifact1", "artifact2"],
        modelId: "runtime",
        retryCount: 0,
        validationPassed: true,
      },
      {
        stepId: "step_2",
        status: "failed" as const,
        durationMs: 50,
        tokenCost: 100,
        summary: "Step 2 failed",
        outputs: {},
        artifacts: [],
        modelId: "runtime",
        retryCount: 0,
        validationPassed: false,
      },
    ],
    totalDurationMs: 150,
    totalTokenCost: 300,
    allSucceeded: false,
    skippedStepIds: [],
    failedStepIds: ["step_2"],
  };

  const outputs = bridge.toDualChannelStepOutputs(executionResult);

  assert.equal(outputs.length, 2);

  // First step - succeeded
  assert.equal(outputs[0]!.stepId, "step_1");
  assert.equal(outputs[0]!.planRef, "plan_transform_test");
  assert.equal(outputs[0]!.userFacingResult.summary, "Step 1 completed");
  assert.ok(outputs[0]!.userFacingResult.artifacts.includes("artifact:artifact1"));
  assert.ok(outputs[0]!.userFacingResult.artifacts.includes("artifact:artifact2"));
  assert.equal(outputs[0]!.systemTelemetry.durationMs, 100);
  assert.equal(outputs[0]!.systemTelemetry.tokensUsed, 200);
  assert.equal(outputs[0]!.systemTelemetry.modelId, "runtime");
  assert.equal(outputs[0]!.systemTelemetry.retryCount, 0);
  assert.equal(outputs[0]!.systemTelemetry.validationPassed, true);

  // Second step - failed
  assert.equal(outputs[1]!.stepId, "step_2");
  assert.equal(outputs[1]!.userFacingResult.summary, "Step 2 failed");
  assert.equal(outputs[1]!.systemTelemetry.validationPassed, false);
});

test("RuntimeExecuteBridge.toDualChannelStepOutputs handles empty results", () => {
  const bridge = new RuntimeExecuteBridge("/fake/db/path");
  const executionResult = {
    planId: "plan_empty",
    results: [],
    totalDurationMs: 0,
    totalTokenCost: 0,
    allSucceeded: true,
    skippedStepIds: [],
    failedStepIds: [],
  };

  const outputs = bridge.toDualChannelStepOutputs(executionResult);

  assert.equal(outputs.length, 0);
});

test("RuntimeExecuteBridge.toDualChannelStepOutputs adds artifact prefix", () => {
  const bridge = new RuntimeExecuteBridge("/fake/db/path");
  const executionResult = {
    planId: "plan_artifacts",
    results: [
      {
        stepId: "step_art",
        status: "succeeded" as const,
        durationMs: 100,
        tokenCost: 200,
        summary: "Done",
        outputs: {},
        artifacts: ["file.txt", "data.json"],
        modelId: "runtime",
        retryCount: 0,
        validationPassed: true,
      },
    ],
    totalDurationMs: 100,
    totalTokenCost: 200,
    allSucceeded: true,
    skippedStepIds: [],
    failedStepIds: [],
  };

  const outputs = bridge.toDualChannelStepOutputs(executionResult);

  assert.equal(outputs[0]!.userFacingResult.artifacts.length, 2);
  assert.ok(outputs[0]!.userFacingResult.artifacts.includes("artifact:file.txt"));
  assert.ok(outputs[0]!.userFacingResult.artifacts.includes("artifact:data.json"));
});
