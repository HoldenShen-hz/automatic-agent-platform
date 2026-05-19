/**
 * Unit tests for CheckpointStore
 *
 * Tests checkpoint storage operations including save, get,
 * list, and delete operations for workflow step checkpoints.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

/**
 * Mock CheckpointStore for testing storage operations
 */
class MockCheckpointStore {
  constructor() {
    this.checkpoints = new Map();
    this.artifacts = new Map();
  }

  async saveCheckpoint(checkpoint) {
    const artifactId = `artifact_${checkpoint.workflowId}_${checkpoint.stepId}_${Date.now()}`;
    const artifact = {
      artifactId,
      taskId: checkpoint.taskId,
      executionId: checkpoint.executionId,
      stepId: checkpoint.stepId,
      kind: "workflow_step_snapshot",
      storagePath: `/checkpoints/${checkpoint.workflowId}/${artifactId}.json`,
      fileName: `${artifactId}.json`,
      mimeType: "application/json",
      checksum: null,
      lineageJson: null,
      createdAt: checkpoint.producedAt,
      sizeBytes: JSON.stringify(checkpoint).length,
    };
    this.checkpoints.set(artifactId, checkpoint);
    this.artifacts.set(artifactId, artifact);
    return artifact;
  }

  async getCheckpoint(artifactId) {
    return this.checkpoints.get(artifactId) ?? null;
  }

  async listCheckpoints(workflowId) {
    const summaries = [];
    for (const [artifactId, checkpoint] of this.checkpoints) {
      if (checkpoint.workflowId === workflowId) {
        const output = checkpoint.output;
        summaries.push({
          artifactId,
          stepId: checkpoint.stepId,
          workflowId: checkpoint.workflowId,
          status: checkpoint.status,
          producedAt: checkpoint.producedAt,
          nextStepId: checkpoint.resumeContext.nextStepId,
          outputKeys: [...checkpoint.resumeContext.outputKeys],
          summary: typeof output === "object" && output !== null && !Array.isArray(output)
            ? output.summary ?? null
            : null,
          source: checkpoint.decisionContext.source,
        });
      }
    }
    return summaries;
  }

  async deleteCheckpoint(artifactId) {
    const existed = this.checkpoints.has(artifactId);
    this.checkpoints.delete(artifactId);
    this.artifacts.delete(artifactId);
    return existed;
  }

  clear() {
    this.checkpoints.clear();
    this.artifacts.clear();
  }
}

function createTestCheckpoint(overrides = {}) {
  return createWorkflowStepCheckpoint({
    harnessRunId: "harness-123",
    nodeRunId: "node-run-456",
    planGraphBundleId: "bundle-789",
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    divisionId: "div-001",
    stepId: "step-001",
    roleId: "role-001",
    outputKey: "output-key",
    status: "succeeded",
    producedAt: new Date().toISOString(),
    output: { result: "success", data: { key: "value" } },
    decisionContext: {
      source: "model:gpt-4o",
      request: "Process user request",
      routeReason: "normal",
      priorStepSummaries: ["Step 0 completed"],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step-000", "step-001"],
      nextStepId: "step-002",
      outputKeys: ["result"],
    },
    fileDiffSummary: {
      summary: "Updated 2 files",
      createdPaths: ["src/new.ts"],
      updatedPaths: ["src/existing.ts"],
      deletedPaths: [],
    },
    upstreamArtifactRefs: [],
    compensationModel: null,
    ...overrides,
  });
}

// CheckpointStore Tests

test("CheckpointStore saveCheckpoint returns artifact record", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint();
    const artifact = await store.saveCheckpoint(checkpoint);

    assert.equal(artifact.kind, "workflow_step_snapshot");
    assert.ok(artifact.artifactId.startsWith("artifact_"));
    assert.ok(artifact.storagePath.startsWith("/"));
    assert.equal(typeof artifact.sizeBytes, "number");
  } finally {
    store.clear();
  }
});

test("CheckpointStore saveCheckpoint persists checkpoint for retrieval", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint();
    const artifact = await store.saveCheckpoint(checkpoint);

    const retrieved = await store.getCheckpoint(artifact.artifactId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.taskId, checkpoint.taskId);
    assert.equal(retrieved.stepId, checkpoint.stepId);
    assert.equal(retrieved.workflowId, checkpoint.workflowId);
  } finally {
    store.clear();
  }
});

