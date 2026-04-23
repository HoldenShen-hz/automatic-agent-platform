/**
 * Integration Tests: Workflow Planner
 *
 * Tests the WorkflowPlanner which transforms workflow definitions
 * into executable PlannedWorkflows with proper agent assignments
 * and dependency edges.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowPlanner } from "../../../../../../src/platform/orchestration/routing/workflow-planner.js";
import { StorageError } from "../../../../../../src/platform/contracts/errors.js";

test("WorkflowPlanner: creates execution plan for single-step workflow", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Analyze this request",
  });

  assert.equal(planned.executionSteps.length, 1);
  assert.equal(planned.workflow.workflowId, "single_agent_minimal");
  assert.equal(planned.executionSteps[0].stepId, "analyze_request");
  assert.equal(planned.executionSteps[0].roleId, "general_executor");
  assert.equal(planned.executionSteps[0].agentId, "agent_general_executor");
});

test("WorkflowPlanner: creates execution plan for multi-step workflow", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Execute multi-step workflow",
  });

  assert.equal(planned.executionSteps.length, 3);
  assert.equal(planned.planReason, "workflow.requires_multi_step_orchestration");
});

test("WorkflowPlanner: assigns correct division to steps", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Test",
  });

  assert.equal(planned.executionSteps[0].divisionId, "general_ops");
});

test("WorkflowPlanner: sets correct input/output keys from workflow definition", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Test",
  });

  const triageStep = planned.executionSteps.find((s) => s.stepId === "intake_triage");
  const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
  const reviewStep = planned.executionSteps.find((s) => s.stepId === "final_review");

  assert.deepEqual(triageStep?.inputKeys, []);
  assert.deepEqual(triageStep?.outputKey, "triage");

  assert.deepEqual(draftStep?.inputKeys, ["triage"]);
  assert.deepEqual(draftStep?.outputKey, "draft");

  assert.deepEqual(reviewStep?.inputKeys, ["draft"]);
  assert.deepEqual(reviewStep?.outputKey, "final");
});

test("WorkflowPlanner: builds correct dependency edges", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Test",
  });

  const triageEdges = planned.dependencyEdges.filter((e) => e.toStepId === "draft_solution");
  assert.equal(triageEdges.length, 1);
  assert.equal(triageEdges[0].fromStepId, "intake_triage");

  const draftEdges = planned.dependencyEdges.filter((e) => e.toStepId === "final_review");
  assert.equal(draftEdges.length, 1);
  assert.equal(draftEdges[0].fromStepId, "draft_solution");
});

test("WorkflowPlanner: uses single_step_execution reason for single-step workflow", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Test",
  });

  assert.equal(planned.planReason, "workflow.single_step_execution");
});

test("WorkflowPlanner: throws StorageError for unknown workflow ID", () => {
  const planner = new WorkflowPlanner();

  assert.throws(
    () =>
      planner.plan({
        workflowId: "nonexistent_workflow",
        request: "Test",
      }),
    (err: unknown) => err instanceof StorageError && err.code === "workflow.not_found:nonexistent_workflow",
  );
});

test("WorkflowPlanner: preserves timeout and maxAttempts from definition", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Test",
  });

  const triageStep = planned.executionSteps.find((s) => s.stepId === "intake_triage");
  assert.equal(triageStep?.timeoutMs, 60_000);
  assert.equal(triageStep?.maxAttempts, 1);

  const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
  assert.equal(draftStep?.timeoutMs, 180_000);
  assert.equal(draftStep?.maxAttempts, 2);
});

test("WorkflowPlanner: sets dependency types with hard as default", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Test",
  });

  const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
  assert.deepEqual(draftStep?.dependencyTypes, { intake_triage: "hard" });

  const reviewStep = planned.executionSteps.find((s) => s.stepId === "final_review");
  assert.deepEqual(reviewStep?.dependencyTypes, { draft_solution: "hard" });
});

test("WorkflowPlanner: includes compensation model when defined", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Test",
  });

  const step = planned.executionSteps[0];
  assert.equal(step.compensationModel, "idempotent_replay");
});

test("WorkflowPlanner: sets output schema path when defined", () => {
  const planner = new WorkflowPlanner();
  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Test",
  });

  const step = planned.executionSteps[0];
  assert.ok(step.outputSchemaPath != null);
});
