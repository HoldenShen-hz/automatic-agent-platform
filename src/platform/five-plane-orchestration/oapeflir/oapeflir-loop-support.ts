import type { PlannedExecutionStep, PlannedWorkflow } from "../routing/workflow-planner.js";
import type { ConstraintPack, HarnessDecision } from "../harness/index.js";
import {
  createDecisionInputBundle,
  createPlanGraphBundle,
  createGraphPatch,
  type DecisionInputBundle,
  type GraphPatch,
  type JsonValue,
  type PlanGraphBundle,
} from "../../contracts/executable-contracts/index.js";
import { TaskSituationBuilder } from "../../shared/observability/task-situation-builder.js";
import type {
  DualChannelStepOutput,
  FeedbackSignal,
  Plan,
  RolloutRecord,
  TaskSituation,
  UnifiedAssessment,
} from "./types/index.js";
import {
  ObservationAggregator,
  type GoalDecompositionSituation,
  type UnifiedObservation,
} from "../../shared/observability/observation-aggregator.js";
import { SystemSituationBuilder } from "../../shared/observability/system-situation-builder.js";
import { AssessmentService, type EffectivePolicySnapshot, type RiskAssessment } from "./assessment-service.js";
import { PlanBuilder, type BuildPlanOptions, type PlanBuilderInput } from "../planner/plan-builder.js";
import { FeedbackCollector } from "../../../scale-ecosystem/feedback-loop/collector/feedback-collector.js";
import type { FeedbackBatch, LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import {
  ExecutionOutcomeEvaluator,
  type ExecutionOutcomeEvaluation,
  type EvaluationReport,
} from "../../prompt-engine/eval/execution-outcome-evaluator.js";
import { PostExecutionQualityGate } from "../../prompt-engine/eval/post-execution-quality-gate.js";
import type { PostExecutionQualityGateDecision } from "../../prompt-engine/eval/post-execution-quality-gate.js";
import { ReplanningService } from "../planner/replanning-service.js";
import type { ReplanningDecision } from "../planner/replanning-service.js";
import { StrategyLearningService } from "./learn/strategy-learning-service.js";
import type { LearningObject } from "./learn/learning-object-model.js";
import { KnowledgePromotionService } from "./learn/knowledge-promotion-service.js";
import { AutonomyBoundaryPolicy } from "./improve-rollout/autonomy-boundary-policy.js";
import { ImprovementCandidateRegistry } from "./improve-rollout/improvement-candidate-registry.js";
import { PolicyRolloutService } from "./improve-rollout/policy-rollout-service.js";
import { createStrategyVersion } from "./improve-rollout/strategy-versioning.js";
import { OapeflirStageTimelineBuilder, type OapeflirStageRecord } from "./stage-timeline.js";
import { buildFromStepResults } from "./handoff-builder.js";
import { serializeHandoff } from "./handoff-serializer.js";
import type { AgentHandoff } from "./handoff-model.js";
import type { ExecuteBridge, ExecutionContext } from "./execute-bridge.js";
import { RuntimeExecuteBridge, MockExecuteBridge } from "./runtime-execute-bridge.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
import { startActiveSpan } from "../../shared/observability/otel-tracer.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import {
  validateTaskSituation,
  validateUnifiedAssessment,
  validatePlan,
  validateStepOutputs,
  validateFeedbackSignals,
  validateLearningSignalsArray,
  validateLearningObjects,
  validateRolloutRecord,
  BOUNDARY_STRATEGY,
  type ValidationResult,
} from "./schemas/validators.js";
import { StageTransitionFSM, createStageTransitionFSM } from "./stage-transition-fsm.js";
import { HarnessLoopController } from "../harness/loop/index.js";
import { newId } from "../../contracts/types/ids.js";
import { nowIso } from "../../contracts/types/ids.js";
import { openAuthoritativeStorageContext } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import {
  ensureBudgetLedger,
  reserveBudgetLedger,
  type EnsureBudgetLedgerInput,
} from "../../five-plane-execution/budget-ledger-reservation.js";
import { DEFAULT_MODEL_METADATA_REGISTRY } from "../../five-plane-control-plane/config-center/model-metadata-registry.js";
import type { GoalDecompositionResult } from "../../../interaction/goal-decomposer/index.js";
import type { MinimalWorkflowDefinition, MinimalWorkflowStep } from "./workflow/minimal-workflow.js";
import { ValidationError } from "../../contracts/errors.js";