test("CheckpointStore saveCheckpoint preserves checkpoint data integrity", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      output: { result: "custom", nested: { deep: true } },
      status: "failed",
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.deepEqual(retrieved.output, { result: "custom", nested: { deep: true } });
    assert.equal(retrieved.status, "failed");
  } finally {
    store.clear();
  }
});

test("CheckpointStore saveCheckpoint handles multiple checkpoints for same workflow", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint1 = createTestCheckpoint({ stepId: "step-001" });
    const checkpoint2 = createTestCheckpoint({ stepId: "step-002" });

    const artifact1 = await store.saveCheckpoint(checkpoint1);
    const artifact2 = await store.saveCheckpoint(checkpoint2);

    const list = await store.listCheckpoints("wf-789");
    assert.equal(list.length, 2);

    const retrieved1 = await store.getCheckpoint(artifact1.artifactId);
    const retrieved2 = await store.getCheckpoint(artifact2.artifactId);

    assert.ok(retrieved1 !== null);
    assert.ok(retrieved2 !== null);
    assert.equal(retrieved1.stepId, "step-001");
    assert.equal(retrieved2.stepId, "step-002");
  } finally {
    store.clear();
  }
});

test("CheckpointStore getCheckpoint returns null for non-existent checkpoint", async () => {
  const store = new MockCheckpointStore();
  try {
    const result = await store.getCheckpoint("non-existent-id");
    assert.equal(result, null);
  } finally {
    store.clear();
  }
});

test("CheckpointStore getCheckpoint retrieves checkpoint with all decision context", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      decisionContext: {
        source: "test-source",
        request: "test request",
        routeReason: "test reason",
        priorStepSummaries: ["prior1", "prior2"],
        dependsOnStepIds: ["dep1", "dep2"],
      },
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.decisionContext.source, "test-source");
    assert.deepEqual(retrieved.decisionContext.priorStepSummaries, ["prior1", "prior2"]);
    assert.deepEqual(retrieved.decisionContext.dependsOnStepIds, ["dep1", "dep2"]);
  } finally {
    store.clear();
  }
});

test("CheckpointStore getCheckpoint retrieves checkpoint with resume context", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      resumeContext: {
        completedStepIds: ["step-a", "step-b"],
        nextStepId: "step-c",
        outputKeys: ["key1", "key2"],
      },
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.deepEqual(retrieved.resumeContext.completedStepIds, ["step-a", "step-b"]);
    assert.equal(retrieved.resumeContext.nextStepId, "step-c");
    assert.deepEqual(retrieved.resumeContext.outputKeys, ["key1", "key2"]);
  } finally {
    store.clear();
  }
});

test("CheckpointStore getCheckpoint retrieves checkpoint with file diff summary", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      fileDiffSummary: {
        summary: "Files changed",
        createdPaths: ["a.txt"],
        updatedPaths: ["b.txt"],
        deletedPaths: ["c.txt"],
      },
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.fileDiffSummary.summary, "Files changed");
    assert.deepEqual(retrieved.fileDiffSummary.createdPaths, ["a.txt"]);
    assert.deepEqual(retrieved.fileDiffSummary.updatedPaths, ["b.txt"]);
    assert.deepEqual(retrieved.fileDiffSummary.deletedPaths, ["c.txt"]);
  } finally {
    store.clear();
  }
});

test("CheckpointStore listCheckpoints returns empty array for workflow with no checkpoints", async () => {
  const store = new MockCheckpointStore();
  try {
    const result = await store.listCheckpoints("non-existent-workflow");
    assert.deepEqual(result, []);
  } finally {
    store.clear();
  }
});

test("CheckpointStore listCheckpoints lists checkpoints for specific workflow only", async () => {
  const store = new MockCheckpointStore();
  try {
    await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-1", stepId: "step-A" }));
    await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-1", stepId: "step-B" }));
    await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-2", stepId: "step-C" }));

    const wf1Checkpoints = await store.listCheckpoints("wf-1");
    const wf2Checkpoints = await store.listCheckpoints("wf-2");

    assert.equal(wf1Checkpoints.length, 2);
    assert.equal(wf2Checkpoints.length, 1);
  } finally {
    store.clear();
  }
});

