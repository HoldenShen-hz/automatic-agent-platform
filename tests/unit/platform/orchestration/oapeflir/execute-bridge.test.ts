import assert from "node:assert/strict";
import test from "node:test";

import {
  MockExecuteBridge,
  mapStepOutputRecord,
  mapToDualChannelStepOutputs,
  extractStepOutputRecords,
  serialiseOapeflirPlan,
} from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { StepOutputRecord } from "../../../../../src/platform/contracts/types/domain/task-types.js";

test("MockExecuteBridge.executeStep returns succeeded result with defaults", async () => {
  const bridge = new MockExecuteBridge();
  const step: PlanStep = {
    stepId: "step_1",
    action: "test_action",
    inputs: { query: "test" },
    outputs: ["result_1"],
    dependencies: [],
    timeout: 5000,
  };

  const result = await bridge.executeStep(step, { taskId: "task_1" });

  assert.equal(result.stepId, "step_1");
  assert.equal(result.status, "succeeded");
  assert.equal(result.durationMs, 100);
  assert.equal(result.tokenCost, 200);
  assert.ok(result.summary.includes("test_action"));
  assert.ok(result.summary.includes("step_1"));
  assert.deepEqual(result.outputs, {});
  assert.deepEqual(result.artifacts, ["artifact:result_1"]);
  assert.equal(result.modelId, "local-simulated");
  assert.equal(result.retryCount, 0);
  assert.equal(result.validationPassed, true);
});

test("MockExecuteBridge.executeStep handles step without outputs", async () => {
  const bridge = new MockExecuteBridge();
  const step: PlanStep = {
    stepId: "step_no_outputs",
    action: "action",
    inputs: {},
    outputs: undefined,
    dependencies: [],
    timeout: 3000,
  };

  const result = await bridge.executeStep(step, { taskId: "task_1" });

  assert.equal(result.stepId, "step_no_outputs");
  assert.deepEqual(result.artifacts, []);
});

test("MockExecuteBridge.executePlan processes multiple steps", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_1",
    taskId: "task_1",
    version: 1,
    assessmentRef: "assessment_1",
    strategy: "linear" as const,
    steps: [
      {
        stepId: "step_1",
        action: "action_1",
        inputs: {},
        outputs: ["out_1"],
        dependencies: [],
        timeout: 1000,
      },
      {
        stepId: "step_2",
        action: "action_2",
        inputs: {},
        outputs: ["out_2"],
        dependencies: ["step_1"],
        timeout: 2000,
      },
    ],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_1" });

  assert.equal(result.planId, "plan_1");
  assert.equal(result.results.length, 2);
  assert.equal(result.allSucceeded, true);
  assert.deepEqual(result.skippedStepIds, []);
  assert.deepEqual(result.failedStepIds, []);
  assert.ok(result.totalDurationMs > 0);
  assert.ok(result.totalTokenCost > 0);
});

test("MockExecuteBridge.executePlan calculates correct totals", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_calc",
    taskId: "task_1",
    version: 1,
    assessmentRef: "assessment_1",
    strategy: "linear" as const,
    steps: [
      {
        stepId: "step_1",
        action: "action_1",
        inputs: {},
        outputs: ["out_1"],
        dependencies: [],
        timeout: 1000,
      },
      {
        stepId: "step_2",
        action: "action_2",
        inputs: {},
        outputs: ["out_2"],
        dependencies: [],
        timeout: 1000,
      },
      {
        stepId: "step_3",
        action: "action_3",
        inputs: {},
        outputs: ["out_3"],
        dependencies: [],
        timeout: 1000,
      },
    ],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_1" });

  // Expected: 100 + 150 + 200 = 450 duration, 200 + 275 + 350 = 825 cost
  assert.equal(result.results.length, 3);
  assert.equal(result.totalDurationMs, 450); // 100 + 150 + 200
  assert.equal(result.totalTokenCost, 825); // 200 + 275 + 350
  assert.equal(result.allSucceeded, true);
});

test("MockExecuteBridge.executePlan empty plan returns empty results", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_empty",
    taskId: "task_1",
    version: 1,
    assessmentRef: "assessment_1",
    strategy: "linear" as const,
    steps: [],
    createdAt: Date.now(),
  };

  const result = await bridge.executePlan(plan, { taskId: "task_1" });

  assert.equal(result.planId, "plan_empty");
  assert.equal(result.results.length, 0);
  assert.equal(result.totalDurationMs, 0);
  assert.equal(result.totalTokenCost, 0);
  assert.equal(result.allSucceeded, true);
});

