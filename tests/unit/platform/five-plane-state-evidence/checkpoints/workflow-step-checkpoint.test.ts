import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  compareWorkflowStepCheckpointVersions,
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  restoreWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  type CreateWorkflowStepCheckpointInput,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";

function createInput(overrides: Partial<CreateWorkflowStepCheckpointInput> = {}): CreateWorkflowStepCheckpointInput {
  return {
    harnessRunId: "harness-123",
    nodeRunId: "node-456",
    planGraphId: "plan-789",
    taskId: "task-001",
    executionId: "exec-002",
    workflowId: "workflow-1",
    divisionId: "division-1",
    stepId: "step-1",
    roleId: "role-agent",
    outputKey: "output.step1",
    status: "succeeded",
    producedAt: "2024-01-01T00:00:00.000Z",
    output: { result: "success", summary: "checkpoint summary" },
    decisionContext: {
      source: "model:gpt-4",
      request: "Analyze the input and provide recommendations",
      routeReason: "user requested analysis",
      priorStepSummaries: ["previous step completed"],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-0"],
      nextStepId: "step-2",
      outputKeys: ["output.step0", "output.step1"],
    },
    upstreamArtifactRefs: [
      {
        artifactId: "artifact-1",
        kind: "evidence_bundle",
        uri: "s3://bucket/artifact-1",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    fileDiffSummary: {
      summary: "modified main.ts",
      createdPaths: ["new.ts"],
      updatedPaths: ["main.ts"],
      deletedPaths: [],
    },
    compensationModel: {
      strategy: "manual_rollback",
      rollbackTaskId: "rollback-1",
    },
    ...overrides,
  };
}

test("createWorkflowStepCheckpoint creates the canonical schema", () => {
  const checkpoint = createWorkflowStepCheckpoint(createInput());

  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(checkpoint.nodeRunId, "node-456");
  assert.equal(checkpoint.planGraphId, "plan-789");
  assert.equal(checkpoint.status, "succeeded");
  assert.equal(checkpoint.fileDiffSummary.summary, "modified main.ts");
  assert.equal(checkpoint.upstreamArtifactRefs[0]?.artifactId, "artifact-1");
});

test("createWorkflowStepCheckpoint fills defaults for omitted optional fields", () => {
  const {
    harnessRunId: _ignoredHarnessRunId,
    nodeRunId: _ignoredNodeRunId,
    planGraphId: _ignoredPlanGraphId,
    ...base
  } = createInput();
  const checkpoint = createWorkflowStepCheckpoint({
    ...base,
    executionId: null,
    upstreamArtifactRefs: [],
    fileDiffSummary: {},
    compensationModel: null,
  });

  assert.equal(checkpoint.harnessRunId, "harness:task-001");
  assert.equal(checkpoint.nodeRunId, "node:step-1");
  assert.equal(checkpoint.planGraphId, "plan:workflow-1");
  assert.equal(checkpoint.executionId, null);
  assert.deepEqual(checkpoint.upstreamArtifactRefs, []);
  assert.equal(checkpoint.compensationModel, null);
});

test("createWorkflowStepCheckpoint makes defensive copies of mutable arrays", () => {
  const priorStepSummaries = ["previous step completed"];
  const completedStepIds = ["step-0"];
  const createdPaths = ["new.ts"];
  const checkpoint = createWorkflowStepCheckpoint(createInput({
    decisionContext: {
      source: "model:test",
      request: "test",
      routeReason: null,
      priorStepSummaries,
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds,
      nextStepId: "step-2",
      outputKeys: ["output.step1"],
    },
    fileDiffSummary: {
      summary: null,
      createdPaths,
      updatedPaths: [],
      deletedPaths: [],
    },
  }));

  priorStepSummaries.push("mutated");
  completedStepIds.push("mutated");
  createdPaths.push("mutated.ts");

  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, ["previous step completed"]);
  assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["step-0"]);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, ["new.ts"]);
});

test("summarizeWorkflowStepCheckpoint and restoreWorkflowStepCheckpoint expose canonical recovery fields", () => {
  const checkpoint = createWorkflowStepCheckpoint(createInput());
  const summary = summarizeWorkflowStepCheckpoint("artifact-step-1", checkpoint);
  const restored = restoreWorkflowStepCheckpoint(checkpoint);

  assert.equal(summary.artifactId, "artifact-step-1");
  assert.equal(summary.nextNodeRunId, "node:step-2");
  assert.equal(summary.summary, "checkpoint summary");
  assert.equal(restored.harnessRunId, checkpoint.harnessRunId);
  assert.deepEqual(restored.output, checkpoint.output);
  assert.equal(restored.compensationModel && typeof restored.compensationModel === "object", true);
});

test("readWorkflowStepCheckpoint accepts persisted structured compensation models", () => {
  const workspace = mkdtempSync(join(tmpdir(), "workflow-step-checkpoint-"));
  const storagePath = join(workspace, "checkpoint.json");

  try {
    writeFileSync(storagePath, JSON.stringify({
      ...createInput(),
      schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    }));

    const checkpoint = readWorkflowStepCheckpoint({
      kind: "workflow_step_snapshot",
      storagePath,
    } as never);

    assert.ok(checkpoint);
    assert.deepEqual(checkpoint.compensationModel, {
      strategy: "manual_rollback",
      rollbackTaskId: "rollback-1",
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("compareWorkflowStepCheckpointVersions tracks output and compensation changes", () => {
  const previous = createWorkflowStepCheckpoint(createInput({
    resumeContext: {
      completedStepIds: ["step-0"],
      nextStepId: "step-2",
      outputKeys: ["output.step1"],
    },
  }));
  const next = createWorkflowStepCheckpoint(createInput({
    status: "partial_success",
    resumeContext: {
      completedStepIds: ["step-0", "step-1"],
      nextStepId: null,
      outputKeys: ["output.step1", "output.step2"],
    },
    compensationModel: {
      strategy: "rollback_and_retry",
      notes: "changed",
    },
  }));

  const diff = compareWorkflowStepCheckpointVersions(previous, next);

  assert.equal(diff.statusChanged, true);
  assert.deepEqual(diff.outputKeysAdded, ["output.step2"]);
  assert.equal(diff.nextStepChanged, true);
  assert.equal(diff.compensationChanged, true);
});
