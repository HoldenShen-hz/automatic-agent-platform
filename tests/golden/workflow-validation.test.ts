import assert from "node:assert/strict";
import test from "node:test";

import { PlanBuilder } from "../../src/platform/orchestration/planner/plan-builder.js";
import { minimalWorkflowToPlanGraphBundle } from "../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { TaskSituation } from "../../src/platform/orchestration/oapeflir/types/task-situation.js";
import type { UnifiedAssessment } from "../../src/platform/orchestration/oapeflir/types/unified-assessment.js";

function makeObservation(taskId: string): TaskSituation {
  return {
    taskId,
    timestamp: Date.now(),
    objective: "Golden graph validation",
    currentPhase: "plan",
    userIntent: {
      category: "automation",
      summary: "build graph",
      requestedOutcome: "validated",
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/workspace",
      relevantFiles: [],
      signals: [],
    },
    environmentContext: {
      availableTools: ["read", "write"],
      executionMode: "workspace_write",
      networkAccess: false,
      secretsAvailable: false,
    },
    historicalContext: {
      relatedTasks: [],
      priorAttempts: [],
      domainInsights: [],
    },
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  };
}

function makeAssessment(taskId: string): UnifiedAssessment {
  return {
    taskId,
    timestamp: Date.now(),
    situationRef: `task_situation:${taskId}`,
    phase: "pre-execution",
    complexity: "simple",
    risk: "low",
    riskAssessment: {
      level: "low",
      factors: [],
    },
    routingDecision: {
      division: "ops",
      workflow: "wf-golden",
      rationale: "golden regression",
    },
    resourceAllocation: {
      modelClass: "balanced",
      maxTokens: 4000,
      timeoutMs: 30_000,
    },
    approvalPolicy: {
      required: false,
      level: "none",
    },
    executionMode: "auto",
    suggestedActions: [],
  };
}

test("golden: minimal workflow converts into canonical PlanGraphBundle", () => {
  const bundle = minimalWorkflowToPlanGraphBundle(
    {
      workflowId: "golden-workflow",
      steps: [
        {
          stepId: "step-1",
          roleId: "planner",
          outputKey: "step1",
          inputKeys: [],
          timeoutMs: 60_000,
          maxAttempts: 1,
          dependsOnStepIds: [],
        },
        {
          stepId: "step-2",
          roleId: "reviewer",
          outputKey: "step2",
          inputKeys: ["step1"],
          timeoutMs: 60_000,
          maxAttempts: 2,
          dependsOnStepIds: ["step-1"],
        },
      ],
    },
    "hrun-golden-001",
  );

  assert.equal(bundle.harnessRunId, "hrun-golden-001");
  assert.deepEqual(bundle.graph.entryNodeIds, ["step-1"]);
  assert.deepEqual(bundle.graph.terminalNodeIds, ["step-2"]);
  assert.equal(bundle.graph.nodes.length, 2);
  assert.equal(bundle.graph.edges.length, 1);
  assert.equal(bundle.validationReport.valid, true);
});

test("golden: PlanBuilder emits validation, risk propagation and worst path on canonical graph", () => {
  const builder = new PlanBuilder();
  const bundle = builder.build({
    observation: makeObservation("golden-task-001"),
    assessment: makeAssessment("golden-task-001"),
    workflow: {
      workflow: {} as never,
      executionSteps: [
        {
          stepId: "prepare",
          divisionId: "ops",
          roleId: "planner",
          inputKeys: [],
          agentId: "agent_prepare",
          outputKey: "prepare",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 5_000,
          maxAttempts: 1,
        },
        {
          stepId: "deploy",
          divisionId: "ops",
          roleId: "executor",
          inputKeys: ["prepare"],
          agentId: "agent_deploy",
          outputKey: "deploy",
          outputSchemaPath: null,
          dependsOnStepIds: ["prepare"],
          dependencyTypes: { prepare: "hard" },
          timeoutMs: 7_000,
          maxAttempts: 2,
        },
      ],
      dependencyEdges: [{ fromStepId: "prepare", toStepId: "deploy" }],
      planReason: "golden.plan_graph_bundle",
    },
    harnessRunId: "hrun-golden-graph-001",
  });

  assert.equal(bundle.validationReport.valid, true);
  assert.ok(bundle.validationReport.worstPath);
  assert.equal(bundle.graph.nodes.length, 2);
  assert.equal(bundle.graph.edges.length, 1);
  assert.deepEqual(bundle.graph.entryNodeIds, ["prepare"]);
  assert.deepEqual(bundle.graph.terminalNodeIds, ["deploy"]);
});
