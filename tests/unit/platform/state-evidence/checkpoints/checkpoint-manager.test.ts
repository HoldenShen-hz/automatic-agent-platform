import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import type {
  WorkflowStepCheckpoint,
  WorkflowStepCheckpointSummary,
} from "../../../../../src/platform/state-evidence/checkpoints/index.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";

/**
 * Mock CheckpointStore interface for testing
 */
interface CheckpointStore {
  saveCheckpoint(checkpoint: WorkflowStepCheckpoint): Promise<ArtifactRecord>;
  getCheckpoint(artifactId: string): Promise<WorkflowStepCheckpoint | null>;
  listCheckpoints(workflowId: string): Promise<WorkflowStepCheckpointSummary[]>;
  deleteCheckpoint(artifactId: string): Promise<boolean>;
}

/**
 * Mock CheckpointEnvelope for testing
 */
interface CheckpointEnvelope {
  version: string;
  schema: string;
  payload: string;
  metadata: {
    originalSizeBytes: number;
    compressedSizeBytes: number;
    checksum: string;
    createdAt: string;
    algorithm: "gzip";
    payloadSchemaVersion: string;
  };
}

/**
 * CheckpointManager coordinates checkpoint operations for workflow execution.
 *
 * Responsibilities:
 * - Create checkpoints at step completion
 * - Track workflow progress via resume context
 * - Enable recovery from last successful step
 * - Manage checkpoint lifecycle
 */
interface CheckpointManager {
  createCheckpoint(input: CreateCheckpointInput): Promise<{ artifactId: string; checkpoint: WorkflowStepCheckpoint }>;
  getLatestCheckpoint(workflowId: string): Promise<WorkflowStepCheckpoint | null>;
  getCheckpointByStep(workflowId: string, stepId: string): Promise<WorkflowStepCheckpoint | null>;
  getWorkflowProgress(workflowId: string): Promise<WorkflowProgress | null>;
  recoverWorkflow(workflowId: string): Promise<RecoveryPlan | null>;
}

interface CreateCheckpointInput {
  taskId: string;
  executionId: string | null;
  workflowId: string;
  divisionId: string;
  stepId: string;
  roleId: string;
  outputKey: string;
  status: "succeeded" | "failed" | "skipped";
  output: Record<string, unknown>;
  decisionContext: {
    source: string;
    request: string;
    routeReason: string | null;
    priorStepSummaries: string[];
    dependsOnStepIds: string[];
  };
  completedStepIds: string[];
  nextStepId: string | null;
  upstreamArtifactRefs?: Array<{
    artifactId: string;
    kind: string;
    uri: string;
    createdAt: string;
  }>;
}

interface WorkflowProgress {
  workflowId: string;
  completedSteps: string[];
  nextStepId: string | null;
  totalSteps: number;
  percentComplete: number;
  lastCheckpointAt: string | null;
}

interface RecoveryPlan {
  workflowId: string;
  resumeFromStepId: string;
  completedSteps: string[];
  outputKeys: string[];
  artifactId: string;
}

/**
 * Mock implementation of CheckpointManager for testing
 */
class MockCheckpointManager implements CheckpointManager {
  private checkpoints = new Map<string, WorkflowStepCheckpoint>();
  private artifacts = new Map<string, ArtifactRecord>();

