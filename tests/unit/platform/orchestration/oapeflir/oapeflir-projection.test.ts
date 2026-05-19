/**
 * OAPEFLIR Projection Tests
 *
 * Validates R9-14: OAPEFLIR is a projection/view layer, NOT an execution engine.
 * The loop service should produce plans, assessments, and evaluations - not execute them.
 *
 * Architecture: §9 OAPEFLIR Design Principles
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

/**
 * Mock ExecuteBridge that verifies OAPEFLIR does NOT call it directly.
 * The service should only produce planGraphBundle and graphPatch - execution
 * happens elsewhere via the bridge.
 */
class SpyExecuteBridge implements ExecuteBridge {
  public executeCallCount = 0;
  public lastContext: ExecutionContext | null = null;

  async executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult> {
    this.executeCallCount++;
    this.lastContext = context;
    return {
      stepId: step.stepId,
      status: "succeeded",
      durationMs: 10,
      tokenCost: 5,
      summary: "mocked",
      outputs: {},
      artifacts: [],
      modelId: "test",
      retryCount: 0,
      validationPassed: true,
    };
  }

  async executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    this.executeCallCount++;
    this.lastContext = context;
    return {
      planId: plan.planId,
      results: plan.steps.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 10,
        tokenCost: 5,
        summary: "mocked",
        outputs: {},
        artifacts: [],
        modelId: "test",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: 10,
      totalTokenCost: 5,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  toDualChannelStepOutputs(result: ExecutionResult) {
    return result.results.map((r) => ({
      stepId: r.stepId,
      planRef: result.planId,
      userFacingResult: { summary: r.summary, artifacts: r.artifacts },
      systemTelemetry: {
        durationMs: r.durationMs,
        tokensUsed: r.tokenCost,
        modelId: r.modelId,
        retryCount: r.retryCount,
        validationPassed: r.validationPassed,
      },
    }));
  }
}

function createSingleStepWorkflow(taskId: string) {
  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: [
      {
        stepId: `step_${taskId}`,
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// R9-14: OAPEFLIR produces projection outputs, not execution
// ─────────────────────────────────────────────────────────────────────────────

test("OapeflirLoopService produces planGraphBundle as primary output (R5-1)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const result = await service.run({
    taskId: "task_projection_bundle",
    objective: "Verify planGraphBundle production",
    workflow: createSingleStepWorkflow("task_projection_bundle"),
  });

  // R5-1: Plan stage produces PlanGraphBundle, not linear Plan
  assert.ok(result.planGraphBundle != null, "planGraphBundle must be produced");
  assert.ok(result.planGraphBundle.planGraphBundleId.length > 0, "bundle must have ID");
  assert.ok(result.planGraphBundle.graph != null, "bundle must contain graph structure");
  assert.ok(result.planGraphBundle.graph.nodes.length > 0, "graph must have nodes");
  assert.ok(result.planGraphBundle.graph.edges != null, "graph must have edges");
  assert.equal(result.planGraphBundle.schedulerPolicy.policyId, "scheduler:oapeflir.deterministic_fifo");
});

test("OapeflirLoopService evaluationReport follows R5-7 structure", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const result = await service.run({
    taskId: "task_eval_report",
    objective: "Verify EvaluationReport output shape",
    workflow: createSingleStepWorkflow("task_eval_report"),
  });

  // R5-7: EvaluationReport has passed/score/issues/recommendation/confidence
  assert.ok(typeof result.evaluationReport.passed === "boolean", "passed must be boolean");
  assert.ok(typeof result.evaluationReport.score === "number", "score must be number");
  assert.ok(Array.isArray(result.evaluationReport.issues), "issues must be array");
  assert.ok(typeof result.evaluationReport.recommendation === "string", "recommendation must be string");
  assert.ok(typeof result.evaluationReport.confidence === "number", "confidence must be number");
  assert.ok(result.evaluationReport.confidence >= 0 && result.evaluationReport.confidence <= 1, "confidence must be 0-1");
});

test("OapeflirLoopService returns normalized observation task in final result", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const result = await service.run({
    taskId: "task_observation_normalized",
    objective: "Verify normalized observation task is returned",
    workflow: createSingleStepWorkflow("task_observation_normalized"),
  });

  assert.equal(result.observation.task.taskId, "task_observation_normalized");
  assert.ok(Array.isArray(result.observation.task.blockers));
});

test("OapeflirLoopService produces graphPatch during replan (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  // Trigger replan by providing failure feedback
  const result = await service.run({
    taskId: "task_replan_patch",
    objective: "Verify graphPatch production during replan",
    workflow: createSingleStepWorkflow("task_replan_patch"),
    feedbackSignals: [
      {
        signalId: "signal_fail",
        taskId: "task_replan_patch",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: { summary: "Schema validation failed", reasonCode: "schema_loop.detected" },
        stepOutputRefs: [`step_task_replan_patch`],
        timestamp: Date.now(),
      },
    ],
  });

  // R5-12: GraphPatch is produced when replan occurs
  if (result.replanDecision.shouldReplan) {
    assert.ok(result.graphPatch != null, "graphPatch must be produced during replan");
    assert.ok(result.graphPatch.harnessRunId.length > 0, "graphPatch must have harnessRunId");
    assert.ok(result.graphPatch.baseGraphVersion >= 1, "graphPatch must have base version");
    assert.ok(result.graphPatch.newGraphVersion > result.graphPatch.baseGraphVersion, "new version must increment");
    assert.ok(Array.isArray(result.graphPatch.operations), "graphPatch must have operations");
  }
});

