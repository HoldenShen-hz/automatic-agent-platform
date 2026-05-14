import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  type WorkflowStepCheckpoint,
  type WorkflowStepCheckpointSummary,
  type CreateWorkflowStepCheckpointInput,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/index.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * Mock CheckpointStore for testing checkpoint operations.
 */
class MockCheckpointStore {
  private checkpoints = new Map<string, WorkflowStepCheckpoint>();
  private artifacts = new Map<string, ArtifactRecord>();

  async saveCheckpoint(checkpoint: WorkflowStepCheckpoint): Promise<ArtifactRecord> {
    const artifactId = `artifact_${checkpoint.workflowId}_${checkpoint.stepId}_${Date.now()}`;
    const artifact: ArtifactRecord = {
      artifactId,
      taskId: checkpoint.taskId,
      executionId: checkpoint.executionId,
      stepId: checkpoint.stepId,
      kind: "workflow_step_snapshot",
      storagePath: `/checkpoints/${checkpoint.workflowId}/${artifactId}.json`,
      fileName: `${artifactId}.json`,
      mimeType: "application/json",
      sizeBytes: JSON.stringify(checkpoint).length,
      checksum: null,
      lineageJson: null,
      createdAt: checkpoint.producedAt,
    };

    this.checkpoints.set(artifactId, checkpoint);
    this.artifacts.set(artifactId, artifact);
    return artifact;
  }

  async getCheckpoint(artifactId: string): Promise<WorkflowStepCheckpoint | null> {
    return this.checkpoints.get(artifactId) ?? null;
  }

  async listCheckpoints(workflowId: string): Promise<WorkflowStepCheckpointSummary[]> {
    const summaries: WorkflowStepCheckpointSummary[] = [];
    for (const [artifactId, checkpoint] of this.checkpoints) {
      if (checkpoint.workflowId === workflowId) {
        summaries.push(summarizeWorkflowStepCheckpoint(artifactId, checkpoint));
      }
    }
    return summaries;
  }

  async deleteCheckpoint(artifactId: string): Promise<boolean> {
    const deleted = this.checkpoints.delete(artifactId);
    if (deleted) {
      this.artifacts.delete(artifactId);
    }
    return deleted;
  }

  clear(): void {
    this.checkpoints.clear();
    this.artifacts.clear();
  }
}

function createTestCheckpointInput(overrides?: Partial<CreateWorkflowStepCheckpointInput>): CreateWorkflowStepCheckpointInput {
  return {
    harnessRunId: "harness-001",
    nodeRunId: null,
    planGraphBundleId: "bundle-001",
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    divisionId: "div-001",
    stepId: "step-001",
    roleId: "role-001",
    outputKey: "output-key",
    status: "succeeded",
    producedAt: new Date().toISOString(),
    output: { result: "success", data: { value: 42 } },
    decisionContext: {
      source: "model:gpt-4o",
      request: "Process request",
      routeReason: "completed successfully",
      priorStepSummaries: ["step 0 completed"],
      dependsOnStepIds: ["step-000"],
    },
    resumeContext: {
      completedStepIds: ["step-000", "step-001"],
      nextStepId: "step-002",
      outputKeys: ["output-key"],
    },
    ...overrides,
  };
}

