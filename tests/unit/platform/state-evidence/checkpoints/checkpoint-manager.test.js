/**
 * Unit tests for CheckpointManager
 *
 * Tests checkpoint management operations including creation,
 * retrieval, progress tracking, and workflow recovery.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";

/**
 * Mock CheckpointManager for testing checkpoint coordination logic
 */
class MockCheckpointManager {
  constructor() {
    this.checkpoints = new Map();
    this.artifacts = new Map();
  }

  async createCheckpoint(input) {
    const producedAt = new Date(Date.now() + this.checkpoints.size).toISOString();
    const checkpoint = createWorkflowStepCheckpoint({
      harnessRunId: `harness_${Date.now()}`,
      nodeRunId: input.nodeRunId ?? null,
      planGraphBundleId: input.planGraphBundleId ?? `bundle_${input.workflowId}`,
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
        source: input.decisionContext?.source ?? "test",
        request: input.decisionContext?.request ?? "test request",
        routeReason: input.decisionContext?.routeReason ?? null,
        priorStepSummaries: input.decisionContext?.priorStepSummaries ?? [],
        dependsOnStepIds: input.decisionContext?.dependsOnStepIds ?? [],
      },
      resumeContext: {
        completedStepIds: input.completedStepIds ?? [],
        nextStepId: input.nextStepId ?? null,
        outputKeys: input.outputKeys ?? [],
      },
      fileDiffSummary: input.fileDiffSummary ?? {
        summary: null,
        createdPaths: [],
        updatedPaths: [],
        deletedPaths: [],
      },
      upstreamArtifactRefs: input.upstreamArtifactRefs ?? [],
      compensationModel: input.compensationModel ?? null,
    });

    const artifactId = `artifact_${input.workflowId}_${input.stepId}_${Date.now()}`;
    this.checkpoints.set(artifactId, checkpoint);
    this.artifacts.set(artifactId, {
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
    });

    return { artifactId, checkpoint };
  }

  async getLatestCheckpoint(workflowId) {
    let latest = null;
    let latestTime = "";

    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.workflowId === workflowId && checkpoint.producedAt > latestTime) {
        latest = checkpoint;
        latestTime = checkpoint.producedAt;
      }
    }

    return latest;
  }

  async getCheckpointByStep(workflowId, stepId) {
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.workflowId === workflowId && checkpoint.stepId === stepId) {
        return checkpoint;
      }
    }
    return null;
  }

  async getWorkflowProgress(workflowId) {
    const workflowCheckpoints = [];
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.workflowId === workflowId) {
        workflowCheckpoints.push(checkpoint);
      }
    }

    if (workflowCheckpoints.length === 0) {
      return null;
    }

    const completedSteps = new Set();
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

  async recoverWorkflow(workflowId) {
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

  clear() {
    this.checkpoints.clear();
    this.artifacts.clear();
  }
}

