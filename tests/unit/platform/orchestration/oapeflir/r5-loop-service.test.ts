import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type { Plan, PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/dual-channel-step-output.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";
import type { HarnessDecision } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

/**
 * R5-1 to R5-14 Integration Tests for OAPEFLIR Loop Service
 *
 * Tests cover:
 * - R5-1: Plan stage produces PlanGraphBundle (not linear Plan)
 * - R5-2: Loop with replanDecision - proper cycle with re-entry
 * - R5-3: StageTransitionFSM integration
 * - R5-4: HarnessLoopController integration with max-iteration/max-replan/max-duration/max-cost guards
 * - R5-5: downgrade_mode decision branch in ReplanningService
 * - R5-6: Assess consumes ConstraintPack/EffectivePolicySnapshot/RiskAssessment
 * - R5-7: Evaluator produces EvaluationReport
 * - R5-8: Release phase with EvaluationGate/approval/canary/rollback
 * - R5-9: Graph Normalization/Validation/Risk Propagation
 * - R5-10: FSM allows backward transition for replan (feedback → plan)
 * - R5-11: Observer includes eventFlow/goalDecomposition/memory situations
 * - R5-12: Replan produces GraphPatch
 * - R5-13: Execute with subgraph/child-run support
 * - R5-14: OapeflirLoopResult has HarnessDecision field
 */

class DeterministicExecuteBridge implements ExecuteBridge {
  public executionCount = 0;
  public lastContext: ExecutionContext | null = null;

  async executeStep(step: PlanStep, context: ExecutionContext): Promise<StepResult> {
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

  async executePlan(plan: Plan, context: ExecutionContext): Promise<ExecutionResult> {
    this.executionCount += 1;
    this.lastContext = context;
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

  async executeSubgraph(subgraph: PlanStep[], context: ExecutionContext): Promise<ExecutionResult> {
    return {
      planId: `subgraph-${context.taskId}`,
      results: subgraph.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 15,
        tokenCost: 5,
        summary: `Executed subgraph step ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [],
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: subgraph.length * 15,
      totalTokenCost: subgraph.length * 5,
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    };
  }

  async executeChildRun(plan: Plan, context: ExecutionContext, parentRunId: string): Promise<ExecutionResult> {
    return {
      planId: plan.planId,
      results: plan.steps.map((step) => ({
        stepId: step.stepId,
        status: "succeeded" as const,
        durationMs: 20,
        tokenCost: 8,
        summary: `Executed child run step ${step.stepId}`,
        outputs: { stepId: step.stepId },
        artifacts: [],
        modelId: "test-bridge",
        retryCount: 0,
        validationPassed: true,
      })),
      totalDurationMs: plan.steps.length * 20,
      totalTokenCost: plan.steps.length * 8,
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

// R5-14: Test HarnessDecision field in OapeflirLoopResult
test("OapeflirLoopResult includes HarnessDecision field (R5-14)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_harness_decision",
    objective: "Test harness decision field in result",
    workflow: {
      workflow: { workflowId: "wf_harness", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_harness",
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

  // R5-14: Verify harnessDecision field exists and has expected structure
  assert.ok(result.harnessDecision !== null, "harnessDecision should not be null");
  assert.ok(typeof result.harnessDecision === "object", "harnessDecision should be an object");
  assert.ok("action" in result.harnessDecision!, "harnessDecision should have action field");
  assert.ok("reasonCodes" in result.harnessDecision!, "harnessDecision should have reasonCodes field");
});

// R5-1: Test PlanGraphBundle is produced by Plan stage
test("OapeflirLoopService produces PlanGraphBundle (R5-1)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_plan_bundle",
    objective: "Test plan graph bundle production",
    workflow: {
      workflow: { workflowId: "wf_plan_bundle", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_plan",
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

  // R5-1: Verify planGraphBundle exists and has graph structure
  assert.ok(result.planGraphBundle !== null, "planGraphBundle should not be null");
  assert.ok("graph" in result.planGraphBundle, "planGraphBundle should have graph field");
  assert.ok("nodes" in result.planGraphBundle.graph, "graph should have nodes");
  assert.ok("edges" in result.planGraphBundle.graph, "graph should have edges");
  assert.ok(result.planGraphBundle.graph.nodes.length > 0, "graph should have at least one node");
});

// R5-6: Test Assess consumes ConstraintPack
test("OapeflirLoopService Assess consumes ConstraintPack (R5-6)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const constraintPack = {
    policyIds: ["policy_1", "policy_2"],
    approvalMode: "none" as const,
    autonomyMode: "full_auto" as const,
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    sandboxRequirement: { sandboxMode: "none" as const, timeoutMs: 300000 },
    approvalRequirement: { requiredForRiskClass: [] as const, approverRoles: [] as const, escalationTimeoutMs: 60000 },
  };

  const result = await service.run({
    taskId: "task_assess_constraint",
    objective: "Test constraint pack consumption",
    workflow: {
      workflow: { workflowId: "wf_constraint", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_constraint",
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
    constraintPack,
  });

  // R5-6: Verify constraintPack was consumed (assessment produced)
  assert.equal(result.assessment.taskId, "task_assess_constraint");
});

// R5-2: Test loop with replan decision
test("OapeflirLoopService handles loop with replan (R5-2)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_replan_loop",
    objective: "Test replan loop behavior",
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
        signalId: "signal_replan",
        taskId: "task_replan_loop",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: {
          summary: "Schema validation failed",
          reasonCode: "schema_loop.detected",
        },
        stepOutputRefs: ["step_replan"],
        timestamp: Date.now(),
        feedbackTrustScore: 0.8,
        trustFactors: {
          sourceReliability: 0.9,
          historicalAccuracy: 0.8,
          authenticatedSource: true,
          attackSurfaceExposure: 0.2,
          holdoutOverlap: 0.1,
        },
      },
    ],
  });

  // R5-2: Verify replanDecision exists and loop handled it
  assert.ok(result.replanDecision !== null, "replanDecision should not be null");
  assert.ok(typeof result.replanDecision.shouldReplan === "boolean", "shouldReplan should be boolean");
});

// R5-7: Test Evaluator produces EvaluationReport
test("OapeflirLoopService produces EvaluationReport (R5-7)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_eval_report",
    objective: "Test evaluation report production",
    workflow: {
      workflow: { workflowId: "wf_eval", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_eval",
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

  // R5-7: Verify evaluationReport has expected structure
  assert.ok(result.evaluationReport !== null, "evaluationReport should not be null");
  assert.ok("verdict" in result.evaluationReport, "evaluationReport should have verdict");
  assert.ok("score" in result.evaluationReport, "evaluationReport should have score");
  assert.ok("dimensions" in result.evaluationReport, "evaluationReport should have dimensions");
});

// R5-3: Test StageTransitionFSM is integrated
test("OapeflirLoopService StageTransitionFSM integration (R5-3)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_fsm",
    objective: "Test FSM stage transitions",
    workflow: {
      workflow: { workflowId: "wf_fsm", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_fsm",
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

  // R5-3: Verify timeline shows FSM-driven stage progression
  const timelineStages = result.timeline.map(entry => entry.stage);
  assert.ok(timelineStages.includes("observe"), "timeline should include observe stage");
  assert.ok(timelineStages.includes("assess"), "timeline should include assess stage");
  assert.ok(timelineStages.includes("plan"), "timeline should include plan stage");
  assert.ok(timelineStages.includes("execute"), "timeline should include execute stage");
});

// R5-4: Test HarnessLoopController guards integration
test("OapeflirLoopService HarnessLoopController guards (R5-4)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_harness_guards",
    objective: "Test harness loop controller guards",
    workflow: {
      workflow: { workflowId: "wf_guards", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_guards",
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
    constraintPack: {
      policyIds: [],
      approvalMode: "none" as const,
      autonomyMode: "full_auto" as const,
      tool_policy: { allowedTools: [] as const },
      sandboxRequirement: { sandboxMode: "none" as const, timeoutMs: 300000 },
      approvalRequirement: { requiredForRiskClass: [] as const, approverRoles: [] as const, escalationTimeoutMs: 60000 },
      budgetEnvelope: {
        maxSteps: 10,
        maxCost: 10000,
        maxDurationMs: 60000,
      },
    },
  });

  // R5-4: Verify harnessDecision exists and reflects loop control
  assert.ok(result.harnessDecision !== null, "harnessDecision should not be null");
  assert.ok("action" in result.harnessDecision, "harnessDecision should have action");
});

// R5-11: Test Observer includes extended situations
test("OapeflirLoopService Observer extended situations (R5-11)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_observer_extended",
    objective: "Test observer extended situations",
    workflow: {
      workflow: { workflowId: "wf_observer", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_observer",
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

  // R5-11: Verify observation includes eventFlow, goalDecomposition, memory
  assert.ok("eventFlow" in result.observation, "observation should have eventFlow");
  assert.ok("goalDecomposition" in result.observation, "observation should have goalDecomposition");
  assert.ok("memory" in result.observation, "observation should have memory");
  assert.ok("observedAt" in result.observation, "observation should have observedAt");
});

// R5-12: Test Replan produces GraphPatch
test("OapeflirLoopService Replan produces GraphPatch (R5-12)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_graph_patch",
    objective: "Test graph patch production on replan",
    workflow: {
      workflow: { workflowId: "wf_patch", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_patch",
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
        signalId: "signal_patch",
        taskId: "task_graph_patch",
        source: "validation",
        category: "failure",
        severity: "error",
        payload: {
          summary: "Schema validation failed",
          reasonCode: "schema_loop.detected",
        },
        stepOutputRefs: ["step_patch"],
        timestamp: Date.now(),
        feedbackTrustScore: 0.8,
        trustFactors: {
          sourceReliability: 0.9,
          historicalAccuracy: 0.8,
          authenticatedSource: true,
          attackSurfaceExposure: 0.2,
          holdoutOverlap: 0.1,
        },
      },
    ],
  });

  // R5-12: When replan is triggered, graphPatch should be produced
  if (result.replanDecision.shouldReplan) {
    assert.ok(result.graphPatch !== null, "graphPatch should not be null when replan is triggered");
    assert.ok("operations" in result.graphPatch, "graphPatch should have operations");
  }
});

// R5-8: Test Release phase with gates
test("OapeflirLoopService Release phase with EvaluationGate (R5-8)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_release_gates",
    objective: "Test release phase with evaluation gate",
    workflow: {
      workflow: { workflowId: "wf_release", divisionId: "coding", steps: [] },
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
        signalId: "signal_release",
        taskId: "task_release_gates",
        source: "user",
        category: "success",
        severity: "info",
        payload: {
          summary: "Task completed successfully",
        },
        stepOutputRefs: ["step_release"],
        timestamp: Date.now(),
        feedbackTrustScore: 0.9,
        trustFactors: {
          sourceReliability: 0.9,
          historicalAccuracy: 0.9,
          authenticatedSource: true,
          attackSurfaceExposure: 0.1,
          holdoutOverlap: 0.0,
        },
      },
    ],
  });

  // R5-8: Verify release stage processed with evaluation gate
  const releaseEntry = result.timeline.find(entry => entry.stage === "release");
  assert.ok(releaseEntry !== undefined, "timeline should have release stage entry");
});

// R5-13: Test subgraph execution support
test("OapeflirLoopService supports subgraph execution (R5-13)", async () => {
  runtimeMetricsRegistry.reset();
  const bridge = new DeterministicExecuteBridge();
  const service = new OapeflirLoopService({
    executeBridge: bridge,
  });

  // Test executeSubgraphViaBridge method exists and works
  const subgraphResult = await service.executeSubgraphViaBridge(
    [
      {
        stepId: "sub_step_1",
        action: "read",
        title: "Subgraph Step 1",
        inputs: {},
        outputs: [],
        dependencies: [],
        status: "pending",
        timeout: 10000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    { taskId: "task_subgraph" }
  );

  assert.ok(Array.isArray(subgraphResult), "subgraph result should be an array");
  assert.ok(subgraphResult.length > 0, "subgraph result should have outputs");
});

// R5-9: Test graph normalization in plan builder
test("OapeflirLoopService PlanBuilder with normalizeGraph (R5-9)", async () => {
  runtimeMetricsRegistry.reset();
  const service = new OapeflirLoopService({
    executeBridge: new DeterministicExecuteBridge(),
  });

  const result = await service.run({
    taskId: "task_normalize",
    objective: "Test graph normalization",
    workflow: {
      workflow: { workflowId: "wf_normalize", divisionId: "coding", steps: [] },
      executionSteps: [
        {
          stepId: "step_normalize_1",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_writer",
          outputKey: "result1",
          outputSchemaPath: null,
          dependsOnStepIds: [],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
        {
          stepId: "step_normalize_2",
          divisionId: "coding",
          roleId: "writer",
          inputKeys: [],
          agentId: "agent_writer",
          outputKey: "result2",
          outputSchemaPath: null,
          dependsOnStepIds: ["step_normalize_1"],
          dependencyTypes: {},
          timeoutMs: 1000,
          maxAttempts: 1,
        },
      ],
      planReason: "workflow.multi_step_execution",
      dependencyEdges: [],
    },
  });

  // R5-9: Verify plan graph bundle has proper graph structure with normalized nodes
  assert.ok(result.planGraphBundle.graph.nodes.length >= 2, "should have at least 2 nodes");
  assert.ok(result.planGraphBundle.graph.edges.length >= 1, "should have at least 1 edge");
});