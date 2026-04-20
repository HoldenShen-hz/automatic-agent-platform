import test from "node:test";
import assert from "node:assert/strict";

import { TaskDecompositionService } from "../../../../../src/platform/orchestration/planner/task-decomposition-service.js";
import type { PlannedWorkflow, PlannedExecutionStep } from "../../../../../src/platform/orchestration/routing/workflow-planner.js";

function createMockExecutionStep(overrides: Partial<PlannedExecutionStep> = {}): PlannedExecutionStep {
  return {
    stepId: "step_1",
    divisionId: "div_alpha",
    roleId: "planner",
    inputKeys: [],
    agentId: "agent_planner",
    outputKey: "result_1",
    outputSchemaPath: null,
    dependsOnStepIds: [],
    dependencyTypes: {},
    timeoutMs: 30000,
    maxAttempts: 3,
    ...overrides,
  };
}

function createMockWorkflow(overrides: Partial<PlannedWorkflow> & { executionSteps?: PlannedExecutionStep[] } = {}): PlannedWorkflow {
  return {
    workflow: {
      workflowId: "wf_test",
      divisionId: "div_test",
      steps: [],
    },
    executionSteps: [createMockExecutionStep()],
    planReason: "Test plan",
    dependencyEdges: [],
    ...overrides,
  };
}

test("TaskDecompositionService.decompose maps step to title format stepId:outputKey", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow();

  const result = service.decompose(workflow);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, "step_1:result_1");
});

test("TaskDecompositionService.decompose preserves dependsOnStepIds", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        dependsOnStepIds: ["step_x", "step_y"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.dependsOn, ["step_x", "step_y"]);
});

test("TaskDecompositionService.decompose copies dependsOnStepIds (not reference)", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        dependsOnStepIds: ["step_x"],
      }),
    ],
  });

  const result = service.decompose(workflow);
  result[0]?.dependsOn.push("step_z"); // mutate result

  // original workflow should be unchanged
  const originalStep = workflow.executionSteps[0];
  assert.ok(originalStep);
  assert.deepEqual(originalStep.dependsOnStepIds, ["step_x"]);
});

test("TaskDecompositionService.decompose sets ownerRoleId from step.roleId", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({ stepId: "step_a", roleId: "executor" }),
      createMockExecutionStep({ stepId: "step_b", roleId: "reviewer" }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result[0]?.ownerRoleId, "executor");
  assert.equal(result[1]?.ownerRoleId, "reviewer");
});

test("TaskDecompositionService.decompose always includes read tool", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("read"));
});

test("TaskDecompositionService.decompose adds apply_patch when compensationModel is present", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        compensationModel: "compensating_action",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("apply_patch"));
});

test("TaskDecompositionService.decompose does not add apply_patch when compensationModel is absent", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(!result[0]?.toolNames.includes("apply_patch"));
});

test("TaskDecompositionService.decompose adds validate_output when outputSchemaPath is present", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        outputSchemaPath: "/schemas/step-output.json",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("validate_output"));
});

test("TaskDecompositionService.decompose does not add validate_output when outputSchemaPath is null", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        outputSchemaPath: null,
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(!result[0]?.toolNames.includes("validate_output"));
});

test("TaskDecompositionService.decompose handles both compensationModel and outputSchemaPath", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        compensationModel: "idempotent_replay",
        outputSchemaPath: "/schemas/step-output.json",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("read"));
  assert.ok(result[0]?.toolNames.includes("apply_patch"));
  assert.ok(result[0]?.toolNames.includes("validate_output"));
});

test("TaskDecompositionService.decompose returns empty array for workflow with no steps", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 0);
});

test("TaskDecompositionService.decompose handles multiple steps", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        roleId: "planner",
        outputKey: "output_a",
        dependsOnStepIds: [],
      }),
      createMockExecutionStep({
        stepId: "step_b",
        roleId: "executor",
        outputKey: "output_b",
        dependsOnStepIds: ["step_a"],
      }),
      createMockExecutionStep({
        stepId: "step_c",
        roleId: "reviewer",
        outputKey: "output_c",
        dependsOnStepIds: ["step_b"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 3);
  assert.equal(result[0]?.title, "step_a:output_a");
  assert.equal(result[1]?.title, "step_b:output_b");
  assert.equal(result[2]?.title, "step_c:output_c");
  assert.deepEqual(result[0]?.dependsOn, []);
  assert.deepEqual(result[1]?.dependsOn, ["step_a"]);
  assert.deepEqual(result[2]?.dependsOn, ["step_b"]);
});
