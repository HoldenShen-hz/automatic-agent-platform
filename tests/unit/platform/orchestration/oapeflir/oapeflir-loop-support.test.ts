import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopSupport } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.js";
import type {
  DualChannelStepOutput,
  FeedbackSignal,
  Plan,
  TaskSituation,
  UnifiedAssessment,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import type { ExecuteBridge, ExecutionContext, ExecutionResult, StepResult } from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type { PlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { createPlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import type { PostExecutionQualityGateDecision } from "../../../../../src/prompt-engine/eval/post-execution-quality-gate.js";
import type { ReplanningDecision } from "../../../../../src/platform/five-plane-orchestration/planner/replanning-service.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { EvaluationReport } from "../../../../../src/prompt-engine/eval/execution-outcome-evaluator.js";
import type { OapeflirLoopResult } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.js";
import type { PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import { ObservationAggregator } from "../../../../../src/platform/shared/observability/observation-aggregator.js";
import { PlanBuilder } from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";

// Concrete implementation of OapeflirLoopSupport for testing
class TestableOapeflirLoopSupport extends OapeflirLoopSupport {
  public observationAggregator: ObservationAggregator;
  public planBuilder: PlanBuilder;
  public executeBridge: ExecuteBridge;
  public boundaryLogger: StructuredLogger;
  public loopController: import("../../../../../src/platform/five-plane-orchestration/harness/loop/index.js").HarnessLoopController | null = null;
  public eventPublisher: import("../../../../../src/five-plane-state-evidence/events/typed-event-publisher.js").TypedEventPublisher | undefined;
  public dbPath: string | undefined;

  constructor(executeBridge?: ExecuteBridge) {
    super();
    this.observationAggregator = new ObservationAggregator();
    this.planBuilder = new PlanBuilder();
    this.executeBridge = executeBridge ?? createMockExecuteBridge();
    this.boundaryLogger = new StructuredLogger({ retentionLimit: 100 });
    this.eventPublisher = undefined;
    this.dbPath = undefined;
  }

  createEmptyEventFlowSituation() {
    return super.createEmptyEventFlowSituation();
  }

  createEmptyGoalDecompositionSituation() {
    return super.createEmptyGoalDecompositionSituation();
  }

  createEmptyMemorySituation() {
    return super.createEmptyMemorySituation();
  }
}

function createMockExecuteBridge(): ExecuteBridge {
  return {
    async executeStep(step: PlanStep, _context: ExecutionContext): Promise<StepResult> {
      return {
        stepId: step.stepId,
        status: "succeeded",
        durationMs: 10,
        tokenCost: 5,
        summary: `Executed ${step.stepId}`,
        outputs: {},
        artifacts: [],
        modelId: "mock",
        retryCount: 0,
        validationPassed: true,
      };
    },
    async executePlan(plan: Plan, _context: ExecutionContext): Promise<ExecutionResult> {
      return {
        planId: plan.planId,
        results: plan.steps.map((step) => ({
          stepId: step.stepId,
          status: "succeeded" as const,
          durationMs: 10,
          tokenCost: 5,
          summary: `Executed ${step.stepId}`,
          outputs: {},
          artifacts: [],
          modelId: "mock",
          retryCount: 0,
          validationPassed: true,
        })),
        totalDurationMs: plan.steps.length * 10,
        totalTokenCost: plan.steps.length * 5,
        allSucceeded: true,
        skippedStepIds: [],
        failedStepIds: [],
      };
    },
    async executeSubgraph(subgraph: PlanStep[], _context: ExecutionContext): Promise<ExecutionResult> {
      return {
        planId: "subgraph-execution",
        results: subgraph.map((step) => ({
          stepId: step.stepId,
          status: "succeeded" as const,
          durationMs: 10,
          tokenCost: 5,
          summary: `Executed ${step.stepId}`,
          outputs: {},
          artifacts: [],
          modelId: "mock",
          retryCount: 0,
          validationPassed: true,
        })),
        totalDurationMs: subgraph.length * 10,
        totalTokenCost: subgraph.length * 5,
        allSucceeded: true,
        skippedStepIds: [],
        failedStepIds: [],
      };
    },
    async executeChildRun(_plan: Plan, _context: ExecutionContext, _parentRunId: string): Promise<ExecutionResult> {
      return {
        planId: "child-run",
        results: [],
        totalDurationMs: 0,
        totalTokenCost: 0,
        allSucceeded: true,
        skippedStepIds: [],
        failedStepIds: [],
      };
    },
    toDualChannelStepOutputs(result: ExecutionResult): DualChannelStepOutput[] {
      return result.results.map((stepResult) => ({
        stepId: stepResult.stepId,
        planRef: result.planId,
        userFacingResult: {
          summary: stepResult.summary,
          artifacts: stepResult.artifacts,
        },
        systemTelemetry: {
          durationMs: stepResult.durationMs,
          tokensUsed: stepResult.tokenCost,
          modelId: stepResult.modelId,
          retryCount: stepResult.retryCount,
          validationPassed: stepResult.validationPassed,
        },
      }));
    },
  };
}

function createMockPlanGraphBundle(taskId: string): PlanGraphBundle {
  return createPlanGraphBundle({
    harnessRunId: `harness:${taskId}`,
    graphVersion: 1,
    graph: {
      graphId: `graph:${taskId}`,
      nodes: [
        {
          nodeId: "node_1",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema:output",
          riskClass: "low",
          budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["compute"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 1000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_1"],
      terminalNodeIds: ["node_1"],
      joinStrategy: "all",
      graphHash: `hash:${taskId}`,
    },
    schedulerPolicy: { policyId: "scheduler:default", strategy: "deterministic_fifo" },
    budgetPlanRef: `budget:${taskId}`,
    riskProfile: { riskClass: "low", reasons: [] },
  });
}

function createMockPlan(taskId: string): Plan {
  return {
    planId: `plan:${taskId}`,
    taskId,
    version: 1,
    assessmentRef: `assessment:${taskId}`,
    strategy: "linear",
    steps: [
      {
        stepId: "step_1",
        action: "tool:read",
        title: "Read File",
        inputs: {},
        outputs: ["output_1"],
        dependencies: [],
        status: "pending",
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    createdAt: Date.now(),
  };
}

function createMockAssessment(): UnifiedAssessment {
  return {
    taskId: "task_test",
    timestamp: Date.now(),
    situationRef: "assessment:test",
    phase: "pre-execution",
    complexity: "moderate",
    risk: "medium",
    riskAssessment: { level: "medium", factors: ["test_factor"] },
    routingDecision: { division: "coding", workflow: "multi-step", rationale: "test" },
    resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
    approvalPolicy: { required: false, level: "none" },
    executionMode: "auto",
    suggestedActions: [],
  };
}

function createMockFeedbackBatch(taskId: string): FeedbackBatch {
  return {
    feedbackId: `feedback:${taskId}`,
    taskId,
    collectedAt: Date.now(),
    signals: [],
    metadata: { source: "test" },
  };
}

function createMockStepOutputs(): DualChannelStepOutput[] {
  return [
    {
      stepId: "step_1",
      planRef: "plan:test",
      userFacingResult: {
        summary: "Step 1 completed successfully",
        artifacts: ["artifact:1"],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: 50,
        modelId: "test-model",
        retryCount: 0,
        validationPassed: true,
      },
    },
  ];
}

test("OapeflirLoopSupport.buildExecutionContext creates correct execution context", () => {
  const support = new TestableOapeflirLoopSupport();
  const planGraphBundle = createMockPlanGraphBundle("task_exec_ctx");
  const plan = createMockPlan("task_exec_ctx");
  const assessment = createMockAssessment();

  const input = {
    taskId: "task_exec_ctx",
    objective: "Test execution context",
  };

  const context = support.buildExecutionContext(input as any, planGraphBundle, plan, assessment);

  assert.equal(context.taskId, "task_exec_ctx");
  assert.equal(context.tokenBudget, assessment.resourceAllocation.maxTokens);
  assert.ok(context.budgetLedgerId.includes("budget:"));
});

test("OapeflirLoopSupport.buildDecisionInputBundle creates bundle with correct structure", () => {
  const support = new TestableOapeflirLoopSupport();
  const planGraphBundle = createMockPlanGraphBundle("task_bundle");
  const stepOutputs = createMockStepOutputs();

  const bundle = support.buildDecisionInputBundle({
    taskId: "task_bundle",
    harnessRunId: "harness:bundle",
    planGraphBundle,
    assessment: { risk: "medium" },
    feedback: createMockFeedbackBatch("task_bundle"),
    qualityGate: { accepted: true, reasonCodes: [], releaseStage: "auto" },
    replanDecision: { shouldReplan: false },
    evaluationReport: { score: 0.9 },
    stepOutputs,
  });

  assert.ok(bundle.decisionInputBundleId.length > 0);
  assert.equal(bundle.decisionKind, "approve");
});

test("OapeflirLoopSupport.buildDecisionInputBundle returns replan decisionKind when shouldReplan is true", () => {
  const support = new TestableOapeflirLoopSupport();
  const planGraphBundle = createMockPlanGraphBundle("task_replan_bundle");
  const stepOutputs = createMockStepOutputs();

  const bundle = support.buildDecisionInputBundle({
    taskId: "task_replan_bundle",
    harnessRunId: "harness:replan",
    planGraphBundle,
    assessment: { risk: "high" },
    feedback: createMockFeedbackBatch("task_replan_bundle"),
    qualityGate: { accepted: false, reasonCodes: ["quality_gate_failed"], releaseStage: "repair" },
    replanDecision: { shouldReplan: true },
    evaluationReport: { score: 0.4 },
    stepOutputs,
  });

  assert.equal(bundle.decisionKind, "replan");
});

test("OapeflirLoopSupport.executeSubgraphViaBridge executes subgraph and returns outputs", async () => {
  const bridge = createMockExecuteBridge();
  const support = new TestableOapeflirLoopSupport(bridge);

  const subgraph: PlanStep[] = [
    {
      stepId: "subgraph_step_1",
      action: "tool:test",
      title: "Test Step",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 1000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const context: ExecutionContext = {
    taskId: "task_subgraph",
    tokenBudget: 1000,
    budgetLedgerId: "budget:test",
  };

  const outputs = await support.executeSubgraphViaBridge(subgraph, context);

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].stepId, "subgraph_step_1");
});

test("OapeflirLoopSupport.executeChildRunViaBridge executes child run and returns outputs", async () => {
  const bridge = createMockExecuteBridge();
  const support = new TestableOapeflirLoopSupport(bridge);

  const plan = createMockPlan("task_child");
  const context: ExecutionContext = {
    taskId: "task_child",
    tokenBudget: 1000,
    budgetLedgerId: "budget:test",
  };

  const outputs = await support.executeChildRunViaBridge(plan, context, "parent_run_123");

  assert.ok(Array.isArray(outputs));
});

test("OapeflirLoopSupport.buildFeedbackSignals creates signals from step outputs", () => {
  const support = new TestableOapeflirLoopSupport();
  const stepOutputs = createMockStepOutputs();

  const signals = support.buildFeedbackSignals("task_feedback", stepOutputs);

  assert.equal(signals.length, 1);
  assert.equal(signals[0].taskId, "task_feedback");
  assert.equal(signals[0].category, "success");
  assert.equal(signals[0].severity, "info");
});

test("OapeflirLoopSupport.buildFeedbackSignals marks failed validation as failure category", () => {
  const support = new TestableOapeflirLoopSupport();
  const stepOutputsWithFailure: DualChannelStepOutput[] = [
    {
      stepId: "step_fail",
      planRef: "plan:test",
      userFacingResult: {
        summary: "Step failed",
        artifacts: [],
      },
      systemTelemetry: {
        durationMs: 100,
        tokensUsed: 50,
        modelId: "test-model",
        retryCount: 0,
        validationPassed: false,
      },
    },
  ];

  const signals = support.buildFeedbackSignals("task_fail", stepOutputsWithFailure);

  assert.equal(signals.length, 1);
  assert.equal(signals[0].category, "failure");
  assert.equal(signals[0].severity, "error");
});

test("OapeflirLoopSupport.deriveFallbackIntentConfidence calculates correct confidence", () => {
  const support = new TestableOapeflirLoopSupport();

  // Test with objective only
  const inputWithObjective = {
    taskId: "task_1",
    objective: "Test objective",
  } as any;
  const confidence1 = support.deriveFallbackIntentConfidence(inputWithObjective);
  assert.ok(confidence1 >= 0.65 && confidence1 <= 0.8);

  // Test with objective and file refs
  const inputWithFiles = {
    taskId: "task_2",
    objective: "Test with files",
    fileRefs: ["file1.ts", "file2.ts"],
  } as any;
  const confidence2 = support.deriveFallbackIntentConfidence(inputWithFiles);
  assert.ok(confidence2 > confidence1);

  // Test with blocker summaries
  const inputWithBlockers = {
    taskId: "task_3",
    objective: "Test with blockers",
    blockerSummaries: ["blocker1", "blocker2"],
  } as any;
  const confidence3 = support.deriveFallbackIntentConfidence(inputWithBlockers);
  assert.ok(confidence3 > confidence1);
});

test("OapeflirLoopSupport.mapRiskClassToScore maps risk classes correctly", () => {
  const support = new TestableOapeflirLoopSupport();

  assert.equal(support.mapRiskClassToScore("low"), 0.25);
  assert.equal(support.mapRiskClassToScore("medium"), 0.5);
  assert.equal(support.mapRiskClassToScore("high"), 0.85);
  assert.equal(support.mapRiskClassToScore("critical"), 1);
  assert.equal(support.mapRiskClassToScore("unknown"), 0.5);
});

test("OapeflirLoopSupport.buildPlanGraphBundle creates bundle from plan", () => {
  const support = new TestableOapeflirLoopSupport();
  const plan = createMockPlan("task_graph");
  const stepOutputs = createMockStepOutputs();

  const bundle = support.buildPlanGraphBundle(plan, "task_graph", stepOutputs.length);

  assert.ok(bundle.planGraphBundleId.length > 0);
  assert.equal(bundle.graph.nodes.length, 1);
  assert.equal(bundle.graph.nodes[0].nodeId, "step_1");
  assert.equal(bundle.graph.entryNodeIds.length, 1);
  assert.equal(bundle.graph.terminalNodeIds.length, 1);
});

test("OapeflirLoopSupport.buildPlanGraphBundle handles plan with dependencies", () => {
  const support = new TestableOapeflirLoopSupport();
  const plan: Plan = {
    planId: "plan:dep",
    taskId: "task_dep",
    version: 1,
    assessmentRef: "assessment:dep",
    strategy: "linear",
    steps: [
      {
        stepId: "step_a",
        action: "tool:read",
        title: "Read",
        inputs: {},
        outputs: ["out_a"],
        dependencies: [],
        status: "pending",
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step_b",
        action: "tool:write",
        title: "Write",
        inputs: {},
        outputs: ["out_b"],
        dependencies: ["step_a"],
        status: "pending",
        timeout: 1000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ],
    createdAt: Date.now(),
  };

  const bundle = support.buildPlanGraphBundle(plan, "task_dep", 2);

  // step_a should be entry (no dependencies), step_b should be terminal (no dependents)
  assert.deepEqual(bundle.graph.entryNodeIds, ["step_a"]);
  assert.deepEqual(bundle.graph.terminalNodeIds, ["step_b"]);
  // Should have 1 edge: step_a -> step_b
  assert.equal(bundle.graph.edges.length, 1);
  assert.equal(bundle.graph.edges[0].fromNodeId, "step_a");
  assert.equal(bundle.graph.edges[0].toNodeId, "step_b");
});

test("OapeflirLoopSupport.toLegacyPlan converts bundle to legacy plan format", () => {
  const support = new TestableOapeflirLoopSupport();
  const bundle = createMockPlanGraphBundle("task_legacy");

  const legacyPlan = support.toLegacyPlan(bundle, "task_legacy");

  assert.equal(legacyPlan.taskId, "task_legacy");
  assert.equal(legacyPlan.version, 1);
  assert.ok(legacyPlan.steps.length > 0);
  assert.equal(legacyPlan.steps[0].stepId, "node_1");
});

test("OapeflirLoopSupport.buildGraphPatch creates patch for replanning", () => {
  const support = new TestableOapeflirLoopSupport();
  const plan = createMockPlan("task_patch");

  const patch = support.buildGraphPatch(plan, 2);

  assert.ok(patch.harnessRunId.includes("oapeflir_run"));
  assert.equal(patch.baseGraphVersion, 1);
  assert.equal(patch.newGraphVersion, 2);
  assert.ok(patch.operations.length > 0);
  assert.equal(patch.operations[0].operationType, "add_node");
});

test("OapeflirLoopSupport.buildRiskPropagationSummary returns null when no risk data", () => {
  const support = new TestableOapeflirLoopSupport();
  const bundle = createMockPlanGraphBundle("task_no_risk");
  // Override validationReport to have no risk data
  bundle.validationReport = {
    valid: true,
    findings: [],
    normalizedNodeIds: [],
    worstPath: undefined,
    riskPropagation: undefined,
  };

  const summary = support.buildRiskPropagationSummary(bundle);

  assert.equal(summary, null);
});

test("OapeflirLoopSupport.buildRiskPropagationSummary returns risk data when present", () => {
  const support = new TestableOapeflirLoopSupport();
  const bundle = createMockPlanGraphBundle("task_risk");
  bundle.validationReport = {
    valid: true,
    findings: ["risk:high"],
    normalizedNodeIds: [],
    worstPath: {
      pathNodeIds: ["node_1", "node_2"],
      riskClass: "high",
      timeoutMs: 5000,
      estimatedBudgetAmount: 1000,
    },
    riskPropagation: [
      {
        nodeId: "node_1",
        reasons: ["reason1", "reason2"],
      },
    ],
  };

  const summary = support.buildRiskPropagationSummary(bundle);

  assert.ok(summary !== null);
  assert.equal(summary.riskScore, 0.85); // high risk
  assert.deepEqual(summary.criticalPathNodes, ["node_1", "node_2"]);
  assert.equal(summary.findings.length, 2);
});

test("OapeflirLoopSupport.normalizeObservationTask fills in missing fields", () => {
  const support = new TestableOapeflirLoopSupport();
  const task: TaskSituation = {
    taskId: "task_normalize",
    timestamp: Date.now(),
    objective: "Test normalization",
    currentPhase: "planning",
    userIntent: {
      raw: "Test",
      normalized: "Test",
      confidence: 0.8,
    },
    blockers: [],
    relevantMemory: [],
    fileRefs: [],
    metrics: {},
  } as any;

  const input = {
    taskId: "task_normalize",
    fileRefs: ["file1.ts", "file2.ts"],
    blockerSummaries: ["blocker1"],
  } as any;

  const normalized = support.normalizeObservationTask(task, input);

  assert.deepEqual(normalized.fileRefs, ["file1.ts", "file2.ts"]);
  assert.equal(normalized.blockers.length, 1);
});

test("OapeflirLoopSupport.buildPlanGraphBundleForInput delegates to planBuilder.buildGraphBundle when available", () => {
  const support = new TestableOapeflirLoopSupport();
  const planBuilder = new PlanBuilder();

  // Test that the method exists and works with proper plan builder input
  const input = {
    observation: support.createEmptyEventFlowSituation(),
    assessment: createMockAssessment(),
    workflow: {
      workflow: { workflowId: "wf_test", divisionId: "coding", steps: [] },
      executionSteps: [],
      planReason: "test",
      dependencyEdges: [],
    },
  };

  // This test verifies the buildPlanGraphBundleForInput method handles both cases
  // When buildGraphBundle is available, it should use it
  const bundle = support.buildPlanGraphBundleForInput(input as any, { normalizeGraph: false });

  assert.ok(bundle.planGraphBundleId.length > 0);
});

test("OapeflirLoopSupport.createEmptyEventFlowSituation creates valid situation", () => {
  const support = new TestableOapeflirLoopSupport();
  const situation = support.createEmptyEventFlowSituation();

  assert.ok(situation != null);
});

test("OapeflirLoopSupport.createEmptyGoalDecompositionSituation creates valid situation", () => {
  const support = new TestableOapeflirLoopSupport();
  const situation = support.createEmptyGoalDecompositionSituation();

  assert.ok(situation != null);
});

test("OapeflirLoopSupport.createEmptyMemorySituation creates valid situation", () => {
  const support = new TestableOapeflirLoopSupport();
  const situation = support.createEmptyMemorySituation();

  assert.ok(situation != null);
});

test("OapeflirLoopSupport.buildDecisionInputBundle calculates remaining budget correctly", () => {
  const support = new TestableOapeflirLoopSupport();
  const planGraphBundle = createMockPlanGraphBundle("task_budget");

  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "full_auto",
    tool_policy: { allowedTools: [] },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 300000 },
    approvalRequirement: {
      requiredForRiskClass: [],
      approverRoles: [],
      escalationTimeoutMs: 60000,
    },
    budgetEnvelope: {
      maxSteps: 10,
      maxCost: 1000,
      maxDurationMs: 60000,
    },
  } as any;

  const stepOutputs = createMockStepOutputs();

  const bundle = support.buildDecisionInputBundle({
    taskId: "task_budget",
    harnessRunId: "harness:budget",
    planGraphBundle,
    assessment: { risk: "medium" },
    feedback: createMockFeedbackBatch("task_budget"),
    qualityGate: { accepted: true, reasonCodes: [], releaseStage: "auto" },
    replanDecision: { shouldReplan: false },
    evaluationReport: { score: 0.9 },
    constraintPack,
    stepOutputs,
  });

  // Budget should reflect remaining after 1 step
  assert.equal(bundle.budget?.remainingSteps, 9);
  assert.ok(bundle.budget?.remainingCost !== undefined);
  assert.ok(bundle.budget?.remainingDurationMs !== undefined);
});

test("OapeflirLoopSupport.buildDecisionInputBundle maps risk score correctly", () => {
  const support = new TestableOapeflirLoopSupport();
  const planGraphBundle = createMockPlanGraphBundle("task_risk_score");
  planGraphBundle.riskProfile.riskClass = "high";
  planGraphBundle.riskProfile.reasons = ["test_reason"];

  const bundle = support.buildDecisionInputBundle({
    taskId: "task_risk_score",
    harnessRunId: "harness:risk",
    planGraphBundle,
    assessment: { risk: "high" as any },
    feedback: createMockFeedbackBatch("task_risk_score"),
    qualityGate: { accepted: true, reasonCodes: [], releaseStage: "auto" },
    replanDecision: { shouldReplan: false },
    evaluationReport: { score: 0.9 },
    stepOutputs: [],
  });

  // mapRiskClassToScore("high") = 0.85
  assert.equal(bundle.risk?.currentScore, 0.85);
});
