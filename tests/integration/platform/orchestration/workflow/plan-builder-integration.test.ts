/**
 * Integration Tests: Plan Builder Service
 *
 * Tests the PlanBuilder class which transforms PlannedWorkflows into
 * executable Plans, integrating with TaskDecompositionService,
 * PlanDagValidator, and PlanStrategySelector.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../../../src/platform/contracts/types/ids.js";
import type { PlannedWorkflow } from "../../../../../../src/platform/orchestration/routing/workflow-planner.js";
import { WorkflowPlanner } from "../../../../../../src/platform/orchestration/routing/workflow-planner.js";
import { PlanBuilder } from "../../../../../../src/platform/orchestration/planner/plan-builder.js";
import { TaskDecompositionService } from "../../../../../../src/platform/orchestration/planner/task-decomposition-service.js";
import { PlanDagValidator } from "../../../../../../src/platform/orchestration/planner/plan-dag-validator.js";
import { PlanStrategySelector } from "../../../../../../src/platform/orchestration/planner/plan-strategy-selector.js";
import type { TaskSituation, UnifiedAssessment } from "../../../../../../src/platform/orchestration/oapeflir/types/index.js";
import { createAssessmentRef, parsePlan } from "../../../../../../src/platform/orchestration/oapeflir/types/index.js";

function createMinimalPlannedWorkflow(): PlannedWorkflow {
  const planner = new WorkflowPlanner();
  return planner.plan({
    workflowId: "single_agent_minimal",
    request: "Test request",
  });
}

function createMultiStepPlannedWorkflow(): PlannedWorkflow {
  const planner = new WorkflowPlanner();
  return planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Test multi-step request",
  });
}

function createMockTaskSituation(taskId: string): TaskSituation {
  return {
    taskId,
    turn: 0,
    channel: "api",
   NL: "test input",
    normalizedInput: "test input",
    structuredInput: {},
    contextIds: {},
    activeRoles: [],
    divisionId: "general_ops",
    timestamp: Date.now(),
  };
}

function createMockAssessment(): UnifiedAssessment {
  return {
    ref: createAssessmentRef({
      assessmentId: newId("assessment"),
      taskId: newId("task"),
      createdAt: Date.now(),
    }),
    confidence: 0.9,
    riskLevel: "low",
    reasoning: "Test assessment",
    suggestions: [],
    annotations: {},
  };
}

test("PlanBuilder: builds plan from single-step workflow", () => {
  const workflow = createMinimalPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const plan = builder.build({
    observation,
    assessment,
    workflow,
  });

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.stepId, "analyze_request");
  assert.equal(plan.steps[0]?.status, "pending");
  assert.ok(parsePlan(plan), "Plan should be valid");
});

test("PlanBuilder: builds plan from multi-step workflow", () => {
  const workflow = createMultiStepPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const plan = builder.build({
    observation,
    assessment,
    workflow,
  });

  assert.equal(plan.steps.length, 3);
  assert.equal(plan.steps[0]?.stepId, "intake_triage");
  assert.equal(plan.steps[1]?.stepId, "draft_solution");
  assert.equal(plan.steps[2]?.stepId, "final_review");
  assert.ok(parsePlan(plan), "Plan should be valid");
});

test("PlanBuilder: plan version increments on replan", () => {
  const workflow = createMinimalPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const originalPlan = builder.build({
    observation,
    assessment,
    workflow,
  });

  const replanned = builder.replan(originalPlan, {
    observation,
    assessment,
    workflow,
  });

  assert.equal(replanned.version, originalPlan.version + 1);
  assert.equal(replanned.parentVersion, originalPlan.version);
});

test("PlanBuilder: sets correct step dependencies from workflow", () => {
  const workflow = createMultiStepPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const plan = builder.build({
    observation,
    assessment,
    workflow,
  });

  const triageStep = plan.steps.find((s) => s.stepId === "intake_triage");
  const draftStep = plan.steps.find((s) => s.stepId === "draft_solution");
  const reviewStep = plan.steps.find((s) => s.stepId === "final_review");

  assert.deepEqual(triageStep?.dependencies, []);
  assert.deepEqual(draftStep?.dependencies, ["intake_triage"]);
  assert.deepEqual(reviewStep?.dependencies, ["draft_solution"]);
});

test("PlanBuilder: uses correct strategy for initial plan", () => {
  const workflow = createMinimalPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const plan = builder.build({
    observation,
    assessment,
    workflow,
  });

  assert.ok(
    plan.strategy === "linear" ||
      plan.strategy === "hierarchical" ||
      plan.strategy === "tree_branch" ||
      plan.strategy === "reflexive" ||
      plan.strategy === "goal_driven" ||
      plan.strategy === "resource_constrained" ||
      plan.strategy === "online",
    `Expected valid strategy, got: ${plan.strategy}`,
  );
});

test("PlanBuilder: uses replanned strategy for subsequent plans", () => {
  const workflow = createMinimalPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const originalPlan = builder.build({
    observation,
    assessment,
    workflow,
    version: 1,
  });

  const replanned = builder.replan(originalPlan, {
    observation,
    assessment,
    workflow,
  });

  assert.equal(replanned.strategy, "replanned");
});

test("PlanBuilder: assigns correct timeout from workflow step", () => {
  const workflow = createMultiStepPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const plan = builder.build({
    observation,
    assessment,
    workflow,
  });

  const triageStep = plan.steps.find((s) => s.stepId === "intake_triage");
  assert.equal(triageStep?.timeout, 60_000);

  const draftStep = plan.steps.find((s) => s.stepId === "draft_solution");
  assert.equal(draftStep?.timeout, 180_000);

  const reviewStep = plan.steps.find((s) => s.stepId === "final_review");
  assert.equal(reviewStep?.timeout, 90_000);
});

test("PlanBuilder: retry policy derived from maxAttempts", () => {
  const workflow = createMultiStepPlannedWorkflow();
  const builder = new PlanBuilder();
  const observation = createMockTaskSituation(newId("task"));
  const assessment = createMockAssessment();

  const plan = builder.build({
    observation,
    assessment,
    workflow,
  });

  const triageStep = plan.steps.find((s) => s.stepId === "intake_triage");
  assert.equal(triageStep?.retryPolicy.maxRetries, 0);

  const draftStep = plan.steps.find((s) => s.stepId === "draft_solution");
  assert.equal(draftStep?.retryPolicy.maxRetries, 1);

  const reviewStep = plan.steps.find((s) => s.stepId === "final_review");
  assert.equal(reviewStep?.retryPolicy.maxRetries, 0);
});

test("TaskDecompositionService: decomposes workflow steps correctly", () => {
  const service = new TaskDecompositionService();
  const workflow = createMultiStepPlannedWorkflow();

  const decompositions = service.decompose(workflow);

  assert.equal(decompositions.length, 3);
  assert.equal(decompositions[0].title, "intake_triage:triage");
  assert.deepEqual(decompositions[0].dependsOn, []);
  assert.equal(decompositions[0].ownerRoleId, "intake_router");
});

test("TaskDecompositionService: includes compensation tools when compensationModel is set", () => {
  const service = new TaskDecompositionService();
  const workflow = createMultiStepPlannedWorkflow();

  const decompositions = service.decompose(workflow);

  const draftStep = decompositions.find((d) => d.title.includes("draft_solution"));
  assert.ok(draftStep?.toolNames.includes("apply_patch"));
});

test("TaskDecompositionService: includes validate_output tool when outputSchemaPath is set", () => {
  const service = new TaskDecompositionService();
  const workflow = createMultiStepPlannedWorkflow();

  const decompositions = service.decompose(workflow);

  for (const decomp of decompositions) {
    assert.ok(decomp.toolNames.includes("validate_output"));
  }
});
