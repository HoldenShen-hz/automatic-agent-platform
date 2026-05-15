import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/dual-channel-step-output.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

class DeterministicExecuteBridge implements ExecuteBridge {
  public executionCount = 0;

  async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 25,
      tokenCost: 10,
      summary: `Executed ${step.stepId}`,
      outputs: { stepId: step.stepId },
      artifacts: [`artifact:${step.stepId}`],
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: true,
    };
  }

  async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
    this.executionCount += 1;
    return {
      planId: plan.planId,
      results: plan.steps.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 25,
        tokenCost: 10,
        summary: `Executed ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [`artifact:${step.stepId}`],
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: plan.steps.length * 25,
      totalTokenCost: plan.steps.length * 10,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
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

test("OapeflirLoopService aggregates task and system observation", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const workflow = {
    workflow: {
      workflowId: "wf_observe",
      divisionId: "coding",
      steps: [],
    },
    executionSteps: [
      {
        stepId: "step_read",
        divisionId: "coding",
        roleId: "reader",
        inputKeys: [],
        agentId: "agent_reader",
        outputKey: "content",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
    ],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };

  const result = await service.run({
    taskId: "task_observe",
    objective: "Inspect observation aggregation",
    workflow,
  });

  assert.equal(result.observation.task.taskId, "task_observe");
  assert.equal(result.observation.system.healthStatus, "ok");
  assert.ok(result.observation.observedAt > 0);
  assert.equal(result.assessment.taskId, "task_observe");
  assert.ok(runtimeMetricsRegistry.getHistograms("oapeflir_loop_duration_ms").length > 0);
  assert.ok(runtimeMetricsRegistry.getCounters("oapeflir_stage_outcome_total").some((series) => series.labels.stage === "execute"));
});

test("OapeflirLoopService records execute errors when execute bridge fails", async () => {
  runtimeMetricsRegistry.reset();
  class FailingExecuteBridge extends DeterministicExecuteBridge {
    override async executePlan(_plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
      throw new Error("execute bridge exploded");
    }
  }

  const service = new OapeflirLoopService({
    executeBridge: new FailingExecuteBridge(),
  });

  await assert.rejects(
    async () => {
      await service.run({
        taskId: "task_execute_error",
        objective: "Exercise execute failure path",
        workflow: {
          workflow: { workflowId: "wf_execute_error", divisionId: "coding", steps: [] },
          executionSteps: [
            {
              stepId: "step_execute",
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
    },
    /execute bridge exploded/,
  );

  assert.ok(
    runtimeMetricsRegistry
      .getCounters("oapeflir_stage_outcome_total")
      .some((series) => series.labels.stage === "execute" && series.labels.result === "error" && series.value >= 1),
  );
});

test("OapeflirLoopService skips learn-driven stages when no feedback signals are provided", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_skip_learning",
    objective: "Exercise skip path",
    workflow: {
      workflow: { workflowId: "wf_skip_learning", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_skip",
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
    feedbackSignals: [],
  });

  assert.equal(result.learningSignals.length, 0);
  assert.equal(result.learningObjects.length, 0);
  assert.equal(result.rolloutRecord, null);
  assert.equal(result.timeline.find((entry) => entry.stage === "learn")?.status, "skipped");
  assert.equal(result.timeline.find((entry) => entry.stage === "improve")?.status, "skipped");
  assert.equal(result.timeline.find((entry) => entry.stage === "release")?.status, "skipped");
});

test("OapeflirLoopService bypasses execute bridge when explicit step outputs are supplied", async () => {
  runtimeMetricsRegistry.reset();
  const executeBridge = new DeterministicExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge });
  const explicitStepOutputs: DualChannelStepOutput[] = [
    {
      stepId: "step_explicit",
      planRef: "plan_explicit",
      userFacingResult: {
        summary: "Provided externally",
        artifacts: ["artifact:explicit"],
      },
      systemTelemetry: {
        durationMs: 5,
        tokensUsed: 1,
        modelId: "manual",
        retryCount: 0,
        validationPassed: true,
      },
    },
  ];

  const result = await service.run({
    taskId: "task_explicit",
    objective: "Use explicit step outputs",
    workflow: {
      workflow: { workflowId: "wf_explicit", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_explicit",
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
    stepOutputs: explicitStepOutputs,
  });

  assert.equal(executeBridge.executionCount, 0);
  assert.deepEqual(result.stepOutputs, explicitStepOutputs);
});

test("OapeflirLoopService learns from failure evidence and gates release after improve", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_learning_release",
    objective: "Promote failure pattern into rollout lane",
    workflow: {
      workflow: { workflowId: "wf_learning_release", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_release",
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
    feedbackSignals: [
      {
        signalId: "signal_failure",
        taskId: "task_learning_release",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: {
          summary: "Schema validation failed after execution.",
          reasonCode: "schema_loop.detected",
        },
        stepOutputRefs: ["step_release"],
        timestamp: Date.now(),
      },
    ],
  });

  assert.equal(result.learningObjects.length > 0, true);
  assert.equal(result.timeline.find((entry) => entry.stage === "learn")?.status, "completed");
  assert.equal(result.timeline.find((entry) => entry.stage === "improve")?.status, "completed");
  assert.equal(result.timeline.find((entry) => entry.stage === "release")?.status, "skipped");
  assert.equal(result.rolloutRecord, null);
  assert.equal(result.qualityGate.accepted, false);
  assert.equal(result.replanDecision.shouldReplan, true);
});

test("OapeflirLoopService preserves successful quality gate when only success feedback is present", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_successful_quality_gate",
    objective: "Keep completed execution accepted",
    workflow: {
      workflow: { workflowId: "wf_successful_quality_gate", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_success",
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
    feedbackSignals: [
      {
        signalId: "signal_success",
        taskId: "task_successful_quality_gate",
        source: "user",
        category: "success",
        severity: "info",
        payload: {
          summary: "The output solved the task.",
        },
        stepOutputRefs: ["step_success"],
        timestamp: Date.now(),
      },
    ],
  });

  assert.equal(result.evaluationReport.verdict, "accept");
  assert.equal(result.qualityGate.accepted, true);
  assert.equal(result.replanDecision.shouldReplan, false);
});

test("OapeflirLoopService terminates partial feedback without replanning", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      service.run({
        taskId: "task_partial_feedback_exit",
        objective: "Exit on partial feedback without entering a replan loop",
        workflow: {
          workflow: { workflowId: "wf_partial_feedback_exit", divisionId: "coding", steps: [] },
          executionSteps: [
            {
              stepId: "step_partial",
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
        feedbackSignals: [
          {
            signalId: "signal_partial",
            taskId: "task_partial_feedback_exit",
            source: "validation",
            category: "partial",
            severity: "warning",
            payload: {
              summary: "Output is only partially complete.",
              reasonCode: "validation.partial_completion",
            },
            stepOutputRefs: ["step_partial"],
            timestamp: Date.now(),
          },
        ],
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("partial feedback loop did not terminate")), 500);
      }),
    ]);

    assert.equal(result.evaluationReport.verdict, "approve");
    assert.equal(result.qualityGate.accepted, false);
    assert.equal(result.qualityGate.releaseStage, "approval");
    assert.equal(result.replanDecision.shouldReplan, false);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
});

test("OapeflirLoopService.buildSerializedHandoff creates handoff from loop result", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_handoff",
    objective: "Build handoff from completed loop",
    workflow: {
      workflow: { workflowId: "wf_handoff", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_handoff",
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

  const handoff = service.buildSerializedHandoff(result, "agent_a", "agent_b", 4096);

  assert.equal(handoff.fromAgentId, "agent_a");
  assert.equal(handoff.toAgentId, "agent_b");
  assert.equal(handoff.state.currentPhase, "completed");
  assert.ok(handoff.taskId.length > 0);
  assert.ok(handoff.handoffId.length > 0);
});

test("OapeflirLoopService handles empty feedback signals for buildSerializedHandoff", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  // Run with empty feedback to have empty learning objects
  const result = await service.run({
    taskId: "task_handoff_empty",
    objective: "Build handoff with no feedback",
    workflow: {
      workflow: { workflowId: "wf_handoff_empty", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_empty",
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
    feedbackSignals: [],
  });

  // Should not throw even with empty feedback
  const handoff = service.buildSerializedHandoff(result, "agent_empty", "agent_b", 4096);
  assert.equal(handoff.fromAgentId, "agent_empty");
  assert.equal(handoff.toAgentId, "agent_b");
});

test("OapeflirLoopService records quality gate replan trigger correctly", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_replan_trigger",
    objective: "Test replan trigger with failed feedback",
    workflow: {
      workflow: { workflowId: "wf_replan", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_replan",
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
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_replan_trigger",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: {
          summary: "Schema validation failed",
          reasonCode: "schema_loop.detected",
        },
        stepOutputRefs: ["step_replan"],
        timestamp: Date.now(),
      },
    ],
  });

  // Verify replan was triggered due to quality gate rejection
  assert.equal(result.replanDecision.shouldReplan, true);
  assert.ok(result.qualityGate.reasonCodes.length > 0);
});
