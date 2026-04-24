import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import type {
  WorkflowStepCheckpoint,
  WorkflowStepCheckpointSummary,
} from "../../../../../src/platform/state-evidence/checkpoints/index.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * Mock CheckpointStore interface for testing
 *
 * This represents the expected interface for a checkpoint storage module
 * that handles persistence of workflow step checkpoints.
 */
interface CheckpointStore {
  saveCheckpoint(checkpoint: WorkflowStepCheckpoint): Promise<ArtifactRecord>;
  getCheckpoint(artifactId: string): Promise<WorkflowStepCheckpoint | null>;
  listCheckpoints(workflowId: string): Promise<WorkflowStepCheckpointSummary[]>;
  deleteCheckpoint(artifactId: string): Promise<boolean>;
}

/**
 * Counter for generating unique IDs across invocations
 */
let checkpointIdCounter = 0;

/**
 * Mock implementation for testing
 */
class MockCheckpointStore implements CheckpointStore {
  private checkpoints = new Map<string, WorkflowStepCheckpoint>();
  private artifacts = new Map<string, ArtifactRecord>();

  async saveCheckpoint(checkpoint: WorkflowStepCheckpoint): Promise<ArtifactRecord> {
    checkpointIdCounter++;
    const uniqueSuffix = `${checkpoint.workflowId}_${checkpoint.stepId}_${checkpointIdCounter}`;
    const artifactId = `artifact_${uniqueSuffix}`;
    const artifact: ArtifactRecord = {
      artifactId,
      kind: "workflow_step_snapshot",
      uri: `file://checkpoints/${checkpoint.workflowId}/${artifactId}.json`,
      storagePath: `/checkpoints/${checkpoint.workflowId}/${artifactId}.json`,
      createdAt: new Date().toISOString(),
      sizeBytes: JSON.stringify(checkpoint).length,
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
        summaries.push({
          artifactId,
          stepId: checkpoint.stepId,
          workflowId: checkpoint.workflowId,
          status: checkpoint.status,
          producedAt: checkpoint.producedAt,
          nextStepId: checkpoint.resumeContext.nextStepId,
          outputKeys: checkpoint.resumeContext.outputKeys,
          summary: typeof checkpoint.output === "object" && checkpoint.output !== null
            ? (checkpoint.output as { summary?: string }).summary ?? null
            : null,
          source: checkpoint.decisionContext.source,
        });
      }
    }
    return summaries;
  }

  async deleteCheckpoint(artifactId: string): Promise<boolean> {
    const existed = this.checkpoints.has(artifactId);
    this.checkpoints.delete(artifactId);
    this.artifacts.delete(artifactId);
    return existed;
  }

  clear(): void {
    this.checkpoints.clear();
    this.artifacts.clear();
  }
}

/**
 * Creates a test checkpoint for use in tests
 */
function createTestCheckpoint(overrides?: Partial<WorkflowStepCheckpoint>): WorkflowStepCheckpoint {
  return {
    schemaVersion: "workflow_step_checkpoint.v1",
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
  };
}

