/**
 * Result Envelope Integration Tests
 *
 * Tests the result envelope building functions with more complex scenarios.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildTaskResultEnvelope, buildStepResultEnvelope } from "../../../../src/platform/contracts/result-envelope/index.js";
import type { TaskRecord, StepOutputRecord, ArtifactRecord, WorkflowStateRecord, TaskSource } from "../../../../src/platform/contracts/types/domain.js";

test("result-envelope: buildTaskResultEnvelope returns null when task has no output and no artifacts", () => {
  const task = createMockTaskRecord("done", null);
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.equal(result, null);
});

test("result-envelope: buildTaskResultEnvelope builds success envelope for done task", () => {
  const task = createMockTaskRecord("done", JSON.stringify({ result: "success" }));
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "success");
  assert.equal(result!.resultId, task.id);
  assert.deepEqual(result!.structuredData, { result: "success" });
});

test("result-envelope: buildTaskResultEnvelope builds error envelope for failed task", () => {
  const task = createMockTaskRecord("failed", JSON.stringify({ error: "Something went wrong" }));
  task.errorCode = "ERR_FAILED";

  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "error");
  assert.equal(result!.error!.code, "ERR_FAILED");
  assert.equal(result!.error!.message, "Something went wrong");
});

test("result-envelope: buildTaskResultEnvelope builds partial envelope for in_progress task", () => {
  const task = createMockTaskRecord("in_progress", JSON.stringify({ progress: 50 }));

  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "partial");
  assert.ok(result!.warnings.some((w) => w.includes("task_non_terminal")));
});

test("result-envelope: buildStepResultEnvelope builds success envelope for succeeded step", () => {
  const stepOutput = createMockStepOutputRecord("succeeded", JSON.stringify({ data: "value" }), 100, 50);
  const artifacts: ArtifactRecord[] = [];

  const result = buildStepResultEnvelope(stepOutput, artifacts);

  assert.equal(result.status, "success");
  assert.equal(result.resultId, stepOutput.id);
  assert.equal(result.metrics!.tokenCost, 100);
  assert.equal(result.metrics!.durationMs, 50);
});

test("result-envelope: buildStepResultEnvelope builds error envelope for failed step", () => {
  const stepOutput = createMockStepOutputRecord("failed", JSON.stringify({ error: "Step failed" }), 0, 0);

  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.status, "error");
  assert.ok(result.error!.code.includes("failed"));
});

test("result-envelope: buildStepResultEnvelope includes partial success warnings", () => {
  const stepOutput = createMockStepOutputRecord("partial_success", null, 0, 0);

  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.status, "partial");
  assert.ok(result.warnings.includes("partial_success"));
});

test("result-envelope: buildStepResultEnvelope handles validation warnings", () => {
  const stepOutput = createMockStepOutputRecord("succeeded", null, 0, 0);
  stepOutput.validationJson = JSON.stringify({
    valid: false,
    warnings: ["deprecated_field", "missing_optional"],
  });

  const result = buildStepResultEnvelope(stepOutput, []);

  assert.ok(result.warnings.includes("validation_failed"));
  assert.ok(result.warnings.includes("validation:deprecated_field"));
  assert.ok(result.warnings.includes("validation:missing_optional"));
});

test("result-envelope: buildStepResultEnvelope extracts human summary from structured data", () => {
  const stepOutput = createMockStepOutputRecord("succeeded", JSON.stringify({ summary: "This is a summary" }), 0, 0);

  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.humanSummary, "This is a summary");
});

test("result-envelope: buildStepResultEnvelope handles artifact references", () => {
  const stepOutput = createMockStepOutputRecord("succeeded", null, 0, 0);
  stepOutput.artifactsJson = JSON.stringify([
    {
      artifactId: "artifact_1",
      kind: "output",
      uri: "/path/to/artifact",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);

  const artifacts: ArtifactRecord[] = [
    {
      artifactId: "artifact_1",
      taskId: stepOutput.taskId,
      executionId: null,
      nodeRunId: null,
      stepId: stepOutput.stepId ?? null,
      kind: "output",
      storagePath: "/path/to/artifact",
      fileName: "artifact_1.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: "abc123",
      lineageJson: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const result = buildStepResultEnvelope(stepOutput, artifacts);

  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]!.artifactId, "artifact_1");
  assert.equal(result.artifacts[0]!.mimeType, "application/json");
});

// Helper functions

function createMockTaskRecord(status: TaskRecord["status"], outputJson: string | null): TaskRecord {
  return {
    id: "task_test_123",
    divisionId: "general-ops",
    rootId: "task_test_123",
    parentId: null,
    title: "Test Task",
    status,
    source: "user" as TaskSource,
    priority: "normal",
    inputJson: '{"input": "test"}',
    normalizedInputJson: '{"input": "test"}',
    outputJson,
    errorCode: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    completedAt: status === "done" || status === "failed" || status === "cancelled" ? "2026-01-01T00:02:00.000Z" : null,
  };
}

function createMockStepOutputRecord(
  status: StepOutputRecord["status"],
  dataJson: string | null,
  tokenCost: number,
  durationMs: number,
): StepOutputRecord {
  return {
    id: "step_output_123",
    taskId: "task_test_123",
    nodeRunId: "nrun_123",
    stepId: "step_1",
    roleId: "general_executor",
    status,
    dataJson: dataJson ?? '{"empty":true}',
    summary: null,
    artifactsJson: null,
    validationJson: null,
    tokenCost,
    durationMs,
    producedAt: "2026-01-01T00:00:00.000Z",
  };
}
