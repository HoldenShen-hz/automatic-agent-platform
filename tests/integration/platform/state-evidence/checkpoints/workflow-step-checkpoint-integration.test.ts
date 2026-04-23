/**
 * Integration Test: Workflow Step Checkpoint
 *
 * Tests workflow step checkpoint creation, storage, and retrieval
 * using SQLite, temporary workspaces, and the checkpoint envelope.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  getEnvelopeCompressionRatio,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
} from "../../../../../src/platform/state-evidence/checkpoints/checkpoint-envelope.js";
import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  type WorkflowStepCheckpoint,
  type WorkflowStepCheckpointSummary,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

test("integration: workflow step checkpoint creation with full decision and resume context", () => {
  const ctx = createSeededIntegrationContext("aa-wf-checkpoint-");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      taskId: ctx.store.getTask("task-seeded-001")!.id,
      executionId: ctx.store.getExecution("exec-seeded-001")?.id ?? null,
      workflowId: "single_agent_minimal",
      divisionId: "general_ops",
      stepId: "step_decision",
      roleId: "general_executor",
      outputKey: "decision_result",
      status: "succeeded",
      producedAt: nowIso(),
      output: { decision: "proceed", confidence: 0.95 },
      decisionContext: {
        source: "model_response",
        request: "Should I proceed with the task?",
        routeReason: "User requested task execution",
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: ["step_start"],
        nextStepId: "step_execute",
        outputKeys: ["decision_result"],
      },
      fileDiffSummary: {
        summary: "Modified 2 files",
        createdPaths: [],
        updatedPaths: ["/workspace/src/main.ts", "/workspace/src/config.ts"],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    });

    assert.equal(checkpoint.schemaVersion, "workflow_step_checkpoint.v1");
    assert.equal(checkpoint.stepId, "step_decision");
    assert.equal(checkpoint.outputKey, "decision_result");
    assert.deepEqual(checkpoint.output, { decision: "proceed", confidence: 0.95 });
    assert.deepEqual(checkpoint.decisionContext.routeReason, "User requested task execution");
    assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["step_start"]);
    assert.deepEqual(checkpoint.fileDiffSummary.updatedPaths, ["/workspace/src/main.ts", "/workspace/src/config.ts"]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: workflow step checkpoint preserves arrays and nested objects", () => {
  const ctx = createSeededIntegrationContext("aa-wf-checkpoint-arrays-");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      taskId: ctx.store.getTask("task-seeded-001")!.id,
      executionId: ctx.store.getExecution("exec-seeded-001")?.id ?? null,
      workflowId: "multi_step_workflow",
      divisionId: "coding_ops",
      stepId: "step_loop",
      roleId: "code_reviewer",
      outputKey: "review_results",
      status: "succeeded",
      producedAt: nowIso(),
      output: {
        findings: [
          { severity: "high", file: "src/auth.ts", issue: "Missing null check" },
          { severity: "medium", file: "src/db.ts", issue: "Connection pool size" },
        ],
      },
      decisionContext: {
        source: "automated_review",
        request: "Review all changed files",
        routeReason: "PR requires review",
        priorStepSummaries: ["step_lint: 0 errors", "step_test: 1 failure"],
        dependsOnStepIds: ["step_lint", "step_test"],
      },
      resumeContext: {
        completedStepIds: ["step_lint", "step_test", "step_loop"],
        nextStepId: null,
        outputKeys: ["review_results", "lint_summary", "test_summary"],
      },
      fileDiffSummary: {
        summary: "Found 2 issues",
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
    });

    // Verify arrays are preserved (not references)
    assert.ok(Array.isArray(checkpoint.decisionContext.priorStepSummaries));
    assert.ok(Array.isArray(checkpoint.decisionContext.dependsOnStepIds));
    assert.ok(Array.isArray(checkpoint.resumeContext.outputKeys));
    assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 2);
    assert.equal(checkpoint.decisionContext.dependsOnStepIds[0], "step_lint");

    // Verify nested arrays in output
    const outputFindings = checkpoint.output.findings as Array<{ severity: string; file: string; issue: string }>;
    assert.ok(Array.isArray(outputFindings));
    assert.equal(outputFindings.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("integration: workflow step checkpoint summary extracts key fields", () => {
  const ctx = createSeededIntegrationContext("aa-wf-checkpoint-summary-");
  try {
    const artifactId = newId("artifact");

    // Create checkpoint
    const checkpoint = createWorkflowStepCheckpoint({
      taskId: ctx.store.getTask("task-seeded-001")!.id,
      executionId: ctx.store.getExecution("exec-seeded-001")?.id ?? null,
      workflowId: "single_agent_minimal",
      divisionId: "general_ops",
      stepId: "step_summary_test",
      roleId: "general_executor",
      outputKey: "summary_output",
      status: "succeeded",
      producedAt: nowIso(),
      output: { result: "test output with lots of content that should be summarized" },
      decisionContext: {
        source: "test",
        request: "Test request",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: [],
        nextStepId: "next_step",
        outputKeys: ["summary_output", "other_output"],
      },
    });

    // Create artifact record for the checkpoint
    ctx.db.connection
      .prepare(
        `INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        artifactId,
        ctx.store.getTask("task-seeded-001")!.id,
        ctx.store.getExecution("exec-seeded-001")?.id ?? null,
        "step_summary_test",
        "workflow_step_snapshot",
        "/tmp/checkpoint.json",
        "checkpoint.json",
        "application/json",
        1024,
        "sha256:test",
        null,
        nowIso(),
      );

    const artifactRecord = ctx.db.connection
      .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .get(artifactId) as { artifact_id: string; kind: string; storage_path: string } | undefined;

    assert.ok(artifactRecord, "Artifact should exist");

    const summary = summarizeWorkflowStepCheckpoint(artifactId, checkpoint);
    assert.equal(summary.stepId, "step_summary_test");
    assert.equal(summary.workflowId, "single_agent_minimal");
    assert.equal(summary.nextStepId, "next_step");
    assert.deepEqual(summary.outputKeys, ["summary_output", "other_output"]);
    assert.equal(summary.status, "succeeded");
  } finally {
    ctx.cleanup();
  }
});

test("integration: checkpoint envelope wraps checkpoint data with compression", async () => {
  const workspace = createTempWorkspace("aa-checkpoint-env-wrap-");
  try {
    const checkpoint: WorkflowStepCheckpoint = {
      schemaVersion: "workflow_step_checkpoint.v1",
      taskId: "task_checkpoint_env",
      executionId: "exec_checkpoint_env",
      workflowId: "test_workflow",
      divisionId: "general_ops",
      stepId: "step_envelope",
      roleId: "executor",
      outputKey: "output",
      status: "succeeded",
      producedAt: nowIso(),
      output: { result: "checkpoint output data" },
      decisionContext: {
        source: "test",
        request: "test request",
        routeReason: null,
        priorStepSummaries: ["prior step 1", "prior step 2"],
        dependsOnStepIds: ["step_1", "step_2"],
      },
      resumeContext: {
        completedStepIds: ["step_1", "step_2"],
        nextStepId: null,
        outputKeys: ["output"],
      },
      fileDiffSummary: {
        summary: "files changed",
        createdPaths: ["/workspace/new.ts"],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    };

    const envelope = await createCheckpointEnvelope(checkpoint, "workflow_step_checkpoint.v1");

    assert.equal(envelope.version, "checkpoint_envelope.v1");
    assert.equal(envelope.schema, "workflow_step_checkpoint.v1");
    assert.ok(envelope.payload.length > 0, "Payload should be base64 encoded");
    assert.equal(envelope.metadata.algorithm, "gzip");
    assert.ok(envelope.metadata.originalSizeBytes > 0, "Should track original size");
    assert.ok(envelope.metadata.compressedSizeBytes > 0, "Should track compressed size");
    assert.ok(envelope.metadata.compressedSizeBytes <= envelope.metadata.originalSizeBytes, "Compressed should be smaller or equal");
    assert.ok(envelope.metadata.checksum.length > 0, "Should have checksum");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: checkpoint envelope unwraps and restores original checkpoint data", async () => {
  const workspace = createTempWorkspace("aa-checkpoint-env-unwrap-");
  try {
    const checkpoint: WorkflowStepCheckpoint = {
      schemaVersion: "workflow_step_checkpoint.v1",
      taskId: "task_unwrap",
      executionId: "exec_unwrap",
      workflowId: "unwrap_workflow",
      divisionId: "ops",
      stepId: "step_unwrap",
      roleId: "worker",
      outputKey: "result",
      status: "succeeded",
      producedAt: nowIso(),
      output: { pausedState: true, checkpointStep: 3 },
      decisionContext: {
        source: "pause_handler",
        request: "Pause at checkpoint",
        routeReason: "User requested pause",
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: ["step_1", "step_2", "step_3"],
        nextStepId: "step_4",
        outputKeys: ["result"],
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

    const envelope = await createCheckpointEnvelope(checkpoint, "workflow_step_checkpoint.v1");
    const unpacked = await unpackCheckpointEnvelope<WorkflowStepCheckpoint>(envelope);

    assert.equal(unpacked.data.taskId, "task_unwrap");
    assert.equal(unpacked.data.executionId, "exec_unwrap");
    assert.equal(unpacked.data.stepId, "step_unwrap");
    assert.equal(unpacked.data.status, "paused");
    assert.deepEqual(unpacked.data.output, { pausedState: true, checkpointStep: 3 });
    assert.equal(unpacked.data.resumeContext.nextStepId, "step_4");
    assert.equal(unpacked.wasCompressed, true);
    assert.equal(unpacked.metadata.algorithm, "gzip");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: checkpoint envelope compression ratio is calculated correctly", async () => {
  const workspace = createTempWorkspace("aa-checkpoint-ratio-calc-");
  try {
    // Highly compressible data (repeated content)
    const compressibleCheckpoint: WorkflowStepCheckpoint = {
      schemaVersion: "workflow_step_checkpoint.v1",
      taskId: "task_compress",
      executionId: "exec_compress",
      workflowId: "compress_workflow",
      divisionId: "ops",
      stepId: "step_compress",
      roleId: "worker",
      outputKey: "result",
      status: "succeeded",
      producedAt: nowIso(),
      output: { data: "A".repeat(1000) },
      decisionContext: {
        source: "test",
        request: "A".repeat(500),
        routeReason: null,
        priorStepSummaries: ["A".repeat(200), "B".repeat(200)],
        dependsOnStepIds: ["step_a", "step_b"],
      },
      resumeContext: {
        completedStepIds: ["step_a", "step_b"],
        nextStepId: null,
        outputKeys: ["result"],
      },
      fileDiffSummary: {
        summary: "A".repeat(100),
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [],
      compensationModel: null,
    };

    const envelope = await createCheckpointEnvelope(compressibleCheckpoint, "workflow_step_checkpoint.v1");
    const ratio = getEnvelopeCompressionRatio(envelope);

    assert.ok(ratio > 0 && ratio < 1, "Compression ratio should be between 0 and 1 for compressible data");
    assert.ok(envelope.metadata.compressedSizeBytes < envelope.metadata.originalSizeBytes, "Compressed should be smaller");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: checkpoint envelope rejects data exceeding size limit", async () => {
  const workspace = createTempWorkspace("aa-checkpoint-size-limit-");
  try {
    const largeCheckpoint: WorkflowStepCheckpoint = {
      schemaVersion: "workflow_step_checkpoint.v1",
      taskId: "task_large",
      executionId: "exec_large",
      workflowId: "large_workflow",
      divisionId: "ops",
      stepId: "step_large",
      roleId: "worker",
      outputKey: "result",
      status: "succeeded",
      producedAt: nowIso(),
      output: { data: "x".repeat(11 * 1024 * 1024) }, // > 10MB
      decisionContext: {
        source: "test",
        request: "large request",
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

    await assert.rejects(
      async () => createCheckpointEnvelope(largeCheckpoint, "workflow_step_checkpoint.v1", { maxSizeBytes: 10 * 1024 * 1024 }),
      (err: Error) => err.message.includes("exceeds maximum"),
      "Should reject checkpoint exceeding size limit",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: get envelope original and compressed sizes work correctly", async () => {
  const workspace = createTempWorkspace("aa-checkpoint-sizes-");
  try {
    const checkpoint: WorkflowStepCheckpoint = {
      schemaVersion: "workflow_step_checkpoint.v1",
      taskId: "task_sizes",
      executionId: "exec_sizes",
      workflowId: "sizes_workflow",
      divisionId: "ops",
      stepId: "step_sizes",
      roleId: "worker",
      outputKey: "result",
      status: "succeeded",
      producedAt: nowIso(),
      output: { data: "test data for size checking" },
      decisionContext: {
        source: "test",
        request: "test request",
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

    const envelope = await createCheckpointEnvelope(checkpoint, "workflow_step_checkpoint.v1");

    const originalSize = getEnvelopeOriginalSize(envelope);
    const compressedSize = getEnvelopeCompressedSize(envelope);

    assert.ok(originalSize > 0, "Original size should be positive");
    assert.ok(compressedSize > 0, "Compressed size should be positive");
    assert.equal(originalSize, envelope.metadata.originalSizeBytes);
    assert.equal(compressedSize, envelope.metadata.compressedSizeBytes);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: checkpoint artifact can be stored and retrieved from database", () => {
  const ctx = createSeededIntegrationContext("aa-checkpoint-artifact-");
  try {
    const artifactId = newId("artifact");
    const taskId = ctx.store.getTask("task-seeded-001")!.id;
    const executionId = ctx.store.getExecution("exec-seeded-001")?.id ?? null;

    ctx.db.connection
      .prepare(
        `INSERT INTO artifacts (artifact_id, task_id, execution_id, step_id, kind, storage_path, file_name, mime_type, size_bytes, checksum, lineage_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        artifactId,
        taskId,
        executionId,
        "step_checkpoint_artifact",
        "workflow_step_snapshot",
        "/workspace/.checkpoints/step_checkpoint_artifact.json",
        "step_checkpoint_artifact.json",
        "application/json",
        2048,
        "sha256:abc123",
        JSON.stringify({ parentArtifactId: null }),
        nowIso(),
      );

    const artifact = ctx.db.connection
      .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .get(artifactId) as { artifact_id: string; task_id: string; execution_id: string | null; step_id: string; kind: string; size_bytes: number } | undefined;

    assert.ok(artifact, "Artifact should exist after insert");
    assert.equal(artifact!.artifact_id, artifactId);
    assert.equal(artifact!.task_id, taskId);
    assert.equal(artifact!.execution_id, executionId);
    assert.equal(artifact!.step_id, "step_checkpoint_artifact");
    assert.equal(artifact!.kind, "workflow_step_snapshot");
    assert.equal(artifact!.size_bytes, 2048);
  } finally {
    ctx.cleanup();
  }
});

test("integration: checkpoint with upstream artifact references", () => {
  const ctx = createSeededIntegrationContext("aa-checkpoint-artifact-refs-");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      taskId: ctx.store.getTask("task-seeded-001")!.id,
      executionId: ctx.store.getExecution("exec-seeded-001")?.id ?? null,
      workflowId: "multi_step_workflow",
      divisionId: "coding_ops",
      stepId: "step_with_artifacts",
      roleId: "code_reviewer",
      outputKey: "review_output",
      status: "succeeded",
      producedAt: nowIso(),
      output: { findings: [] },
      decisionContext: {
        source: "test",
        request: "Review artifacts",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: ["step_parse", "step_analyze"],
        nextStepId: null,
        outputKeys: ["review_output"],
      },
      upstreamArtifactRefs: [
        { artifactId: "artifact_lint_output", kind: "lint_report", uri: "memory://artifacts/lint" },
        { artifactId: "artifact_test_output", kind: "test_report", uri: "memory://artifacts/test" },
      ],
    });

    assert.ok(checkpoint.upstreamArtifactRefs.length === 2);
    assert.equal(checkpoint.upstreamArtifactRefs[0].artifactId, "artifact_lint_output");
    assert.equal(checkpoint.upstreamArtifactRefs[0].kind, "lint_report");
    assert.equal(checkpoint.upstreamArtifactRefs[1].artifactId, "artifact_test_output");
  } finally {
    ctx.cleanup();
  }
});