function createTestInput(overrides = {}) {
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

// CheckpointManager Tests

test("CheckpointManager createCheckpoint creates checkpoint with correct structure", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({ stepId: "step-001" });
    const { artifactId, checkpoint } = await manager.createCheckpoint(input);

    assert.ok(artifactId.startsWith("artifact_"));
    assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
    assert.equal(checkpoint.taskId, input.taskId);
    assert.equal(checkpoint.workflowId, input.workflowId);
    assert.equal(checkpoint.stepId, input.stepId);
    assert.equal(checkpoint.status, input.status);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint preserves decision context", async () => {
  const manager = new MockCheckpointManager();
  try {
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

    assert.equal(checkpoint.decisionContext.source, "test-source");
    assert.equal(checkpoint.decisionContext.request, "test request");
    assert.equal(checkpoint.decisionContext.routeReason, "test reason");
    assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, ["step 1 done", "step 2 done"]);
    assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, ["step-001", "step-002"]);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint builds resume context from completed steps", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({
      completedStepIds: ["step-a", "step-b", "step-c"],
      nextStepId: "step-d",
    });
    const { checkpoint } = await manager.createCheckpoint(input);

    assert.deepEqual(checkpoint.resumeContext.completedStepIds, ["step-a", "step-b", "step-c"]);
    assert.equal(checkpoint.resumeContext.nextStepId, "step-d");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint handles null executionId", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({ executionId: null });
    const { checkpoint } = await manager.createCheckpoint(input);
    assert.equal(checkpoint.executionId, null);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint handles failed status", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({ status: "failed" });
    const { checkpoint } = await manager.createCheckpoint(input);
    assert.equal(checkpoint.status, "failed");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint handles skipped status", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({ status: "skipped" });
    const { checkpoint } = await manager.createCheckpoint(input);
    assert.equal(checkpoint.status, "skipped");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getLatestCheckpoint returns null for non-existent workflow", async () => {
  const manager = new MockCheckpointManager();
  try {
    const result = await manager.getLatestCheckpoint("non-existent");
    assert.equal(result, null);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getLatestCheckpoint returns most recent checkpoint by producedAt time", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));
    await manager.createCheckpoint(createTestInput({ stepId: "step-002" }));
    await manager.createCheckpoint(createTestInput({ stepId: "step-003" }));

    const latest = await manager.getLatestCheckpoint("wf-789");
    assert.ok(latest !== null);
    assert.equal(latest.stepId, "step-003");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getLatestCheckpoint returns checkpoint with all fields populated", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput());
    const latest = await manager.getLatestCheckpoint("wf-789");

    assert.ok(latest !== null);
    assert.ok(latest.producedAt);
    assert.ok(latest.output);
    assert.ok(latest.decisionContext);
    assert.ok(latest.resumeContext);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getCheckpointByStep returns null for non-existent step", async () => {
  const manager = new MockCheckpointManager();
  try {
    const result = await manager.getCheckpointByStep("wf-789", "non-existent-step");
    assert.equal(result, null);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getCheckpointByStep retrieves correct checkpoint by step ID", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ stepId: "step-A" }));
    await manager.createCheckpoint(createTestInput({ stepId: "step-B" }));
    await manager.createCheckpoint(createTestInput({ stepId: "step-C" }));

    const checkpoint = await manager.getCheckpointByStep("wf-789", "step-B");
    assert.ok(checkpoint !== null);
    assert.equal(checkpoint.stepId, "step-B");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getCheckpointByStep returns correct workflow checkpoint only", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ workflowId: "wf-1", stepId: "step-X" }));
    await manager.createCheckpoint(createTestInput({ workflowId: "wf-2", stepId: "step-X" }));

    const wf1Checkpoint = await manager.getCheckpointByStep("wf-1", "step-X");
    const wf2Checkpoint = await manager.getCheckpointByStep("wf-2", "step-X");

    assert.ok(wf1Checkpoint !== null);
    assert.ok(wf2Checkpoint !== null);
    assert.equal(wf1Checkpoint.workflowId, "wf-1");
    assert.equal(wf2Checkpoint.workflowId, "wf-2");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getWorkflowProgress returns null for workflow with no checkpoints", async () => {
  const manager = new MockCheckpointManager();
  try {
    const result = await manager.getWorkflowProgress("non-existent");
    assert.equal(result, null);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getWorkflowProgress returns progress with completed steps", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({
      stepId: "step-001",
      completedStepIds: ["step-001"],
      nextStepId: "step-002",
    }));
    await manager.createCheckpoint(createTestInput({
      stepId: "step-002",
      completedStepIds: ["step-001", "step-002"],
      nextStepId: "step-003",
    }));

    const progress = await manager.getWorkflowProgress("wf-789");
    assert.ok(progress !== null);
    assert.equal(progress.workflowId, "wf-789");
    assert.ok(progress.completedSteps.includes("step-001"));
    assert.ok(progress.completedSteps.includes("step-002"));
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getWorkflowProgress tracks next step from latest checkpoint", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({
      stepId: "step-001",
      completedStepIds: ["step-001"],
      nextStepId: "step-002",
    }));
    await manager.createCheckpoint(createTestInput({
      stepId: "step-002",
      completedStepIds: ["step-001", "step-002"],
      nextStepId: null,
    }));

    const progress = await manager.getWorkflowProgress("wf-789");
    assert.ok(progress !== null);
    assert.equal(progress.nextStepId, null); // Workflow complete
  } finally {
    manager.clear();
  }
});

