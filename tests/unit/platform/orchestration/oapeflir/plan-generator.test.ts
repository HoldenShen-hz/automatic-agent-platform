import assert from "node:assert/strict";
import test from "node:test";

import { PlanBuilder } from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { PlanDagValidator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import { PlanStrategySelector } from "../../../../../src/platform/five-plane-orchestration/planner/plan-strategy-selector.js";
import { parsePlan, type PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { UnifiedAssessment, TaskSituation } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import type { PlannedWorkflow } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

function createObservation(taskId: string, tools: string[] = ["read"]): TaskSituation {
  return {
    taskId,
    objective: "implement change",
    phase: "planning",
    blockers: [],
    fileRefs: [],
    codebaseSnapshot: { rootPath: "/repo", fileCount: 10 },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/repo",
      availableTools: tools,
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
    userIntent: {
      raw: "implement change",
      normalized: "implement change",
      confidence: 0.9,
    },
    metrics: {},
  };
}

function createAssessment(overrides: Partial<UnifiedAssessment> = {}): UnifiedAssessment {
  return {
    taskId: "task-1",
    timestamp: Date.now(),
    situationRef: "assessment:task-1",
    phase: "pre-execution",
    complexity: "moderate",
    risk: "low",
    riskAssessment: { level: "low", factors: [] },
    routingDecision: { division: "coding", workflow: "default", rationale: "test" },
    resourceAllocation: { modelClass: "medium", maxTokens: 4_000, timeoutMs: 60_000 },
    approvalPolicy: { required: false, level: "none" },
    executionMode: "auto",
    suggestedActions: [],
    ...overrides,
  };
}

function createWorkflow(taskId: string, multiDivision = false): PlannedWorkflow {
  return {
    workflow: {
      workflowId: `workflow:${taskId}`,
      divisionId: "coding",
      steps: [],
    },
    executionSteps: [
      {
        stepId: "step-1",
        divisionId: "coding",
        roleId: "planner",
        inputKeys: [],
        agentId: "agent_planner",
        outputKey: "plan",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1_000,
        maxAttempts: 1,
      },
      {
        stepId: "step-2",
        divisionId: multiDivision ? "ops" : "coding",
        roleId: "writer",
        inputKeys: ["plan"],
        agentId: "agent_writer",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: ["step-1"],
        dependencyTypes: { "step-1": "hard" },
        timeoutMs: 2_000,
        maxAttempts: 2,
      },
    ],
    dependencyEdges: [{ fromStepId: "step-1", toStepId: "step-2" }],
    planReason: "workflow.requires_multi_step_orchestration",
  };
}

test("PlanDagValidator orders a valid DAG", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step-1",
      action: "read",
      title: "Read",
      inputs: {},
      dependencies: [],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-2",
      action: "write",
      title: "Write",
      inputs: {},
      dependencies: ["step-1"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);
  assert.equal(result.valid, true);
  assert.deepEqual(result.orderedSteps.map((step) => step.stepId), ["step-1", "step-2"]);
});

test("PlanDagValidator rejects cycles", () => {
  const validator = new PlanDagValidator();
  const steps: PlanStep[] = [
    {
      stepId: "step-1",
      action: "read",
      title: "Read",
      inputs: {},
      dependencies: ["step-2"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step-2",
      action: "write",
      title: "Write",
      inputs: {},
      dependencies: ["step-1"],
      status: "pending",
      timeout: 1_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const result = validator.validate(steps);
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("planning.cycle_detected"));
});

test("PlanStrategySelector promotes destructive workflows to reflexive strategy", () => {
  const selector = new PlanStrategySelector();
  const strategy = selector.select({
    observation: createObservation("task-risky", ["read", "apply_patch"]),
    assessment: createAssessment(),
    workflow: createWorkflow("task-risky"),
  });

  assert.equal(strategy, "reflexive");
});

test("PlanStrategySelector chooses hierarchical strategy for multi-division workflows", () => {
  const selector = new PlanStrategySelector();
  const strategy = selector.select({
    observation: createObservation("task-hierarchical", ["read"]),
    assessment: createAssessment({ complexity: "complex" }),
    workflow: createWorkflow("task-hierarchical", true),
  });

  assert.equal(strategy, "hierarchical");
});

test("PlanBuilder produces a parseable plan graph bundle", () => {
  const builder = new PlanBuilder();
  const plan = builder.build({
    observation: createObservation("task-build"),
    assessment: createAssessment(),
    workflow: createWorkflow("task-build"),
    harnessRunId: "run-1",
  });

  const parsed = parsePlan(plan);
  assert.equal(parsed.steps.length, 2);
  assert.equal(plan.graph.nodes.length, 2);
  assert.equal(plan.graph.entryNodeIds[0], "step-1");
  assert.equal(plan.graph.terminalNodeIds[0], "step-2");
  assert.equal(plan.strategy, "linear");
});