  async createCheckpoint(input: CreateCheckpointInput): Promise<{ artifactId: string; checkpoint: WorkflowStepCheckpoint }> {
    const producedAt = new Date(Date.now() + this.checkpoints.size).toISOString();
    const checkpoint: WorkflowStepCheckpoint = {
      schemaVersion: "workflow_step_checkpoint.v1",
      taskId: input.taskId,
      executionId: input.executionId,
      workflowId: input.workflowId,
      divisionId: input.divisionId,
      stepId: input.stepId,
      roleId: input.roleId,
      outputKey: input.outputKey,
      status: input.status,
      producedAt,
      output: input.output,
      decisionContext: {
        source: input.decisionContext.source,
        request: input.decisionContext.request,
        routeReason: input.decisionContext.routeReason,
        priorStepSummaries: [...input.decisionContext.priorStepSummaries],
        dependsOnStepIds: [...input.decisionContext.dependsOnStepIds],
      },
      resumeContext: {
        completedStepIds: [...input.completedStepIds],
        nextStepId: input.nextStepId,
        outputKeys: [],
      },
      fileDiffSummary: {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: input.upstreamArtifactRefs ?? [],
      compensationModel: null,
    };

    const artifactId = `artifact_${input.workflowId}_${input.stepId}_${Date.now()}`;
    const artifact: ArtifactRecord = {
      artifactId,
      taskId: input.taskId,
      executionId: input.executionId,
      stepId: input.stepId,
      kind: "workflow_step_snapshot",
      storagePath: `/checkpoints/${input.workflowId}/${artifactId}.json`,
      fileName: `${artifactId}.json`,
      mimeType: "application/json",
      sizeBytes: JSON.stringify(checkpoint).length,
      checksum: null,
      lineageJson: null,
      createdAt: checkpoint.producedAt,
    };

    this.checkpoints.set(artifactId, checkpoint);
    this.artifacts.set(artifactId, artifact);

    return { artifactId, checkpoint };
  }

  async getLatestCheckpoint(workflowId: string): Promise<WorkflowStepCheckpoint | null> {
    let latest: WorkflowStepCheckpoint | null = null;
    let latestTime = "";

    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.workflowId === workflowId && checkpoint.producedAt > latestTime) {
        latest = checkpoint;
        latestTime = checkpoint.producedAt;
      }
    }

    return latest;
  }

  async getCheckpointByStep(workflowId: string, stepId: string): Promise<WorkflowStepCheckpoint | null> {
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.workflowId === workflowId && checkpoint.stepId === stepId) {
        return checkpoint;
      }
    }
    return null;
  }

  async getWorkflowProgress(workflowId: string): Promise<WorkflowProgress | null> {
    const workflowCheckpoints: WorkflowStepCheckpoint[] = [];
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.workflowId === workflowId) {
        workflowCheckpoints.push(checkpoint);
      }
    }

    if (workflowCheckpoints.length === 0) {
      return null;
    }

    const completedSteps = new Set<string>();
    for (const cp of workflowCheckpoints) {
      completedSteps.add(cp.stepId);
    }

    const latestCheckpoint = await this.getLatestCheckpoint(workflowId);
    const nextStepId = latestCheckpoint?.resumeContext.nextStepId ?? null;
    const lastCheckpointAt = latestCheckpoint?.producedAt ?? null;

    return {
      workflowId,
      completedSteps: Array.from(completedSteps),
      nextStepId,
      totalSteps: completedSteps.size,
      percentComplete: 100,
      lastCheckpointAt,
    };
  }

  async recoverWorkflow(workflowId: string): Promise<RecoveryPlan | null> {
    const latest = await this.getLatestCheckpoint(workflowId);
    if (!latest) {
      return null;
    }

    let artifactId = "";
    for (const [aid, cp] of this.checkpoints) {
      if (cp === latest) {
        artifactId = aid;
        break;
      }
    }

    return {
      workflowId,
      resumeFromStepId: latest.resumeContext.nextStepId ?? latest.stepId,
      completedSteps: latest.resumeContext.completedStepIds,
      outputKeys: latest.resumeContext.outputKeys,
      artifactId,
    };
  }

  clear(): void {
    this.checkpoints.clear();
    this.artifacts.clear();
  }
}

/**
 * Creates test checkpoint input
 */
