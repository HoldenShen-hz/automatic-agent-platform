import assert from "node:assert/strict";
import test from "node:test";

import {
  SINGLE_AGENT_MINIMAL_WORKFLOW,
  PHASE_1B_SINGLE_DIVISION_WORKFLOW,
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  type MinimalWorkflowStep,
  type MinimalWorkflowDefinition,
  type CompensationModel,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";

test("SINGLE_AGENT_MINIMAL_WORKFLOW has correct structure", () => {
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId, "single_agent_minimal");
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId, "general_ops");
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.steps.length, 1);

  const step = SINGLE_AGENT_MINIMAL_WORKFLOW.steps[0]!;
  assert.equal(step.stepId, "analyze_request");
  assert.equal(step.roleId, "general_executor");
  assert.equal(step.outputKey, "analysis");
  assert.equal(step.timeoutMs, 120_000);
  assert.equal(step.maxAttempts, 1);
  assert.equal(step.compensationModel, "idempotent_replay");
});

test("PHASE_1B_SINGLE_DIVISION_WORKFLOW has correct structure", () => {
  assert.equal(PHASE_1B_SINGLE_DIVISION_WORKFLOW.workflowId, "single_division_multi_step_orchestration");
  assert.equal(PHASE_1B_SINGLE_DIVISION_WORKFLOW.divisionId, "general_ops");
  assert.equal(PHASE_1B_SINGLE_DIVISION_WORKFLOW.steps.length, 3);

  const steps = PHASE_1B_SINGLE_DIVISION_WORKFLOW.steps;
  const intake = steps[0]!;
  const draft = steps[1]!;
  const review = steps[2];

  assert.ok(review !== undefined, "review step should exist");
  assert.equal(intake.stepId, "intake_triage");
  assert.equal(intake.roleId, "intake_router");
  assert.deepEqual(intake.inputKeys, undefined);
  assert.equal(intake.dependsOnStepIds, undefined);

  assert.equal(draft.stepId, "draft_solution");
  assert.equal(draft.roleId, "general_executor");
  assert.deepEqual(draft.inputKeys, ["triage"]);
  assert.deepEqual(draft.dependsOnStepIds, ["intake_triage"]);

  assert.equal(review.stepId, "final_review");
  assert.equal(review.roleId, "workflow_planner");
  assert.deepEqual(review.inputKeys, ["draft"]);
  assert.deepEqual(review.dependsOnStepIds, ["draft_solution"]);
});

test("WORKFLOW_DEFINITIONS contains both built-in workflows", () => {
  assert.equal(WORKFLOW_DEFINITIONS.size, 2);
  assert.ok(WORKFLOW_DEFINITIONS.has("single_agent_minimal"));
  assert.ok(WORKFLOW_DEFINITIONS.has("single_division_multi_step_orchestration"));
});

test("MinimalWorkflowStep interface accepts all compensation models", () => {
  const models: CompensationModel[] = [
    "idempotent_replay",
    "compare_and_swap_write",
    "compensating_action",
    "manual_reconciliation_required",
  ];
  assert.equal(models.length, 4);
});

test("MinimalWorkflowStep can have soft dependency type", () => {
  const step: MinimalWorkflowStep = {
    stepId: "conditional_step",
    roleId: "executor",
    outputKey: "result",
    timeoutMs: 60_000,
    maxAttempts: 1,
    dependsOnStepIds: ["predecessor"],
    dependencyTypes: { predecessor: "soft" },
  };

  assert.deepEqual(step.dependencyTypes, { predecessor: "soft" });
});

test("MinimalWorkflowStep can have hard dependency type", () => {
  const step: MinimalWorkflowStep = {
    stepId: "required_step",
    roleId: "executor",
    outputKey: "result",
    timeoutMs: 60_000,
    maxAttempts: 1,
    dependsOnStepIds: ["predecessor"],
    dependencyTypes: { predecessor: "hard" },
  };

  assert.deepEqual(step.dependencyTypes, { predecessor: "hard" });
});

