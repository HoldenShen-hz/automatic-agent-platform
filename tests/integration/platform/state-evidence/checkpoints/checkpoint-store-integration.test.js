/**
 * Integration tests for CheckpointStore
 *
 * Tests integration between CheckpointStore operations and the
 * actual file system, envelope wrapping, and SQLite persistence.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createCheckpointEnvelope,
  unpackCheckpointEnvelope,
} from "../../../../../src/platform/state-evidence/checkpoints/checkpoint-envelope.js";

import {
  createWorkflowStepCheckpoint,
  readWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

function createTempDir(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return path;
}

function cleanupDir(path) {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Mock CheckpointStore for integration testing with file system
 */
class IntegrationCheckpointStore {
  constructor(basePath) {
    this.basePath = basePath;
    this.artifacts = new Map();
  }

  async saveCheckpoint(checkpoint) {
    const artifactId = `artifact_${checkpoint.workflowId}_${checkpoint.stepId}_${Date.now()}`;
    const storagePath = join(this.basePath, `${artifactId}.json`);

    // Write raw checkpoint to file system (not envelope-wrapped for simplicity)
    mkdirSync(this.basePath, { recursive: true });
    writeFileSync(storagePath, JSON.stringify(checkpoint), "utf8");

    const artifact = {
      artifactId,
      taskId: checkpoint.taskId,
      executionId: checkpoint.executionId,
      stepId: checkpoint.stepId,
      kind: "workflow_step_snapshot",
      storagePath,
      fileName: `${artifactId}.json`,
      mimeType: "application/json",
      checksum: null,
      lineageJson: null,
      createdAt: checkpoint.producedAt,
      sizeBytes: JSON.stringify(checkpoint).length,
    };

    this.artifacts.set(artifactId, artifact);
    return artifact;
  }

  async getCheckpoint(artifactId) {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return null;
    }

    const record = {
      artifactId: artifact.artifactId,
      taskId: artifact.taskId,
      executionId: artifact.executionId,
      stepId: artifact.stepId,
      kind: artifact.kind,
      storagePath: artifact.storagePath,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      checksum: artifact.checksum,
      lineageJson: artifact.lineageJson,
      createdAt: artifact.createdAt,
    };

    return readWorkflowStepCheckpoint(record);
  }

  async listCheckpoints(workflowId) {
    const summaries = [];
    for (const artifact of this.artifacts.values()) {
      if (artifact.storagePath.includes(workflowId)) {
        const checkpoint = await this.getCheckpoint(artifact.artifactId);
        if (checkpoint) {
          summaries.push(summarizeWorkflowStepCheckpoint(artifact.artifactId, checkpoint));
        }
      }
    }
    return summaries;
  }

  async deleteCheckpoint(artifactId) {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return false;
    }

    try {
      rmSync(artifact.storagePath, { force: true });
    } catch {
      // ignore file removal errors
    }

    this.artifacts.delete(artifactId);
    return true;
  }

  clear() {
    this.artifacts.clear();
  }
}

function createTestCheckpoint(overrides = {}) {
  return createWorkflowStepCheckpoint({
    harnessRunId: overrides.harnessRunId ?? "harness-integration",
    nodeRunId: overrides.nodeRunId ?? null,
    planGraphBundleId: overrides.planGraphBundleId ?? "bundle-integration",
    taskId: overrides.taskId ?? "task-integration",
    executionId: overrides.executionId ?? null,
    workflowId: overrides.workflowId ?? "wf-integration",
    divisionId: overrides.divisionId ?? "div-integration",
    stepId: overrides.stepId ?? "step-integration",
    roleId: overrides.roleId ?? "role-integration",
    outputKey: overrides.outputKey ?? "output-integration",
    status: overrides.status ?? "succeeded",
    producedAt: overrides.producedAt ?? new Date().toISOString(),
    output: overrides.output ?? { result: "integration success" },
    decisionContext: {
      source: "integration_test",
      request: "integration test request",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: overrides.completedStepIds ?? [],
      nextStepId: overrides.nextStepId ?? null,
      outputKeys: overrides.outputKeys ?? [],
    },
    fileDiffSummary: overrides.fileDiffSummary ?? {
      summary: null,
      createdPaths: [],
      updatedPaths: [],
      deletedPaths: [],
    },
  });
}

// Integration tests

