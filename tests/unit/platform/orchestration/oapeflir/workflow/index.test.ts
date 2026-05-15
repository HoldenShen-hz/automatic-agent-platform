import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  SINGLE_AGENT_MINIMAL_WORKFLOW,
  PHASE_1B_SINGLE_DIVISION_WORKFLOW,
  WORKFLOW_DEFINITIONS,
  WorkflowValidator,
  getWorkflowDefinition,
  type CompensationModel,
  type MinimalWorkflowStep,
  type MinimalWorkflowDefinition,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/workflow/index.js";

test("CompensationModel type accepts valid values", () => {
  const models: CompensationModel[] = [
    "idempotent_replay",
    "compare_and_swap_write",
    "compensating_action",
    "manual_reconciliation_required",
  ];
  assert.equal(models.length, 4);
});

test("MinimalWorkflowStep structure is correct", () => {
  const step: MinimalWorkflowStep = {
    stepId: "step_1",
    roleId: "coder",
    outputKey: "result",
    timeoutMs: 60000,
    maxAttempts: 3,
  };
  assert.equal(step.stepId, "step_1");
  assert.equal(step.roleId, "coder");
  assert.equal(step.timeoutMs, 60000);
});

test("MinimalWorkflowDefinition structure is correct", () => {
  const workflow: MinimalWorkflowDefinition = {
    workflowId: "test_workflow",
    divisionId: "engineering",
    steps: [
      {
        stepId: "step_1",
        roleId: "coder",
        outputKey: "result",
        timeoutMs: 60000,
        maxAttempts: 3,
      },
    ],
  };
  assert.equal(workflow.workflowId, "test_workflow");
  assert.equal(workflow.steps.length, 1);
});

test("SINGLE_AGENT_MINIMAL_WORKFLOW is defined", () => {
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId, "single_agent_minimal");
  assert.ok(SINGLE_AGENT_MINIMAL_WORKFLOW.steps.length > 0);
});

test("PHASE_1B_SINGLE_DIVISION_WORKFLOW is defined", () => {
  assert.equal(PHASE_1B_SINGLE_DIVISION_WORKFLOW.workflowId, "single_division_multi_step_orchestration");
  assert.ok(PHASE_1B_SINGLE_DIVISION_WORKFLOW.steps.length > 0);
});

test("WORKFLOW_DEFINITIONS contains both workflows", () => {
  assert.equal(WORKFLOW_DEFINITIONS.size, 2);
  assert.ok(WORKFLOW_DEFINITIONS.has("single_agent_minimal"));
  assert.ok(WORKFLOW_DEFINITIONS.has("single_division_multi_step_orchestration"));
});

test("getWorkflowDefinition returns correct workflow", () => {
  const workflow = getWorkflowDefinition("single_agent_minimal");
  assert.ok(workflow !== null);
  assert.equal(workflow!.workflowId, "single_agent_minimal");
});

test("getWorkflowDefinition returns null for unknown workflow", () => {
  const workflow = getWorkflowDefinition("nonexistent");
  assert.equal(workflow, null);
});

test("workflow barrel exports validator", () => {
  assert.equal(typeof WorkflowValidator, "function");
});
