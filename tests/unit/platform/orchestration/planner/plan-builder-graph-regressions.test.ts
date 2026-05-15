import assert from "node:assert/strict";
import test from "node:test";

import { PlanBuilder } from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import type { TaskSituation } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/task-situation.js";
import type { UnifiedAssessment } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/unified-assessment.js";

test("plan builder returns a graph bundle with validation, risk propagation and worst path", () => {
  const builder = new PlanBuilder();
  const observation: TaskSituation = {
    taskId: "task-1",
    timestamp: Date.now(),
    objective: "Reach target state",
    currentPhase: "execute",
    userIntent: {
      category: "automation",
      summary: "build plan",
      requestedOutcome: "done",
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
  const assessment: UnifiedAssessment = {
    taskId: "task-1",
    timestamp: Date.now(),
    situationRef: "task_situation:task-1:1",
    phase: "pre-execution",
    complexity: "simple",
    risk: "low",
    riskAssessment: {
      level: "low",
      factors: [],
    },
    routingDecision: {
      division: "ops",
      workflow: "wf-1",
      rationale: "test",
    },
    resourceAllocation: {
      modelClass: "balanced",
      maxTokens: 4000,
      timeoutMs: 30000,
    },
    approvalPolicy: {
      required: false,
      level: "none",
    },
    executionMode: "auto",
    suggestedActions: [],
  };
  const bundle = builder.build({
    observation,
    assessment,
    workflow: {
      workflow: {} as never,
      executionSteps: [
        {
          stepId: "step-a",
          divisionId: "ops",
          roleId: "planner",
          inputKeys: [],
          agentId: "agent_planner",
          outputKey: "a",
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 5_000,
          maxAttempts: 1,
        },
        {
          stepId: "step-b",
          divisionId: "ops",
          roleId: "reviewer",
          inputKeys: ["a"],
          agentId: "agent_reviewer",
          outputKey: "b",
          dependsOnStepIds: ["step-a"],
          dependencyTypes: { "step-a": "hard" },
          timeoutMs: 7_000,
          maxAttempts: 2,
        },
      ],
      dependencyEdges: [{ fromStepId: "step-a", toStepId: "step-b" }],
      planReason: "workflow.requires_multi_step_orchestration",
    },
    harnessRunId: "hrn_plan_1",
  });

  assert.equal(bundle.graph.nodes.length, 2);
  assert.equal(bundle.graph.edges.length, 1);
  assert.deepEqual(bundle.graph.entryNodeIds, ["step-a"]);
  assert.deepEqual(bundle.graph.terminalNodeIds, ["step-b"]);
  assert.equal(bundle.validationReport.valid, true);
  assert.ok(bundle.validationReport.worstPath);
});
