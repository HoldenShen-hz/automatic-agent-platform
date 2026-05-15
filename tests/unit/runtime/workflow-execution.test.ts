/**
 * Unit Tests: Workflow Execution
 *
 * Tests for workflow planning, step execution, and workflow definitions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowPlanner, type WorkflowPlannerInput } from "../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import {
  SINGLE_AGENT_MINIMAL_WORKFLOW,
  PHASE_1B_SINGLE_DIVISION_WORKFLOW,
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
} from "../../../src/platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";
import { StorageError } from "../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Minimal Workflow Definitions Tests
// ---------------------------------------------------------------------------

test("SINGLE_AGENT_MINIMAL_WORKFLOW has correct structure", () => {
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.workflowId, "single_agent_minimal");
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.divisionId, "general_ops");
  assert.equal(SINGLE_AGENT_MINIMAL_WORKFLOW.steps.length, 1);
});

test("SINGLE_AGENT_MINIMAL_WORKFLOW has correct step configuration", () => {
  const step = SINGLE_AGENT_MINIMAL_WORKFLOW.steps[0];
  assert.ok(step != null, "should have at least one step");
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
});

test("PHASE_1B_SINGLE_DIVISION_WORKFLOW has correct step dependencies", () => {
  const steps = PHASE_1B_SINGLE_DIVISION_WORKFLOW.steps;
  assert.ok(steps.length === 3, "should have 3 steps");

  // First step - no dependencies
  assert.equal(steps[0]!.stepId, "intake_triage");
  assert.deepEqual(steps[0]!.dependsOnStepIds, []);

  // Second step - depends on first
  assert.equal(steps[1]!.stepId, "draft_solution");
  assert.deepEqual(steps[1]!.dependsOnStepIds, ["intake_triage"]);

  // Third step - depends on second
  assert.equal(steps[2]!.stepId, "final_review");
  assert.deepEqual(steps[2]!.dependsOnStepIds, ["draft_solution"]);
});

test("PHASE_1B_SINGLE_DIVISION_WORKFLOW has correct input/output keys", () => {
  const steps = PHASE_1B_SINGLE_DIVISION_WORKFLOW.steps;
  assert.ok(steps.length === 3, "should have 3 steps");

  // First step produces triage
  assert.equal(steps[0]!.outputKey, "triage");
  assert.deepEqual(steps[0]!.inputKeys, []);

  // Second step consumes triage, produces draft
  assert.deepEqual(steps[1]!.inputKeys, ["triage"]);
  assert.equal(steps[1]!.outputKey, "draft");

  // Third step consumes draft, produces final
  assert.deepEqual(steps[2]!.inputKeys, ["draft"]);
  assert.equal(steps[2]!.outputKey, "final");
});

// ---------------------------------------------------------------------------
// WORKFLOW_DEFINITIONS Registry Tests
// ---------------------------------------------------------------------------

test("WORKFLOW_DEFINITIONS contains built-in workflows", () => {
  assert.ok(WORKFLOW_DEFINITIONS.size >= 2);
  assert.ok(WORKFLOW_DEFINITIONS.has("single_agent_minimal"));
  assert.ok(WORKFLOW_DEFINITIONS.has("single_division_multi_step_orchestration"));
});

test("WORKFLOW_DEFINITIONS returns correct workflow by ID", () => {
  const workflow = WORKFLOW_DEFINITIONS.get("single_agent_minimal");
  assert.ok(workflow != null);
  assert.equal(workflow.workflowId, "single_agent_minimal");
});

test("getWorkflowDefinition returns null for unknown workflow ID", () => {
  const workflow = getWorkflowDefinition("nonexistent_workflow");
  assert.equal(workflow, null);
});

test("getWorkflowDefinition returns built-in workflow by ID", () => {
  const workflow = getWorkflowDefinition("single_agent_minimal");
  assert.ok(workflow != null);
  assert.equal(workflow.workflowId, "single_agent_minimal");
});

test("getWorkflowDefinition returns phase_1b workflow", () => {
  const workflow = getWorkflowDefinition("single_division_multi_step_orchestration");
  assert.ok(workflow != null);
  assert.equal(workflow.steps.length, 3);
});

// ---------------------------------------------------------------------------
// WorkflowPlanner Tests
// ---------------------------------------------------------------------------

test("WorkflowPlanner can be instantiated", () => {
  const planner = new WorkflowPlanner();
  assert.ok(planner instanceof WorkflowPlanner);
});

test("WorkflowPlanner.plan() creates planned workflow for single_agent", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "analyze this request",
  };

  const planned = planner.plan(input);

  assert.equal(planned.workflow.workflowId, "single_agent_minimal");
  assert.ok(planned.executionSteps.length >= 1);
  assert.ok(planned.planReason.length > 0);
  assert.ok(planned.dependencyEdges.length >= 0);
});

test("WorkflowPlanner.plan() creates planned workflow for multi-step", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "analyze and review",
  };

  const planned = planner.plan(input);

  assert.equal(planned.workflow.workflowId, "single_division_multi_step_orchestration");
  assert.equal(planned.executionSteps.length, 3);
  assert.equal(planned.planReason, "workflow.requires_multi_step_orchestration");
});

test("WorkflowPlanner.plan() throws StorageError for unknown workflow", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "unknown_workflow",
    request: "test request",
  };

  assert.throws(
    () => planner.plan(input),
    StorageError,
  );
});

test("WorkflowPlanner.plan() assigns correct agent IDs to execution steps", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);
  const step = planned.executionSteps[0];
  assert.ok(step != null, "should have at least one step");
  assert.ok(step!.agentId.startsWith("agent_"));
  assert.ok(step!.agentId.includes(step!.roleId));
});

test("WorkflowPlanner.plan() computes correct dependency edges", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "test",
  };

  const planned = planner.plan(input);

  // Should have edges from triage -> draft_solution and draft_solution -> final_review
  assert.ok(planned.dependencyEdges.length >= 2);

  // Check specific edges
  const triageToDraft = planned.dependencyEdges.find(
    (e) => e.fromStepId === "intake_triage" && e.toStepId === "draft_solution",
  );
  assert.ok(triageToDraft != null);

  const draftToFinal = planned.dependencyEdges.find(
    (e) => e.fromStepId === "draft_solution" && e.toStepId === "final_review",
  );
  assert.ok(draftToFinal != null);
});

test("WorkflowPlanner.plan() preserves step division ID", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);

  for (const step of planned.executionSteps) {
    assert.ok(step.divisionId != null);
    assert.equal(step.divisionId, "general_ops");
  }
});

test("WorkflowPlanner.plan() computes correct timeoutMs and maxAttempts", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);
  const step = planned.executionSteps[0];
  assert.ok(step != null, "should have at least one step");
  assert.equal(step!.timeoutMs, 120_000);
  assert.equal(step!.maxAttempts, 1);
});

test("WorkflowPlanner.plan() handles step with no dependencies", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);
  const step = planned.executionSteps[0];
  assert.ok(step != null, "should have at least one step");
  assert.deepEqual(step!.dependsOnStepIds, []);
});

test("WorkflowPlanner.plan() uses single_step_execution reason for single step", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);

  assert.equal(planned.planReason, "workflow.single_step_execution");
});

test("WorkflowPlanner.plan() uses requires_multi_step_orchestration reason for multi-step", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "test",
  };

  const planned = planner.plan(input);

  assert.equal(planned.planReason, "workflow.requires_multi_step_orchestration");
});

test("WorkflowPlanner.plan() sets dependencyTypes to hard by default", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "test",
  };

  const planned = planner.plan(input);

  // Find draft_solution step which has dependencies
  const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
  assert.ok(draftStep != null);
  assert.equal(draftStep!.dependencyTypes["intake_triage"], "hard");
});

// ---------------------------------------------------------------------------
// PlannedExecutionStep Structure Tests
// ---------------------------------------------------------------------------

test("PlannedExecutionStep has all required fields", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);
  const step = planned.executionSteps[0];
  assert.ok(step != null, "should have at least one step");

  assert.ok(step!.stepId.length > 0);
  assert.ok(step!.divisionId.length > 0);
  assert.ok(step!.roleId.length > 0);
  assert.ok(step!.agentId.length > 0);
  assert.ok(step!.outputKey.length > 0);
  assert.ok(typeof step!.timeoutMs === "number");
  assert.ok(typeof step!.maxAttempts === "number");
  assert.ok(Array.isArray(step!.inputKeys));
  assert.ok(Array.isArray(step!.dependsOnStepIds));
  assert.ok(typeof step!.dependencyTypes === "object");
});

test("PlannedExecutionStep agentId follows naming convention", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);
  const step = planned.executionSteps[0];
  assert.ok(step != null, "should have at least one step");

  // agentId should be "agent_" + roleId
  assert.equal(step!.agentId, `agent_${step!.roleId}`);
});

test("PlannedExecutionStep outputSchemaPath can be null", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_agent_minimal",
    request: "test",
  };

  const planned = planner.plan(input);
  const step = planned.executionSteps[0];
  assert.ok(step != null, "should have at least one step");

  // outputSchemaPath can be null or a string
  assert.ok(step!.outputSchemaPath === null || typeof step!.outputSchemaPath === "string");
});

// ---------------------------------------------------------------------------
// Edge Case Tests
// ---------------------------------------------------------------------------

test("WorkflowPlanner.plan() throws with correct error code for missing workflow", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "definitely_does_not_exist",
    request: "test",
  };

  try {
    planner.plan(input);
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof StorageError);
    const error = err as StorageError;
    assert.ok(error.code.includes("workflow.not_found"));
  }
});

test("WorkflowPlanner.plan() preserves all step information for complex workflow", () => {
  const planner = new WorkflowPlanner();
  const input: WorkflowPlannerInput = {
    workflowId: "single_division_multi_step_orchestration",
    request: "complex multi-step task",
  };

  const planned = planner.plan(input);

  // Verify all three steps are properly planned
  const stepIds = planned.executionSteps.map((s) => s.stepId);
  assert.ok(stepIds.includes("intake_triage"));
  assert.ok(stepIds.includes("draft_solution"));
  assert.ok(stepIds.includes("final_review"));

  // Verify roles
  const roles = planned.executionSteps.map((s) => s.roleId);
  assert.ok(roles.includes("intake_router"));
  assert.ok(roles.includes("general_executor"));
  assert.ok(roles.includes("workflow_planner"));
});