import type { OapeflirLoopInput, OapeflirLoopResult } from "./oapeflir-loop-core.js";

type OapeflirPlanBuilder = Pick<PlanBuilder, "build"> & Partial<{
  buildGraphBundle: (input: PlanBuilderInput, options?: BuildPlanOptions) => PlanGraphBundle;
}>;

function normalizeOapeflirStageName(stage: string): string {
  return stage.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

export abstract class OapeflirLoopSupport {
  protected abstract readonly observationAggregator: ObservationAggregator;
  protected abstract readonly planBuilder: OapeflirPlanBuilder;
  protected abstract readonly executeBridge: ExecuteBridge;
  protected abstract readonly boundaryLogger: StructuredLogger;
  protected abstract readonly eventPublisher: import("../../five-plane-state-evidence/events/typed-event-publisher.js").TypedEventPublisher | undefined;
  protected abstract readonly dbPath: string | undefined;
  public abstract loopController: HarnessLoopController | null;

  protected buildExecutionContext(
    input: OapeflirLoopInput,
    planGraphBundle: PlanGraphBundle,
    plan: Plan,
    assessment: UnifiedAssessment,
  ): ExecutionContext {
    return {
      taskId: input.taskId,
      tokenBudget: assessment.resourceAllocation.maxTokens,
      budgetLedgerId: `${planGraphBundle.budgetPlanRef ?? `budget:${input.taskId}`}:execute:v${plan.version}`,
    };
  }

  protected buildDecisionInputBundle(input: {
    taskId: string;
    harnessRunId: string;
    planGraphBundle: PlanGraphBundle;
    assessment: Pick<UnifiedAssessment, "risk"> | { risk: UnifiedAssessment["risk"] };
    feedback: FeedbackBatch;
    qualityGate: Pick<PostExecutionQualityGateDecision, "accepted" | "reasonCodes" | "releaseStage">;
    replanDecision: Pick<ReplanningDecision, "shouldReplan">;
    evaluationReport: Pick<EvaluationReport, "score"> & Partial<Pick<EvaluationReport, "notes">>;
    constraintPack?: ConstraintPack;
    stepOutputs: readonly DualChannelStepOutput[];
  }): DecisionInputBundle {
    const budgetEnvelope = input.constraintPack?.budgetEnvelope;
    const remainingSteps = budgetEnvelope == null
      ? 0
      : Math.max(0, budgetEnvelope.maxSteps - input.stepOutputs.length);
    const consumedCostUsd = input.stepOutputs.reduce(
      (sum, output) => sum + this.estimateUsdFromTokens(output.systemTelemetry.tokensUsed, output.systemTelemetry.modelId),
      0,
    );
    const remainingCost = budgetEnvelope == null
      ? 0
      : Math.max(0, budgetEnvelope.maxCost - consumedCostUsd);
    const remainingDurationMs = budgetEnvelope == null
      ? 0
      : Math.max(0, budgetEnvelope.maxDurationMs - input.stepOutputs.reduce((sum, output) => sum + output.systemTelemetry.durationMs, 0));
    const firstNode = input.planGraphBundle.graph.nodes[0];
    const decisionKind = input.replanDecision.shouldReplan
      ? "replan"
      : input.qualityGate.accepted || input.qualityGate.releaseStage === "approval"
        ? "approve"
        : "retry";
    const bundle = createDecisionInputBundle({
      harnessRunId: input.harnessRunId,
      decisionKind,
      riskClass: input.planGraphBundle.riskProfile.riskClass,
      evaluator: {
        score: input.evaluationReport.score,
        reasoning: input.evaluationReport.notes ?? "oapeflir.evaluation.complete",
      },
      policy: {
        policyIds: input.constraintPack?.policyIds ?? [],
        constraintPackRef: `constraint-pack:${input.taskId}`,
      },
      budget: {
        remainingSteps,
        remainingCost,
        remainingDurationMs,
      },
      risk: {
        currentScore: this.mapRiskClassToScore(input.assessment.risk),
        maxScore: input.constraintPack?.risk_policy?.maxRiskScore ?? 1,
        escalationThreshold: input.constraintPack?.risk_policy?.escalationThreshold ?? 0.7,
      },
      ...(firstNode == null ? {} : {
        node: {
          nodeId: firstNode.nodeId,
          nodeType: firstNode.nodeType,
          status: input.stepOutputs.every((output) => output.systemTelemetry.validationPassed) ? "succeeded" : "failed",
        },
      }),
      ...(firstNode == null ? {} : {
        sideEffect: {
          mayCommit: firstNode.sideEffectProfile.mayCommitExternalEffect,
          reversible: firstNode.sideEffectProfile.reversible,
        },
      }),
      hitl: {
        pending: false,
        requestId: null,
      },
      guardrail: null,
    });
    return {
      ...bundle,
      bundleId: bundle.decisionInputBundleId,
    };
  }

  /**
   * R4-25 (INV-BUDGET-001) fix: Reserve budget BEFORE execution via bridge.
   * BudgetAllocator.reserve() must be called before any cost-bearing execution
   * to properly track expected cost via the state machine.
   */
  protected async reserveBudgetForExecution(context: ExecutionContext, taskId: string): Promise<void> {
    if (!context.budgetLedgerId || !this.dbPath) {
      return;
    }
    const storage = openAuthoritativeStorageContext({ dbPath: this.dbPath });
    storage.migrate();
    try {
      const amount = this.estimateUsdFromTokens(context.tokenBudget ?? 1_000, context.modelId);
      storage.sql.transaction(() => {
        ensureOapeflirBudgetReservationAnchors(storage.sql.connection, {
          budgetLedgerId: context.budgetLedgerId!,
          taskId,
        });
        ensureBudgetLedger({
          connection: storage.sql.connection,
          budgetLedgerId: context.budgetLedgerId!,
          tenantId: "tenant:oapeflir",
          harnessRunId: `hrun:oapeflir:${context.budgetLedgerId!}`,
          currency: "USD",
          hardCap: amount,
        });
        // Canonical budget reserve path stays routed through budgetAllocator.reserve(...),
        // which persists UPDATE budget_ledgers and raises budget_reservation.sql_cas_failed on CAS contention.
        reserveBudgetLedger({
          connection: storage.sql.connection,
          budgetLedgerId: context.budgetLedgerId!,
          amount,
          resourceKind: "api",
          allocatorContext: {
            tenantId: "tenant:unknown",
            traceId: taskId,
            emittedBy: "oapeflir-loop-service",
            principal: "oapeflir",
          },
          onMissingLedger: () => {
            this.boundaryLogger.warn("[budget] No ledger found for budget reservation", {
              data: { budgetLedgerId: context.budgetLedgerId, taskId },
            });
          },
        });
      });
    } finally {
      storage.close();
    }
  }

  /**
   * R5-13: Execute a subgraph of steps via the bridge.
   * Used when the loop needs to execute a subset of steps for parallel branches,
   * conditional paths, or nested workflows.
   */
  public async executeSubgraphViaBridge(
    subgraph: import("./types/plan.js").PlanStep[],
    context: ExecutionContext,
  ): Promise<DualChannelStepOutput[]> {
    const executionResult = await this.executeBridge.executeSubgraph(subgraph, context);
    return this.executeBridge.toDualChannelStepOutputs(executionResult);
  }

  /**
   * R5-13: Execute a child run attached to a parent run via the bridge.
   * Used for spawning child executions in multi-agent scenarios or
   * detached background workflows.
   */
  public async executeChildRunViaBridge(
    plan: Plan,
    context: ExecutionContext,
    parentRunId: string,
  ): Promise<DualChannelStepOutput[]> {
    const executionResult = await this.executeBridge.executeChildRun(plan, context, parentRunId);
    return this.executeBridge.toDualChannelStepOutputs(executionResult);
  }

  protected async runStage<T>(
    stage: string,
    operation: () => Promise<T> | T,
    attributes: Record<string, unknown>,
  ): Promise<T> {
    const startedAt = Date.now();
    const canonicalStage = normalizeOapeflirStageName(stage);
    runtimeMetricsRegistry.recordOapeflirStageEntry(canonicalStage);
    let outcome: "completed" | "error" = "completed";
    try {
      return await startActiveSpan(`oapeflir.${canonicalStage}`, {
        tracerName: "automatic-agent-platform.oapeflir",
        attributes: {
          "aa.oapeflir.stage": canonicalStage,
          ...attributes,
        },
      }, async () => await operation());
    } catch (error) {
      outcome = "error";
      throw error;
    } finally {
      const durationSeconds = (Date.now() - startedAt) / 1000;
      runtimeMetricsRegistry.recordOapeflirStage(canonicalStage, outcome, durationSeconds * 1000);
    }
  }

  public buildFeedbackSignals(taskId: string, stepOutputs: readonly DualChannelStepOutput[]): FeedbackSignal[] {
    return stepOutputs.map((output, index) => {
      // R19-08 fix: Derive feedback category from step output status, not a fixed "success" value.
      // Failed steps with validation failures should produce failure/blocker feedback
      const isLastStep = index === stepOutputs.length - 1;
      const validationPassed = output.systemTelemetry.validationPassed;
      const category: FeedbackSignal["category"] = !validationPassed
        ? "failure"
        : "success";
      const nodeRunId = typeof Reflect.get(output, "nodeRunId") === "string"
        ? String(Reflect.get(output, "nodeRunId"))
        : null;

      return {
        signalId: `signal_${index + 1}`,
        taskId,
        source: isLastStep ? "user" : "execution",
        category,
        severity: !validationPassed ? "error" : "info",
        payload: {
          summary: output.userFacingResult.summary,
          durationMs: output.systemTelemetry.durationMs,
          validationPassed,
        },
        stepOutputRefs: [nodeRunId ?? output.stepId],
        ...(nodeRunId != null ? { nodeRunId } : {}),
        timestamp: Date.now() + index,
        feedbackTrustScore: 0.5,
        trustFactors: {
          sourceReliability: 0.5,
          historicalAccuracy: 0.5,
          authenticatedSource: false,
          attackSurfaceExposure: 0.5,
          holdoutOverlap: 0,
        },
      };
    });
  }

  /**
   * R19-06 fix: Emits platform._ facts / oapeflir.view._ projections for state changes per §14.3.
   * Called after each stage transition to emit lifecycle events.
   */
  public emitOapeflirEvent(eventType: string, payload: Record<string, unknown>, taskId: string): void {
    if (!this.eventPublisher) {
      return;
    }
    (this.eventPublisher.publish as (input: { eventType: string; taskId: string; payload: Record<string, unknown> }) => void)({
      eventType,
      taskId,
      payload,
    });
  }

  public assertGuardAllowsStage(stage: "assess" | "plan" | "execute", taskId: string): void {
    const reasonCode = this.loopController?.getGuardViolation() ?? null;
    if (reasonCode == null) {
      return;
    }
    this.emitOapeflirEvent("oapeflir.decision.recorded", { stage, reasonCode }, taskId);
    throw new Error(`oapeflir.guard_blocked_before_${stage}: ${reasonCode}`);
  }

  protected emitStageEvent(stage: string, taskId: string, data: Record<string, unknown>): void {
    if (!this.eventPublisher) {
      return;
    }
    // Cast to allow oapeflir.view.run_lifecycle which is Record<string, unknown> in TypedEventPayloadMap
    (this.eventPublisher.publish as (input: { eventType: string; taskId: string; payload: Record<string, unknown> }) => void)({
      eventType: "oapeflir.view.run_lifecycle",
      taskId,
      payload: { stage, ...data },
    });
  }

  /**
   * Builds a serialized AgentHandoff from the result of a loop run.
   *
   * This is the integration point for §12 Agent Handoff Protocol (GAP-V2-05 Phase 3).
   * Call this after `run()` to produce a handoff suitable for passing to the next
   * agent in a multi-agent or session-continuation scenario.
   *
   * @param result - The OapeflirLoopResult from a prior run() call
   * @param fromAgentId - Identity of the agent handing off
   * @param toAgentId - Identity of the receiving agent
   * @param totalMaxTokens - Token budget for the serialized handoff (default 4096)
   */
  public buildSerializedHandoff(
    result: OapeflirLoopResult,
    fromAgentId: string,
    toAgentId: string,
    totalMaxTokens: number = 4096,
  ): AgentHandoff {
    const handoff = buildFromStepResults({
      taskId: result.observation.task.taskId,
      fromAgentId,
      toAgentId,
      currentPhase: "completed",
      blockers: result.observation.task.blockers.map((b) => b.description),
      remainingBudgetUsd: null,
      latestSummary: OapeflirLoopSupport.extractFeedbackSummary(result),
      completedSteps: result.plan.steps,
      stepOutputs: result.stepOutputs,
      primaryRefs: result.stepOutputs.flatMap((o) => o.userFacingResult.artifacts ?? []),
    });

    return serializeHandoff(handoff, { totalMaxTokens });
  }

  /**
   * Extracts a human-readable summary string from the first feedback signal's payload.
   * Falls back to an empty string if no signals are available or the payload is malformed.
   */
  protected static extractFeedbackSummary(result: OapeflirLoopResult): string {
    const signals = result.feedback.signals;
    if (!signals || signals.length === 0) {
      return "";
    }
    const first = signals[0]!;
    const payload = (first.payload as Record<string, unknown>) ?? {};
    if (typeof payload.summary === "string") {
      return payload.summary;
    }
    return "";
  }

  protected deriveFallbackIntentConfidence(input: OapeflirLoopInput): number {
    const objectiveSignal = input.objective.trim().length > 0 ? 0.68 : 0.65;
    const contextSignal = Math.min((input.fileRefs?.length ?? 0) * 0.03 + (input.blockerSummaries?.length ?? 0) * 0.02, 0.12);
    return Number(Math.min(0.8, objectiveSignal + contextSignal).toFixed(2));
  }

  protected buildPlanGraphBundleForInput(input: PlanBuilderInput, options: BuildPlanOptions): PlanGraphBundle {
    if ("buildGraphBundle" in this.planBuilder && typeof this.planBuilder.buildGraphBundle === "function") {
      return this.planBuilder.buildGraphBundle(input, options);
    }
    return this.planBuilder.build(input, options);
  }

  protected createEmptyEventFlowSituation() {
    if ("createEmptyEventFlowSituation" in this.observationAggregator
      && typeof this.observationAggregator.createEmptyEventFlowSituation === "function") {
      return this.observationAggregator.createEmptyEventFlowSituation();
    }
    return new ObservationAggregator().createEmptyEventFlowSituation();
  }

  protected createEmptyGoalDecompositionSituation() {
    if ("createEmptyGoalDecompositionSituation" in this.observationAggregator
      && typeof this.observationAggregator.createEmptyGoalDecompositionSituation === "function") {
      return this.observationAggregator.createEmptyGoalDecompositionSituation();
    }
    return new ObservationAggregator().createEmptyGoalDecompositionSituation();
  }

  protected createEmptyMemorySituation() {
    if ("createEmptyMemorySituation" in this.observationAggregator
      && typeof this.observationAggregator.createEmptyMemorySituation === "function") {
      return this.observationAggregator.createEmptyMemorySituation();
    }
    return new ObservationAggregator().createEmptyMemorySituation();
  }

  protected resolvePlanningWorkflow(input: OapeflirLoopInput): PlannedWorkflow {
    if (input.goalDecomposition == null) {
      return input.workflow;
    }
    return this.buildWorkflowFromGoalDecomposition(input.workflow, input.goalDecomposition);
  }

  protected buildGoalDecompositionSituation(input: OapeflirLoopInput): GoalDecompositionSituation {
    if (input.goalDecomposition == null) {
      return this.createEmptyGoalDecompositionSituation();
    }
    return {
      goalId: input.goalDecomposition.goalId,
      lifecycleState: input.goalDecomposition.lifecycleState,
      strategy: input.goalDecomposition.decompositionStrategy ?? null,
      taskCount: input.goalDecomposition.tasks.length,
      requiresHumanReview: input.goalDecomposition.requiresHumanReview,
      decompositionConfidence: input.goalDecomposition.decompositionConfidence,
      overallRisk: input.goalDecomposition.riskSummary.overallRisk,
    };
  }

  protected normalizeObservationTask(observationTask: TaskSituation, input: OapeflirLoopInput): TaskSituation {
    return {
      ...observationTask,
      blockers: observationTask.blockers ?? [],
      relevantMemory: observationTask.relevantMemory ?? [],
      fileRefs: (observationTask.fileRefs?.length ?? 0) > 0 ? observationTask.fileRefs : (input.fileRefs ?? []),
      metrics: observationTask.metrics ?? {},
    };
  }

  protected buildRiskPropagationSummary(planGraphBundle: PlanGraphBundle): {
    riskScore: number;
    criticalPathNodes: string[];
    findings: string[];
  } | null {
    const validationReport = planGraphBundle.validationReport;
    const worstPath = validationReport.worstPath;
    const riskFindings = validationReport.riskPropagation;
    if (worstPath == null && (riskFindings == null || riskFindings.length === 0)) {
      return null;
    }
    return {
      riskScore: this.mapRiskClassToScore(worstPath?.riskClass ?? planGraphBundle.riskProfile.riskClass),
      criticalPathNodes: [...(worstPath?.pathNodeIds ?? riskFindings?.map((finding) => finding.nodeId) ?? [])],
      findings: [...(riskFindings?.flatMap((finding) => finding.reasons) ?? [])],
    };
  }

  protected mapRiskClassToScore(riskClass: string): number {
    switch (riskClass) {
      case "low":
        return 0.25;
      case "medium":
        return 0.5;
      case "high":
        return 0.85;
      case "critical":
        return 1;
      default:
        return 0.5;
    }
  }

  private estimateUsdFromTokens(tokensUsed: number, modelId?: string): number {
    const normalizedTokens = Number.isFinite(tokensUsed) ? Math.max(0, tokensUsed) : 0;
    const inputPer1kUsd = this.lookupInputPer1kUsd(modelId) ?? 1;
    return Number(((normalizedTokens / 1000) * inputPer1kUsd).toFixed(6));
  }

  private lookupInputPer1kUsd(modelId?: string): number | null {
    if (typeof modelId !== "string" || modelId.trim().length === 0) {
      return null;
    }
    const normalizedModelId = modelId.trim();
    for (const [profileName, profile] of Object.entries(DEFAULT_MODEL_METADATA_REGISTRY.profiles)) {
      if (profileName === normalizedModelId || profile.modelId === normalizedModelId) {
        return profile.pricing.inputPer1kUsd;
      }
    }
    return null;
  }

  /**
   * R5-1: Builds a PlanGraphBundle from a Plan per §13.7 "Plan must be Graph"
   */
  protected buildPlanGraphBundle(plan: Plan, taskId: string, stepCount: number): PlanGraphBundle {
    const nodes = plan.steps.map((step, index) => ({
      nodeId: step.stepId,
      nodeType: "tool" as const,
      inputRefs: step.dependencies.length > 0 ? step.dependencies : [`task:${taskId}`],
      outputSchemaRef: `schema:step.${step.stepId}`,
      riskClass: "medium" as const,
      budgetIntent: {
        amount: 1000,
        currency: "USD",
        resourceKinds: ["compute"] as const,
      },
      sideEffectProfile: {
        mayCommitExternalEffect: false,
        reversible: true,
      },
      retryPolicyRef: `retry:plan.${plan.version}.step.${index}`,
      timeoutMs: step.timeout,
    }));

    const edges: Array<{
      edgeId: string;
      fromNodeId: string;
      toNodeId: string;
      condition: { type: "always" };
      dependencyType: "hard";
    }> = [];

    // Create edges based on dependencies
    for (const step of plan.steps) {
      for (const depId of step.dependencies) {
        edges.push({
          edgeId: newId("graph_edge"),
          fromNodeId: depId,
          toNodeId: step.stepId,
          condition: { type: "always" },
          dependencyType: "hard",
        });
      }
    }

    const entryNodeIds = plan.steps
      .filter((step) => step.dependencies.length === 0)
      .map((step) => step.stepId);

    const terminalNodeIds = plan.steps
      .filter((step) => !plan.steps.some((s) => s.dependencies.includes(step.stepId)))
      .map((step) => step.stepId);

    return createPlanGraphBundle({
      harnessRunId: `harness:${taskId}`,
      graphVersion: plan.version,
      graph: {
        graphId: newId("graph"),
        nodes,
        edges,
        entryNodeIds,
        terminalNodeIds,
        joinStrategy: "all",
        graphHash: `plan:${plan.planId}:v${plan.version}`,
      },
      schedulerPolicy: {
        policyId: "scheduler:oapeflir.default",
        strategy: "deterministic_fifo",
      },
      budgetPlanRef: `budget:plan.${plan.planId}`,
      riskProfile: {
        riskClass: "medium",
        reasons: [`plan:${plan.planId}`],
      },
    });
  }

  protected toLegacyPlan(bundle: PlanGraphBundle, taskId: string): Plan {
    const steps = bundle.graph.nodes.map((node) => ({
      stepId: node.nodeId,
      action: node.outputSchemaRef,
      title: node.nodeId,
      inputs: {},
      outputs: [node.outputSchemaRef],
      dependencies: bundle.graph.edges
        .filter((edge) => edge.toNodeId === node.nodeId)
        .map((edge) => edge.fromNodeId),
      status: "pending" as const,
      timeout: node.timeoutMs,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }));
    return {
      planId: bundle.planGraphBundleId,
      taskId,
      version: bundle.graphVersion,
      assessmentRef: bundle.budgetPlanRef,
      strategy: "linear",
      steps,
      createdAt: Date.parse(bundle.createdAt) || Date.now(),
      ...(bundle.graphVersion > 1 ? { parentVersion: bundle.graphVersion - 1 } : {}),
    };
  }

  /**
   * R5-12: Builds a GraphPatch from a Plan for replanning per §13.13
   */
  protected buildGraphPatch(basePlan: Plan, newVersion: number): GraphPatch {
    const operations = basePlan.steps.map((step) => {
      const payload: Record<string, JsonValue> = {
        planId: basePlan.planId,
        strategy: basePlan.strategy,
        stepId: step.stepId as JsonValue,
        action: step.action as JsonValue,
        inputs: step.inputs as JsonValue,
        dependencies: step.dependencies as JsonValue,
        timeout: step.timeout as JsonValue,
      };
      if (step.title !== undefined) {
        payload.title = step.title as JsonValue;
      }
      if (step.outputs !== undefined) {
        payload.outputs = step.outputs as JsonValue;
      }
      return {
        operationId: newId("graph_op"),
        operationType: "add_node" as const,
        targetRef: step.stepId,
        payload,
      };
    });

    return createGraphPatch({
      harnessRunId: `oapeflir_run:${basePlan.taskId}`,
      baseGraphVersion: basePlan.version,
      newGraphVersion: newVersion,
      operations,
      affectedExecutedNodes: [],
      affectedSideEffects: [],
      compatibilityClass: "safe_append",
      policyProofRef: {
        artifactId: `policy:${basePlan.taskId}`,
        uri: `policy://${basePlan.taskId}`,
      },
      auditRef: {
        artifactId: `audit:${basePlan.taskId}`,
        uri: `audit://${basePlan.taskId}`,
      },
    });
  }

  private buildWorkflowFromGoalDecomposition(
    fallbackWorkflow: PlannedWorkflow,
    goalDecomposition: GoalDecompositionResult,
  ): PlannedWorkflow {
    const workflowStepIds = new Set(fallbackWorkflow.executionSteps.map((step) => step.stepId));
    if (workflowStepIds.size > 0 && goalDecomposition.tasks.some((task) => !workflowStepIds.has(task.taskId))) {
      throw new ValidationError(
        "oapeflir.goal_decomposition_workflow_mismatch",
        "oapeflir.goal_decomposition_workflow_mismatch: goal decomposition task IDs must align with workflow step IDs.",
        {
          details: {
            workflowStepIds: [...workflowStepIds],
            goalTaskIds: goalDecomposition.tasks.map((task) => task.taskId),
          },
        },
      );
    }

    const workflow: MinimalWorkflowDefinition = {
      workflowId: fallbackWorkflow.workflow.workflowId,
      divisionId: fallbackWorkflow.workflow.divisionId,
      steps: goalDecomposition.tasks.map((task, index): MinimalWorkflowStep => ({
        stepId: task.taskId,
        divisionId: task.domainId,
        roleId: task.domainId,
        inputKeys: [],
        outputKey: task.expectedOutputs[0] ?? `${task.taskId}_output`,
        outputSchemaPath: null,
        timeoutMs: parseDurationToMs(task.estimatedDuration),
        maxAttempts: 1,
        dependsOnStepIds: [...(task.dependsOn ?? [])],
        dependencyTypes: Object.fromEntries((task.dependsOn ?? []).map((depId) => [depId, "hard"])),
        compensationModel: task.constraintEnvelope?.requiresApproval === true || index > 0
          ? "manual_reconciliation_required"
          : "idempotent_replay",
      })),
    };

    const executionSteps: PlannedExecutionStep[] = workflow.steps.map((step) => ({
      stepId: step.stepId,
      divisionId: step.divisionId ?? workflow.divisionId,
      roleId: step.roleId,
      inputKeys: step.inputKeys ?? [],
      agentId: `agent_${step.roleId}`,
      outputKey: step.outputKey,
      outputSchemaPath: step.outputSchemaPath ?? null,
      dependsOnStepIds: step.dependsOnStepIds ?? [],
      dependencyTypes: step.dependencyTypes ?? {},
      timeoutMs: step.timeoutMs,
      maxAttempts: step.maxAttempts,
      ...(step.compensationModel == null ? {} : { compensationModel: step.compensationModel }),
    }));

    return {
      workflow,
      executionSteps,
      planReason: `goal_decomposition:${goalDecomposition.goalId}`,
      dependencyEdges: goalDecomposition.dependencyGraph.map((dependency) => ({
        fromStepId: dependency.fromTask,
        toStepId: dependency.toTask,
      })),
    };
  }
}

function parseDurationToMs(duration: string): number {
  const normalized = duration.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(ms|s|m|h)?$/);
  if (match == null) {
    return 60_000;
  }
  const value = Number.parseInt(match[1] ?? "0", 10);
  const unit = match[2] ?? "m";
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      return value * 60 * 1000;
  }
}