describe("CheckpointStore", () => {
  let store: MockCheckpointStore;

  beforeEach(() => {
    store = new MockCheckpointStore();
  });

  describe("saveCheckpoint", () => {
    it("should save a checkpoint and return artifact record", async () => {
      const checkpoint = createTestCheckpoint();
      const artifact = await store.saveCheckpoint(checkpoint);

      assert.strictEqual(artifact.kind, "workflow_step_snapshot");
      assert.ok(artifact.artifactId.startsWith("artifact_"));
      assert.ok(artifact.uri.startsWith("file://"));
      assert.ok(artifact.storagePath.startsWith("/"));
      assert.strictEqual(typeof artifact.sizeBytes, "number");
    });

    it("should persist checkpoint for retrieval", async () => {
      const checkpoint = createTestCheckpoint();
      const artifact = await store.saveCheckpoint(checkpoint);

      const retrieved = await store.getCheckpoint(artifact.artifactId);
      assert.ok(retrieved !== null);
      assert.strictEqual(retrieved.taskId, checkpoint.taskId);
      assert.strictEqual(retrieved.stepId, checkpoint.stepId);
      assert.strictEqual(retrieved.workflowId, checkpoint.workflowId);
    });

    it("should preserve checkpoint data integrity", async () => {
      const checkpoint = createTestCheckpoint({
        output: { result: "custom", nested: { deep: true } },
        status: "failed",
      });
      const artifact = await store.saveCheckpoint(checkpoint);
      const retrieved = await store.getCheckpoint(artifact.artifactId);

      assert.ok(retrieved !== null);
      assert.deepStrictEqual(retrieved.output, { result: "custom", nested: { deep: true } });
      assert.strictEqual(retrieved.status, "failed");
    });

    it("should handle multiple checkpoints for same workflow", async () => {
      const checkpoint1 = createTestCheckpoint({ stepId: "step-001" });
      const checkpoint2 = createTestCheckpoint({ stepId: "step-002" });

      const artifact1 = await store.saveCheckpoint(checkpoint1);
      const artifact2 = await store.saveCheckpoint(checkpoint2);

      const list = await store.listCheckpoints("wf-789");
      assert.strictEqual(list.length, 2);

      const retrieved1 = await store.getCheckpoint(artifact1.artifactId);
      const retrieved2 = await store.getCheckpoint(artifact2.artifactId);

      assert.ok(retrieved1 !== null);
      assert.ok(retrieved2 !== null);
      assert.strictEqual(retrieved1.stepId, "step-001");
      assert.strictEqual(retrieved2.stepId, "step-002");
    });
  });

  describe("getCheckpoint", () => {
    it("should return null for non-existent checkpoint", async () => {
      const result = await store.getCheckpoint("non-existent-id");
      assert.strictEqual(result, null);
    });

    it("should retrieve checkpoint with all decision context", async () => {
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
      assert.strictEqual(retrieved.decisionContext.source, "test-source");
      assert.deepStrictEqual(retrieved.decisionContext.priorStepSummaries, ["prior1", "prior2"]);
      assert.deepStrictEqual(retrieved.decisionContext.dependsOnStepIds, ["dep1", "dep2"]);
    });

    it("should retrieve checkpoint with resume context", async () => {
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
      assert.deepStrictEqual(retrieved.resumeContext.completedStepIds, ["step-a", "step-b"]);
      assert.strictEqual(retrieved.resumeContext.nextStepId, "step-c");
      assert.deepStrictEqual(retrieved.resumeContext.outputKeys, ["key1", "key2"]);
    });

    it("should retrieve checkpoint with file diff summary", async () => {
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
      assert.strictEqual(retrieved.fileDiffSummary.summary, "Files changed");
      assert.deepStrictEqual(retrieved.fileDiffSummary.createdPaths, ["a.txt"]);
      assert.deepStrictEqual(retrieved.fileDiffSummary.updatedPaths, ["b.txt"]);
      assert.deepStrictEqual(retrieved.fileDiffSummary.deletedPaths, ["c.txt"]);
    });
  });

  describe("listCheckpoints", () => {
    it("should return empty array for workflow with no checkpoints", async () => {
      const result = await store.listCheckpoints("non-existent-workflow");
      assert.deepStrictEqual(result, []);
    });

    it("should list checkpoints for specific workflow only", async () => {
      await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-1" }));
      await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-1" }));
      await store.saveCheckpoint(createTestCheckpoint({ workflowId: "wf-2" }));

      const wf1Checkpoints = await store.listCheckpoints("wf-1");
      const wf2Checkpoints = await store.listCheckpoints("wf-2");

      assert.strictEqual(wf1Checkpoints.length, 2);
      assert.strictEqual(wf2Checkpoints.length, 1);
    });

    it("should return correct summary fields", async () => {
      const checkpoint = createTestCheckpoint({
        stepId: "step-test",
        status: "succeeded",
        output: { summary: "Operation completed successfully" },
        decisionContext: { source: "model:claude" },
        resumeContext: {
          completedStepIds: ["s1", "s2"],
          nextStepId: "s3",
          outputKeys: ["out1"],
        },
      });
      await store.saveCheckpoint(checkpoint);

      const summaries = await store.listCheckpoints("wf-789");
      assert.strictEqual(summaries.length, 1);

      const summary = summaries[0];
      assert.strictEqual(summary.stepId, "step-test");
      assert.strictEqual(summary.workflowId, "wf-789");
      assert.strictEqual(summary.status, "succeeded");
      assert.strictEqual(summary.summary, "Operation completed successfully");
      assert.strictEqual(summary.source, "model:claude");
      assert.strictEqual(summary.nextStepId, "s3");
      assert.deepStrictEqual(summary.outputKeys, ["out1"]);
    });
  });

  describe("deleteCheckpoint", () => {
    it("should return false when deleting non-existent checkpoint", async () => {
      const result = await store.deleteCheckpoint("non-existent-id");
      assert.strictEqual(result, false);
    });

    it("should return true when checkpoint was deleted", async () => {
      const checkpoint = createTestCheckpoint();
      const artifact = await store.saveCheckpoint(checkpoint);

      const result = await store.deleteCheckpoint(artifact.artifactId);
      assert.strictEqual(result, true);
    });

    it("should remove checkpoint from store", async () => {
      const checkpoint = createTestCheckpoint();
      const artifact = await store.saveCheckpoint(checkpoint);

      await store.deleteCheckpoint(artifact.artifactId);
      const retrieved = await store.getCheckpoint(artifact.artifactId);
      assert.strictEqual(retrieved, null);
    });

    it("should not affect other checkpoints when deleting one", async () => {
      const artifact1 = await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-1" }));
      const artifact2 = await store.saveCheckpoint(createTestCheckpoint({ stepId: "step-2" }));

      await store.deleteCheckpoint(artifact1.artifactId);

      const remaining = await store.listCheckpoints("wf-789");
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].stepId, "step-2");

      const retrieved2 = await store.getCheckpoint(artifact2.artifactId);
      assert.ok(retrieved2 !== null);
    });
  });
});
