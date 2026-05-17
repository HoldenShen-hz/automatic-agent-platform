import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowPlanner } from "../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { PlanBuilder } from "../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { PlanDagValidator } from "../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import { PlanStrategySelector } from "../../../../src/platform/five-plane-orchestration/planner/plan-strategy-selector.js";
import { TaskDecompositionService } from "../../../../src/platform/five-plane-orchestration/planner/task-decomposition-service.js";

function createMinimalObservation(taskId: string) {
  return {
    taskId,
    timestamp: Date.now(),
    objective: "build and validate a workflow plan",
    currentPhase: "planning" as const,
    userIntent: { raw: "plan task", normalized: "plan task", confidence: 0.9 },
    blockers: [],
    codebaseSnapshot: { rootPath: ".", fileCount: 1, relevantFiles: [] },
    environmentContext: {
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      availableTools: ["read", "grep"],
    },
    historicalContext: { previousTaskIds: [], relatedMemoryRefs: [] },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };
}

function createMinimalAssessment(taskId: string, risk: "low" | "medium" | "high" | "critical" = "medium") {
  return {
    taskId,
    timestamp: Date.now(),
    situationRef: `task_situation:${taskId}:1`,
    phase: "pre-execution" as const,
    complexity: "moderate" as const,
    risk,
    riskAssessment: { level: risk, factors: [] },
    routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
    resourceAllocation: { modelClass: "small", maxTokens: 8000, timeoutMs: 60000 },
    approvalPolicy: { required: false, level: "none" as const },
    executionMode: "auto" as const,
    suggestedActions: [],
  };
}

test("E2E Planner: workflow planner resolves the canonical workflow definition", () => {
  const planner = new WorkflowPlanner();

  const workflow = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Decompose and execute a multi-step task.",
  });

  assert.ok(workflow.executionSteps.length > 1);
  assert.ok(workflow.dependencyEdges.length > 0);
});

test("E2E Planner: plan builder emits a graph bundle with ordered steps", () => {
  const workflowPlanner = new WorkflowPlanner();
  const builder = new PlanBuilder();
  const workflow = workflowPlanner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Create a plan graph for execution.",
  });

  const plan = builder.build({
    observation: createMinimalObservation("task-plan-build"),
    assessment: createMinimalAssessment("task-plan-build"),
    workflow,
  });

  assert.equal(plan.taskId, "task-plan-build");
  assert.ok(plan.steps.length > 1);
  assert.ok(plan.graph.entryNodeIds.length > 0);
  assert.ok(plan.graph.terminalNodeIds.length > 0);
});

test("E2E Planner: DAG validator accepts the built plan steps", () => {
  const workflowPlanner = new WorkflowPlanner();
  const builder = new PlanBuilder();
  const validator = new PlanDagValidator();
  const workflow = workflowPlanner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Validate plan ordering and dependencies.",
  });

  const plan = builder.build({
    observation: createMinimalObservation("task-plan-validate"),
    assessment: createMinimalAssessment("task-plan-validate"),
    workflow,
  });
  const validation = validator.validate(plan.steps);

  assert.equal(validation.valid, true);
  assert.equal(validation.orderedSteps.length, plan.steps.length);
});

test("E2E Planner: strategy selector and decomposition follow the current workflow contract", () => {
  const workflowPlanner = new WorkflowPlanner();
  const selector = new PlanStrategySelector();
  const decomposition = new TaskDecompositionService();
  const workflow = workflowPlanner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Reach the target with a coordinated plan.",
  });

  const strategy = selector.select({
    observation: createMinimalObservation("task-plan-strategy"),
    assessment: createMinimalAssessment("task-plan-strategy", "medium"),
    workflow,
  });
  const tasks = decomposition.decompose(workflow);

  assert.equal(typeof strategy, "string");
  assert.equal(tasks.length, workflow.executionSteps.length);
  assert.ok(tasks.every((task) => typeof task.ownerRoleId === "string"));
});
