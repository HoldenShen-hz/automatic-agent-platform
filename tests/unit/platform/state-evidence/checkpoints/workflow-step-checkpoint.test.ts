/**
 * Comprehensive unit tests for WorkflowStepCheckpoint
 *
 * Tests cover:
 * - createWorkflowStepCheckpoint function
 * - summarizeWorkflowStepCheckpoint function
 * - isWorkflowStepCheckpoint validation logic
 * - compensationModel type validation (issue #2030)
 * - Defensive array copying
 * - All field validations
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  type WorkflowStepCheckpoint,
  type CreateWorkflowStepCheckpointInput,
  type WorkflowStepCheckpointDecisionContext,
  type WorkflowStepCheckpointResumeContext,
  type WorkflowStepCheckpointFileDiffSummary,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { CompensationModel } from "../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js";
import { unsafeCast } from "../../../../helpers/typed-factories.js";

// ── Test Factory Helpers ────────────────────────────────────────────────────────

function createMinimalInput(overrides: Partial<CreateWorkflowStepCheckpointInput> = {}): CreateWorkflowStepCheckpointInput {
  return {
    harnessRunId: "harness_test",
    nodeRunId: "node_test",
    planGraphBundleId: "bundle_test",
    taskId: "task_test",
    executionId: "exec_test",
    workflowId: "wf_test",
    divisionId: "div_test",
    stepId: "step_test",
    roleId: "role_test",
    outputKey: "output_test",
    status: "succeeded",
    producedAt: "2026-05-01T00:00:00.000Z",
    output: { result: "success" },
    decisionContext: {
      source: "test",
      request: "test request",
      routeReason: "test reason",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
    ...overrides,
  };
}

function createMinimalDecisionContext(overrides: Partial<WorkflowStepCheckpointDecisionContext> = {}): WorkflowStepCheckpointDecisionContext {
  return {
    source: "test_source",
    request: "test_request",
    routeReason: null,
    priorStepSummaries: [],
    dependsOnStepIds: [],
    ...overrides,
  };
}

function createMinimalResumeContext(overrides: Partial<WorkflowStepCheckpointResumeContext> = {}): WorkflowStepCheckpointResumeContext {
  return {
    completedStepIds: [],
    nextStepId: null,
    outputKeys: [],
    ...overrides,
  };
}

function createMinimalFileDiffSummary(overrides: Partial<WorkflowStepCheckpointFileDiffSummary> = {}): WorkflowStepCheckpointFileDiffSummary {
  return {
    summary: null,
    createdPaths: [],
    updatedPaths: [],
    deletedPaths: [],
    ...overrides,
  };
}

// ── Basic Creation Tests ───────────────────────────────────────────────────────

test("createWorkflowStepCheckpoint creates valid checkpoint with all required fields", () => {
  const input = createMinimalInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(checkpoint.harnessRunId, input.harnessRunId);
  assert.equal(checkpoint.nodeRunId, input.nodeRunId);
  assert.equal(checkpoint.planGraphBundleId, input.planGraphBundleId);
  assert.equal(checkpoint.taskId, input.taskId);
  assert.equal(checkpoint.executionId, input.executionId);
  assert.equal(checkpoint.workflowId, input.workflowId);
  assert.equal(checkpoint.divisionId, input.divisionId);
  assert.equal(checkpoint.stepId, input.stepId);
  assert.equal(checkpoint.roleId, input.roleId);
  assert.equal(checkpoint.outputKey, input.outputKey);
  assert.equal(checkpoint.status, input.status);
  assert.equal(checkpoint.producedAt, input.producedAt);
});

test("createWorkflowStepCheckpoint accepts null nodeRunId for early-stage checkpoints", () => {
  const input = createMinimalInput({ nodeRunId: null });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.nodeRunId, null);
});

test("createWorkflowStepCheckpoint accepts null executionId for planning phase", () => {
  const input = createMinimalInput({ executionId: null });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.executionId, null);
});

test("createWorkflowStepCheckpoint accepts all valid status values", () => {
  const statuses: CreateWorkflowStepCheckpointInput["status"][] = [
    "succeeded",
    "failed",
    "partial_success",
    "skipped",
  ];

  for (const status of statuses) {
    const input = createMinimalInput({ status });
    const checkpoint = createWorkflowStepCheckpoint(input);
    assert.equal(checkpoint.status, status, `Status ${status} should be accepted`);
  }
});

// ── Defensive Array Copy Tests ─────────────────────────────────────────────────

test("createWorkflowStepCheckpoint creates defensive copy of priorStepSummaries", () => {
  const originalArray = ["step1", "step2"];
  const input = createMinimalInput({
    decisionContext: createMinimalDecisionContext({ priorStepSummaries: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("step3");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, ["step1", "step2"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of dependsOnStepIds", () => {
  const originalArray = ["step1"];
  const input = createMinimalInput({
    decisionContext: createMinimalDecisionContext({ dependsOnStepIds: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("step2");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.decisionContext.dependsOnStepIds.length, 1);
  assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, ["step1"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of completedStepIds", () => {
  const originalArray = ["step1", "step2"];
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({ completedStepIds: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("step3");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.resumeContext.completedStepIds.length, 2);
  assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["step1", "step2"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of outputKeys", () => {
  const originalArray = ["key1", "key2"];
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({ outputKeys: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("key3");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.resumeContext.outputKeys.length, 2);
  assert.deepEqual(checkpoint.resumeContext.outputKeys, ["key1", "key2"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of createdPaths", () => {
  const originalArray = ["/path1", "/path2"];
  const input = createMinimalInput({
    fileDiffSummary: createMinimalFileDiffSummary({ createdPaths: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("/path3");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.fileDiffSummary.createdPaths.length, 2);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, ["/path1", "/path2"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of updatedPaths", () => {
  const originalArray = ["/path1"];
  const input = createMinimalInput({
    fileDiffSummary: createMinimalFileDiffSummary({ updatedPaths: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("/path2");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.fileDiffSummary.updatedPaths.length, 1);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, ["/path1"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of deletedPaths", () => {
  const originalArray = ["/path1", "/path2"];
  const input = createMinimalInput({
    fileDiffSummary: createMinimalFileDiffSummary({ deletedPaths: originalArray }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push("/path3");

  // Checkpoint should be unaffected
  assert.equal(checkpoint.fileDiffSummary.deletedPaths.length, 2);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, ["/path1", "/path2"]);
});

test("createWorkflowStepCheckpoint creates defensive copy of upstreamArtifactRefs", () => {
  const originalArray = [
    { artifactId: "a1", kind: "code", uri: "file://a1", createdAt: "2026-01-01T00:00:00Z" },
  ];
  const input = createMinimalInput({ upstreamArtifactRefs: originalArray });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate original
  originalArray.push({ artifactId: "a2", kind: "code", uri: "file://a2", createdAt: "2026-01-01T00:00:00Z" });

  // Checkpoint should be unaffected
  assert.equal(checkpoint.upstreamArtifactRefs.length, 1);
  assert.equal(checkpoint.upstreamArtifactRefs[0].artifactId, "a1");
});

// ── CompensationModel Tests (issue #2030) ───────────────────────────────────────

test("createWorkflowStepCheckpoint accepts string compensationModel", () => {
  const compensationModels: CompensationModel[] = [
    "idempotent_replay",
    "compare_and_swap_write",
    "compensating_action",
    "manual_reconciliation_required",
  ];

  for (const model of compensationModels) {
    const input = createMinimalInput({ compensationModel: model });
    const checkpoint = createWorkflowStepCheckpoint(input);
    assert.equal(checkpoint.compensationModel, model, `${model} should be accepted`);
  }
});

test("createWorkflowStepCheckpoint accepts null compensationModel", () => {
  const input = createMinimalInput({ compensationModel: null });
  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.equal(checkpoint.compensationModel, null);
});

test("createWorkflowStepCheckpoint accepts undefined compensationModel (defaults to null)", () => {
  const input = createMinimalInput({ compensationModel: undefined });
  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.equal(checkpoint.compensationModel, null);
});

test("createWorkflowStepCheckpoint rejects when compensationModel is an object - issue #2030", () => {
  // Issue #2030: compensationModel type check uses typeof === "string" but actual can be object
  // The isWorkflowStepCheckpoint validation would reject objects because typeof object !== "string"

  // Create a checkpoint with object compensationModel (bypassing TypeScript type system)
  const checkpointData = {
    schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    harnessRunId: "harness_obj_comp",
    nodeRunId: "node_obj_comp",
    planGraphBundleId: "bundle_obj_comp",
    taskId: "task_obj_comp",
    executionId: "exec_obj_comp",
    workflowId: "wf_obj_comp",
    divisionId: "div_obj_comp",
    stepId: "step_obj_comp",
    roleId: "role_obj_comp",
    outputKey: "output_obj_comp",
    status: "succeeded",
    producedAt: "2026-05-01T00:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
    fileDiffSummary: {
      summary: null,
      createdPaths: [],
      updatedPaths: [],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [],
    // Object compensationModel instead of string - this violates the type but happens in practice
    compensationModel: {
      kind: "compensating_action",
      steps: [
        { action: "rollback", target: "/tmp/file.txt" },
      ],
    },
  };

  // When readWorkflowStepCheckpoint parses this, isWorkflowStepCheckpoint will return false
  // because typeof object !== "string"
  const tempDir = join(tmpdir(), "checkpoint-comp-test-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    writeFileSync(tempFile, JSON.stringify(checkpointData), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_obj_comp",
      taskId: "task_obj_comp",
      executionId: "exec_obj_comp",
      stepId: "step_obj_comp",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    // The current implementation will return null because isWorkflowStepCheckpoint rejects objects
    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null, "Object compensationModel should be rejected by current validation");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("createWorkflowStepCheckpoint accepts compensationModel as object when passed via input", () => {
  // This tests the createWorkflowStepCheckpoint function directly with an object compensationModel
  // Note: TypeScript type system would reject this, but we use unsafeCast to bypass

  const inputWithObjectComp = createMinimalInput({
    compensationModel: unsafeCast<CompensationModel | null>({
      kind: "compensating_action",
      steps: [{ action: "rollback", target: "/tmp/file.txt" }],
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(inputWithObjectComp);

  // The checkpoint should have the object compensationModel
  assert.ok(checkpoint.compensationModel !== null);
  if (typeof checkpoint.compensationModel === "object") {
    assert.equal((checkpoint.compensationModel as { kind: string }).kind, "compensating_action");
  }
});

// ── DecisionContext Tests ───────────────────────────────────────────────────────

test("createWorkflowStepCheckpoint handles decisionContext with routeReason", () => {
  const input = createMinimalInput({
    decisionContext: createMinimalDecisionContext({
      routeReason: "completed successfully",
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.equal(checkpoint.decisionContext.routeReason, "completed successfully");
});

test("createWorkflowStepCheckpoint handles decisionContext with priorStepSummaries", () => {
  const input = createMinimalInput({
    decisionContext: createMinimalDecisionContext({
      priorStepSummaries: ["step1 completed", "step2 completed"],
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, ["step1 completed", "step2 completed"]);
});

test("createWorkflowStepCheckpoint handles decisionContext with dependsOnStepIds", () => {
  const input = createMinimalInput({
    decisionContext: createMinimalDecisionContext({
      dependsOnStepIds: ["step1", "step2"],
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, ["step1", "step2"]);
});

// ── ResumeContext Tests ─────────────────────────────────────────────────────────

test("createWorkflowStepCheckpoint handles resumeContext with completedStepIds", () => {
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({
      completedStepIds: ["step1", "step2", "step3"],
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["step1", "step2", "step3"]);
});

test("createWorkflowStepCheckpoint handles resumeContext with nextStepId", () => {
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({
      nextStepId: "step_next",
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.equal(checkpoint.resumeContext.nextStepId, "step_next");
});

test("createWorkflowStepCheckpoint handles resumeContext with outputKeys", () => {
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({
      outputKeys: ["key1", "key2"],
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.deepEqual(checkpoint.resumeContext.outputKeys, ["key1", "key2"]);
});

// ── FileDiffSummary Tests ────────────────────────────────────────────────────────

test("createWorkflowStepCheckpoint handles fileDiffSummary with summary", () => {
  const input = createMinimalInput({
    fileDiffSummary: createMinimalFileDiffSummary({
      summary: "Updated 3 files",
    }),
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.equal(checkpoint.fileDiffSummary.summary, "Updated 3 files");
});

test("createWorkflowStepCheckpoint handles empty fileDiffSummary (defaults)", () => {
  const input = createMinimalInput({
    fileDiffSummary: undefined,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.equal(checkpoint.fileDiffSummary.summary, null);
  assert.deepEqual(checkpoint.fileDiffSummary.createdPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, []);
  assert.deepEqual(checkpoint.fileDiffSummary.deletedPaths, []);
});

// ── UpstreamArtifactRefs Tests ──────────────────────────────────────────────────

test("createWorkflowStepCheckpoint handles empty upstreamArtifactRefs (defaults)", () => {
  const input = createMinimalInput({
    upstreamArtifactRefs: undefined,
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  assert.deepEqual(checkpoint.upstreamArtifactRefs, []);
});

test("createWorkflowStepCheckpoint handles upstreamArtifactRefs with full data", () => {
  const artifactRefs = [
    {
      artifactId: "artifact1",
      kind: "source_code",
      uri: "file://src/artifact1.ts",
      mimeType: "text/typescript",
      sizeBytes: 1024,
      checksum: "abc123",
      createdAt: "2026-05-01T00:00:00.000Z" as const,
    },
  ];

  const input = createMinimalInput({ upstreamArtifactRefs: artifactRefs });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.equal(checkpoint.upstreamArtifactRefs.length, 1);
  assert.equal(checkpoint.upstreamArtifactRefs[0].artifactId, "artifact1");
  assert.equal(checkpoint.upstreamArtifactRefs[0].mimeType, "text/typescript");
  assert.equal(checkpoint.upstreamArtifactRefs[0].sizeBytes, 1024);
});

// ── Output Tests ───────────────────────────────────────────────────────────────

test("createWorkflowStepCheckpoint preserves output object", () => {
  const output = {
    result: "success",
    data: { nested: { key: "value" } },
    count: 42,
    flag: true,
  };

  const input = createMinimalInput({ output });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.output, output);
});

test("createWorkflowStepCheckpoint handles empty output", () => {
  const input = createMinimalInput({ output: {} });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.deepEqual(checkpoint.output, {});
});

// ── Summarize Tests ────────────────────────────────────────────────────────────

test("summarizeWorkflowStepCheckpoint extracts artifactId", () => {
  const input = createMinimalInput();
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_123", checkpoint);

  assert.equal(summary.artifactId, "artifact_123");
});

test("summarizeWorkflowStepCheckpoint extracts harnessRunId", () => {
  const input = createMinimalInput({ harnessRunId: "harness_abc" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.harnessRunId, "harness_abc");
});

test("summarizeWorkflowStepCheckpoint extracts nodeRunId", () => {
  const input = createMinimalInput({ nodeRunId: "node_xyz" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.nodeRunId, "node_xyz");
});

test("summarizeWorkflowStepCheckpoint extracts planGraphBundleId", () => {
  const input = createMinimalInput({ planGraphBundleId: "bundle_123" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.planGraphBundleId, "bundle_123");
});

test("summarizeWorkflowStepCheckpoint extracts status", () => {
  const input = createMinimalInput({ status: "failed" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.status, "failed");
});

test("summarizeWorkflowStepCheckpoint extracts producedAt", () => {
  const input = createMinimalInput({ producedAt: "2026-05-01T12:00:00.000Z" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.producedAt, "2026-05-01T12:00:00.000Z");
});

test("summarizeWorkflowStepCheckpoint extracts nextStepId", () => {
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({ nextStepId: "step_next" }),
  });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.nextStepId, "step_next");
});

test("summarizeWorkflowStepCheckpoint extracts outputKeys", () => {
  const input = createMinimalInput({
    resumeContext: createMinimalResumeContext({ outputKeys: ["key1", "key2"] }),
  });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.deepEqual(summary.outputKeys, ["key1", "key2"]);
});

test("summarizeWorkflowStepCheckpoint extracts summary from output", () => {
  const input = createMinimalInput({
    output: { summary: "This is a summary text" },
  });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.summary, "This is a summary text");
});

test("summarizeWorkflowStepCheckpoint returns null summary when output lacks summary field", () => {
  const input = createMinimalInput({
    output: { result: "success" },
  });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint returns null summary when output is empty object", () => {
  const input = createMinimalInput({ output: {} });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint returns null when summary is not a string", () => {
  const input = createMinimalInput({
    output: { summary: { nested: "object" } },
  });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.summary, null);
});

test("summarizeWorkflowStepCheckpoint extracts source from decisionContext", () => {
  const input = createMinimalInput({
    decisionContext: createMinimalDecisionContext({ source: "planner_v3" }),
  });
  const checkpoint = createWorkflowStepCheckpoint(input);

  const summary = summarizeWorkflowStepCheckpoint("artifact_1", checkpoint);

  assert.equal(summary.source, "planner_v3");
});

// ── readWorkflowStepCheckpoint Tests ──────────────────────────────────────────

test("readWorkflowStepCheckpoint returns null for non-workflow_step_snapshot kind", () => {
  const artifactRecord: ArtifactRecord = {
    artifactId: "artifact_wrong_kind",
    taskId: "task_test",
    executionId: "exec_test",
    stepId: "step_test",
    kind: "source_code", // Wrong kind
    storagePath: "/tmp/test.ts",
    fileName: "test.ts",
    mimeType: "text/typescript",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("readWorkflowStepCheckpoint returns null for non-existent file", () => {
  const artifactRecord: ArtifactRecord = {
    artifactId: "artifact_missing",
    taskId: "task_test",
    executionId: "exec_test",
    stepId: "step_test",
    kind: "workflow_step_snapshot",
    storagePath: "/nonexistent/path/checkpoint.json",
    fileName: "checkpoint.json",
    mimeType: "application/json",
    sizeBytes: 100,
    checksum: null,
    lineageJson: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  const result = readWorkflowStepCheckpoint(artifactRecord);
  assert.equal(result, null);
});

test("readWorkflowStepCheckpoint returns null for invalid JSON", () => {
  const tempDir = join(tmpdir(), "checkpoint-invalid-json-test-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "invalid.json");

  try {
    writeFileSync(tempFile, "not valid json {", "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_invalid",
      taskId: "task_test",
      executionId: "exec_test",
      stepId: "step_test",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "invalid.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("readWorkflowStepCheckpoint parses valid checkpoint with string compensationModel", () => {
  const tempDir = join(tmpdir(), "checkpoint-valid-string-comp-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    const checkpointData = {
      schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
      harnessRunId: "harness_valid",
      nodeRunId: "node_valid",
      planGraphBundleId: "bundle_valid",
      taskId: "task_valid",
      executionId: "exec_valid",
      workflowId: "wf_valid",
      divisionId: "div_valid",
      stepId: "step_valid",
      roleId: "role_valid",
      outputKey: "output_valid",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: { result: "success" },
      decisionContext: {
        source: "test",
        request: "test",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: [],
        nextStepId: null,
        outputKeys: [],
      },
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: "idempotent_replay",
    };

    writeFileSync(tempFile, JSON.stringify(checkpointData), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_valid",
      taskId: "task_valid",
      executionId: "exec_valid",
      stepId: "step_valid",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);

    assert.ok(result !== null);
    assert.equal(result!.taskId, "task_valid");
    assert.equal(result!.compensationModel, "idempotent_replay");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("readWorkflowStepCheckpoint returns null when compensationModel is invalid type", () => {
  // This test demonstrates issue #2030: when compensationModel is an object,
  // readWorkflowStepCheckpoint returns null because the validation rejects it

  const tempDir = join(tmpdir(), "checkpoint-invalid-comp-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    const checkpointData = {
      schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
      harnessRunId: "harness_invalid",
      nodeRunId: "node_invalid",
      planGraphBundleId: "bundle_invalid",
      taskId: "task_invalid",
      executionId: "exec_invalid",
      workflowId: "wf_invalid",
      divisionId: "div_invalid",
      stepId: "step_invalid",
      roleId: "role_invalid",
      outputKey: "output_invalid",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: {},
      decisionContext: {
        source: "test",
        request: "test",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: [],
        nextStepId: null,
        outputKeys: [],
      },
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      // Invalid: object instead of string
      compensationModel: { kind: "test", steps: [] },
    };

    writeFileSync(tempFile, JSON.stringify(checkpointData), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_invalid",
      taskId: "task_invalid",
      executionId: "exec_invalid",
      stepId: "step_invalid",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);

    // Current behavior: validation fails because typeof object !== "string"
    assert.equal(result, null, "Object compensationModel should be rejected");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("readWorkflowStepCheckpoint returns null for missing schema version", () => {
  const tempDir = join(tmpdir(), "checkpoint-missing-schema-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    const checkpointData = {
      // Missing schemaVersion
      harnessRunId: "harness_no_schema",
      nodeRunId: "node_no_schema",
      planGraphBundleId: "bundle_no_schema",
      taskId: "task_no_schema",
      executionId: "exec_no_schema",
      workflowId: "wf_no_schema",
      divisionId: "div_no_schema",
      stepId: "step_no_schema",
      roleId: "role_no_schema",
      outputKey: "output_no_schema",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: {},
      decisionContext: {
        source: "test",
        request: "test",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: [],
        nextStepId: null,
        outputKeys: [],
      },
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    };

    writeFileSync(tempFile, JSON.stringify(checkpointData), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_no_schema",
      taskId: "task_no_schema",
      executionId: "exec_no_schema",
      stepId: "step_no_schema",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("readWorkflowStepCheckpoint returns null for wrong schema version", () => {
  const tempDir = join(tmpdir(), "checkpoint-wrong-schema-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    const checkpointData = {
      schemaVersion: "wrong_schema.v1",
      harnessRunId: "harness_wrong",
      nodeRunId: "node_wrong",
      planGraphBundleId: "bundle_wrong",
      taskId: "task_wrong",
      executionId: "exec_wrong",
      workflowId: "wf_wrong",
      divisionId: "div_wrong",
      stepId: "step_wrong",
      roleId: "role_wrong",
      outputKey: "output_wrong",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: {},
      decisionContext: {
        source: "test",
        request: "test",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: [],
        nextStepId: null,
        outputKeys: [],
      },
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    };

    writeFileSync(tempFile, JSON.stringify(checkpointData), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_wrong",
      taskId: "task_wrong",
      executionId: "exec_wrong",
      stepId: "step_wrong",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("readWorkflowStepCheckpoint returns null when output is array instead of object", () => {
  const tempDir = join(tmpdir(), "checkpoint-array-output-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    const checkpointData = {
      schemaVersion: WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
      harnessRunId: "harness_array",
      nodeRunId: "node_array",
      planGraphBundleId: "bundle_array",
      taskId: "task_array",
      executionId: "exec_array",
      workflowId: "wf_array",
      divisionId: "div_array",
      stepId: "step_array",
      roleId: "role_array",
      outputKey: "output_array",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: [], // Invalid: should be object
      decisionContext: {
        source: "test",
        request: "test",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: [],
        nextStepId: null,
        outputKeys: [],
      },
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    };

    writeFileSync(tempFile, JSON.stringify(checkpointData), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_array",
      taskId: "task_array",
      executionId: "exec_array",
      stepId: "step_array",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── Schema Version Constants ───────────────────────────────────────────────────

test("WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION is correct value", () => {
  assert.equal(WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION, "workflow_step_checkpoint.v1");
});