test("MockExecuteBridge.toDualChannelStepOutputs converts execution result", async () => {
  const bridge = new MockExecuteBridge();
  const plan = {
    planId: "plan_convert",
    taskId: "task_1",
    version: 1,
    assessmentRef: "assessment_1",
    strategy: "linear" as const,
    steps: [
      {
        stepId: "step_1",
        action: "action_1",
        inputs: {},
        outputs: ["artifact_1"],
        dependencies: [],
        timeout: 1000,
      },
    ],
    createdAt: Date.now(),
  };

  const execResult = await bridge.executePlan(plan, { taskId: "task_1" });
  const outputs = bridge.toDualChannelStepOutputs(execResult);

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0]!.stepId, "step_1");
  assert.equal(outputs[0]!.planRef, "plan_convert");
  assert.ok(outputs[0]!.userFacingResult.summary.includes("action_1"));
  assert.deepEqual(outputs[0]!.userFacingResult.artifacts, ["artifact:artifact_1"]);
  assert.equal(outputs[0]!.systemTelemetry.durationMs, 100);
  assert.equal(outputs[0]!.systemTelemetry.tokensUsed, 200);
  assert.equal(outputs[0]!.systemTelemetry.modelId, "local-simulated");
  assert.equal(outputs[0]!.systemTelemetry.retryCount, 0);
  assert.equal(outputs[0]!.systemTelemetry.validationPassed, true);
});

