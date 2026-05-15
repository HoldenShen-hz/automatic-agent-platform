import assert from "node:assert/strict";
import test from "node:test";

import { PlanBuilder } from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { PlanEvaluator, estimatePlanTokens } from "../../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";

const observation = {
  taskId: "task-r20",
  timestamp: Date.now(),
  objective: "validate planner regressions",
  currentPhase: "planning",
  userIntent: {
    raw: "validate planner regressions",
    normalized: "validate planner regressions",
    confidence: 0.95,
  },
  blockers: [],
  codebaseSnapshot: {
    rootPath: process.cwd(),
    fileCount: 3,
    relevantFiles: [{ path: "src/index.ts" }],
  },
  environmentContext: {
    nodeVersion: process.version,
    platform: process.platform,
    workingDirectory: process.cwd(),
    availableTools: ["read", "apply_patch"],
  },
  historicalContext: {
    previousTaskIds: [],
    relatedMemoryRefs: [],
  },
  relevantMemory: [],
  fileRefs: ["src/index.ts"],
  metrics: {},
};

function createAssessment(overrides: Partial<{
  maxTokens: number;
  workerPoolCapacity: number;
}> = {}) {
  return {
    taskId: "task-r20",
    timestamp: Date.now(),
    situationRef: "task_situation:task-r20:1",
    phase: "pre-execution" as const,
    complexity: "complex" as const,
    risk: "medium" as const,
    riskAssessment: {
      level: "medium" as const,
      factors: [],
    },
    routingDecision: {
      division: "coding",
      workflow: "multi-step",
      rationale: "regression coverage",
    },
    resourceAllocation: {
      modelClass: "medium",
      maxTokens: overrides.maxTokens ?? 20_000,
      timeoutMs: 60_000,
      ...(overrides.workerPoolCapacity != null ? { workerPoolCapacity: overrides.workerPoolCapacity } : {}),
    },
    approvalPolicy: {
      required: false,
      level: "none" as const,
    },
    executionMode: "auto" as const,
    suggestedActions: [],
  };
}

function createPlan() {
  return {
    planId: "plan-r20",
    taskId: "task-r20",
    assessmentRef: "assessment:task-r20:1",
    version: 1,
    strategy: "dag" as const,
    steps: [
      {
        stepId: "step_a",
        action: "read",
        title: "A",
        inputs: {},
        outputs: ["a"],
        dependencies: [],
        status: "pending" as const,
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step_b",
        action: "read",
        title: "B",
        inputs: {},
        outputs: ["b"],
        dependencies: [],
        status: "pending" as const,
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step_c",
        action: "execute",
        title: "C",
        inputs: {},
        outputs: ["c"],
        dependencies: ["step_a", "step_b"],
        status: "pending" as const,
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    createdAt: Date.now(),
  };
}

test("R20-04 token estimation accounts for dependency depth and parallel branches", () => {
  const estimation = estimatePlanTokens(createPlan(), {
    avgInputTokensPerStep: 100,
    avgOutputTokensPerStep: 50,
    costPerMillionTokens: 1,
    overheadMultiplier: 1,
  });

  assert.equal(estimation.inputTokens, 400);
  assert.equal(estimation.outputTokens, 180);
  assert.equal(estimation.totalTokens, 580);
  assert.equal(estimation.costEstimateUsd, 0.00058);
});

test("R20-05 PlanEvaluator rejects plans whose concurrency exceeds worker pool capacity", () => {
  const evaluator = new PlanEvaluator();
  const evaluation = evaluator.evaluate(createPlan(), createAssessment({ workerPoolCapacity: 1 }));

  assert.equal(evaluation.viable, false);
  assert.ok(evaluation.issues.includes("planning.parallelism_limit_exceeded:2>1"));
});

test("R20-06 PlanBuilder returns canonical bundle metadata required by the contract", () => {
  const builder = new PlanBuilder();
  const plan = builder.build({
    observation,
    assessment: createAssessment(),
    workflow: {
      workflow: {
        workflowId: "wf-r20",
        divisionId: "coding",
        steps: [],
      },
      executionSteps: [
        {
          stepId: "step_a",
          divisionId: "coding",
          roleId: "planner",
          inputKeys: [],
          agentId: "agent-planner",
          outputKey: "a",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
        {
          stepId: "step_b",
          divisionId: "coding",
          roleId: "builder",
          inputKeys: ["a"],
          agentId: "agent-builder",
          outputKey: "b",
          outputSchemaPath: null,
          dependsOnStepIds: ["step_a"],
          dependencyTypes: { step_a: "hard" as const },
          timeoutMs: 1000,
          maxAttempts: 1,
        },
      ],
      planReason: "workflow.requires_multi_step_orchestration",
      dependencyEdges: [{ fromStepId: "step_a", toStepId: "step_b" }],
    },
  });

  assert.equal(typeof plan.planGraphBundleId, "string");
  assert.equal(plan.graphVersion, 1);
  assert.equal(plan.schedulerPolicy.strategy, "deterministic_fifo");
  assert.match(plan.budgetPlanRef, /^budget:\/\//);
  assert.equal(plan.riskProfile.riskClass, "medium");
  assert.equal(plan.validationReport.valid, true);
  assert.deepEqual(plan.graph.entryNodeIds, ["step_a"]);
  assert.deepEqual(plan.graph.terminalNodeIds, ["step_b"]);
});
