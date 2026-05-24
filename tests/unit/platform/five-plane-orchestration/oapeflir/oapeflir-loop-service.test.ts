import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

class DeterministicExecuteBridge implements ExecuteBridge {
  public async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 10,
      tokenCost: 5,
      summary: `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [`artifact:${step.stepId}`],
      modelId: "test-model",
      retryCount: 0,
      validationPassed: true,
    };
  }

  public async executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    return {
      planId: plan.planId,
      results: await Promise.all(plan.steps.map((step) => this.executeStep(step, context))),
      totalDurationMs: plan.steps.length * 10,
      totalTokenCost: plan.steps.length * 5,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  public toDualChannelStepOutputs(result: ExecutionResult) {
    return result.results.map((stepResult) => ({
      stepId: stepResult.stepId,
      planRef: result.planId,
      userFacingResult: {
        summary: stepResult.summary,
        artifacts: [...stepResult.artifacts],
      },
      systemTelemetry: {
        durationMs: stepResult.durationMs,
        tokensUsed: stepResult.tokenCost,
        modelId: stepResult.modelId,
        retryCount: stepResult.retryCount,
        validationPassed: stepResult.validationPassed,
      },
    }));
  }

  public async executeSubgraph(subgraph: PlanStep[], context: ExecutionContext): Promise<ExecutionResult> {
    return this.executePlan({
      planId: "subgraph-plan",
      taskId: context.taskId,
      version: 1,
      assessmentRef: "assessment:subgraph",
      strategy: "linear",
      steps: subgraph,
      createdAt: Date.now(),
    }, context);
  }

  public async executeChildRun(plan: Plan, context: ExecutionContext, _parentRunId: string): Promise<ExecutionResult> {
    return this.executePlan(plan, context);
  }
}

function createWorkflow(taskId: string) {
  return {
    workflow: { workflowId: `wf:${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: [{
      stepId: `step:${taskId}`,
      divisionId: "coding",
      roleId: "writer",
      inputKeys: [],
      agentId: "agent_writer",
      outputKey: "result",
      outputSchemaPath: null,
      dependsOnStepIds: [],
      dependencyTypes: {},
      timeoutMs: 1_000,
      maxAttempts: 1,
    }],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };
}

test("OapeflirLoopService runs a single-step workflow end-to-end", async () => {
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task-loop-service",
    objective: "test loop service",
    workflow: createWorkflow("task-loop-service"),
  });

  assert.equal(result.planGraphBundle.graph.nodes.length, 1);
  assert.equal(result.stepOutputs.length, 1);
  assert.equal(result.stepOutputs[0]?.userFacingResult.summary, "Executed step:task-loop-service");
});

test("OapeflirLoopService generates a graph patch when feedback requests replanning", async () => {
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task-loop-replan",
    objective: "test replanning",
    workflow: createWorkflow("task-loop-replan"),
    feedbackSignals: [{
      signalId: "signal-replan",
      taskId: "task-loop-replan",
      source: "validation",
      category: "failure",
      severity: "error",
      payload: { summary: "schema failed", reasonCode: "schema_loop.detected" },
      stepOutputRefs: ["step:task-loop-replan"],
      timestamp: Date.now(),
      feedbackTrustScore: 0.5,
      trustFactors: {
        sourceReliability: 0.5,
        historicalAccuracy: 0.5,
        authenticatedSource: false,
        attackSurfaceExposure: 0.5,
        holdoutOverlap: 0,
      },
    }],
    stepOutputs: [{
      stepId: "step:task-loop-replan",
      planRef: "plan:task-loop-replan",
      userFacingResult: {
        summary: "Executed step:task-loop-replan",
        artifacts: ["artifact:task-loop-replan"],
      },
      systemTelemetry: {
        durationMs: 10,
        tokensUsed: 5,
        modelId: "test-model",
        retryCount: 0,
        validationPassed: false,
      },
    }],
  });

  assert.equal(result.replanDecision.shouldReplan, true);
  assert.ok(result.graphPatch != null);
  assert.ok(result.graphPatch!.operations.length > 0);
});
