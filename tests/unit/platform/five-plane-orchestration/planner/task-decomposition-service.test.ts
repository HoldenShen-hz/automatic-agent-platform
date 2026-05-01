/**
 * Task Decomposition Service Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TaskDecompositionService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/planner/task-decomposition-service.js";

function makeWorkflow() {
  return {
    workflowId: "wf-001",
    taskId: "task-001",
    divisionId: "division-1",
    executionSteps: [
      {
        stepId: "step-1",
        roleId: "planner",
        inputKeys: ["context"],
        outputKey: "plan",
        dependsOnStepIds: [],
        timeoutMs: 60000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        roleId: "generator",
        inputKeys: ["plan"],
        outputKey: "result",
        dependsOnStepIds: ["step-1"],
        timeoutMs: 120000,
        maxAttempts: 2,
        compensationModel: { compensationType: "rollback" },
      },
      {
        stepId: "step-3",
        roleId: "evaluator",
        inputKeys: ["result"],
        outputKey: "evaluation",
        dependsOnStepIds: ["step-2"],
        timeoutMs: 30000,
        maxAttempts: 1,
        outputSchemaPath: "/schemas/evaluation.json",
      },
    ],
  };
}

test("TaskDecompositionService.decompose produces correct number of decompositions", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  assert.equal(result.length, 3);
});

test("TaskDecompositionService.decompose handles step with no dependencies", () => {
  const service = new TaskDecompositionService();
  const wf = {
    workflowId: "wf-001",
    taskId: "task-001",
    divisionId: "division-1",
    executionSteps: [
      {
        stepId: "step-1",
        roleId: "planner",
        inputKeys: [],
        outputKey: "plan",
        dependsOnStepIds: [],
        timeoutMs: 60000,
        maxAttempts: 1,
      },
    ],
  };

  const result = service.decompose(wf);

  assert.equal(result[0].dependsOn.length, 0);
  assert.equal(result[0].ownerRoleId, "planner");
});

test("TaskDecompositionService.decompose copies dependsOnStepIds as dependsOn", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  assert.deepEqual(result[1].dependsOn, ["step-1"]);
  assert.deepEqual(result[2].dependsOn, ["step-2"]);
});

test("TaskDecompositionService.decompose sets ownerRoleId from step roleId", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  assert.equal(result[0].ownerRoleId, "planner");
  assert.equal(result[1].ownerRoleId, "generator");
  assert.equal(result[2].ownerRoleId, "evaluator");
});

test("TaskDecompositionService.decompose adds 'read' tool when step has dependencies", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  // step-1 has no dependencies - should not get 'read'
  assert.ok(!result[0].toolNames.includes("read"));
  // step-2 has dependsOn - should get 'read' + others
  assert.ok(result[1].toolNames.includes("read"));
});

test("TaskDecompositionService.decompose adds 'apply_patch' when step has compensationModel", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  // step-2 has compensationModel
  assert.ok(result[1].toolNames.includes("apply_patch"));
});

test("TaskDecompositionService.decompose adds 'validate_output' when step has outputSchemaPath", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  // step-3 has outputSchemaPath
  assert.ok(result[2].toolNames.includes("validate_output"));
});

test("TaskDecompositionService.decompose builds correct title", () => {
  const service = new TaskDecompositionService();
  const result = service.decompose(makeWorkflow());

  assert.equal(result[0].title, "step-1:plan");
  assert.equal(result[1].title, "step-2:result");
  assert.equal(result[2].title, "step-3:evaluation");
});

test("TaskDecompositionService.decompose handles empty workflow", () => {
  const service = new TaskDecompositionService();
  const wf = {
    workflowId: "wf-empty",
    taskId: "task-empty",
    divisionId: "division-1",
    executionSteps: [],
  };

  const result = service.decompose(wf);

  assert.equal(result.length, 0);
});