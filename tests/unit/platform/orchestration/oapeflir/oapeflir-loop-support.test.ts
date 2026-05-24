import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopSupport } from "../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.js";
import { ObservationAggregator } from "../../../../../src/platform/shared/observability/observation-aggregator.js";
import { PlanBuilder } from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import type { ExecuteBridge } from "../../../../../src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";
import type {
  DualChannelStepOutput,
  Plan,
  UnifiedAssessment,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import type { PlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

class TestSupport extends OapeflirLoopSupport {
  protected readonly observationAggregator = new ObservationAggregator();
  protected readonly planBuilder = new PlanBuilder();
  protected readonly boundaryLogger = new StructuredLogger({ retentionLimit: 10 });
  protected readonly eventPublisher = undefined;
  protected readonly dbPath = undefined;
  public loopController = null;
  protected readonly executeBridge: ExecuteBridge = {
    executeStep: async () => {
      throw new Error("unused");
    },
    executePlan: async () => {
      throw new Error("unused");
    },
    executeSubgraph: async () => {
      throw new Error("unused");
    },
    executeChildRun: async () => {
      throw new Error("unused");
    },
    toDualChannelStepOutputs: () => [],
  };

  public extractSummary(result: {
    feedback: FeedbackBatch;
  } & Record<string, unknown>): string {
    return TestSupport.extractFeedbackSummary(result as never);
  }

  public fallbackConfidence(input: {
    objective: string;
    fileRefs?: string[];
    blockerSummaries?: string[];
  }): number {
    return this.deriveFallbackIntentConfidence(input as never);
  }

  public emptySituations() {
    return {
      eventFlow: this.createEmptyEventFlowSituation(),
      goalDecomposition: this.createEmptyGoalDecompositionSituation(),
      memory: this.createEmptyMemorySituation(),
    };
  }

  public decisionBundle(input: Parameters<OapeflirLoopSupport["buildDecisionInputBundle"]>[0]) {
    return this.buildDecisionInputBundle(input);
  }
}

function makePlanGraphBundle(): PlanGraphBundle {
  return {
    planGraphBundleId: "bundle-1",
    harnessRunId: "harness-1",
    graphVersion: 1,
    createdAt: new Date(0).toISOString(),
    graph: {
      graphId: "graph-1",
      nodes: [{
        nodeId: "node-1",
        nodeType: "tool",
        inputRefs: [],
        riskClass: "low",
        budgetIntent: {},
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      }],
      edges: [],
      entryNodeIds: ["node-1"],
      terminalNodeIds: ["node-1"],
      joinStrategy: "all",
      graphHash: "hash-1",
    },
    schedulerPolicy: { policyId: "scheduler-1", strategy: "deterministic_fifo" },
    budgetPlanRef: "budget-1",
    riskProfile: { riskClass: "medium", reasons: [] },
    validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
  } as never;
}

test("OapeflirLoopSupport extracts feedback summaries from payload", () => {
  const support = new TestSupport();

  const summary = support.extractSummary({
    feedback: {
      feedbackId: "feedback-1",
      taskId: "task-1",
      executionId: null,
      planId: null,
      outcome: "completed",
      signals: [{
        signalId: "signal-1",
        taskId: "task-1",
        source: "system",
        category: "success",
        severity: "info",
        payload: { summary: "completed successfully" },
        stepOutputRefs: [],
        timestamp: 1,
        trustFactors: {
          sourceReliability: 1,
          historicalAccuracy: 1,
          authenticatedSource: true,
          attackSurfaceExposure: 0,
          holdoutOverlap: 0,
        },
        feedbackTrustScore: 1,
      }],
      emittedAt: 1,
    },
  });

  assert.equal(summary, "completed successfully");
});

test("OapeflirLoopSupport derives bounded fallback confidence", () => {
  const support = new TestSupport();

  const base = support.fallbackConfidence({ objective: "do work" });
  const enriched = support.fallbackConfidence({
    objective: "do work",
    fileRefs: ["a.ts", "b.ts", "c.ts"],
    blockerSummaries: ["blocked"],
  });

  assert.ok(base >= 0.65 && base <= 0.8);
  assert.ok(enriched >= base);
  assert.ok(enriched <= 0.8);
});

test("OapeflirLoopSupport creates empty observation sub-situations", () => {
  const support = new TestSupport();
  const empty = support.emptySituations();

  assert.ok(empty.eventFlow);
  assert.ok(empty.goalDecomposition);
  assert.ok(empty.memory);
});

test("OapeflirLoopSupport builds decision bundles from current plan state", () => {
  const support = new TestSupport();
  const assessment: Pick<UnifiedAssessment, "risk"> = { risk: "medium" };
  const stepOutputs: DualChannelStepOutput[] = [{
    planRef: "plan-1",
    stepId: "step-1",
    userFacingResult: { summary: "ok", artifacts: [] },
    systemTelemetry: {
      modelId: "mock",
      retryCount: 0,
      durationMs: 100,
      tokensUsed: 50,
      validationPassed: true,
    },
  }];
  const constraintPack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: [] },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 60_000,
    },
    budgetEnvelope: { maxSteps: 5, maxCost: 100, maxDurationMs: 5_000 },
  };

  const bundle = support.decisionBundle({
    taskId: "task-1",
    harnessRunId: "harness-1",
    planGraphBundle: makePlanGraphBundle(),
    assessment,
    feedback: {
      feedbackId: "feedback-1",
      taskId: "task-1",
      executionId: null,
      planId: null,
      outcome: "completed",
      signals: [],
      emittedAt: 1,
    },
    qualityGate: { accepted: true, reasonCodes: [], releaseStage: "approved" },
    replanDecision: { shouldReplan: false },
    evaluationReport: { score: 0.9 },
    constraintPack,
    stepOutputs,
  });

  assert.equal(bundle.decisionKind, "approve");
  assert.equal(bundle.budget.remainingSteps, 4);
  assert.equal(bundle.budget.remainingDurationMs, 4_900);
});
