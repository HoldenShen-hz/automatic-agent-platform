import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
  createWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  type CreateWorkflowStepCheckpointInput,
  type WorkflowStepCheckpoint,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/index.js";

class MockCheckpointStore {
  private readonly checkpoints = new Map<string, WorkflowStepCheckpoint>();

  public async save(checkpoint: WorkflowStepCheckpoint): Promise<string> {
    const artifactId = `artifact:${checkpoint.workflowId}:${checkpoint.stepId}:${this.checkpoints.size + 1}`;
    this.checkpoints.set(artifactId, checkpoint);
    return artifactId;
  }

  public get(artifactId: string): WorkflowStepCheckpoint | null {
    return this.checkpoints.get(artifactId) ?? null;
  }

  public list(workflowId: string) {
    return [...this.checkpoints.entries()]
      .filter(([, checkpoint]) => checkpoint.workflowId === workflowId)
      .map(([artifactId, checkpoint]) => summarizeWorkflowStepCheckpoint(artifactId, checkpoint));
  }

  public delete(artifactId: string): boolean {
    return this.checkpoints.delete(artifactId);
  }
}

function createInput(overrides: Partial<CreateWorkflowStepCheckpointInput> = {}): CreateWorkflowStepCheckpointInput {
  return {
    harnessRunId: "harness-001",
    nodeRunId: null,
    planGraphId: "plan-001",
    taskId: "task-123",
    executionId: "exec-456",
    workflowId: "workflow-789",
    divisionId: "division-001",
    stepId: "step-001",
    roleId: "role-001",
    outputKey: "output-key",
    status: "succeeded",
    producedAt: "2026-05-24T00:00:00.000Z",
    output: { result: "success", nested: { value: 42 } },
    decisionContext: {
      source: "model:gpt-4o",
      request: "Process request",
      routeReason: "matched workflow",
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

test("checkpoint store saves and retrieves workflow step checkpoints", async () => {
  const store = new MockCheckpointStore();
  const checkpoint = createWorkflowStepCheckpoint(createInput({
    workflowId: "wf-test",
    stepId: "step-a",
  }));

  const artifactId = await store.save(checkpoint);
  const stored = store.get(artifactId);

  assert.ok(stored);
  assert.equal(stored.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
  assert.equal(stored.workflowId, "wf-test");
  assert.equal(stored.stepId, "step-a");
  assert.equal(stored.status, "succeeded");
});

test("checkpoint store lists summaries only for the requested workflow", async () => {
  const store = new MockCheckpointStore();

  await store.save(createWorkflowStepCheckpoint(createInput({ workflowId: "wf-a", stepId: "step-1" })));
  await store.save(createWorkflowStepCheckpoint(createInput({ workflowId: "wf-a", stepId: "step-2" })));
  await store.save(createWorkflowStepCheckpoint(createInput({ workflowId: "wf-b", stepId: "step-9" })));

  const summaries = store.list("wf-a");

  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries.map((entry) => entry.stepId).sort(), ["step-1", "step-2"]);
  assert.equal(summaries[0]?.planGraphId, "plan-001");
});

test("checkpoint preserves complex output and summary extraction", () => {
  const checkpoint = createWorkflowStepCheckpoint(createInput({
    output: {
      result: {
        files: [
          { path: "/a.txt", status: "created" },
          { path: "/b.txt", status: "updated" },
        ],
        metadata: { currentStep: 2 },
      },
      summary: "step summary",
      nested: { value: 12345 },
    },
  }));
  const output = checkpoint.output as {
    result: {
      files: Array<{ path: string; status: string }>;
      metadata: { currentStep: number };
    };
    summary: string;
    nested: { value: number };
  };
  const summary = summarizeWorkflowStepCheckpoint("artifact-1", checkpoint);

  assert.equal(output.result.files.length, 2);
  assert.equal(output.result.metadata.currentStep, 2);
  assert.equal(output.nested.value, 12345);
  assert.equal(summary.summary, "step summary");
  assert.equal(summary.nextNodeRunId, "node:step-002");
});

test("checkpoint store delete removes saved checkpoints", async () => {
  const store = new MockCheckpointStore();
  const artifactId = await store.save(createWorkflowStepCheckpoint(createInput()));

  assert.equal(store.delete(artifactId), true);
  assert.equal(store.get(artifactId), null);
  assert.equal(store.delete("missing-artifact"), false);
});