test("CheckpointManager getWorkflowProgress includes last checkpoint timestamp", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));

    const progress = await manager.getWorkflowProgress("wf-789");
    assert.ok(progress !== null);
    assert.ok(progress.lastCheckpointAt !== null);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager recoverWorkflow returns null for workflow with no checkpoints", async () => {
  const manager = new MockCheckpointManager();
  try {
    const result = await manager.recoverWorkflow("non-existent");
    assert.equal(result, null);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager recoverWorkflow returns recovery plan with resume step", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({
      stepId: "step-001",
      completedStepIds: ["step-001"],
      nextStepId: "step-002",
    }));

    const plan = await manager.recoverWorkflow("wf-789");
    assert.ok(plan !== null);
    assert.equal(plan.workflowId, "wf-789");
    assert.equal(plan.resumeFromStepId, "step-002");
    assert.deepEqual(plan.completedSteps, ["step-001"]);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager recoverWorkflow includes output keys from resume context", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));

    const plan = await manager.recoverWorkflow("wf-789");
    assert.ok(plan !== null);
    assert.ok(Array.isArray(plan.outputKeys));
  } finally {
    manager.clear();
  }
});

test("CheckpointManager recoverWorkflow falls back to last checkpoint step if nextStepId is null", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({
      stepId: "step-001",
      completedStepIds: ["step-001"],
      nextStepId: null, // Workflow ended
    }));

    const plan = await manager.recoverWorkflow("wf-789");
    assert.ok(plan !== null);
    assert.equal(plan.resumeFromStepId, "step-001"); // Resume from last completed step
  } finally {
    manager.clear();
  }
});

test("CheckpointManager recoverWorkflow includes artifact ID for checkpoint reference", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ stepId: "step-001" }));

    const plan = await manager.recoverWorkflow("wf-789");
    assert.ok(plan !== null);
    assert.ok(plan.artifactId.startsWith("artifact_"));
  } finally {
    manager.clear();
  }
});

test("CheckpointManager tracks multiple workflows independently", async () => {
  const manager = new MockCheckpointManager();
  try {
    await manager.createCheckpoint(createTestInput({ workflowId: "wf-A", stepId: "step-1" }));
    await manager.createCheckpoint(createTestInput({ workflowId: "wf-B", stepId: "step-1" }));
    await manager.createCheckpoint(createTestInput({ workflowId: "wf-A", stepId: "step-2" }));

    const progressA = await manager.getWorkflowProgress("wf-A");
    const progressB = await manager.getWorkflowProgress("wf-B");

    assert.ok(progressA !== null);
    assert.ok(progressB !== null);
    assert.equal(progressA.completedSteps.length, 2);
    assert.equal(progressB.completedSteps.length, 1);
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint with nodeRunId and planGraphBundleId per R4-18", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({
      nodeRunId: "node_run_456",
      planGraphBundleId: "bundle_789",
    });
    const { checkpoint } = await manager.createCheckpoint(input);

    assert.equal(checkpoint.nodeRunId, "node_run_456");
    assert.equal(checkpoint.planGraphBundleId, "bundle_789");
  } finally {
    manager.clear();
  }
});

test("CheckpointManager createCheckpoint allows null nodeRunId for early stage", async () => {
  const manager = new MockCheckpointManager();
  try {
    const input = createTestInput({ nodeRunId: null });
    const { checkpoint } = await manager.createCheckpoint(input);
    assert.equal(checkpoint.nodeRunId, null);
  } finally {
    manager.clear();
  }
});
