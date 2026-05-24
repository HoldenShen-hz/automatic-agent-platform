import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import type {
  ExecuteBridge,
  ExecutionContext,
  ExecutionResult,
  StepResult,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

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

async function runWithFeedback(taskId: string) {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  return service.run({
    taskId,
    objective: "verify graph patch generation",
    workflow: createWorkflow(taskId),
    stepOutputs: [{
      stepId: `step:${taskId}`,
      planRef: `plan:${taskId}`,
      userFacingResult: {
        summary: "executed",
        artifacts: [`artifact:${taskId}`],
      },
      systemTelemetry: {
        durationMs: 10,
        tokensUsed: 5,
        modelId: "test-model",
        retryCount: 0,
        validationPassed: true,
      },
    }],
    feedbackSignals: [{
      signalId: `signal:${taskId}`,
      taskId,
      source: "validation",
      category: "failure",
      severity: "error",
      payload: {
        summary: "schema validation failed",
        reasonCode: "schema_loop.detected",
      },
      stepOutputRefs: [`step:${taskId}`],
      timestamp: Date.now(),
    }],
  });
}

test("OapeflirLoopService produces a graph patch when feedback triggers replanning", async () => {
  const result = await runWithFeedback("task-graph-patch");

  assert.equal(result.replanDecision.shouldReplan, true);
  assert.ok(result.graphPatch != null);
  assert.ok(result.graphPatch!.operations.length > 0);
});

test("graph patch versions advance by exactly one", async () => {
  const result = await runWithFeedback("task-graph-version");
  const patch = result.graphPatch;

  assert.ok(patch != null);
  assert.equal(patch.newGraphVersion, patch.baseGraphVersion + 1);
  assert.equal(patch.harnessRunId, result.planGraphBundle.harnessRunId);
});

test("graph patch carries contract evidence references", async () => {
  const result = await runWithFeedback("task-graph-evidence");
  const patch = result.graphPatch;

  assert.ok(patch != null);
  assert.ok(patch.policyProofRef.startsWith("artifact:"));
  assert.ok(patch.auditRef.startsWith("artifact:"));
});
