// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import type {
  TaskRecord,
  WorkflowStateRecord,
  StepOutputRecord,
  ArtifactRecord,
} from "../../../../../src/platform/contracts/types/domain.js";
import {
  buildTaskResultEnvelope,
  buildStepResultEnvelope,
} from "../../../../../src/platform/contracts/result-envelope/result-envelope.js";

function createTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_1",
    parentId: null,
    rootId: "task_1",
    divisionId: "general",
    title: "Test Task",
    status: "done",
    source: "user",
    priority: "normal",
    inputJson: '{"prompt": "test"}',
    normalizedInputJson: null,
    outputJson: '{"result": "success"}',
    estimatedCostUsd: null,
    actualCostUsd: 0.01,
    errorCode: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:01:00.000Z",
    completedAt: "2026-04-14T00:01:00.000Z",
    ...overrides,
  };
}

function createStepOutputRecord(overrides: Partial<StepOutputRecord> = {}): StepOutputRecord {
  return {
    id: "step_out_1",
    taskId: "task_1",
    stepId: "step1",
    roleId: "executor",
    status: "succeeded",
    dataJson: '{"output": "done"}',
    summary: "Step completed",
    artifactsJson: null,
    tokenCost: 100,
    durationMs: 500,
    validationJson: null,
    producedAt: "2026-04-14T00:00:30.000Z",
    ...overrides,
  };
}

function createWorkflowStateRecord(overrides: Partial<WorkflowStateRecord> = {}): WorkflowStateRecord {
  return {
    taskId: "task_1",
    divisionId: "general",
    workflowId: "workflow_1",
    currentStepIndex: 0,
    status: "completed",
    outputsJson: "{}",
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:01:00.000Z",
    ...overrides,
  };
}

function createArtifactRecord(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "art_1",
    taskId: "task_1",
    executionId: null,
    stepId: null,
    kind: "code",
    storagePath: "/tmp/art_1.txt",
    fileName: "art_1.txt",
    mimeType: "text/plain",
    sizeBytes: 1024,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-04-14T00:00:30.000Z",
    ...overrides,
  };
}

test("buildTaskResultEnvelope returns null when task has no output and no step outputs and no artifacts", () => {
  const task = createTaskRecord({
    outputJson: null,
    status: "done",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  // Should return null because structuredData is null and there are no step outputs or artifacts
  assert.equal(result, null);
});

test("buildTaskResultEnvelope creates success envelope for done task", () => {
  const task = createTaskRecord({ status: "done" });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "success");
  assert.equal(result!.resultId, "task_1");
});

test("buildTaskResultEnvelope creates error envelope for failed task", () => {
  const task = createTaskRecord({
    status: "failed",
    errorCode: "task.execution_failed",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "error");
  assert.equal(result!.error!.code, "task.execution_failed");
});

test("buildTaskResultEnvelope creates partial envelope for in_progress task", () => {
  const task = createTaskRecord({ status: "in_progress" });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "partial");
  assert.ok(result!.warnings.some(w => w.includes("task_non_terminal")));
});

test("buildTaskResultEnvelope uses outputJson as structuredData", () => {
  const task = createTaskRecord({ outputJson: '{"result": "test output"}' });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.deepEqual(result!.structuredData, { result: "test output" });
});

test("buildTaskResultEnvelope returns null for invalid outputJson", () => {
  const task = createTaskRecord({ outputJson: "not valid json" });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.equal(result, null);
});

test("buildTaskResultEnvelope uses last step summary as humanSummary", () => {
  const task = createTaskRecord({ outputJson: null });
  const stepOutputs = [
    createStepOutputRecord({ id: "step_1", summary: "First step" }),
    createStepOutputRecord({ id: "step_2", summary: "Final step" }),
  ];
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs,
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.humanSummary, "Final step");
});

test("buildTaskResultEnvelope falls back to task title when no step summary available", () => {
  const task = createTaskRecord({ outputJson: null, title: "My Task Title" });
  // Provide a step output without a summary to test fallback to task title
  const stepOutputs = [
    createStepOutputRecord({ summary: null, dataJson: "{}" }),
  ];
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs,
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.humanSummary, "My Task Title");
});