test("MinimalWorkflowStep divisionId is optional", () => {
  const step: MinimalWorkflowStep = {
    stepId: "no_division",
    roleId: "executor",
    outputKey: "result",
    timeoutMs: 60_000,
    maxAttempts: 1,
  };

  assert.equal(step.divisionId, undefined);
  assert.equal(step.outputSchemaPath, undefined);
});

test("MinimalWorkflowStep with all optional fields", () => {
  const step: MinimalWorkflowStep = {
    stepId: "full_step",
    divisionId: "engineering_ops",
    roleId: "engineer",
    inputKeys: ["input1", "input2"],
    outputKey: "output",
    outputSchemaPath: "/schemas/output.json",
    timeoutMs: 300_000,
    maxAttempts: 3,
    dependsOnStepIds: ["dep1", "dep2"],
    dependencyTypes: { dep1: "hard", dep2: "soft" },
    compensationModel: "compensating_action",
  };

  assert.equal(step.divisionId, "engineering_ops");
  assert.deepEqual(step.inputKeys, ["input1", "input2"]);
  assert.equal(step.outputSchemaPath, "/schemas/output.json");
  assert.equal(step.timeoutMs, 300_000);
  assert.equal(step.maxAttempts, 3);
  assert.equal(step.compensationModel, "compensating_action");
});

test("MinimalWorkflowDefinition structure", () => {
  const definition: MinimalWorkflowDefinition = {
    workflowId: "test_workflow",
    divisionId: "test_ops",
    steps: [],
  };

  assert.equal(definition.workflowId, "test_workflow");
  assert.equal(definition.divisionId, "test_ops");
  assert.deepEqual(definition.steps, []);
});

test("PHASE_1B workflow steps have correct dependency chain", () => {
  const steps = PHASE_1B_SINGLE_DIVISION_WORKFLOW.steps;
  const intake = steps[0]!;
  const draft = steps[1]!;
  const review = steps[2]!;

  // intake_triage has no dependencies
  assert.equal(intake.dependsOnStepIds, undefined);
  assert.equal(intake.inputKeys, undefined);

  // draft_solution depends on intake_triage
  assert.deepEqual(draft.dependsOnStepIds, ["intake_triage"]);
  assert.deepEqual(draft.inputKeys, ["triage"]);

  // final_review depends on draft_solution
  assert.deepEqual(review.dependsOnStepIds, ["draft_solution"]);
  assert.deepEqual(review.inputKeys, ["draft"]);
});

test("SINGLE_AGENT workflow has no dependencies", () => {
  const step = SINGLE_AGENT_MINIMAL_WORKFLOW.steps[0]!;
  assert.equal(step.dependsOnStepIds, undefined);
  assert.equal(step.inputKeys, undefined);
});

test("all built-in workflows have valid step IDs", () => {
  for (const workflow of [SINGLE_AGENT_MINIMAL_WORKFLOW, PHASE_1B_SINGLE_DIVISION_WORKFLOW]) {
    for (const step of workflow.steps) {
      assert.ok(step.stepId.length > 0, "stepId should not be empty");
      assert.ok(step.roleId.length > 0, "roleId should not be empty");
      assert.ok(step.outputKey.length > 0, "outputKey should not be empty");
    }
  }
});

test("all built-in workflows have valid timeouts", () => {
  for (const workflow of [SINGLE_AGENT_MINIMAL_WORKFLOW, PHASE_1B_SINGLE_DIVISION_WORKFLOW]) {
    for (const step of workflow.steps) {
      assert.ok(step.timeoutMs > 0, "timeoutMs should be positive");
    }
  }
});

test("all built-in workflows have valid maxAttempts", () => {
  for (const workflow of [SINGLE_AGENT_MINIMAL_WORKFLOW, PHASE_1B_SINGLE_DIVISION_WORKFLOW]) {
    for (const step of workflow.steps) {
      assert.ok(step.maxAttempts >= 1, "maxAttempts should be at least 1");
    }
  }
});
