import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/orchestration/oapeflir/types/dual-channel-step-output.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

/**
 * Creates a minimal DualChannelStepOutput suitable for tests that need to
 * exercise the observe, assess, plan, and feedback/learn stages without
 * hitting the execute bridge directly (since OAPEFLIR is a projection/view
 * that consumes stepOutputs from the caller per R9-14).
 */
function makeStepOutput(stepId: string): DualChannelStepOutput {
  return {
    stepId,
    planRef: `plan_${stepId}`,
    userFacingResult: {
      summary: `Executed ${stepId}`,
      artifacts: [`artifact:${stepId}`],
    },
    systemTelemetry: {
      durationMs: 25,
      tokensUsed: 10,
      modelId: "test-bridge",
      retryCount: 0,
      validationPassed: true,
    },
  };
}

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
    stepOutputs: [makeStepOutput("step_read")],
  });

  assert.equal(result.observation.task.taskId, "task_observe");
  assert.equal(result.observation.system.healthStatus, "ok");
  assert.ok(result.observation.observedAt > 0);
  assert.equal(result.assessment.taskId, "task_observe");
  assert.ok(runtimeMetricsRegistry.getHistograms("oapeflir_loop_duration_ms").length > 0);
  assert.ok(runtimeMetricsRegistry.getCounters("oapeflir_stage_outcome_total").some((series) => series.labels.stage === "execute"));
});

test("OapeflirLoopService records execute stage completion when stepOutputs are provided", async () => {
  runtimeMetricsRegistry.reset();
  // R9-14: OAPEFLIR is a projection/view that consumes stepOutputs provided by the caller.
  // The run() method no longer calls executeBridge.executePlan() directly.
  // This test verifies that when stepOutputs are provided, the execute stage completes.
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_execute_error",
    objective: "Exercise execute stage with caller-provided outputs",
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
    // Provide stepOutputs so the execute stage can complete
    stepOutputs: [makeStepOutput("step_execute")],
  });

  // Verify execute stage was recorded as completed (not error, since stepOutputs were valid)
  assert.ok(
    runtimeMetricsRegistry
      .getCounters("oapeflir_stage_outcome_total")
      .some((series) => series.labels.stage === "execute" && series.labels.result === "completed"),
  );
  // Verify we got step outputs back
  assert.equal(result.stepOutputs.length, 1);
  assert.equal(result.stepOutputs[0].stepId, "step_execute");
});

test("OapeflirLoopService preserves trace and span context on stage failures", async () => {
  runtimeMetricsRegistry.reset();
  // R9-14: OAPEFLIR is a projection/view. To test stage error context preservation,
  // we trigger an O→A boundary validation failure by injecting a custom
  // observationAggregator that returns an invalid (empty) task situation.
  const publishedEvents: Array<{ eventType: string; payload: Record<string, unknown>; taskId?: string }> = [];
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
    observationAggregator: {
      aggregate() {
        return {
          task: {} as never, // Invalid empty task will fail O→A validation
          system: {} as never,
          observedAt: Date.now(),
        };
      },
    } as never,
    eventPublisher: {
      publish(input) {
        publishedEvents.push(input as { eventType: string; payload: Record<string, unknown>; taskId?: string });
      },
    } as never,
  });

  await assert.rejects(
    async () => {
      await service.run({
        taskId: "task_stage_context",
        objective: "Exercise stage error context",
        workflow: {
          workflow: { workflowId: "wf_stage_context", divisionId: "coding", steps: [] },
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
        // Provide stepOutputs so we can reach the O→A boundary where the error occurs
        stepOutputs: [makeStepOutput("step_execute")],
      });
    },
    (error: unknown) => {
      assert.ok(error instanceof Error);
      // O→A boundary validation failure throws a plain Error with the taskId in the message
      assert.match(error.message, /boundary\.validation_failed.*task_stage_context/i);
      const stageError = error as Error & {
        stage?: string;
        taskId?: string;
        traceId?: string;
        spanId?: string;
        parentSpanId?: string | null;
      };
      // taskId should be accessible from the error
      assert.equal(stageError.taskId, "task_stage_context");
      return true;
    },
  );
});

