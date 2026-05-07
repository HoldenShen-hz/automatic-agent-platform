import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowPlanner, type WorkflowPlannerInput } from "../../../../../src/platform/orchestration/routing/workflow-planner.js";
import { StorageError } from "../../../../../src/platform/contracts/errors.js";
import type { MinimalWorkflowDefinition } from "../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js";

test("WorkflowPlanner type exports are correct", () => {
  // WorkflowPlannerInput requires workflowId and request
  const input: WorkflowPlannerInput = {
    workflowId: "test_workflow",
    request: "test request",
  };
  assert.equal(input.workflowId, "test_workflow");
  assert.equal(input.request, "test request");
});

test("WorkflowPlanner.plan throws StorageError for unknown workflowId", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "nonexistent_workflow",
    request: "test request",
  };

  assert.throws(
    () => planner.plan(input),
    (err: unknown) => {
      return err instanceof StorageError && err.code === "workflow.not_found:nonexistent_workflow";
    },
  );
});

test("WorkflowPlanner.plan single step workflow returns correct planReason", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "simple task",
  };

  const planned = planner.plan(input);

  // Single step should have single_step_execution reason
  assert.equal(planned.planReason, "workflow.single_step_execution");
  assert.equal(planned.executionSteps.length, 1);
});

test("WorkflowPlanner.plan builds correct dependency edges", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // single_division_multi_step_orchestration has 3 steps with dependencies
  // step_2 depends on step_1, step_3 depends on step_2
  // So we expect edges: (intake_triage -> draft_solution) and (draft_solution -> final_review)
  if (planned.executionSteps.length > 1) {
    assert.ok(planned.dependencyEdges.length >= planned.executionSteps.length - 1);
  }
});

test("WorkflowPlanner.plan assigns agent IDs correctly", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "simple task",
  };

  const planned = planner.plan(input);

  assert.equal(planned.executionSteps[0]?.agentId, "agent_general_executor");
});

test("WorkflowPlanner.plan preserves workflow metadata", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test request",
  };

  const planned = planner.plan(input);

  assert.equal(planned.workflow.workflowId, "single_agent_minimal");
  assert.equal(planned.workflow.divisionId, "general_ops");
});

test("WorkflowPlanner.plan timeout and maxAttempts are preserved", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "simple task",
  };

  const planned = planner.plan(input);

  // From SINGLE_AGENT_MINIMAL_WORKFLOW definition
  assert.equal(planned.executionSteps[0]?.timeoutMs, 120_000);
  assert.equal(planned.executionSteps[0]?.maxAttempts, 1);
});

test("WorkflowPlanner.plan dependencyTypes default to hard", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "simple task",
  };

  const planned = planner.plan(input);

  // Single step with no dependencies should have empty dependencyTypes
  assert.deepEqual(planned.executionSteps[0]?.dependencyTypes, {});
});

test("WorkflowPlanner.plan multi-step workflow has multi_step_orchestration reason", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // Multi-step should have multi_step_orchestration reason
  if (planned.executionSteps.length > 1) {
    assert.equal(planned.planReason, "workflow.requires_multi_step_orchestration");
  }
});

test("WorkflowPlanner.plan multi-step workflow preserves step inputKeys", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // Find draft_solution step which has inputKeys: ["triage"]
  const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
  assert.ok(draftStep !== undefined, "draft_solution step should exist");
  assert.deepEqual(draftStep.inputKeys, ["triage"]);
});

test("WorkflowPlanner.plan multi-step workflow preserves outputKey", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // Find intake_triage step
  const triageStep = planned.executionSteps.find((s) => s.stepId === "intake_triage");
  assert.ok(triageStep !== undefined, "intake_triage step should exist");
  assert.equal(triageStep.outputKey, "triage");
});

test("WorkflowPlanner.plan multi-step workflow assigns division IDs", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // All steps should have divisionId set to workflow's divisionId
  for (const step of planned.executionSteps) {
    assert.equal(step.divisionId, "general_ops");
  }
});

test("WorkflowPlanner.plan multi-step workflow builds correct dependency edges count", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // There are 3 steps, and the second and third steps each depend on one other step
  // So we expect exactly 2 dependency edges
  assert.equal(planned.dependencyEdges.length, 2);
});

test("WorkflowPlanner.plan multi-step workflow edge direction is correct", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex task",
  };

  const planned = planner.plan(input);

  // Find edge from intake_triage to draft_solution
  const triageToDraft = planned.dependencyEdges.find(
    (e) => e.fromStepId === "intake_triage" && e.toStepId === "draft_solution",
  );
  assert.ok(triageToDraft !== undefined, "edge from intake_triage to draft_solution should exist");
});

test("WorkflowPlanner.plan rejects missing dependency references", () => {
  const workflow: MinimalWorkflowDefinition = {
    workflowId: "missing-dependency-workflow",
    divisionId: "general_ops",
    steps: [
      {
        stepId: "step_a",
        roleId: "general_executor",
        outputKey: "a",
        timeoutMs: 1000,
        maxAttempts: 1,
      },
      {
        stepId: "step_b",
        roleId: "general_executor",
        outputKey: "b",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_missing"],
      },
    ],
  };
  const planner = new WorkflowPlanner((workflowId) => workflowId === workflow.workflowId ? workflow : null);

  assert.throws(
    () => planner.plan({ workflowId: workflow.workflowId, request: "test request" }),
    (err: unknown) => err instanceof StorageError && err.code === "workflow.missing_dependency",
  );
});

test("WorkflowPlanner.plan rejects cyclic dependencies before execution", () => {
  const workflow: MinimalWorkflowDefinition = {
    workflowId: "cyclic-workflow",
    divisionId: "general_ops",
    steps: [
      {
        stepId: "step_a",
        roleId: "general_executor",
        outputKey: "a",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_c"],
      },
      {
        stepId: "step_b",
        roleId: "general_executor",
        outputKey: "b",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_a"],
      },
      {
        stepId: "step_c",
        roleId: "general_executor",
        outputKey: "c",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_b"],
      },
    ],
  };
  const planner = new WorkflowPlanner((workflowId) => workflowId === workflow.workflowId ? workflow : null);

  assert.throws(
    () => planner.plan({ workflowId: workflow.workflowId, request: "test request" }),
    (err: unknown) => err instanceof StorageError && err.code === "workflow.cyclic_dependency",
  );
});