test("buildTaskResultEnvelope aggregates step metrics", () => {
  const task = createTaskRecord({ status: "done" });
  const stepOutputs = [
    createStepOutputRecord({ tokenCost: 100, durationMs: 500 }),
    createStepOutputRecord({ tokenCost: 200, durationMs: 300 }),
  ];
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs,
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.deepEqual(result!.metrics, { tokenCost: 300, durationMs: 800 });
});

test("buildTaskResultEnvelope includes workflow provenance when provided", () => {
  const task = createTaskRecord({ status: "done" });
  const workflowState = createWorkflowStateRecord({ workflowId: "wf_test" });
  const result = buildTaskResultEnvelope({
    task,
    workflowState,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.provenance!.workflowId, "wf_test");
  assert.equal(result!.provenance!.workflowStatus, "completed");
});

test("buildStepResultEnvelope creates success envelope for succeeded step", () => {
  const stepOutput = createStepOutputRecord({ status: "succeeded" });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.status, "success");
  assert.equal(result.resultId, "step_out_1");
});

test("buildStepResultEnvelope creates error envelope for failed step", () => {
  const stepOutput = createStepOutputRecord({
    status: "failed",
    dataJson: '{"error": "Step failed"}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.status, "error");
  assert.equal(result.error!.code, "step_output.failed");
  assert.equal(result.error!.message, "Step failed");
});

test("buildStepResultEnvelope creates partial envelope for partial_success step", () => {
  const stepOutput = createStepOutputRecord({ status: "partial_success" });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.status, "partial");
  assert.ok(result.warnings.includes("partial_success"));
});

test("buildStepResultEnvelope includes validation warnings", () => {
  const stepOutput = createStepOutputRecord({
    validationJson: '{"valid": false, "warnings": ["deprecated_field"]}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.ok(result.warnings.includes("validation_failed"));
  assert.ok(result.warnings.some(w => w.includes("deprecated_field")));
});

test("buildStepResultEnvelope parses nested error message", () => {
  const stepOutput = createStepOutputRecord({
    status: "failed",
    dataJson: '{"error": {"message": "Nested error"}}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.error!.message, "Nested error");
});

test("buildStepResultEnvelope extracts summary from structured data", () => {
  const stepOutput = createStepOutputRecord({
    summary: null,
    dataJson: '{"summary": "Data summary"}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.humanSummary, "Data summary");
});

test("buildStepResultEnvelope prefers explicit summary over data summary", () => {
  const stepOutput = createStepOutputRecord({
    summary: "Explicit summary",
    dataJson: '{"summary": "Data summary"}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.humanSummary, "Explicit summary");
});

test("buildStepResultEnvelope includes step metrics", () => {
  const stepOutput = createStepOutputRecord({
    tokenCost: 150,
    durationMs: 750,
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.deepEqual(result.metrics, { tokenCost: 150, durationMs: 750 });
});

test("buildStepResultEnvelope resolves artifact refs from step output", () => {
  const artifact = createArtifactRecord({ artifactId: "art_1" });
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([{
      artifactId: "art_1",
      kind: "code",
      uri: "/path/file.ts",
      createdAt: "2026-04-14T00:00:30.000Z",
    }]),
  });
  const result = buildStepResultEnvelope(stepOutput, [artifact]);

  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]!.artifactId, "art_1");
});

test("buildStepResultEnvelope enriches artifact refs with record data", () => {
  const artifact = createArtifactRecord({
    artifactId: "art_1",
    mimeType: "text/plain",
    sizeBytes: 2048,
  });
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([{
      artifactId: "art_1",
      kind: "code",
      uri: "/path/file.ts",
      createdAt: "2026-04-14T00:00:30.000Z",
    }]),
  });
  const result = buildStepResultEnvelope(stepOutput, [artifact]);

  assert.equal(result.artifacts[0]!.mimeType, "text/plain");
  assert.equal(result.artifacts[0]!.sizeBytes, 2048);
});

test("buildStepResultEnvelope provenance includes step details", () => {
  const stepOutput = createStepOutputRecord({
    taskId: "task_1",
    stepId: "step_1",
    roleId: "executor",
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.provenance!.taskId, "task_1");
  assert.equal(result.provenance!.stepId, "step_1");
  assert.equal(result.provenance!.roleId, "executor");
});

test("buildTaskResultEnvelope deduplicates artifact refs", () => {
  const artifact1 = createArtifactRecord({ artifactId: "art_1" });
  const artifact2 = createArtifactRecord({ artifactId: "art_1" }); // Duplicate
  const task = createTaskRecord({ status: "done" });

  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [artifact1, artifact2],
  });

  assert.notEqual(result, null);
  assert.equal(result!.artifacts.length, 1);
});

test("collectTaskWarnings includes task_non_terminal for pending status", () => {
  const task = createTaskRecord({ status: "pending" });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.ok(result!.warnings.some(w => w.includes("task_non_terminal:pending")));
});

test("collectStepWarnings extracts validation warnings array", () => {
  const stepOutput = createStepOutputRecord({
    status: "succeeded",
    validationJson: '{"valid": true, "warnings": ["field_deprecated", "unknown_field"]}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.ok(result.warnings.some(w => w === "validation:field_deprecated"));
  assert.ok(result.warnings.some(w => w === "validation:unknown_field"));
});

test("collectStepWarnings ignores non-string validation warnings", () => {
  const stepOutput = createStepOutputRecord({
    validationJson: '{"valid": false, "warnings": [123, null, "", "valid_warning"]}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.ok(result.warnings.some(w => w === "validation:valid_warning"));
  assert.equal(result.warnings.filter(w => w.startsWith("validation:")).length, 1);
});

test("buildTaskResultEnvelope maps cancelled status to error", () => {
  const task = createTaskRecord({ status: "cancelled" });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.status, "error");
});

test("extractHumanSummary returns string values directly", () => {
  const task = createTaskRecord({
    outputJson: '"just a string result"',
    status: "done",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.humanSummary, "just a string result");
});

test("extractHumanSummary returns null for arrays when no explicit summary is present", () => {
  const stepOutput = createStepOutputRecord({
    dataJson: '["array", "result"]',
    summary: null,
    status: "succeeded",
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.humanSummary, null);
});

test("extractHumanSummary prefers summary over humanSummary over result", () => {
  const task = createTaskRecord({
    outputJson: '{"summary": "Sum", "humanSummary": "Human", "result": "Res"}',
    status: "done",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.humanSummary, "Sum");
});

test("extractErrorMessage handles nested error object", () => {
  const task = createTaskRecord({
    status: "failed",
    outputJson: '{"error": {"message": "Something went wrong", "code": "ERR_123"}}',
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.error!.message, "Something went wrong");
});

test("extractErrorMessage returns null for array error", () => {
  const task = createTaskRecord({
    status: "failed",
    outputJson: '{"error": ["array", "error"]}',
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.error!.message, null);
});

test("safeParseJson returns null for invalid JSON", () => {
  const task = createTaskRecord({
    outputJson: "not valid json {",
    status: "done",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  // Invalid JSON results in null structuredData, so with no step outputs or artifacts, returns null
  assert.equal(result, null);
});

test("dedupeArtifactRefs deduplicates by artifactId", () => {
  const task = createTaskRecord({ status: "done" });
  const artifacts = [
    createArtifactRecord({ artifactId: "art_1", storagePath: "/path1" }),
    createArtifactRecord({ artifactId: "art_1", storagePath: "/path2" }),
  ];
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts,
  });

  assert.notEqual(result, null);
  assert.equal(result!.artifacts.length, 1);
});

test("dedupeArtifactRefs deduplicates by uri:createdAt when artifactId missing", () => {
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([
      { artifactId: "", kind: "code", uri: "/path/file.ts", createdAt: "2026-04-14T00:00:30.000Z" },
      { artifactId: "", kind: "code", uri: "/path/file.ts", createdAt: "2026-04-14T00:00:30.000Z" },
    ]),
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.artifacts.length, 1);
});

test("enrichArtifactRef prefers explicit ref values over artifact record", () => {
  const artifact = createArtifactRecord({
    artifactId: "art_1",
    storagePath: "/original/path.txt",
    mimeType: "text/plain",
    sizeBytes: 1024,
  });
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([{
      artifactId: "art_1",
      kind: "code",
      uri: "/override/path.txt",
      mimeType: "text/html",
      sizeBytes: 2048,
      createdAt: "2026-04-14T00:00:30.000Z",
    }]),
  });
  const result = buildStepResultEnvelope(stepOutput, [artifact]);
  const firstArtifact = result.artifacts[0]!;

  assert.equal(firstArtifact.uri, "/override/path.txt");
  assert.equal(firstArtifact.mimeType, "text/html");
  assert.equal(firstArtifact.sizeBytes, 2048);
});

test("enrichArtifactRef falls back to artifact record when ref values missing", () => {
  const artifact = createArtifactRecord({
    artifactId: "art_1",
    storagePath: "/original/path.txt",
    mimeType: "text/plain",
    sizeBytes: 1024,
    checksum: "abc123",
  });
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([{
      artifactId: "art_1",
      kind: "code",
      uri: "",
      createdAt: "",
    }]),
  });
  const result = buildStepResultEnvelope(stepOutput, [artifact]);
  const firstArtifact = result.artifacts[0]!;

  assert.equal(firstArtifact.uri, "/original/path.txt");
  assert.equal(firstArtifact.mimeType, "text/plain");
  assert.equal(firstArtifact.checksum, "abc123");
});

test("toArtifactRef converts artifact record correctly", () => {
  const task = createTaskRecord({ status: "done" });
  const artifact = createArtifactRecord({
    artifactId: "art_convert",
    kind: "data",
    storagePath: "/data/output.json",
    mimeType: "application/json",
    sizeBytes: 512,
    checksum: "def456",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [artifact],
  });

  assert.notEqual(result, null);
  assert.equal(result!.artifacts.length, 1);
  const firstArtifact = result!.artifacts[0]!;
  assert.equal(firstArtifact.artifactId, "art_convert");
  assert.equal(firstArtifact.kind, "data");
  assert.equal(firstArtifact.uri, "/data/output.json");
  assert.equal(firstArtifact.checksum, "def456");
});

test("safeParseArtifactRefs skips invalid entries", () => {
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([
      { artifactId: "valid_art", kind: "code", uri: "/path/file.ts", createdAt: "2026-04-14T00:00:30.000Z" },
      { artifactId: 123, kind: "code", uri: "/path/file.ts", createdAt: "2026-04-14T00:00:30.000Z" },
      { artifactId: "art_2", kind: null, uri: "/path/file.ts", createdAt: "2026-04-14T00:00:30.000Z" },
      { artifactId: "art_3", kind: "code", createdAt: "2026-04-14T00:00:30.000Z" },
    ]),
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.artifacts.length, 1);
  const firstArtifact = result.artifacts[0]!;
  assert.equal(firstArtifact.artifactId, "valid_art");
});

test("safeParseArtifactRefs handles non-array JSON", () => {
  const stepOutput = createStepOutputRecord({
    artifactsJson: '{"artifactId": "should be array"}',
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.artifacts.length, 0);
});

test("safeParseArtifactRefs handles null values in array", () => {
  const stepOutput = createStepOutputRecord({
    artifactsJson: JSON.stringify([null, { artifactId: "art_valid", kind: "code", uri: "/path/file.ts", createdAt: "2026-04-14T00:00:30.000Z" }]),
  });
  const result = buildStepResultEnvelope(stepOutput, []);

  assert.equal(result.artifacts.length, 1);
});

test("buildTaskResultEnvelope uses humanSummary from structuredData over task title", () => {
  const task = createTaskRecord({
    outputJson: '{"humanSummary": "Human readable summary"}',
    title: "Task Title",
    status: "done",
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [],
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.equal(result!.humanSummary, "Human readable summary");
});

test("buildStepResultEnvelope includes step warning with stepId prefix", () => {
  const task = createTaskRecord({ status: "done" });
  const stepOutputs = [
    createStepOutputRecord({
      stepId: "step_1",
      status: "partial_success",
    }),
  ];
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs,
    artifacts: [],
  });

  assert.notEqual(result, null);
  assert.ok(result!.warnings.some(w => w.startsWith("step_1:")));
});

test("resolveArtifactRefs falls back to task artifacts when step output has no refs", () => {
  const task = createTaskRecord({ status: "done" });
  const artifact = createArtifactRecord({ artifactId: "fallback_art", stepId: "step_1" });
  const stepOutput = createStepOutputRecord({
    stepId: "step_1",
    artifactsJson: null,
  });
  const result = buildTaskResultEnvelope({
    task,
    workflowState: null,
    stepOutputs: [stepOutput],
    artifacts: [artifact],
  });

  assert.notEqual(result, null);
  assert.equal(result!.artifacts.length, 1);
  const firstArtifact = result!.artifacts[0]!;
  assert.equal(firstArtifact.artifactId, "fallback_art");
});