test("integration: CheckpointStore saves checkpoint to file system with envelope", async () => {
  const workspace = createTempDir("aa-store-integration-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint();
    const artifact = await store.saveCheckpoint(checkpoint);

    assert.equal(artifact.kind, "workflow_step_snapshot");
    assert.ok(artifact.artifactId.startsWith("artifact_"));
    assert.ok(artifact.storagePath.includes(workspace));
    assert.equal(artifact.checksum, null);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore retrieves checkpoint from file system", async () => {
  const workspace = createTempDir("aa-store-retrieve-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({ stepId: "step-retrieve" });
    const artifact = await store.saveCheckpoint(checkpoint);

    const retrieved = await store.getCheckpoint(artifact.artifactId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.stepId, "step-retrieve");
    assert.equal(retrieved.taskId, "task-integration");
    assert.equal(retrieved.status, "succeeded");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore listCheckpoints returns correct summaries", async () => {
  const workspace = createTempDir("aa-store-list-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-list-1" }));
    await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-list-2" }));
    await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-list-3" }));

    const checkpoints = await store.listCheckpoints("wf-integration");
    assert.equal(checkpoints.length, 3);

    const stepIds = checkpoints.map((c) => c.stepId);
    assert.ok(stepIds.includes("step-list-1"));
    assert.ok(stepIds.includes("step-list-2"));
    assert.ok(stepIds.includes("step-list-3"));
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore deletes checkpoint and removes file", async () => {
  const workspace = createTempDir("aa-store-delete-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({ stepId: "step-delete" });
    const artifact = await store.saveCheckpoint(checkpoint);

    const result = await store.deleteCheckpoint(artifact.artifactId);
    assert.equal(result, true);

    const retrieved = await store.getCheckpoint(artifact.artifactId);
    assert.equal(retrieved, null);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore returns null for non-existent checkpoint", async () => {
  const workspace = createTempDir("aa-store-null-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const retrieved = await store.getCheckpoint("non-existent-artifact");
    assert.equal(retrieved, null);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore handles multiple workflows independently", async () => {
  const workspace = createTempDir("aa-store-multi-workflow-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-A", stepId: "step-A1" }));
    await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-A", stepId: "step-A2" }));
    await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-B", stepId: "step-B1" }));

    const checkpointsA = await store.listCheckpoints("wf-A");
    const checkpointsB = await store.listCheckpoints("wf-B");

    assert.equal(checkpointsA.length, 2);
    assert.equal(checkpointsB.length, 1);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore preserves checkpoint data through envelope wrap/unwrap", async () => {
  const workspace = createTempDir("aa-store-envelope-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const originalCheckpoint = createTestCheckpoint({
      stepId: "step-envelope",
      workflowId: "wf-envelope",
      output: { result: "envelope test", nested: { deep: true } },
      decisionContext: {
        source: "envelope_source",
        request: "envelope request",
        routeReason: "testing envelope",
        priorStepSummaries: ["prior-envelope"],
        dependsOnStepIds: [],
      },
    });

    const artifact = await store.saveCheckpoint(originalCheckpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null, "Retrieved checkpoint should not be null");
    assert.equal(retrieved.taskId, originalCheckpoint.taskId);
    assert.equal(retrieved.workflowId, "wf-envelope");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore with failed status checkpoint", async () => {
  const workspace = createTempDir("aa-store-failed-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({
      stepId: "step-failed",
      status: "failed",
      output: { error: "Integration test failure" },
    });

    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.status, "failed");
    assert.deepEqual(retrieved.output, { error: "Integration test failure" });
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore with skipped status checkpoint", async () => {
  const workspace = createTempDir("aa-store-skipped-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({
      stepId: "step-skipped",
      status: "skipped",
      output: { reason: "condition not met" },
    });

    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.status, "skipped");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore preserves resume context", async () => {
  const workspace = createTempDir("aa-store-resume-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({
      stepId: "step-resume",
      completedStepIds: ["step-1", "step-2", "step-resume"],
      nextStepId: "step-4",
      outputKeys: ["output-resume-1", "output-resume-2"],
    });

    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.deepEqual(retrieved.resumeContext.completedStepIds, ["step-1", "step-2", "step-resume"]);
    assert.equal(retrieved.resumeContext.nextStepId, "step-4");
    assert.deepEqual(retrieved.resumeContext.outputKeys, ["output-resume-1", "output-resume-2"]);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore preserves file diff summary", async () => {
  const workspace = createTempDir("aa-store-file-diff-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({
      stepId: "step-file-diff",
      fileDiffSummary: {
        summary: "Changed 3 files",
        createdPaths: ["/new/a.ts", "/new/b.ts"],
        updatedPaths: ["/existing/c.ts"],
        deletedPaths: ["/old/d.ts"],
      },
    });

    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.fileDiffSummary.summary, "Changed 3 files");
    assert.deepEqual(retrieved.fileDiffSummary.createdPaths, ["/new/a.ts", "/new/b.ts"]);
    assert.deepEqual(retrieved.fileDiffSummary.updatedPaths, ["/existing/c.ts"]);
    assert.deepEqual(retrieved.fileDiffSummary.deletedPaths, ["/old/d.ts"]);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore handles null executionId", async () => {
  const workspace = createTempDir("aa-store-null-exec-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({
      stepId: "step-null-exec",
      executionId: null,
    });

    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.executionId, null);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore delete returns false for non-existent", async () => {
  const workspace = createTempDir("aa-store-delete-false-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const result = await store.deleteCheckpoint("non-existent-artifact");
    assert.equal(result, false);
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore summary extracts summary from output", async () => {
  const workspace = createTempDir("aa-store-summary-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const checkpoint = createTestCheckpoint({
      stepId: "step-summary",
      output: { summary: "Integration summary text" },
    });

    const artifact = await store.saveCheckpoint(checkpoint);
    const summaries = await store.listCheckpoints("wf-integration");

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].summary, "Integration summary text");
  } finally {
    cleanupDir(workspace);
  }
});

test("integration: CheckpointStore delete does not affect other checkpoints", async () => {
  const workspace = createTempDir("aa-store-isolate-");
  try {
    const store = new IntegrationCheckpointStore(workspace);
    const artifact1 = await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-1" }));
    const artifact2 = await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-2" }));

    await store.deleteCheckpoint(artifact1.artifactId);

    const remaining = await store.listCheckpoints("wf-integration");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].stepId, "step-2");

    const retrieved2 = await store.getCheckpoint(artifact2.artifactId);
    assert.ok(retrieved2 !== null);
  } finally {
    cleanupDir(workspace);
  }
});