function createTestInput(overrides?: Partial<CreateCheckpointInput>): CreateCheckpointInput {
  return {
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "wf-789",
    divisionId: "div-001",
    stepId: "step-001",
    roleId: "role-001",
    outputKey: "output-key",
    status: "succeeded",
    output: { result: "success" },
    decisionContext: {
      source: "model:gpt-4o",
      request: "Process request",
      routeReason: "completed",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    completedStepIds: [],
    nextStepId: "step-002",
    ...overrides,
  };
}

describe("CheckpointManager", () => {
  let manager: MockCheckpointManager;

  beforeEach(() => {
    manager = new MockCheckpointManager();
  });

  describe("createCheckpoint", () => {
    it("should create a checkpoint with correct structure", async () => {
      const input = createTestInput({ stepId: "step-001" });
      const { artifactId, checkpoint } = await manager.createCheckpoint(input);

      assert.ok(artifactId.startsWith("artifact_"));
      assert.strictEqual(checkpoint.schemaVersion, "workflow_step_checkpoint.v1");
      assert.strictEqual(checkpoint.taskId, input.taskId);
      assert.strictEqual(checkpoint.workflowId, input.workflowId);
      assert.strictEqual(checkpoint.stepId, input.stepId);
      assert.strictEqual(checkpoint.status, input.status);
    });

    it("should preserve decision context", async () => {
      const input = createTestInput({
        decisionContext: {
          source: "test-source",
          request: "test request",
          routeReason: "test reason",
          priorStepSummaries: ["step 1 done", "step 2 done"],
          dependsOnStepIds: ["step-001", "step-002"],
        },
      });
      const { checkpoint } = await manager.createCheckpoint(input);

      assert.strictEqual(checkpoint.decisionContext.source, "test-source");
      assert.strictEqual(checkpoint.decisionContext.request, "test request");
      assert.strictEqual(checkpoint.decisionContext.routeReason, "test reason");
      assert.deepStrictEqual(checkpoint.decisionContext.priorStepSummaries, ["step 1 done", "step 2 done"]);
      assert.deepStrictEqual(checkpoint.decisionContext.dependsOnStepIds, ["step-001", "step-002"]);
    });

    it("should build resume context from completed steps", async () => {
      const input = createTestInput({
        completedStepIds: ["step-a", "step-b", "step-c"],
        nextStepId: "step-d",
      });
      const { checkpoint } = await manager.createCheckpoint(input);

      assert.deepStrictEqual(checkpoint.resumeContext.completedStepIds, ["step-a", "step-b", "step-c"]);
      assert.strictEqual(checkpoint.resumeContext.nextStepId, "step-d");
    });

    it("should handle null executionId", async () => {
      const input = createTestInput({ executionId: null });
      const { checkpoint } = await manager.createCheckpoint(input);
      assert.strictEqual(checkpoint.executionId, null);
    });

    it("should handle failed status", async () => {
      const input = createTestInput({ status: "failed" });
      const { checkpoint } = await manager.createCheckpoint(input);
      assert.strictEqual(checkpoint.status, "failed");
    });

    it("should handle skipped status", async () => {
      const input = createTestInput({ status: "skipped" });
      const { checkpoint } = await manager.createCheckpoint(input);
      assert.strictEqual(checkpoint.status, "skipped");
    });
  });

  describe("getLatestCheckpoint", () => {
    it("should return null for workflow with no checkpoints", async () => {
      const result = await manager.getLatestCheckpoint("non-existent");
      assert.strictEqual(result, null);
    });

    it("should return the most recent checkpoint by producedAt time", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));
      await manager.createCheckpoint(createTestInput({ stepId: "step-002" }));
      await manager.createCheckpoint(createTestInput({ stepId: "step-003" }));

      const latest = await manager.getLatestCheckpoint("wf-789");
      assert.ok(latest !== null);
      assert.strictEqual(latest.stepId, "step-003");
    });

    it("should return checkpoint with all fields populated", async () => {
      await manager.createCheckpoint(createTestInput());
      const latest = await manager.getLatestCheckpoint("wf-789");

      assert.ok(latest !== null);
      assert.ok(latest.producedAt);
      assert.ok(latest.output);
      assert.ok(latest.decisionContext);
      assert.ok(latest.resumeContext);
    });
  });

  describe("getCheckpointByStep", () => {
    it("should return null for non-existent step", async () => {
      const result = await manager.getCheckpointByStep("wf-789", "non-existent-step");
      assert.strictEqual(result, null);
    });

    it("should retrieve correct checkpoint by step ID", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-A" }));
      await manager.createCheckpoint(createTestInput({ stepId: "step-B" }));
      await manager.createCheckpoint(createTestInput({ stepId: "step-C" }));

      const checkpoint = await manager.getCheckpointByStep("wf-789", "step-B");
      assert.ok(checkpoint !== null);
      assert.strictEqual(checkpoint.stepId, "step-B");
    });

    it("should return correct workflow checkpoint only", async () => {
      await manager.createCheckpoint(createTestInput({ workflowId: "wf-1", stepId: "step-X" }));
      await manager.createCheckpoint(createTestInput({ workflowId: "wf-2", stepId: "step-X" }));

      const wf1Checkpoint = await manager.getCheckpointByStep("wf-1", "step-X");
      const wf2Checkpoint = await manager.getCheckpointByStep("wf-2", "step-X");

      assert.ok(wf1Checkpoint !== null);
      assert.ok(wf2Checkpoint !== null);
      assert.strictEqual(wf1Checkpoint.workflowId, "wf-1");
      assert.strictEqual(wf2Checkpoint.workflowId, "wf-2");
    });
  });

  describe("getWorkflowProgress", () => {
    it("should return null for workflow with no checkpoints", async () => {
      const result = await manager.getWorkflowProgress("non-existent");
      assert.strictEqual(result, null);
    });

    it("should return progress with completed steps", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-001", completedStepIds: ["step-001"], nextStepId: "step-002" }));
      await manager.createCheckpoint(createTestInput({ stepId: "step-002", completedStepIds: ["step-001", "step-002"], nextStepId: "step-003" }));

      const progress = await manager.getWorkflowProgress("wf-789");
      assert.ok(progress !== null);
      assert.strictEqual(progress.workflowId, "wf-789");
      assert.ok(progress.completedSteps.includes("step-001"));
      assert.ok(progress.completedSteps.includes("step-002"));
    });

    it("should track next step from latest checkpoint", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-001", completedStepIds: ["step-001"], nextStepId: "step-002" }));
      await manager.createCheckpoint(createTestInput({ stepId: "step-002", completedStepIds: ["step-001", "step-002"], nextStepId: null }));

      const progress = await manager.getWorkflowProgress("wf-789");
      assert.ok(progress !== null);
      assert.strictEqual(progress.nextStepId, null); // Workflow complete
    });

    it("should include last checkpoint timestamp", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));

      const progress = await manager.getWorkflowProgress("wf-789");
      assert.ok(progress !== null);
      assert.ok(progress.lastCheckpointAt !== null);
    });
  });

  describe("recoverWorkflow", () => {
    it("should return null for workflow with no checkpoints", async () => {
      const result = await manager.recoverWorkflow("non-existent");
      assert.strictEqual(result, null);
    });

    it("should return recovery plan with resume step", async () => {
      await manager.createCheckpoint(
        createTestInput({
          stepId: "step-001",
          completedStepIds: ["step-001"],
          nextStepId: "step-002",
        }),
      );

      const plan = await manager.recoverWorkflow("wf-789");
      assert.ok(plan !== null);
      assert.strictEqual(plan.workflowId, "wf-789");
      assert.strictEqual(plan.resumeFromStepId, "step-002");
      assert.deepStrictEqual(plan.completedSteps, ["step-001"]);
    });

    it("should include output keys from resume context", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));

      const plan = await manager.recoverWorkflow("wf-789");
      assert.ok(plan !== null);
      assert.ok(Array.isArray(plan.outputKeys));
    });

    it("should fall back to last checkpoint step if nextStepId is null", async () => {
      await manager.createCheckpoint(
        createTestInput({
          stepId: "step-001",
          completedStepIds: ["step-001"],
          nextStepId: null, // Workflow ended
        }),
      );

      const plan = await manager.recoverWorkflow("wf-789");
      assert.ok(plan !== null);
      assert.strictEqual(plan.resumeFromStepId, "step-001"); // Resume from last completed step
    });

    it("should include artifact ID for checkpoint reference", async () => {
      await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));

      const plan = await manager.recoverWorkflow("wf-789");
      assert.ok(plan !== null);
      assert.ok(plan.artifactId.startsWith("artifact_"));
    });
  });
});
