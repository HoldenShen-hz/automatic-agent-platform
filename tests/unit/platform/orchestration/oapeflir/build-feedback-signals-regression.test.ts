import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

/**
 * R19-08 Regression Tests: buildFeedbackSignals derives category from step validation status
 *
 * Issue: buildFeedbackSignals all step hardcoded category:"success" - failed step
 * produces虚假正向反馈
 *
 * Fix: Derive feedback category from step output's validationPassed field
 */
class FailureInjectingBridge implements ExecuteBridge {
  public executionCount = 0;

  async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    // Inject validation failure for specific steps
    const validationPassed = !step.stepId.includes("fail");
    return {
      stepId: step.stepId,
      status: validationPassed ? "succeeded" : "failed",
      durationMs: 25,
      tokenCost: 10,
      summary: `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [],
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed,
    };
  }

  async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
    this.executionCount += 1;
    const results = plan.steps.map((step) => {
      const validationPassed = !step.stepId.includes("fail");
      return {
        stepId: step.stepId,
        status: validationPassed ? "succeeded" as const : "failed" as const,
        durationMs: 25,
        tokenCost: 10,
        summary: `Executed ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [],
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed,
      };
    });

    return {
      planId: plan.planId,
      results,
      totalDurationMs: plan.steps.length * 25,
      totalTokenCost: plan.steps.length * 10,
      allSucceeded: results.every((r) => r.status === "succeeded"),
      skippedStepIds: [],
      failedStepIds: results.filter((r) => r.status === "failed").map((r) => r.stepId),
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
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

test("R19-08: buildFeedbackSignals derives failure category when step validation fails", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new FailureInjectingBridge(),
  });

  const result = await service.run({
    taskId: "task_feedback_category",
    objective: "Test feedback category derivation",
    workflow: {
      workflow: { workflowId: "wf_feedback", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_succeed",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_writer",
          outputKey: "result",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
        {
          stepId: "step_fail",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_writer",
          outputKey: "result",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
      ],
      planReason: "workflow.multi_step_execution",
      dependencyEdges: [],
    },
  });

  // Verify feedback signals exist
  assert.ok(result.feedback, "feedback should exist");
  assert.ok(result.feedback.signals, "feedback.signals should exist");

  // Find the failing step's signal
  const failSignal = result.feedback.signals.find(
    (s: { stepOutputRefs: string[] }) => s.stepOutputRefs.includes("step_fail")
  );
  assert.ok(failSignal, "Should have feedback signal for failed step");

  // R19-08 fix: Failed step should have category "failure", not hardcoded "success"
  assert.equal(
    failSignal!.category,
    "failure",
    "Failed step should have category 'failure' not 'success'"
  );

  // Find the succeeding step's signal
  const succeedSignal = result.feedback.signals.find(
    (s: { stepOutputRefs: string[] }) => s.stepOutputRefs.includes("step_succeed")
  );
  assert.ok(succeedSignal, "Should have feedback signal for succeeded step");
  assert.equal(
    succeedSignal!.category,
    "success",
    "Succeeded step should have category 'success'"
  );
});

test("R19-08: buildFeedbackSignals severity is error when validation fails", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new FailureInjectingBridge(),
  });

  const result = await service.run({
    taskId: "task_feedback_severity",
    objective: "Test feedback severity derivation",
    workflow: {
      workflow: { workflowId: "wf_severity", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_fail_validation",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_writer",
          outputKey: "result",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
      ],
      planReason: "workflow.single_step_execution",
      dependencyEdges: [],
    },
  });

  const failSignal = result.feedback.signals[0];
  assert.equal(
    failSignal.severity,
    "error",
    "Failed step should have severity 'error' not 'info'"
  );
});