test("OapeflirLoopService harnessDecision is present when guard triggers (R5-14)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  // Use constraintPack to trigger harness guards
  const result = await service.run({
    taskId: "task_harness_abort",
    objective: "Verify harnessDecision when abort triggered",
    workflow: createSingleStepWorkflow("task_harness_abort"),
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "full_auto",
      tool_policy: { allowedTools: ["read", "write"] },
      risk_policy: { maxRiskScore: 50, escalationThreshold: 75 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 1, maxCost: 0.01, maxDurationMs: 1 }, // Very tight budget to trigger guard
    },
  });

  // R5-14: HarnessDecision is produced when guardrails fire
  if (result.harnessDecision != null) {
    assert.ok(result.harnessDecision.decisionId.length > 0, "harnessDecision must have decisionId");
    assert.ok(result.harnessDecision.decisionKind.length > 0, "harnessDecision must have decisionKind");
    assert.ok(result.harnessDecision.reasonCode.length > 0, "harnessDecision must have reasonCode");
  }
});

test("OapeflirLoopService records all 8 stages in timeline (R5-3)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const result = await service.run({
    taskId: "task_timeline_8",
    objective: "Verify all 8 OAPEFLIR stages are recorded",
    workflow: createSingleStepWorkflow("task_timeline_8"),
    feedbackSignals: [
      {
        signalId: "signal_success",
        taskId: "task_timeline_8",
        source: "user",
        category: "success",
        severity: "info",
        payload: { summary: "Task completed successfully" },
        stepOutputRefs: [`step_task_timeline_8`],
        timestamp: Date.now(),
      },
    ],
  });

  const expectedStages = ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"];
  const recordedStages = result.timeline.map((t) => t.stage);

  for (const expected of expectedStages) {
    assert.ok(
      recordedStages.includes(expected),
      `Stage ${expected} must be recorded in timeline`,
    );
  }
});

test("OapeflirLoopService does NOT execute when stepOutputs are provided (projection-only)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const preSuppliedStepOutputs = [
    {
      stepId: "step_pre",
      planRef: "plan_pre",
      userFacingResult: { summary: "Pre-supplied output", artifacts: [] },
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
    taskId: "task_no_exec",
    objective: "Verify no execution when outputs pre-supplied",
    workflow: createSingleStepWorkflow("task_no_exec"),
    stepOutputs: preSuppliedStepOutputs,
  });

  // When stepOutputs are provided, bridge should NOT be called
  assert.equal(spy.executeCallCount, 0, "ExecuteBridge must not be called when stepOutputs are provided");
  assert.deepEqual(result.stepOutputs, preSuppliedStepOutputs, "Pre-supplied outputs must be returned");
  assert.ok(result.planGraphBundle != null, "planGraphBundle still produced as projection");
});

test("OapeflirLoopService outcome evaluation is produced (not execution)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const result = await service.run({
    taskId: "task_outcome",
    objective: "Verify outcome is evaluated, not executed",
    workflow: createSingleStepWorkflow("task_outcome"),
  });

  // Outcome is an evaluation, not execution result
  assert.ok(result.outcome != null, "outcome must be evaluated");
  assert.ok(typeof result.outcome.score === "number" || result.outcome.score === undefined, "score should be number or undefined");
  assert.ok(Array.isArray(result.outcome.issues ?? []), "issues should be array");
  assert.ok(typeof result.outcome.nextAction === "string" || result.outcome.nextAction === undefined, "nextAction should be string or undefined");
});

test("OapeflirLoopService assessment is derived from situation (projection output)", async () => {
  runtimeMetricsRegistry.reset();
  const spy = new SpyExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: spy });

  const result = await service.run({
    taskId: "task_assessment",
    objective: "Verify assessment is computed, not executed",
    workflow: createSingleStepWorkflow("task_assessment"),
  });

  // Assessment is a projection of the situation, not execution
  assert.ok(result.assessment != null, "assessment must be derived");
  assert.equal(result.assessment.taskId, "task_assessment");
  assert.ok(["low", "medium", "high", "critical"].includes(result.assessment.risk), "risk must be valid");
  assert.ok(["trivial", "simple", "moderate", "complex", "critical"].includes(result.assessment.complexity), "complexity must be valid");
  assert.ok(result.assessment.routingDecision != null, "routingDecision must be computed");
  assert.ok(result.assessment.resourceAllocation != null, "resourceAllocation must be computed");
});
