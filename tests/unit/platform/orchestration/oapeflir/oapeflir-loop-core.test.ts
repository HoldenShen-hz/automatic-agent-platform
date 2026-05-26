import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService, type OapeflirLoopInput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.js";
import type { GoalDecompositionResult } from "../../../../../src/interaction/goal-decomposer/index.js";

function makeInput(overrides: Partial<OapeflirLoopInput> = {}): OapeflirLoopInput {
  return {
    taskId: overrides.taskId ?? "task-1",
    objective: overrides.objective ?? "inspect repository state",
    workflow: overrides.workflow ?? {
      workflow: {
        workflowId: "workflow-1",
        divisionId: "coding",
        steps: [],
      },
      executionSteps: [{
        stepId: "step-1",
        divisionId: "coding",
        roleId: "operator",
        inputKeys: [],
        agentId: "agent_operator",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1_000,
        maxAttempts: 1,
      }],
      planReason: "workflow.single_step_execution",
      dependencyEdges: [],
    },
    feedbackSignals: overrides.feedbackSignals,
    blockerSummaries: overrides.blockerSummaries,
    fileRefs: overrides.fileRefs,
    stepOutputs: overrides.stepOutputs,
    constraintPack: overrides.constraintPack,
    effectivePolicy: overrides.effectivePolicy,
    goalDecomposition: overrides.goalDecomposition,
    requiresOrchestration: overrides.requiresOrchestration,
  };
}

function makeGoalDecomposition(overrides: Partial<GoalDecompositionResult> = {}): GoalDecompositionResult {
  return {
    goalId: "goal-1",
    tasks: [{
      taskId: "step-1",
      domainId: "coding",
      description: "Inspect repository state",
      inputs: {},
      expectedOutputs: ["result"],
      delegationMode: "auto",
      estimatedDuration: "PT1M",
      estimatedCost: {
        estimatedCostUsd: 0.05,
        confidence: "default",
        sampleCount: 0,
        divisionId: "coding",
        basedOn: "default",
      },
    }],
    dependencyGraph: [],
    estimatedDuration: "PT1M",
    estimatedCost: {
      estimatedCostUsd: 0.05,
      confidence: "default",
      sampleCount: 0,
      divisionId: "coding",
      basedOn: "default",
    },
    riskSummary: {
      overallRisk: "low",
      riskFactors: [],
      reversible: true,
      sideEffects: [],
      approvalNeeded: false,
    },
    decompositionConfidence: 0.92,
    requiresHumanReview: false,
    decompositionStrategy: "template",
    topologicallySortedTaskIds: ["step-1"],
    parallelTaskGroups: [["step-1"]],
    criticalPathTaskIds: ["step-1"],
    depthUsed: 1,
    maxDepthReached: false,
    lifecycleState: "decomposed",
    goalGraphDraft: {
      goalId: "goal-1",
      lifecycleState: "decomposed",
      constraintEnvelope: {
        budgetLimitUsd: null,
        riskTolerance: "high",
        requiresApproval: false,
        requiredPermissions: [],
        requiredCapabilities: [],
      },
      plannerIntent: "template",
      evidenceRefs: [],
    },
    taskGraphDraft: {
      graphId: "goal-1:graph",
      goalId: "goal-1",
      tasks: [],
      dependencyGraph: [],
      normalized: true,
      validationMessages: [],
      worstPathTaskIds: ["step-1"],
    },
    plannerHandoff: {
      handoffId: "handoff-1",
      goalId: "goal-1",
      state: "ready_for_planner",
      graphId: "goal-1:graph",
      constraintEnvelope: {
        budgetLimitUsd: null,
        riskTolerance: "high",
        requiresApproval: false,
        requiredPermissions: [],
        requiredCapabilities: [],
      },
    },
    ...overrides,
  };
}

test("OapeflirLoopService constructs with default dependencies", () => {
  const service = new OapeflirLoopService();

  assert.ok(service);
  assert.equal(typeof service.run, "function");
});

test("OapeflirLoopInput accepts canonical workflow payloads", () => {
  const input = makeInput({
    blockerSummaries: ["missing approval"],
    fileRefs: ["src/index.ts"],
  });

  assert.equal(input.taskId, "task-1");
  assert.equal(input.workflow.executionSteps[0]?.stepId, "step-1");
  assert.deepEqual(input.blockerSummaries, ["missing approval"]);
  assert.deepEqual(input.fileRefs, ["src/index.ts"]);
});

test("OapeflirLoopService forces orchestration-aware assessment when requested", async () => {
  const service = new OapeflirLoopService();

  const result = await service.run(makeInput({
    requiresOrchestration: true,
    stepOutputs: [{
      stepId: "step-1",
      planRef: "plan-1",
      userFacingResult: { summary: "provided", artifacts: [] },
      systemTelemetry: {
        durationMs: 1,
        tokensUsed: 1,
        modelId: "manual",
        retryCount: 0,
        validationPassed: true,
      },
    }],
  }));

  assert.equal(result.assessment.routingDecision.workflow, "multi-step");
  assert.equal(result.assessment.executionMode, "supervised");
  assert.ok(result.assessment.suggestedActions.includes("require_orchestration"));
});

test("OapeflirLoopService rejects goal decomposition that does not align with workflow steps", async () => {
  const service = new OapeflirLoopService();

  await assert.rejects(
    async () => {
      await service.run(makeInput({
        goalDecomposition: makeGoalDecomposition({
          tasks: [{
            taskId: "step-mismatch",
            domainId: "coding",
            description: "Different step",
            inputs: {},
            expectedOutputs: ["result"],
            delegationMode: "auto",
            estimatedDuration: "PT1M",
            estimatedCost: {
              estimatedCostUsd: 0.05,
              confidence: "default",
              sampleCount: 0,
              divisionId: "coding",
              basedOn: "default",
            },
          }],
          topologicallySortedTaskIds: ["step-mismatch"],
          criticalPathTaskIds: ["step-mismatch"],
          taskGraphDraft: {
            graphId: "goal-1:graph",
            goalId: "goal-1",
            tasks: [],
            dependencyGraph: [],
            normalized: true,
            validationMessages: [],
            worstPathTaskIds: ["step-mismatch"],
          },
        }),
      }));
    },
    /oapeflir\.goal_decomposition_workflow_mismatch/,
  );
});