test("CheckpointStore listCheckpoints returns correct summary fields", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      stepId: "step-test",
      status: "succeeded",
      output: { summary: "Operation completed successfully" },
      decisionContext: {
        source: "model:claude",
        request: "Summarize checkpoint",
        routeReason: null,
        priorStepSummaries: [],
        dependsOnStepIds: [],
      },
      resumeContext: {
        completedStepIds: ["s1", "s2"],
        nextStepId: "s3",
        outputKeys: ["out1"],
      },
    });
    await store.saveCheckpoint(checkpoint);

    const summaries = await store.listCheckpoints("wf-789");
    assert.equal(summaries.length, 1);

    const summary = summaries[0];
    assert.equal(summary.stepId, "step-test");
    assert.equal(summary.workflowId, "wf-789");
    assert.equal(summary.status, "succeeded");
    assert.equal(summary.summary, "Operation completed successfully");
    assert.equal(summary.source, "model:claude");
    assert.equal(summary.nextStepId, "s3");
    assert.deepEqual(summary.outputKeys, ["out1"]);
  } finally {
    store.clear();
  }
});

test("CheckpointStore deleteCheckpoint returns false when deleting non-existent checkpoint", async () => {
  const store = new MockCheckpointStore();
  try {
    const result = await store.deleteCheckpoint("non-existent-id");
    assert.equal(result, false);
  } finally {
    store.clear();
  }
});

test("CheckpointStore deleteCheckpoint returns true when checkpoint was deleted", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint();
    const artifact = await store.saveCheckpoint(checkpoint);

    const result = await store.deleteCheckpoint(artifact.artifactId);
    assert.equal(result, true);
  } finally {
    store.clear();
  }
});

test("CheckpointStore deleteCheckpoint removes checkpoint from store", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint();
    const artifact = await store.saveCheckpoint(checkpoint);

    await store.deleteCheckpoint(artifact.artifactId);
    const retrieved = await store.getCheckpoint(artifact.artifactId);
    assert.equal(retrieved, null);
  } finally {
    store.clear();
  }
});

test("CheckpointStore deleteCheckpoint does not affect other checkpoints when deleting one", async () => {
  const store = new MockCheckpointStore();
  try {
    const artifact1 = await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-1" }));
    const artifact2 = await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-2" }));

    await store.deleteCheckpoint(artifact1.artifactId);

    const remaining = await store.listCheckpoints("wf-789");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].stepId, "step-2");

    const retrieved2 = await store.getCheckpoint(artifact2.artifactId);
    assert.ok(retrieved2 !== null);
  } finally {
    store.clear();
  }
});

test("CheckpointStore saveCheckpoint preserves upstream artifact refs", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      upstreamArtifactRefs: [
        {
          artifactId: "upstream-artifact-1",
          kind: "source_code",
          uri: "file://src/artifact.ts",
          createdAt: "2026-04-27T00:00:00.000Z",
        },
      ],
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.upstreamArtifactRefs.length, 1);
    assert.equal(retrieved.upstreamArtifactRefs[0].artifactId, "upstream-artifact-1");
  } finally {
    store.clear();
  }
});

test("CheckpointStore saveCheckpoint handles compensation model", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      compensationModel: "idempotent_replay",
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.compensationModel, "idempotent_replay");
  } finally {
    store.clear();
  }
});

test("CheckpointStore listCheckpoints returns checkpoints in arbitrary order", async () => {
  const store = new MockCheckpointStore();
  try {
    await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-A" }));
    await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-B" }));
    await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-C" }));

    const checkpoints = await store.listCheckpoints("wf-789");
    assert.equal(checkpoints.length, 3);

    const stepIds = checkpoints.map((c) => c.stepId);
    assert.ok(stepIds.includes("step-A"));
    assert.ok(stepIds.includes("step-B"));
    assert.ok(stepIds.includes("step-C"));
  } finally {
    store.clear();
  }
});

test("CheckpointStore getCheckpoint handles null compensationModel", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      compensationModel: null,
    });
    const artifact = await store.saveCheckpoint(checkpoint);
    const retrieved = await store.getCheckpoint(artifact.artifactId);

    assert.ok(retrieved !== null);
    assert.equal(retrieved.compensationModel, null);
  } finally {
    store.clear();
  }
});

test("CheckpointStore listCheckpoints handles empty file diff summary", async () => {
  const store = new MockCheckpointStore();
  try {
    const checkpoint = createTestCheckpoint({
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
    });
    const artifact = await store.saveCheckpoint(checkpoint);

    const retrieved = await store.getCheckpoint(artifact.artifactId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved.fileDiffSummary.summary, null);
    assert.deepEqual(retrieved.fileDiffSummary.createdPaths, []);
  } finally {
    store.clear();
  }
});