test("createCheckpoint saves workflow state with all required fields", async () => {
  const store = new MockCheckpointStore();
  const input = createTestCheckpointInput({
    workflowId: "wf-test-001",
    stepId: "step-A",
    status: "succeeded",
    output: { result: "test output", items: ["a", "b", "c"] },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const artifact = await store.saveCheckpoint(checkpoint);

  assert.ok(artifact.artifactId.startsWith("artifact_"));
  assert.strictEqual(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.strictEqual(checkpoint.workflowId, "wf-test-001");
  assert.strictEqual(checkpoint.stepId, "step-A");
  assert.strictEqual(checkpoint.status, "succeeded");
  assert.deepStrictEqual(checkpoint.output, { result: "test output", items: ["a", "b", "c"] });
  assert.strictEqual(checkpoint.outputKey, "output-key");
  assert.strictEqual(checkpoint.harnessRunId, "harness-001");
  assert.strictEqual(checkpoint.taskId, "task-123");
  assert.strictEqual(checkpoint.divisionId, "div-001");
  assert.strictEqual(checkpoint.roleId, "role-001");
});

test("getCheckpoint retrieves checkpoint by ID", async () => {
  const store = new MockCheckpointStore();
  const input = createTestCheckpointInput({ stepId: "step-retrieve" });
  const checkpoint = createWorkflowStepCheckpoint(input);
  const artifact = await store.saveCheckpoint(checkpoint);

  const retrieved = await store.getCheckpoint(artifact.artifactId);

  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved.stepId, "step-retrieve");
  assert.strictEqual(retrieved.workflowId, input.workflowId);
  assert.strictEqual(retrieved.status, input.status);
  assert.deepStrictEqual(retrieved.output, input.output);
});

test("getCheckpoint returns null for non-existent ID", async () => {
  const store = new MockCheckpointStore();

  const result = await store.getCheckpoint("non-existent-artifact-id");

  assert.strictEqual(result, null);
});

test("listCheckpoints returns all checkpoints for a workflow", async () => {
  const store = new MockCheckpointStore();

  await store.saveCheckpoint(createWorkflowStepCheckpoint(createTestCheckpointInput({ stepId: "step-1", workflowId: "wf-list" })));
  await store.saveCheckpoint(createWorkflowStepCheckpoint(createTestCheckpointInput({ stepId: "step-2", workflowId: "wf-list" })));
  await store.saveCheckpoint(createWorkflowStepCheckpoint(createTestCheckpointInput({ stepId: "step-3", workflowId: "wf-list" })));
  // This one should NOT be included
  await store.saveCheckpoint(createWorkflowStepCheckpoint(createTestCheckpointInput({ stepId: "step-X", workflowId: "wf-other" })));

  const checkpoints = await store.listCheckpoints("wf-list");

  assert.strictEqual(checkpoints.length, 3);
  const stepIds = checkpoints.map((c) => c.stepId).sort();
  assert.deepStrictEqual(stepIds, ["step-1", "step-2", "step-3"]);
});

test("listCheckpoints returns empty array for workflow with no checkpoints", async () => {
  const store = new MockCheckpointStore();

  const result = await store.listCheckpoints("non-existent-workflow");

  assert.strictEqual(result.length, 0);
});

test("deleteCheckpoint removes checkpoint and returns true", async () => {
  const store = new MockCheckpointStore();
  const checkpoint = createWorkflowStepCheckpoint(createTestCheckpointInput());
  const artifact = await store.saveCheckpoint(checkpoint);

  const deleted = await store.deleteCheckpoint(artifact.artifactId);

  assert.strictEqual(deleted, true);
  const retrieved = await store.getCheckpoint(artifact.artifactId);
  assert.strictEqual(retrieved, null);
});

test("deleteCheckpoint returns false for non-existent checkpoint", async () => {
  const store = new MockCheckpointStore();

  const result = await store.deleteCheckpoint("non-existent-id");

  assert.strictEqual(result, false);
});

test("checkpoint includes step index in resume context", async () => {
  const input = createTestCheckpointInput({
    stepId: "step-index-test",
    resumeContext: {
      completedStepIds: ["step-001", "step-002", "step-003"],
      nextStepId: "step-004",
      outputKeys: ["key1", "key2"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.resumeContext.completedStepIds.length, 3);
  assert.strictEqual(checkpoint.resumeContext.nextStepId, "step-004");
  assert.ok(checkpoint.resumeContext.completedStepIds.includes("step-001"));
  assert.ok(checkpoint.resumeContext.completedStepIds.includes("step-002"));
  assert.ok(checkpoint.resumeContext.completedStepIds.includes("step-003"));
});

test("checkpoint includes output data with complex structure", async () => {
  const complexOutput = {
    result: {
      files: [
        { path: "/a.txt", status: "created" },
        { path: "/b.txt", status: "modified" },
      ],
      metadata: {
        totalSteps: 5,
        currentStep: 2,
        timestamp: "2026-04-29T00:00:00Z",
      },
    },
    nested: {
      deep: {
        value: 12345,
      },
    },
  };

  const checkpoint = createWorkflowStepCheckpoint(
    createTestCheckpointInput({ output: complexOutput }),
  );

  assert.strictEqual(checkpoint.output.result.files.length, 2);
  assert.strictEqual(checkpoint.output.result.metadata.currentStep, 2);
  assert.strictEqual(checkpoint.output.nested.deep.value, 12345);
});

test("checkpoint includes decision context with routing information", async () => {
  const input = createTestCheckpointInput({
    decisionContext: {
      source: "model:claude-3-5",
      request: "Summarize the document",
      routeReason: "Routed to summarization handler based on keyword match",
      priorStepSummaries: ["Parsed document", "Extracted text content"],
      dependsOnStepIds: ["parse-step", "extract-step"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.decisionContext.source, "model:claude-3-5");
  assert.strictEqual(checkpoint.decisionContext.request, "Summarize the document");
  assert.strictEqual(checkpoint.decisionContext.routeReason, "Routed to summarization handler based on keyword match");
  assert.strictEqual(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.strictEqual(checkpoint.decisionContext.dependsOnStepIds.length, 2);
});

test("createCheckpoint makes defensive copies of arrays", async () => {
  const priorSummaries = ["step 1", "step 2"];
  const dependsOn = ["dep-1", "dep-2"];
  const completed = ["c-1", "c-2"];

  const input = createTestCheckpointInput({
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: priorSummaries,
      dependsOnStepIds: dependsOn,
    },
    resumeContext: {
      completedStepIds: completed,
      nextStepId: "next",
      outputKeys: ["key"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  // Mutate originals after creating checkpoint
  priorSummaries.push("mutated");
  dependsOn.push("mutated-dep");
  completed.push("mutated-completed");

  assert.strictEqual(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.strictEqual(checkpoint.decisionContext.dependsOnStepIds.length, 2);
  assert.strictEqual(checkpoint.resumeContext.completedStepIds.length, 2);
});

test("summarizeWorkflowStepCheckpoint creates correct summary", async () => {
  const input = createTestCheckpointInput({
    stepId: "summary-step",
    workflowId: "wf-summary",
    status: "succeeded",
    decisionContext: {
      source: "test-source",
      request: "test request",
      routeReason: "test reason",
      priorStepSummaries: ["prior"],
      dependsOnStepIds: ["dep"],
    },
    resumeContext: {
      completedStepIds: ["step-001"],
      nextStepId: "step-002",
      outputKeys: ["output-a", "output-b"],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);
  const summary = summarizeWorkflowStepCheckpoint("artifact-123", checkpoint);

  assert.strictEqual(summary.artifactId, "artifact-123");
  assert.strictEqual(summary.stepId, "summary-step");
  assert.strictEqual(summary.workflowId, "wf-summary");
  assert.strictEqual(summary.status, "succeeded");
  assert.strictEqual(summary.nextStepId, "step-002");
  assert.deepStrictEqual(summary.outputKeys, ["output-a", "output-b"]);
  assert.strictEqual(summary.source, "test-source");
});

test("checkpoint with null nodeRunId is handled correctly", async () => {
  const input = createTestCheckpointInput({ nodeRunId: null });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.nodeRunId, null);
});

test("checkpoint with null executionId is handled correctly", async () => {
  const input = createTestCheckpointInput({ executionId: null });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.executionId, null);
});

test("checkpoint with fileDiffSummary includes file changes", async () => {
  const input = createTestCheckpointInput({
    fileDiffSummary: {
      summary: "Created 2 files, updated 1 file",
      createdPaths: ["/new/file1.txt", "/new/file2.txt"],
      updatedPaths: ["/existing/config.json"],
      deletedPaths: [],
    },
  });

  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.fileDiffSummary.summary, "Created 2 files, updated 1 file");
  assert.strictEqual(checkpoint.fileDiffSummary.createdPaths.length, 2);
  assert.strictEqual(checkpoint.fileDiffSummary.updatedPaths.length, 1);
  assert.strictEqual(checkpoint.fileDiffSummary.deletedPaths.length, 0);
});

test("checkpoint with upstreamArtifactRefs includes artifact references", async () => {
  const artifactRefs = [
    {
      artifactId: "art-001",
      kind: "file",
      uri: "file:///artifacts/art-001.json",
      createdAt: "2026-04-29T00:00:00Z",
      mimeType: "application/json",
    },
    {
      artifactId: "art-002",
      kind: "data",
      uri: "file:///artifacts/art-002.json",
      createdAt: "2026-04-29T00:01:00Z",
    },
  ];

  const input = createTestCheckpointInput({ upstreamArtifactRefs: artifactRefs });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.upstreamArtifactRefs.length, 2);
  assert.strictEqual(checkpoint.upstreamArtifactRefs[0].artifactId, "art-001");
  assert.strictEqual(checkpoint.upstreamArtifactRefs[1].artifactId, "art-002");
});

test("checkpoint with failed status records failure", async () => {
  const input = createTestCheckpointInput({ status: "failed" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.status, "failed");
});

test("checkpoint with skipped status records skipped step", async () => {
  const input = createTestCheckpointInput({ status: "skipped" });
  const checkpoint = createWorkflowStepCheckpoint(input);

  assert.strictEqual(checkpoint.status, "skipped");
});