test("mapStepOutputRecord handles succeeded status", () => {
  const record: StepOutputRecord = {
    id: "rec_1",
    taskId: "task_1",
    stepId: "step_1",
    roleId: "executor",
    status: "succeeded",
    dataJson: '{"result": "success"}',
    summary: "Step completed",
    artifactsJson: '["artifact:1"]',
    tokenCost: 150,
    durationMs: 300,
    validationJson: null,
    producedAt: "2026-04-14T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.stepId, "step_1");
  assert.equal(result.status, "succeeded");
  assert.equal(result.durationMs, 300);
  assert.equal(result.tokenCost, 150);
  assert.equal(result.summary, "Step completed");
  assert.deepEqual(result.outputs, { result: "success" });
  assert.deepEqual(result.artifacts, ["artifact:1"]);
  assert.equal(result.modelId, "runtime");
  assert.equal(result.retryCount, 0);
  assert.equal(result.validationPassed, false);
});

test("mapStepOutputRecord handles failed status", () => {
  const record: StepOutputRecord = {
    id: "rec_2",
    taskId: "task_1",
    stepId: "step_2",
    roleId: "executor",
    status: "failed",
    dataJson: '{"error": "failed"}',
    summary: null,
    artifactsJson: null,
    tokenCost: 50,
    durationMs: 100,
    validationJson: null,
    producedAt: "2026-04-14T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.status, "failed");
  assert.equal(result.summary, "Step step_2 failed");
});

test("mapStepOutputRecord handles skipped status", () => {
  const record: StepOutputRecord = {
    id: "rec_3",
    taskId: "task_1",
    stepId: "step_3",
    roleId: "executor",
    status: "skipped",
    dataJson: "{}",
    summary: null,
    artifactsJson: null,
    tokenCost: 0,
    durationMs: 0,
    validationJson: null,
    producedAt: "2026-04-14T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.status, "skipped");
});

test("mapStepOutputRecord handles invalid JSON gracefully", () => {
  const record: StepOutputRecord = {
    id: "rec_4",
    taskId: "task_1",
    stepId: "step_4",
    roleId: "executor",
    status: "succeeded",
    dataJson: "not valid json",
    summary: null,
    artifactsJson: null,
    tokenCost: 0,
    durationMs: 0,
    validationJson: null,
    producedAt: "2026-04-14T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.deepEqual(result.outputs, {});
});

test("mapStepOutputRecord handles invalid artifacts JSON gracefully", () => {
  const record: StepOutputRecord = {
    id: "rec_5",
    taskId: "task_1",
    stepId: "step_5",
    roleId: "executor",
    status: "succeeded",
    dataJson: "{}",
    summary: null,
    artifactsJson: "not valid json",
    tokenCost: 0,
    durationMs: 0,
    validationJson: null,
    producedAt: "2026-04-14T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.deepEqual(result.artifacts, []);
});

test("mapStepOutputRecord handles validationJson present", () => {
  const record: StepOutputRecord = {
    id: "rec_6",
    taskId: "task_1",
    stepId: "step_6",
    roleId: "executor",
    status: "succeeded",
    dataJson: "{}",
    summary: null,
    artifactsJson: null,
    tokenCost: 0,
    durationMs: 0,
    validationJson: '{"valid": true}',
    producedAt: "2026-04-14T00:00:00.000Z",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.validationPassed, true);
});

test("mapToDualChannelStepOutputs converts multiple records", () => {
  const records: StepOutputRecord[] = [
    {
      id: "rec_1",
      taskId: "task_1",
      stepId: "step_1",
      roleId: "executor",
      status: "succeeded",
      dataJson: '{"result": "one"}',
      summary: "First",
      artifactsJson: null,
      tokenCost: 100,
      durationMs: 200,
      validationJson: null,
      producedAt: "2026-04-14T00:00:00.000Z",
    },
    {
      id: "rec_2",
      taskId: "task_1",
      stepId: "step_2",
      roleId: "executor",
      status: "succeeded",
      dataJson: '{"result": "two"}',
      summary: "Second",
      artifactsJson: null,
      tokenCost: 150,
      durationMs: 300,
      validationJson: null,
      producedAt: "2026-04-14T00:00:00.000Z",
    },
  ];

  const outputs = mapToDualChannelStepOutputs(records, "plan_test");

  assert.equal(outputs.length, 2);
  assert.equal(outputs[0]!.stepId, "step_1");
  assert.equal(outputs[0]!.planRef, "plan_test");
  assert.equal(outputs[1]!.stepId, "step_2");
  assert.equal(outputs[1]!.planRef, "plan_test");
});

test("extractStepOutputRecords returns empty array when snapshot is missing", () => {
  const result = {
    snapshot: undefined,
  } as any;

  const records = extractStepOutputRecords(result);

  assert.deepEqual(records, []);
});

test("extractStepOutputRecords returns empty array when executionRecord is missing", () => {
  const result = {
    snapshot: {},
  } as any;

  const records = extractStepOutputRecords(result);

  assert.deepEqual(records, []);
});

test("extractStepOutputRecords returns empty array when stepOutputs is missing", () => {
  const result = {
    snapshot: {
      executionRecord: {},
    },
  } as any;

  const records = extractStepOutputRecords(result);

  assert.deepEqual(records, []);
});

test("extractStepOutputRecords extracts step outputs from result", () => {
  const stepOutputs: StepOutputRecord[] = [
    {
      id: "rec_1",
      taskId: "task_1",
      stepId: "step_1",
      roleId: "executor",
      status: "succeeded",
      dataJson: "{}",
      summary: null,
      artifactsJson: null,
      tokenCost: 0,
      durationMs: 0,
      validationJson: null,
      producedAt: "2026-04-14T00:00:00.000Z",
    },
  ];
  const result = {
    snapshot: {
      executionRecord: {
        stepOutputs,
      },
    },
  } as any;

  const records = extractStepOutputRecords(result);

  assert.equal(records.length, 1);
  assert.equal(records[0]!.stepId, "step_1");
});

test("serialiseOapeflirPlan creates correct format", () => {
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      inputs: { path: "/tmp" },
      outputs: ["out_1"],
      dependencies: [],
      timeout: 5000,
    },
  ];

  const serialised = serialiseOapeflirPlan(steps);

  assert.ok(serialised.startsWith("oapeflir://plan "));
  const jsonPart = serialised.slice("oapeflir://plan ".length);
  const parsed = JSON.parse(jsonPart);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].stepId, "step_1");
  assert.equal(parsed[0].action, "read");
});

test("serialiseOapeflirPlan preserves all step metadata", () => {
  const steps: PlanStep[] = [
    {
      stepId: "step_complex",
      action: "write",
      inputs: { path: "/output", content: "data" },
      outputs: ["file"],
      dependencies: ["dep_1"],
      timeout: 10000,
    },
  ];

  const serialised = serialiseOapeflirPlan(steps);
  const jsonPart = serialised.slice("oapeflir://plan ".length);
  const parsed = JSON.parse(jsonPart);

  assert.equal(parsed[0].stepId, "step_complex");
  assert.deepEqual(parsed[0].inputs, { path: "/output", content: "data" });
  assert.deepEqual(parsed[0].outputs, ["file"]);
  assert.deepEqual(parsed[0].dependencies, ["dep_1"]);
  assert.equal(parsed[0].timeout, 10000);
});

test("serialiseOapeflirPlan handles multiple steps", () => {
  const steps: PlanStep[] = [
    { stepId: "s1", action: "a1", inputs: {}, outputs: [], dependencies: [], timeout: 1000 },
    { stepId: "s2", action: "a2", inputs: {}, outputs: [], dependencies: ["s1"], timeout: 2000 },
    { stepId: "s3", action: "a3", inputs: {}, outputs: [], dependencies: ["s1", "s2"], timeout: 3000 },
  ];

  const serialised = serialiseOapeflirPlan(steps);
  const jsonPart = serialised.slice("oapeflir://plan ".length);
  const parsed = JSON.parse(jsonPart);

  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].stepId, "s1");
  assert.equal(parsed[1].dependencies[0], "s1");
  assert.equal(parsed[2].dependencies.length, 2);
});