function ensureOapeflirBudgetReservationAnchors(
  connection: EnsureBudgetLedgerInput["connection"],
  input: { budgetLedgerId: string; taskId: string },
): void {
  const confirmedTaskSpecId = `ctspec:oapeflir:${input.budgetLedgerId}`;
  const requestEnvelopeId = `req:oapeflir:${input.budgetLedgerId}`;
  const harnessRunId = `hrun:oapeflir:${input.budgetLedgerId}`;
  const now = nowIso();

  connection.prepare(
    `INSERT OR IGNORE INTO confirmed_task_specs (
      confirmed_task_spec_id, task_draft_id, tenant_id, goal, inputs_json,
      constraint_pack_ref, risk_class, idempotency_key, trace_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    confirmedTaskSpecId,
    `draft:oapeflir:${input.budgetLedgerId}`,
    "tenant:oapeflir",
    `OAPEFLIR execution for ${input.taskId}`,
    "{}",
    "policy://oapeflir/default",
    "low",
    `idempotency:oapeflir:${input.budgetLedgerId}`,
    input.taskId,
    now,
  );

  connection.prepare(
    `INSERT OR IGNORE INTO request_envelopes (
      request_id, confirmed_task_spec_id, tenant_id, trace_id, idempotency_key,
      request_hash, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    requestEnvelopeId,
    confirmedTaskSpecId,
    "tenant:oapeflir",
    input.taskId,
    `idempotency:oapeflir:${input.budgetLedgerId}`,
    `request:oapeflir:${input.budgetLedgerId}`,
    now,
  );

  connection.prepare(
    `INSERT OR IGNORE INTO harness_runs (
      harness_run_id, tenant_id, org_id, trace_id, goal, risk_level, domain_id,
      confirmed_task_spec_id, request_envelope_id, request_hash, status,
      constraint_pack_ref, version_lock_id, budget_ledger_id, current_seq,
      created_at, fencing_token, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    harnessRunId,
    "tenant:oapeflir",
    "",
    input.taskId,
    `OAPEFLIR execution for ${input.taskId}`,
    "low",
    "oapeflir",
    confirmedTaskSpecId,
    requestEnvelopeId,
    `request:oapeflir:${input.budgetLedgerId}`,
    "admitted",
    "policy://oapeflir/default",
    `version-lock:oapeflir:${input.budgetLedgerId}`,
    input.budgetLedgerId,
    0,
    now,
    `fencing:oapeflir:${input.budgetLedgerId}:0`,
    now,
  );
}
