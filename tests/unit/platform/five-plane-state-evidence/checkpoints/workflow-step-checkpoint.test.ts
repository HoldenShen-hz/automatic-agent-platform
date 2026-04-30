/**
 * Unit tests for workflow-step-checkpoint module
 *
 * Tests workflow step checkpoint creation, validation, and summarization.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  createWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  type WorkflowStepCheckpoint,
  type CreateWorkflowStepCheckpointInput,
  type WorkflowStepCheckpointSummary,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";

function createMockCheckpointInput(
  overrides: Partial<CreateWorkflowStepCheckpointInput> = {},
): CreateWorkflowStepCheckpointInput {
  return {
    harnessRunId: "harness-123",
    nodeRunId: "node-456",
    planGraphBundleId: "bundle-789",
    taskId: "task-001",
    executionId: "exec-002",
    workflowId: "workflow-1",
    divisionId: "division-1",
    stepId: "step-1",
    roleId: "role-agent",
    outputKey: "output.step1",
    status: "completed",
    producedAt: "2024-01-01T00:00:00Z",
    output: { result: "success", data: { key: "value" } },
    decisionContext: {
      source: "model:gpt-4",
      request: "Analyze the input and provide recommendations",
      routeReason: "User requested analysis",
      priorStepSummaries: ["Previous step completed successfully"],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-0"],
      nextStepId: "step-2",
      outputKeys: ["output.step0", "output.step1"],
    },
    upstreamArtifactRefs: [
      {
        artifactId: "art-1",
        kind: "evidence_bundle",
        uri: "s3://bucket/art-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ],
    fileDiffSummary: {
      summary: "Modified main.ts and added test.ts",
      createdPaths: ["test.ts"],
      updatedPaths: ["main.ts"],
      deletedPaths: [],
    },
    compensationModel: null,
    ...overrides,
  };
}

test("WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION is correct", () => {
  assert.equal(WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION, "workflow_step_checkpoint.v1");
});

test("createWorkflowStepCheckpoint creates valid checkpoint", () => {
  const input = createMockCheckpointInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(checkpoint.harnessRunId, input.harnessRunId);
  assert.equal(checkpoint.nodeRunId, input.nodeRunId);
  assert.equal(checkpoint.planGraphBundleId, input.planGraphBundleId);
  assert.equal(checkpoint.taskId, input.taskId);
  assert.equal(checkpoint.workflowId, input.workflowId);
  assert.equal(checkpoint.stepId, input.stepId);
  assert.equal(checkpoint.roleId, input.roleId);
  assert.equal(checkpoint.outputKey, input.outputKey);
  assert.equal(checkpoint.status, input.status);
  assert.deepEqual(checkpoint.output, input.output);
});

test("createWorkflowStepCheckpoint makes defensive copies of arrays", () => {
  const input = createMockCheckpointInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  // Modify original arrays
  input.decisionContext.priorStepSummaries.push("modified");
  input.resumeContext.completedStepIds.push("step-99");
  input.fileDiffSummary!.createdPaths.push("modified.ts");

  // Checkpoint should not be affected
  assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 1);
  assert.equal(checkpoint.resumeContext.completedStepIds.length, 1);
  assert.equal(checkpoint.fileDiffSummary.createdPaths.length, 1);
});

test("createWorkflowStepCheckpoint handles optional fields", () => {
  const input = createMockCheckpointInput({
    nodeRunId: null,
    executionId: null,
    compensationModel: null,
    upstreamArtifactRefs: undefined,
    fileDiffSummary: undefined,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.nodeRunId, null);
  assert.equal(checkpoint.executionId, null);
  assert.equal(checkpoint.compensationModel, null);
  assert.deepEqual(checkpoint.upstreamArtifactRefs, []);
  assert.equal(checkpoint.fileDiffSummary.summary, null);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
});

test("createWorkflowStepCheckpoint preserves decision context", () => {
  const input = createMockCheckpointInput({
    decisionContext: {
      source: "model:claude-3",
      request: "Process user request",
      routeReason: "Direct routing",
      priorStepSummaries: ["Step 1: Init", "Step 2: Process"],
      dependsOnStepIds: ["init-step", "process-step"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.decisionContext.source, "model:claude-3");
  assert.equal(checkpoint.decisionContext.request, "Process user request");
  assert.equal(checkpoint.decisionContext.routeReason, "Direct routing");
  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, ["Step 1: Init", "Step 2: Process"]);
  assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, ["init-step", "process-step"]);
});

test("createWorkflowStepCheckpoint preserves resume context", () => {
  const input = createMockCheckpointInput({
    resumeContext: {
      completedStepIds: ["step-a", "step-b", "step-c"],
      nextStepId: "step-d",
      outputKeys: ["out.a", "out.b", "out.c"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["step-a", "step-b", "step-c"]);
  assert.equal(checkpoint.resumeContext.nextStepId, "step-d");
  assert.deepEqual(checkpoint.resumeContext.outputKeys, ["out.a", "out.b", "out.c"]);
});

test("createWorkflowStepCheckpoint preserves file diff summary", () => {
  const input = createMockCheckpointInput({
    fileDiffSummary: {
      summary: "Code changes summary",
      createdPaths: ["new-file.ts"],
      updatedPaths: ["existing.ts", "another.ts"],
      deletedPaths: ["removed.ts"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.fileDiffSummary.summary, "Code changes summary");
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, ["new-file.ts"]);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, ["existing.ts", "another.ts"]);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, ["removed.ts"]);
});

test("createWorkflowStepCheckpoint preserves upstream artifact refs", () => {
  const artifactRefs = [
    { artifactId: "art-1", kind: "evidence_bundle", uri: "s3://bucket/art-1", createdAt: "2024-01-01T00:00:00Z" },
    { artifactId: "art-2", kind: "diagnostic_bundle", uri: "s3://bucket/art-2", createdAt: "2024-01-02T00:00:00Z" },
  ];

  const input = createMockCheckpointInput({
    upstreamArtifactRefs: artifactRefs,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.upstreamArtifactRefs.length, 2);
  assert.equal(checkpoint.upstreamArtifactRefs[0].artifactId, "art-1");
  assert.equal(checkpoint.upstreamArtifactRefs[1].artifactId, "art-2");
});

test("createWorkflowStepCheckpoint stores compensation model when provided", () => {
  const compensationModel = "compensate:undo-action";
  const input = createMockCheckpointInput({
    compensationModel,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.compensationModel, compensationModel);
});

test("createWorkflowStepCheckpoint accepts all valid step statuses", () => {
  const statuses = ["pending", "running", "completed", "failed", "skipped", "cancelled"] as const;

  for (const status of statuses) {
    const input = createMockCheckpointInput({ status });
    const checkpoint = createWorkflowStepCheckpoint(input);
    assert.equal(checkpoint.status, status);
  }
});

test("summarizeWorkflowStepCheckpoint creates summary from checkpoint", () => {
  const input = createMockCheckpointInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact-step-1", checkpoint);

  assert.equal(summary.artifactId, "artifact-step-1");
  assert.equal(summary.harnessRunId, checkpoint.harnessRunId);
  assert.equal(summary.nodeRunId, checkpoint.nodeRunId);
  assert.equal(summary.planGraphBundleId, checkpoint.planGraphBundleId);
  assert.equal(summary.status, checkpoint.status);
  assert.equal(summary.producedAt, checkpoint.producedAt);
  assert.equal(summary.nextStepId, checkpoint.resumeContext.nextStepId);
  assert.deepEqual(summary.outputKeys, checkpoint.resumeContext.outputKeys);
  assert.equal(summary.source, checkpoint.decisionContext.source);
});

test("summarizeWorkflowStepCheckpoint extracts summary from output", () => {
  const input = createMockCheckpointInput({
    output: {
      result: "success",
      summary: "This is the step summary extracted from output",
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const summary = summarizeWorkflowStepCheckpoint("art-1", checkpoint);

  assert.equal(summary.summary, "This is the step summary extracted from output");
});

test("summarizeWorkflowStepCheckpoint handles missing summary in output", () => {
  const input = createMockCheckpointInput({
    output: {
      result: "success",
      // No summary field
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const summary = summarizeWorkflowStepCheckpoint("art-1", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint handles non-string summary in output", () => {
  const input = createMockCheckpointInput({
    output: {
      result: "success",
      summary: 123, // number instead of string
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const summary = summarizeWorkflowStepCheckpoint("art-1", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint handles null output", () => {
  const input = createMockCheckpointInput({
    output: null as unknown as Record<string, unknown>,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const summary = summarizeWorkflowStepCheckpoint("art-1", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint handles array output", () => {
  const input = createMockCheckpointInput({
    output: ["item1", "item2"] as unknown as Record<string, unknown>,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const summary = summarizeWorkflowStepCheckpoint("art-1", checkpoint);

  assert.equal(summary.summary, null);
});

test("createWorkflowStepCheckpoint works with empty priorStepSummaries", () => {
  const input = createMockCheckpointInput({
    decisionContext: {
      source: "model:test",
      request: "Test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, []);
  assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, []);
});

test("createWorkflowStepCheckpoint works with empty outputKeys", () => {
  const input = createMockCheckpointInput({
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.resumeContext.outputKeys, []);
  assert.equal(checkpoint.resumeContext.nextStepId, null);
});

test("createWorkflowStepCheckpoint works with empty file changes", () => {
  const input = createMockCheckpointInput({
    fileDiffSummary: {
      summary: null,
      createdPaths: [],
      updatedPaths: [],
      deletedPaths: [],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.fileDiffSummary.summary, null);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
});

test("createWorkflowStepCheckpoint works with all chunk types in upstream refs", () => {
  const artifactKinds = [
    "source_code",
    "config",
    "document",
    "report",
    "evidence_bundle",
    "timeline_export",
    "diagnostic_bundle",
    "workflow_checkpoint",
    "feedback_snapshot",
    "learning_object_bundle",
    "improvement_candidate_bundle",
    "rollout_evidence",
    "test_result",
    "log",
  ] as const;

  for (const kind of artifactKinds) {
    const input = createMockCheckpointInput({
      upstreamArtifactRefs: [
        { artifactId: `art-${kind}`, kind, uri: "s3://bucket/test", createdAt: "2024-01-01T00:00:00Z" },
      ],
    });

    const checkpoint = createWorkflowStepCheckpoint(input);
    assert.equal(checkpoint.upstreamArtifactRefs[0].kind, kind);
  }
});
