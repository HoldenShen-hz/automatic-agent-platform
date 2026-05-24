import assert from "node:assert/strict";
import test from "node:test";

import { TaskDecompositionService } from "../../../../../src/platform/five-plane-orchestration/planner/task-decomposition-service.js";
import type { PlannedWorkflow } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

function makeWorkflow(overrides: Partial<PlannedWorkflow> = {}): PlannedWorkflow {
  return {
    workflow: overrides.workflow ?? {
      workflowId: "workflow-1",
      divisionId: "ops",
      steps: [],
    },
    executionSteps: overrides.executionSteps ?? [
      {
        stepId: "step-1",
        divisionId: "ops",
        roleId: "operator",
        inputKeys: [],
        agentId: "agent_operator",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1_000,
        maxAttempts: 1,
      },
    ],
    planReason: overrides.planReason ?? "workflow.single_step_execution",
    dependencyEdges: overrides.dependencyEdges ?? [],
  };
}

test("TaskDecompositionService decomposes execution steps into titles and owners", () => {
  const service = new TaskDecompositionService();

  const [decomposition] = service.decompose(makeWorkflow());

  assert.ok(decomposition);
  assert.equal(decomposition.title, "step-1:result");
  assert.equal(decomposition.ownerRoleId, "operator");
  assert.deepEqual(decomposition.dependsOn, []);
});

test("TaskDecompositionService derives tool requirements from dependencies and validation hooks", () => {
  const service = new TaskDecompositionService();

  const [decomposition] = service.decompose(makeWorkflow({
    executionSteps: [{
      stepId: "step-2",
      divisionId: "ops",
      roleId: "reviewer",
      inputKeys: ["draft"],
      agentId: "agent_reviewer",
      outputKey: "approved",
      outputSchemaPath: "schemas/output.json",
      dependsOnStepIds: ["step-1"],
      dependencyTypes: { "step-1": "hard" },
      timeoutMs: 2_000,
      maxAttempts: 2,
      compensationModel: {
        strategy: "manual",
        compensateAction: "rollback",
      } as never,
    }],
  }));

  assert.deepEqual(decomposition?.dependsOn, ["step-1"]);
  assert.deepEqual(decomposition?.toolNames, ["read", "apply_patch", "validate_output"]);
});

test("TaskDecompositionService preserves workflow order for multiple steps", () => {
  const service = new TaskDecompositionService();

  const decomposition = service.decompose(makeWorkflow({
    executionSteps: [
      {
        stepId: "step-1",
        divisionId: "ops",
        roleId: "operator",
        inputKeys: [],
        agentId: "agent_operator",
        outputKey: "draft",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1_000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        divisionId: "ops",
        roleId: "reviewer",
        inputKeys: ["draft"],
        agentId: "agent_reviewer",
        outputKey: "approved",
        outputSchemaPath: null,
        dependsOnStepIds: ["step-1"],
        dependencyTypes: { "step-1": "hard" },
        timeoutMs: 1_000,
        maxAttempts: 1,
      },
    ],
  }));

  assert.deepEqual(decomposition.map((entry) => entry.title), ["step-1:draft", "step-2:approved"]);
});