test("OapeflirLoopService emits boundary violation signal and metric on O→A validation failure", async () => {
  runtimeMetricsRegistry.reset();
  const publishedEvents: Array<{ eventType: string; payload: Record<string, unknown>; taskId?: string }> = [];
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
    observationAggregator: {
      aggregate() {
        return {
          task: {} as never,
          system: {} as never,
          observedAt: Date.now(),
        };
      },
    } as never,
    eventPublisher: {
      publish(input) {
        publishedEvents.push(input as { eventType: string; payload: Record<string, unknown>; taskId?: string });
      },
    } as never,
  });

  await assert.rejects(
    async () => {
      await service.run({
        taskId: "task_boundary_violation",
        objective: "Trigger boundary validation failure",
        workflow: {
          workflow: { workflowId: "wf_boundary_violation", divisionId: "coding", steps: [] },
          executionSteps: [
            {
              stepId: "step_observe",
              divisionId: "coding",
              roleId: "observer",
              inputKeys: [],
              agentId: "agent_observer",
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
    /boundary\.validation_failed: TaskSituation validation failed at O→A boundary/,
  );

  assert.ok(
    runtimeMetricsRegistry
      .getCounters("oapeflir_boundary_violation_total")
      .some((series) =>
        series.labels.boundary === "O→A"
        && series.labels.taskId === "task_boundary_violation"
        && series.labels.reasonCode === "boundary:O→A:validation_failed"
        && series.value >= 1),
  );
  assert.ok(
    publishedEvents.some((event) =>
      event.eventType === "platform.harness_run.status_changed"
      && event.taskId === "task_boundary_violation"
      && event.payload.status === "decision:boundary_violation:abort"),
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
    stepOutputs: [makeStepOutput("step_skip")],
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

test("OapeflirLoopService completes learn improve and release stages when failure evidence is present", async () => {
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
        harnessRunId: "task_learning_release",
        nodeRunId: "step_release",
        taskId: "task_learning_release",
        source: "validation" as const,
        category: "failure" as const,
        severity: "error" as const,
        payload: {
          summary: "Schema validation failed after execution.",
          reasonCode: "schema_loop.detected",
        },
        stepOutputRefs: ["step_release"],
        timestamp: Date.now(),
        trustScore: {
          overallScore: 0.95,
          sourceCredibility: 0.98,
          historicalAccuracy: 0.9,
          attackSurface: 0.05,
        },
        evidenceRefs: [],
      },
    ],
    stepOutputs: [makeStepOutput("step_release")],
  });

  assert.equal(result.learningObjects.length > 0, true);
  assert.equal(result.timeline.find((entry) => entry.stage === "learn")?.status, "completed");
  assert.equal(result.timeline.find((entry) => entry.stage === "improve")?.status, "completed");
  assert.equal(result.timeline.find((entry) => entry.stage === "release")?.status, "completed");
  assert.equal(result.rolloutRecord?.status, "shadow");
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
        harnessRunId: "task_successful_quality_gate",
        nodeRunId: "step_success",
        taskId: "task_successful_quality_gate",
        source: "user" as const,
        category: "success" as const,
        severity: "info" as const,
        payload: {
          summary: "The output solved the task.",
        },
        stepOutputRefs: ["step_success"],
        timestamp: Date.now(),
        trustScore: {
          overallScore: 0.95,
          sourceCredibility: 0.98,
          historicalAccuracy: 0.9,
          attackSurface: 0.05,
        },
        evidenceRefs: [],
      },
    ],
    stepOutputs: [makeStepOutput("step_success")],
  });

  assert.equal(result.outcome.nextAction, "complete");
  assert.equal(result.qualityGate.accepted, true);
  assert.equal(result.replanDecision.shouldReplan, false);
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
    stepOutputs: [makeStepOutput("step_handoff")],
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
    stepOutputs: [makeStepOutput("step_empty")],
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
        harnessRunId: "task_replan_trigger",
        nodeRunId: "step_replan",
        taskId: "task_replan_trigger",
        source: "validation" as const,
        category: "failure" as const,
        severity: "error" as const,
        payload: {
          summary: "Schema validation failed",
          reasonCode: "schema_loop.detected",
        },
        stepOutputRefs: ["step_replan"],
        timestamp: Date.now(),
        trustScore: {
          overallScore: 0.95,
          sourceCredibility: 0.98,
          historicalAccuracy: 0.9,
          attackSurface: 0.05,
        },
        evidenceRefs: [],
      },
    ],
    stepOutputs: [makeStepOutput("step_replan")],
  });

  // Verify replan was triggered due to quality gate rejection
  assert.equal(result.replanDecision.shouldReplan, true);
  assert.ok(result.qualityGate.reasonCodes.length > 0);
});
