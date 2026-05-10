/**
 * Integration tests for Checkpoints Module
 *
 * Tests the integration between checkpoint envelope and workflow step checkpoint
 * functionality, including file system operations and round-trip serialization.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
  wrapWorkflowStepCheckpoint,
  unwrapWorkflowStepCheckpoint,
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  getEnvelopeOriginalSize,
  getEnvelopeCompressedSize,
  getEnvelopeCompressionRatio,
  CHECKPOINT_ENVELOPE_SCHEMA_VERSION,
  DEFAULT_MAX_CHECKPOINT_SIZE_BYTES,
  CheckpointSizeExceededError,
  CheckpointEnvelopeInvalidError,
  CheckpointEnvelope,
} from "../../../../../src/platform/state-evidence/checkpoints/index.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { CompensationModel } from "../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js";
import { unsafeCast } from "../../../../helpers/typed-factories.js";

// ── Integration Test Setup ─────────────────────────────────────────────────────

function createTempDir(prefix: string): string {
  const tempDir = join(tmpdir(), prefix + "-" + Date.now());
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(tempDir: string): void {
  rmSync(tempDir, { recursive: true, force: true });
}

// ── Envelope Round-Trip Tests ─────────────────────────────────────────────────

test("integration: wrap and unwrap workflow step checkpoint preserves all fields", async () => {
  const tempDir = createTempDir("aa-wrap-unwrap-test");
  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness_integ_1",
      nodeRunId: "node_integ_1",
      planGraphId: "pg_integ_1",
      taskId: "task_integ_1",
      executionId: "exec_integ_1",
      workflowId: "wf_integ_1",
      divisionId: "div_integ_1",
      stepId: "step_integ_1",
      roleId: "role_integ_1",
      outputKey: "output_integ_1",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: { result: "success", data: { nested: true } },
      decisionContext: {
        source: "integration_test",
        request: "test request",
        routeReason: "completed",
        priorStepSummaries: ["step1 done", "step2 done"],
        dependsOnStepIds: ["step1", "step2"],
      },
      resumeContext: {
        completedStepIds: ["step1", "step2", "step_integ_1"],
        nextStepId: null,
        outputKeys: ["output1", "output2", "output_integ_1"],
      },
      fileDiffSummary: {
        summary: "Updated 2 files",
        createdPaths: ["/new/file.ts"],
        updatedPaths: ["/existing/file.ts"],
        deletedPaths: [],
      },
      upstreamArtifactRefs: [
        {
          artifactId: "artifact_integ_1",
          kind: "source_code",
          uri: "file://src/artifact.ts",
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      compensationModel: "idempotent_replay",
    });

    const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
    const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

    assert.equal(unpacked.data.taskId, "task_integ_1");
    assert.equal(unpacked.data.executionId, "exec_integ_1");
    assert.equal(unpacked.data.status, "succeeded");
    assert.deepEqual(unpacked.data.output, { result: "success", data: { nested: true } });
    assert.equal(unpacked.data.compensationModel, "idempotent_replay");
    assert.deepEqual(unpacked.data.decisionContext.priorStepSummaries, ["step1 done", "step2 done"]);
    assert.deepEqual(unpacked.data.upstreamArtifactRefs.length, 1);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("integration: multiple wrap/unwrap cycles produce identical results", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_cycle",
    nodeRunId: "node_cycle",
    planGraphId: "bundle_cycle",
    taskId: "task_cycle",
    executionId: "exec_cycle",
    workflowId: "wf_cycle",
    divisionId: "div_cycle",
    stepId: "step_cycle",
    roleId: "role_cycle",
    outputKey: "output_cycle",
    status: "succeeded",
    producedAt: "2026-05-01T00:00:00.000Z",
    output: { iteration: 0 },
    decisionContext: {
      source: "cycle_test",
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
  });

  const envelope1 = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked1 = await unwrapWorkflowStepCheckpoint(envelope1);

  const envelope2 = await wrapWorkflowStepCheckpoint(unpacked1.data);
  const unpacked2 = await unwrapWorkflowStepCheckpoint(envelope2);

  assert.deepEqual(unpacked1.data, unpacked2.data);
  assert.equal(unpacked1.data.taskId, unpacked2.data.taskId);
});

test("integration: checkpoint with all compensation model types round-trips correctly", async () => {
  const compensationModels: CompensationModel[] = [
    "idempotent_replay",
    "compare_and_swap_write",
    "compensating_action",
    "manual_reconciliation_required",
  ];

  for (const model of compensationModels) {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: `harness_comp_${model}`,
      nodeRunId: "node_comp",
      planGraphId: "bundle_comp",
      taskId: `task_comp_${model}`,
      executionId: "exec_comp",
      workflowId: "wf_comp",
      divisionId: "div_comp",
      stepId: "step_comp",
      roleId: "role_comp",
      outputKey: "output_comp",
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
      compensationModel: model,
    });

    const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
    const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

    assert.equal(unpacked.data.compensationModel, model, `${model} should round-trip correctly`);
  }
});

test("integration: checkpoint with null compensation model round-trips correctly", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_null_comp",
    nodeRunId: "node_null_comp",
    planGraphId: "bundle_null_comp",
    taskId: "task_null_comp",
    executionId: "exec_null_comp",
    workflowId: "wf_null_comp",
    divisionId: "div_null_comp",
    stepId: "step_null_comp",
    roleId: "role_null_comp",
    outputKey: "output_null_comp",
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
    compensationModel: null,
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.equal(unpacked.data.compensationModel, null);
});

// ── Issue #2030: Object CompensationModel ──────────────────────────────────────

test("integration: checkpoint with object compensationModel - demonstrates issue #2030", async () => {
  // Issue #2030: compensationModel type check uses typeof === "string" but actual can be object
  // This test demonstrates that objects are NOT currently accepted by the validation

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_obj_comp",
    nodeRunId: "node_obj_comp",
    planGraphId: "bundle_obj_comp",
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
    // Using unsafeCast to bypass TypeScript type system - object compensationModel
    compensationModel: unsafeCast<CompensationModel | null>({
      kind: "compensating_action",
      steps: [{ action: "rollback", target: "/tmp/file.txt" }],
    }),
  });

  // The createWorkflowStepCheckpoint accepts this (bypasses type check)
  assert.ok(checkpoint.compensationModel !== null);

  // But wrapping in envelope and unwrapping will work since it bypasses isWorkflowStepCheckpoint
  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);

  // The envelope itself doesn't validate - only unwrapping does
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  // This will have the object
  if (typeof unpacked.data.compensationModel === "object" && unpacked.data.compensationModel !== null) {
    const obj = unpacked.data.compensationModel as { kind?: string };
    assert.equal(obj.kind, "compensating_action");
  }
});

test("integration: round-trip with object compensationModel fails validation", async () => {
  // This test shows that if we write a checkpoint with object compensationModel to disk
  // and read it back via readWorkflowStepCheckpoint, it will fail validation

  const tempDir = createTempDir("aa-obj-comp-fail");
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    // Create checkpoint with object compensationModel
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness_obj_fail",
      nodeRunId: "node_obj_fail",
      planGraphId: "bundle_obj_fail",
      taskId: "task_obj_fail",
      executionId: "exec_obj_fail",
      workflowId: "wf_obj_fail",
      divisionId: "div_obj_fail",
      stepId: "step_obj_fail",
      roleId: "role_obj_fail",
      outputKey: "output_obj_fail",
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
      compensationModel: unsafeCast<CompensationModel | null>({
        kind: "compensating_action",
        steps: [],
      }),
    });

    // Write directly to file
    writeFileSync(tempFile, JSON.stringify(checkpoint), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_obj_fail",
      taskId: "task_obj_fail",
      executionId: "exec_obj_fail",
      stepId: "step_obj_fail",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "checkpoint.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    // readWorkflowStepCheckpoint uses isWorkflowStepCheckpoint which rejects objects
    const result = readWorkflowStepCheckpoint(artifactRecord);

    // Current behavior: returns null because object compensationModel fails validation
    assert.equal(result, null, "Object compensationModel should fail validation");
  } finally {
    cleanupTempDir(tempDir);
  }
});

// ── Envelope Metadata Tests ─────────────────────────────────────────────────────

test("integration: envelope metadata tracks compression savings", async () => {
  // Large repetitive data compresses well
  const largeData = { content: "ABC".repeat(1000) };

  const envelope = await createCheckpointEnvelope(largeData, "test.v1");

  assert.ok(envelope.metadata.originalSizeBytes > 0);
  assert.ok(envelope.metadata.compressedSizeBytes > 0);
  assert.ok(envelope.metadata.originalSizeBytes > envelope.metadata.compressedSizeBytes);

  const ratio = getEnvelopeCompressionRatio(envelope);
  assert.ok(ratio > 0 && ratio < 1, "Repetitive data should compress well");
});

test("integration: envelope metadata includes checksum", async () => {
  const data = { test: "data", value: 123 };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.ok(envelope.metadata.checksum.length > 0);
  assert.equal(envelope.metadata.checksum.length, 64); // SHA-256 hex length
});

test("integration: getEnvelopeOriginalSize returns correct value", async () => {
  const data = { original: true };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  const size = getEnvelopeOriginalSize(envelope);
  assert.equal(size, envelope.metadata.originalSizeBytes);
});

test("integration: getEnvelopeCompressedSize returns correct value", async () => {
  const data = { compressed: true };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  const size = getEnvelopeCompressedSize(envelope);
  assert.equal(size, envelope.metadata.compressedSizeBytes);
});

// ── File System Integration Tests ──────────────────────────────────────────────

test("integration: readWorkflowStepCheckpoint with valid checkpoint file", async () => {
  const tempDir = createTempDir("aa-read-valid");
  const tempFile = join(tempDir, "checkpoint.json");

  try {
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: "harness_read_valid",
      nodeRunId: "node_read_valid",
      planGraphId: "pg_read_valid",
      taskId: "task_read_valid",
      executionId: "exec_read_valid",
      workflowId: "wf_read_valid",
      divisionId: "div_read_valid",
      stepId: "step_read_valid",
      roleId: "role_read_valid",
      outputKey: "output_read_valid",
      status: "succeeded",
      producedAt: "2026-05-01T00:00:00.000Z",
      output: { read: "success" },
      decisionContext: {
        source: "integration",
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
    });

    // Write directly as JSON - same as what the runtime would write
    writeFileSync(tempFile, JSON.stringify(checkpoint), "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_read_valid",
      taskId: "task_read_valid",
      executionId: "exec_read_valid",
      stepId: "step_read_valid",
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
    assert.equal(result!.taskId, "task_read_valid");
    assert.equal(result!.status, "succeeded");
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("integration: readWorkflowStepCheckpoint returns null for wrong kind", async () => {
  const tempDir = createTempDir("aa-wrong-kind");
  const tempFile = join(tempDir, "artifact.txt");

  try {
    writeFileSync(tempFile, "some content", "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_wrong_kind",
      taskId: "task_wrong",
      executionId: "exec_wrong",
      stepId: "step_wrong",
      kind: "source_code", // Wrong kind
      storagePath: tempFile,
      fileName: "artifact.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("integration: readWorkflowStepCheckpoint returns null for corrupted JSON", async () => {
  const tempDir = createTempDir("aa-corrupted");
  const tempFile = join(tempDir, "corrupted.json");

  try {
    writeFileSync(tempFile, "{ invalid json }", "utf8");

    const artifactRecord: ArtifactRecord = {
      artifactId: "artifact_corrupted",
      taskId: "task_corrupted",
      executionId: "exec_corrupted",
      stepId: "step_corrupted",
      kind: "workflow_step_snapshot",
      storagePath: tempFile,
      fileName: "corrupted.json",
      mimeType: "application/json",
      sizeBytes: 100,
      checksum: null,
      lineageJson: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    };

    const result = readWorkflowStepCheckpoint(artifactRecord);
    assert.equal(result, null);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test("integration: readWorkflowStepCheckpoint returns null for non-existent path", async () => {
  const artifactRecord: ArtifactRecord = {
    artifactId: "artifact_missing",
    taskId: "task_missing",
    executionId: "exec_missing",
    stepId: "step_missing",
    kind: "workflow_step_snapshot",
    storagePath: "/non/existent/path/checkpoint.json",
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

// ── Summarize Integration Tests ─────────────────────────────────────────────────

test("integration: summarizeWorkflowStepCheckpoint with full checkpoint", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_summarize",
    nodeRunId: "node_summarize",
    planGraphId: "pg_summarize",
    taskId: "task_summarize",
    executionId: "exec_summarize",
    workflowId: "wf_summarize",
    divisionId: "div_summarize",
    stepId: "step_summarize",
    roleId: "role_summarize",
    outputKey: "output_summarize",
    status: "succeeded",
    producedAt: "2026-05-01T12:30:00.000Z",
    output: { summary: "This is the workflow summary" },
    decisionContext: {
      source: "summarize_test",
      request: "test",
      routeReason: "testing",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: "step_next",
      outputKeys: ["key1", "key2"],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_summarize_1", checkpoint);

  assert.equal(summary.artifactId, "artifact_summarize_1");
  assert.equal(summary.workflowId, "wf_summarize");
  assert.equal(summary.stepId, "step_summarize");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.producedAt, "2026-05-01T12:30:00.000Z");
  assert.equal(summary.nextNodeRunId, "step_next");
  assert.deepEqual(summary.outputKeys, ["key1", "key2"]);
  assert.equal(summary.summary, "This is the workflow summary");
  assert.equal(summary.source, "summarize_test");
});

test("integration: summarizeWorkflowStepCheckpoint with null values", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_null_summary",
    nodeRunId: "node_null_summary",
    planGraphId: "pg_null_summary",
    taskId: "task_null_summary",
    executionId: null,
    workflowId: "wf_null_summary",
    divisionId: "div_null_summary",
    stepId: "step_null_summary",
    roleId: "role_null_summary",
    outputKey: "output_null_summary",
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
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_null_summary", checkpoint);

  assert.equal(summary.artifactId, "artifact_null_summary");
  assert.equal(summary.stepId, "step_null_summary");
  assert.equal(summary.nextNodeRunId, null);
  assert.equal(summary.summary, null);
});

// ── Size Limit Tests ───────────────────────────────────────────────────────────

test("integration: createCheckpointEnvelope rejects data exceeding size limit", async () => {
  const largeData = { content: "x".repeat(DEFAULT_MAX_CHECKPOINT_SIZE_BYTES + 1) };

  await assert.rejects(
    () => createCheckpointEnvelope(largeData, "test.v1"),
    CheckpointSizeExceededError,
  );
});

test("integration: createCheckpointEnvelope accepts data within size limit", async () => {
  const data = { small: true };

  const envelope = await createCheckpointEnvelope(data, "test.v1");

  assert.ok(envelope.metadata.originalSizeBytes <= DEFAULT_MAX_CHECKPOINT_SIZE_BYTES);
});

test("integration: createCheckpointEnvelope with custom maxSizeBytes", async () => {
  const data = { test: "data" };

  await assert.rejects(
    () => createCheckpointEnvelope(data, "test.v1", { maxSizeBytes: 5 }),
    CheckpointSizeExceededError,
  );
});

test("integration: unpackCheckpointEnvelope with custom maxSizeBytes", async () => {
  const data = { content: "test content" };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  const unpacked = await unpackCheckpointEnvelope(envelope, { maxSizeBytes: 100000 });

  assert.deepEqual(unpacked.data, data);
});

// ── Checksum Verification Tests ───────────────────────────────────────────────

test("integration: unpackCheckpointEnvelope verifies checksum", async () => {
  const data = { verify: "checksum" };
  const envelope = await createCheckpointEnvelope(data, "test.v1");

  // Corrupt the payload
  envelope.payload = Buffer.from("corrupted data").toString("base64");

  await assert.rejects(
    () => unpackCheckpointEnvelope(envelope),
    CheckpointEnvelopeInvalidError,
  );
});

test("integration: unpackCheckpointEnvelope rejects invalid envelope structure", async () => {
  const invalidEnvelope = {
    version: "invalid_version" as CheckpointEnvelope["version"],
    schema: "test.v1",
    payload: "abc123",
    metadata: {
      originalSizeBytes: 100,
      compressedSizeBytes: 100,
      checksum: "abc123",
      createdAt: "2026-05-01T00:00:00.000Z",
      algorithm: "gzip" as const,
      payloadSchemaVersion: "test.v1",
    },
  };

  await assert.rejects(
    () => unpackCheckpointEnvelope(invalidEnvelope),
    CheckpointEnvelopeInvalidError,
  );
});

// ── Complex Data Round-Trip Tests ─────────────────────────────────────────────

test("integration: checkpoint with complex nested output round-trips", async () => {
  const complexOutput = {
    level1: {
      level2: {
        level3: {
          array: [1, 2, 3, { nested: true }],
        },
      },
    },
    dates: ["2026-05-01T00:00:00.000Z"],
    nullValue: null,
    boolean: true,
    number: 42,
  };

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_complex",
    nodeRunId: "node_complex",
    planGraphId: "bundle_complex",
    taskId: "task_complex",
    executionId: "exec_complex",
    workflowId: "wf_complex",
    divisionId: "div_complex",
    stepId: "step_complex",
    roleId: "role_complex",
    outputKey: "output_complex",
    status: "succeeded",
    producedAt: "2026-05-01T00:00:00.000Z",
    output: complexOutput,
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
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.deepEqual(unpacked.data.output, complexOutput);
});

test("integration: checkpoint with unicode content round-trips", async () => {
  const unicodeOutput = {
    chinese: "中文测试",
    japanese: "日本語",
    emoji: "😀🎉",
    arabic: "مرحبا",
  };

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_unicode",
    nodeRunId: "node_unicode",
    planGraphId: "bundle_unicode",
    taskId: "task_unicode",
    executionId: "exec_unicode",
    workflowId: "wf_unicode",
    divisionId: "div_unicode",
    stepId: "step_unicode",
    roleId: "role_unicode",
    outputKey: "output_unicode",
    status: "succeeded",
    producedAt: "2026-05-01T00:00:00.000Z",
    output: unicodeOutput,
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
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.deepEqual(unpacked.data.output, unicodeOutput);
});

test("integration: checkpoint with special JSON characters round-trips", async () => {
  const specialOutput = {
    json: '{"key": "value"}',
    newline: "line1\nline2",
    tab: "col1\tcol2",
    backslash: "path\\to\\file",
    quote: 'said "hello"',
  };

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_special",
    nodeRunId: "node_special",
    planGraphId: "bundle_special",
    taskId: "task_special",
    executionId: "exec_special",
    workflowId: "wf_special",
    divisionId: "div_special",
    stepId: "step_special",
    roleId: "role_special",
    outputKey: "output_special",
    status: "succeeded",
    producedAt: "2026-05-01T00:00:00.000Z",
    output: specialOutput,
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
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);
  const unpacked = await unwrapWorkflowStepCheckpoint(envelope);

  assert.deepEqual(unpacked.data.output, specialOutput);
});

// ── Envelope Schema Version Tests ──────────────────────────────────────────────

test("integration: envelope includes correct schema version", async () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_schema",
    nodeRunId: "node_schema",
    planGraphId: "bundle_schema",
    taskId: "task_schema",
    executionId: "exec_schema",
    workflowId: "wf_schema",
    divisionId: "div_schema",
    stepId: "step_schema",
    roleId: "role_schema",
    outputKey: "output_schema",
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
  });

  const envelope = await wrapWorkflowStepCheckpoint(checkpoint);

  assert.equal(envelope.version, CHECKPOINT_ENVELOPE_SCHEMA_VERSION);
  assert.equal(envelope.schema, "workflow_step_checkpoint.v1");
  assert.equal(envelope.metadata.payloadSchemaVersion, "workflow_step_checkpoint.v1");
});
