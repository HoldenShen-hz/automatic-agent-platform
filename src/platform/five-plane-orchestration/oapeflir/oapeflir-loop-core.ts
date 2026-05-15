import type { PlannedWorkflow } from "../routing/workflow-planner.js";
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
import { ObservationAggregator, type UnifiedObservation } from "../../shared/observability/observation-aggregator.js";
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
import { BudgetAllocator, type BudgetAllocatorContext } from "../../five-plane-execution/budget-allocator.js";
import { ValidationError } from "../../contracts/errors.js";
import type { ControlPlaneDirectiveSink } from "../../five-plane-control-plane/control-plane-directive-sink.js";
import { OapeflirLoopSupport } from "./oapeflir-loop-support.js";

export interface OapeflirLoopInput {
  taskId: string;
  objective: string;
  workflow: PlannedWorkflow;
  feedbackSignals?: FeedbackSignal[];
  blockerSummaries?: string[];
  fileRefs?: string[];
  stepOutputs?: DualChannelStepOutput[];
  // R5-6: ConstraintPack consumed by the Assess stage for policy-aware risk evaluation
  constraintPack?: ConstraintPack;
  // R5-6: EffectivePolicySnapshot consumed by the Assess stage for policy-informed routing
  effectivePolicy?: EffectivePolicySnapshot;
}

export interface OapeflirLoopResult {
  observation: UnifiedObservation;
  assessment: UnifiedAssessment;
  plan: Plan;
  planGraphBundle: PlanGraphBundle;
  stepOutputs: DualChannelStepOutput[];
  feedback: FeedbackBatch;
  learningSignals: LearningSignal[];
  learningObjects: LearningObject[];
  rolloutRecord: RolloutRecord | null;
  timeline: OapeflirStageRecord[];
  outcome: {
    score: number;
    issues: readonly string[];
    confidence: number;
  };
  evaluationReport: EvaluationReport;
  qualityGate: PostExecutionQualityGateDecision;
  replanDecision: ReplanningDecision;
  graphPatch: GraphPatch | null;
  harnessDecision: HarnessDecision | null;
}

type OapeflirPlanBuilder = Pick<PlanBuilder, "build"> & Partial<{
  buildGraphBundle: (input: PlanBuilderInput, options?: BuildPlanOptions) => PlanGraphBundle;
}>;

export interface OapeflirLoopServiceOptions {
  /** Execute bridge for the OAPEFLIR execute phase. */
  executeBridge?: ExecuteBridge;
  /** Optional task situation builder for observation stage injection. */
  situationBuilder?: TaskSituationBuilder;
  /** Optional observation aggregator for deterministic tests and DI. */
  observationAggregator?: ObservationAggregator;
  /** Optional assessment service for policy/risk overrides in tests. */
  assessmentService?: AssessmentService;
  /** Optional plan builder for deterministic graph bundle generation. */
  planBuilder?: OapeflirPlanBuilder;
  /** Optional feedback collector for feedback-stage overrides in tests. */
  feedbackCollector?: FeedbackCollector;
  /** Optional strategy learning service override for tests. */
  learningService?: StrategyLearningService;
  /** Optional knowledge promotion service override for tests. */
  knowledgePromotionService?: KnowledgePromotionService;
  /** Optional autonomy boundary override for tests. */
  autonomyBoundary?: AutonomyBoundaryPolicy;
  /** Optional directive sink for downstream control-plane integration. */
  directiveSink?: ControlPlaneDirectiveSink | null;
  /** Path to the SQLite database (required for RuntimeExecuteBridge). */
  dbPath?: string;
  /** Event publisher for emitting OAPEFLIR lifecycle events. */
  eventPublisher?: import("../../five-plane-state-evidence/events/typed-event-publisher.js").TypedEventPublisher | null;
}

export class OapeflirLoopService extends OapeflirLoopSupport {
  private readonly situationBuilder: TaskSituationBuilder;
  private readonly systemSituationBuilder = new SystemSituationBuilder();
  protected readonly observationAggregator: ObservationAggregator;
  private readonly assessment: AssessmentService;
  protected readonly planBuilder: OapeflirPlanBuilder;
  private readonly feedbackCollector: FeedbackCollector;
  private readonly outcomeEvaluator = new ExecutionOutcomeEvaluator();
  private readonly qualityGate = new PostExecutionQualityGate();
  private readonly replanning = new ReplanningService();
  private readonly learning: StrategyLearningService;
  private readonly knowledgePromotion: KnowledgePromotionService;
  private readonly autonomyBoundary: AutonomyBoundaryPolicy;
  private readonly candidateRegistry = new ImprovementCandidateRegistry();
  private readonly rollout = new PolicyRolloutService();
  protected readonly executeBridge: ExecuteBridge;
  protected readonly boundaryLogger = new StructuredLogger({ retentionLimit: 500 });
  // R19-06 fix: Store eventPublisher for emitting state change events per §14.3
  protected readonly eventPublisher: import("../../five-plane-state-evidence/events/typed-event-publisher.js").TypedEventPublisher | undefined;
  public loopController: HarnessLoopController | null = null;
  /** Optional control-plane sink reserved for directive emission integrations. */
  private readonly directiveSink: ControlPlaneDirectiveSink | null;
  // R4-25 (INV-BUDGET-001) fix: Store dbPath for budget reservation before bridge execution
  protected readonly dbPath: string | undefined;

  constructor(options: OapeflirLoopServiceOptions = {}) {
    super();
    this.situationBuilder = options.situationBuilder ?? new TaskSituationBuilder();
    this.observationAggregator = options.observationAggregator ?? new ObservationAggregator();
    this.assessment = options.assessmentService ?? new AssessmentService();
    this.planBuilder = options.planBuilder ?? new PlanBuilder();
    this.feedbackCollector = options.feedbackCollector ?? new FeedbackCollector();
    this.learning = options.learningService ?? new StrategyLearningService();
    this.autonomyBoundary = options.autonomyBoundary ?? new AutonomyBoundaryPolicy();
    this.directiveSink = options.directiveSink ?? null;
    if (options.executeBridge) {
      this.executeBridge = options.executeBridge;
    } else if (options.dbPath) {
      this.executeBridge = new RuntimeExecuteBridge(options.dbPath);
    } else {
      this.executeBridge = new MockExecuteBridge();
    }
    // G7: Wire eventPublisher to KnowledgePromotionService for learning:knowledge_promoted events
    this.knowledgePromotion = options.knowledgePromotionService ?? new KnowledgePromotionService({
      eventPublisher: options.eventPublisher ?? null,
    });
    // R19-06 fix: Store eventPublisher for stage event emission
    this.eventPublisher = options.eventPublisher ?? undefined;
    // R4-25 (INV-BUDGET-001) fix: Store dbPath for budget reservation before bridge execution
    this.dbPath = options.dbPath;
  }

  public async run(input: OapeflirLoopInput): Promise<OapeflirLoopResult> {
    if ((input as Partial<OapeflirLoopInput>).workflow == null) {
      return await this.produceStageRationale(input);
    }
    return await startActiveSpan("oapeflir.loop", {
      tracerName: "automatic-agent-platform.oapeflir",
      attributes: {
        "aa.task.id": input.taskId,
        "aa.workflow.step_count": input.workflow.executionSteps.length,
      },
    }, async () => {
      const timeline = new OapeflirStageTimelineBuilder();

      // R5-3: Create FSM instance to track stage transitions
      const fsm = createStageTransitionFSM();

      // R5-3: Observe stage
      const observeTransition = fsm.canTransitionTo("observe");
      if (!observeTransition.allowed) {
        this.boundaryLogger.error("[fsm:observe] Stage transition not allowed", {
          data: { taskId: input.taskId, reasonCode: observeTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
        });
        throw new Error(`FSM transition denied: observe - ${observeTransition.reasonCode}`);
      }
      fsm.recordStageEntry("observe");

      const taskObservation = await this.runStage<UnifiedObservation>("observe", async () => {
        const taskSituation: TaskSituation = this.situationBuilder.build({
          taskId: input.taskId,
          objective: input.objective,
          currentPhase: "planning",
          blockers: input.blockerSummaries ?? [],
          fileRefs: input.fileRefs ?? [],
          metrics: { workflowSteps: input.workflow.executionSteps.length },
        });
        const systemObservation = this.systemSituationBuilder.build();
        return this.observationAggregator.aggregate(
          taskSituation,
          systemObservation,
          this.createEmptyEventFlowSituation(),
          this.createEmptyGoalDecompositionSituation(),
          this.createEmptyMemorySituation(),
        );
      }, {
        taskId: input.taskId,
        workflowStepCount: input.workflow.executionSteps.length,
      });
      timeline.record("observe", "completed", taskObservation.task.taskId, null, "Aggregated task and system observations for downstream assessment.");
      fsm.recordStageCompletion("observe");
      this.emitStageEvent("observe", input.taskId, { status: "completed" });

      // R5-3: Assess stage transition check
      const assessTransition = fsm.canTransitionTo("assess");
      if (!assessTransition.allowed) {
        this.boundaryLogger.error("[fsm:assess] Stage transition not allowed", {
          data: { taskId: input.taskId, reasonCode: assessTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
        });
        throw new Error(`FSM transition denied: assess - ${assessTransition.reasonCode}`);
      }
      fsm.recordStageEntry("assess");

      // O→A boundary: validate TaskSituation — degrade to default on failure (per §L.14)
      const observedTask: TaskSituation = (() => {
        const result = validateTaskSituation(taskObservation.task);
        if (result.ok) return result.value;
        this.boundaryLogger.warn("[boundary:O→A] TaskSituation validation failed — degrading to default", {
          data: { taskId: input.taskId, boundary: "O→A" },
        });
        return {
          taskId: input.taskId,
          timestamp: Date.now(),
          objective: input.objective,
          currentPhase: "planning",
          userIntent: {
            raw: input.objective,
            normalized: input.objective,
            confidence: this.deriveFallbackIntentConfidence(input),
          },
          blockers: [],
          codebaseSnapshot: { rootPath: ".", fileCount: 0, relevantFiles: [] },
          environmentContext: { nodeVersion: process.version, platform: process.platform, workingDirectory: process.cwd(), availableTools: [] },
          historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
          relevantMemory: [],
          fileRefs: input.fileRefs ?? [],
          metrics: {},
        };
      })();

      const assessResult = await this.runStage<{ assessment: UnifiedAssessment; riskAssessment: RiskAssessment }>("assess", () => this.assessment.assess(observedTask, input.constraintPack, input.effectivePolicy), {
        taskId: input.taskId,
      });
      const assessment = assessResult.assessment;
      timeline.record("assess", "completed", assessment.situationRef, null, assessment.routingDecision.rationale);
      fsm.recordStageCompletion("assess");
      this.emitStageEvent("assess", input.taskId, { status: "completed", routingDivision: assessment.routingDecision.division });

      // R5-3: Plan stage transition check
      const planTransition = fsm.canTransitionTo("plan");
      if (!planTransition.allowed) {
        this.boundaryLogger.error("[fsm:plan] Stage transition not allowed", {
          data: { taskId: input.taskId, reasonCode: planTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
        });
        throw new Error(`FSM transition denied: plan - ${planTransition.reasonCode}`);
      }
      fsm.recordStageEntry("plan");

      // A→P boundary: validate UnifiedAssessment — default to fallback on failure (per §L.14)
      const validatedAssessment: UnifiedAssessment = (() => {
        const result = validateUnifiedAssessment(assessment);
        if (result.ok) return result.value;
        this.boundaryLogger.warn("[boundary:A→P] UnifiedAssessment validation failed — using default", {
          data: { taskId: input.taskId, boundary: "A→P" },
        });
        return {
          taskId: input.taskId,
          timestamp: Date.now(),
          situationRef: `assessment:${input.taskId}:fallback`,
          phase: "pre-execution",
          complexity: "moderate",
          risk: "medium",
          riskAssessment: { level: "medium", factors: ["assessment_validation_failed"] },
          routingDecision: { division: "coding", workflow: "multi-step", rationale: "fallback_due_to_validation_error" },
          resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
          approvalPolicy: { required: false, level: "none" },
          executionMode: "auto",
          suggestedActions: [],
        };
      })();

      // R5-2: Loop variables for replanning support
      let loopPlan: Plan;
      let loopPlanGraphBundle: PlanGraphBundle;
      let loopStepOutputs: DualChannelStepOutput[];
      let loopFeedback: FeedbackBatch;
      let loopOutcome: ExecutionOutcomeEvaluation;
      let loopQualityGate: PostExecutionQualityGateDecision;
      let loopReplanTrigger: ReturnType<ReplanningService["createTrigger"]>;
      let loopReplanDecision: ReplanningDecision;
      let loopGraphPatch: GraphPatch | null = null;
      let loopEvaluationReport: EvaluationReport;
      const constraintPack = input.constraintPack ?? {
        policyIds: [],
        approvalMode: "none" as const,
        autonomyMode: "full_auto" as const,
        tool_policy: { allowedTools: [] as const },
        sandboxRequirement: { sandboxMode: "none" as const, timeoutMs: 300000 },
        approvalRequirement: { requiredForRiskClass: [] as const, approverRoles: [] as const, escalationTimeoutMs: 60000 },
      };
      const loopController = new HarnessLoopController(constraintPack, {}, { startedAt: Date.now() });

      // R5-1: Build PlanGraphBundle directly from PlanBuilder (canonical output per §13.7)
      // R5-9: Enable graph normalization and risk propagation per §13.9
      loopPlanGraphBundle = await this.runStage<PlanGraphBundle>("plan", () => this.buildPlanGraphBundleForInput({
        observation: observedTask,
        assessment: validatedAssessment,
        workflow: input.workflow,
      }, { normalizeGraph: true, propagateRisk: true }), {
        taskId: input.taskId,
      });
      // R5-1: Keep legacy Plan for backward-compatible interfaces only
      loopPlan = this.toLegacyPlan(loopPlanGraphBundle, input.taskId);
      timeline.record("plan", "completed", loopPlan.planId, null, "Built a PlanGraphBundle from validated observation, assessment, and workflow inputs.");
      fsm.recordStageCompletion("plan");
      this.emitStageEvent("plan", input.taskId, { status: "completed", planGraphBundleId: loopPlanGraphBundle.planGraphBundleId });

      // P→E boundary: validate Plan DTO — abort on failure (per §L.14)
      const planValidation = validatePlan(loopPlan);
      if (!planValidation.ok) {
        throw planValidation.error;
      }

      // R5-2: Main loop — execute until no replan needed and quality gate passes
      while (true) {
        // R5-1: loopPlanGraphBundle is now the authoritative plan representation.
        // Initial build captures it directly from PlanBuilder (above).
        // Replan steps (below) refresh it directly — no buildPlanGraphBundle() round-trip needed.

        // R5-3: Execute stage transition check
        const executeTransition = fsm.canTransitionTo("execute");
        if (!executeTransition.allowed) {
          this.boundaryLogger.error("[fsm:execute] Stage transition not allowed", {
            data: { taskId: input.taskId, reasonCode: executeTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
          });
          throw new Error(`FSM transition denied: execute - ${executeTransition.reasonCode}`);
        }
        fsm.recordStageEntry("execute");

        loopStepOutputs = await this.runStage<DualChannelStepOutput[]>("execute", async () => {
          const executionContext = this.buildExecutionContext(input, loopPlanGraphBundle, loopPlan, validatedAssessment);
          // R31-16 FIX: Validate stepOutputs before using them directly
          if (input.stepOutputs != null) {
            const validation = validateStepOutputs(input.stepOutputs);
            if (!validation.ok) {
              this.boundaryLogger.warn("[boundary:E] input.stepOutputs validation failed — executing via bridge instead", {
                data: { taskId: input.taskId, boundary: "E" },
              });
              return this.executeViaBridge(loopPlan, executionContext);
            }
            return input.stepOutputs;
          }
          // R4-25 (INV-BUDGET-001) fix: Reserve budget BEFORE execution via bridge
          // BudgetAllocator.reserve() must be called before any cost-bearing execution
          await this.reserveBudgetForExecution(executionContext, input.taskId);
          return this.executeViaBridge(loopPlan, executionContext);
        }, {
          taskId: input.taskId,
          planId: loopPlan.planId,
        });
        timeline.record("execute", "completed", loopStepOutputs[loopStepOutputs.length - 1]?.stepId ?? loopPlan.planId, null, "Executed the plan or consumed supplied step outputs for the task.");
        fsm.recordStageCompletion("execute");
        this.emitStageEvent("execute", input.taskId, { status: "completed", stepCount: loopStepOutputs.length });

        // E→F boundary: validate step outputs and feedback signals — skip feedback on failure (per §L.14)
        const validatedStepOutputs: DualChannelStepOutput[] = (() => {
          const result = validateStepOutputs(loopStepOutputs);
          if (result.ok) return result.value;
          this.boundaryLogger.warn("[boundary:E→F] stepOutputs validation failed — skipping feedback stage", {
            data: { taskId: input.taskId, boundary: "E→F" },
          });
          return [];
        })();

        const feedbackSignals: FeedbackSignal[] = (() => {
          const result = validateFeedbackSignals(input.feedbackSignals ?? this.buildFeedbackSignals(input.taskId, validatedStepOutputs));
          if (result.ok) return result.value;
          this.boundaryLogger.warn("[boundary:E→F] feedbackSignals validation failed — skipping feedback stage", {
            data: { taskId: input.taskId, boundary: "E→F" },
          });
          return [];
        })();

        // R5-3: Feedback stage transition check
        const feedbackTransition = fsm.canTransitionTo("feedback");
        if (!feedbackTransition.allowed) {
          this.boundaryLogger.error("[fsm:feedback] Stage transition not allowed", {
            data: { taskId: input.taskId, reasonCode: feedbackTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
          });
          throw new Error(`FSM transition denied: feedback - ${feedbackTransition.reasonCode}`);
        }
        fsm.recordStageEntry("feedback");

        loopFeedback = await this.runStage<FeedbackBatch>("feedback", () => this.feedbackCollector.collect({
          taskId: input.taskId,
          planId: loopPlan.planId,
          signals: feedbackSignals,
        }), {
          taskId: input.taskId,
          signalCount: feedbackSignals.length,
        });
        timeline.record("feedback", "completed", loopFeedback.feedbackId, null, "Collected execution feedback signals and normalized them for learning.");
        fsm.recordStageCompletion("feedback");
        this.emitStageEvent("feedback", input.taskId, { status: "completed", signalCount: feedbackSignals.length });

        // R5-2: Compute quality gate and replan decision after each feedback collection
        // R5-7: Use EvaluationReport as the canonical input to quality gate
        loopOutcome = this.outcomeEvaluator.evaluateWithBreakdown(loopPlanGraphBundle, loopFeedback) as ExecutionOutcomeEvaluation;
        loopEvaluationReport = this.outcomeEvaluator.evaluate(
          loopPlanGraphBundle,
          loopFeedback,
        );
        // R5-7: Pass EvaluationReport to quality gate (canonical format)
        loopQualityGate = this.qualityGate.decide(loopEvaluationReport);
        loopReplanTrigger = this.replanning.createTrigger(
          input.taskId,
          loopQualityGate.accepted ? "planning.no_replan_required" : "planning.quality_gate_replan",
          "feedback",
          loopQualityGate.reasonCodes.join(","),
        );
        loopReplanDecision = this.replanning.decide(loopPlan, loopFeedback, loopReplanTrigger);
        const iterationCost = loopStepOutputs.reduce((sum, output) => sum + output.systemTelemetry.tokensUsed, 0);
        loopController.recordIteration(iterationCost);

        // R5-12: Build GraphPatch if replan is needed
        loopGraphPatch = loopReplanDecision.shouldReplan ? this.buildGraphPatch(loopPlan, loopPlan.version + 1) : null;

        // Exit whenever replanning is not warranted. Non-accepted terminal outcomes
        // such as approval/block must return to the caller instead of spinning back
        // into a fresh plan cycle with the same feedback.
        if (!loopReplanDecision.shouldReplan) {
          break;
        }
        loopController.recordReplan();
        if (loopController.getGuardViolation() !== null) {
          break;
        }

        // R5-2: Re-enter at Plan stage — record replan and rebuild plan
        // R19-33 fix: check transition BEFORE reset to match guard pattern used elsewhere
        const replanTransition = fsm.canTransitionTo("plan");
        if (!replanTransition.allowed) {
          this.boundaryLogger.error("[fsm:replan] Stage transition not allowed", {
            data: { taskId: input.taskId, reasonCode: replanTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
          });
          throw new Error(`FSM transition denied: replan - ${replanTransition.reasonCode}`);
        }
        fsm.resetToStage("plan");
        fsm.recordStageEntry("plan");

        // R5-1: Build fresh PlanGraphBundle directly (no toLegacyPlan round-trip)
        // R5-9: Enable graph normalization and risk propagation per §13.9
        // R5-12: Apply graph patch from prior replan decision if available
        const planBuildOptions: BuildPlanOptions = { normalizeGraph: true, propagateRisk: true };
        if (loopGraphPatch) {
          planBuildOptions.graphPatch = loopGraphPatch;
        }
        loopPlanGraphBundle = await this.runStage<PlanGraphBundle>("plan", () => this.buildPlanGraphBundleForInput({
          observation: observedTask,
          assessment: validatedAssessment,
          workflow: input.workflow,
        }, planBuildOptions), {
          taskId: input.taskId,
          hasGraphPatch: loopGraphPatch != null,
        });
        // R5-1: Refresh legacy Plan from the authoritative PlanGraphBundle
        loopPlan = this.toLegacyPlan(loopPlanGraphBundle, input.taskId);
        timeline.record("plan", "completed", loopPlan.planId, null, "Re-built PlanGraphBundle from validated observation, assessment, and workflow inputs.");
        fsm.recordStageCompletion("plan");
        this.emitStageEvent("plan", input.taskId, { status: "completed", isReplan: true });

        // Validate the new plan
        const loopPlanValidation = validatePlan(loopPlan);
        if (!loopPlanValidation.ok) {
          throw loopPlanValidation.error;
        }
      }

      const learningSignals: LearningSignal[] = this.feedbackCollector.toLearningSignals(loopFeedback);
      // F→L boundary: validate learning signals — skip learn on failure (per §L.14)
      const validatedLearningSignals: LearningSignal[] = ((): LearningSignal[] => {
        const result = validateLearningSignalsArray(learningSignals);
        if (result.ok) return result.value as LearningSignal[];
        this.boundaryLogger.warn("[boundary:F→L] learningSignals validation failed — skipping learn stage", {
          data: { taskId: input.taskId, boundary: "F→L" },
        });
        return [] as LearningSignal[];
      })();

      // R5-3: Learn stage transition check
      const learnTransition = fsm.canTransitionTo("learn");
      if (!learnTransition.allowed) {
        this.boundaryLogger.error("[fsm:learn] Stage transition not allowed", {
          data: { taskId: input.taskId, reasonCode: learnTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
        });
        throw new Error(`FSM transition denied: learn - ${learnTransition.reasonCode}`);
      }
      fsm.recordStageEntry("learn");

      const learningObjects = await this.runStage<LearningObject[]>("learn", () => this.learning.learn(validatedLearningSignals), {
        taskId: input.taskId,
        signalCount: validatedLearningSignals.length,
      });
      timeline.record(
        "learn",
        learningObjects.length > 0 ? "completed" : "skipped",
        learningObjects[0]?.learningObjectId ?? null,
        learningObjects.length > 0 ? null : "learning.no_objects",
        learningObjects.length > 0
          ? "Converted validated feedback into reusable learning objects."
          : "No qualifying feedback patterns were strong enough to produce learning objects.",
      );

      // R5-3: Record learn stage completion or skip
      if (learningObjects.length > 0) {
        fsm.recordStageCompletion("learn");
        this.emitStageEvent("learn", input.taskId, { status: "completed", learningObjectCount: learningObjects.length });
      } else {
        fsm.recordStageSkipped("learn", "learning.no_objects");
        this.emitStageEvent("learn", input.taskId, { status: "skipped", reason: "learning.no_objects" });
      }

      // G7: Promote validated learning objects into the knowledge plane
      if (learningObjects.length > 0) {
        await this.knowledgePromotion.promote(learningObjects, input.taskId);
      }

      let rolloutRecord: RolloutRecord | null = null;

      if (learningObjects.length > 0) {
        // L→I boundary: validate LearningObject[] — skip improve on failure (per §L.14)
        const validatedLearningObjects: LearningObject[] = ((): LearningObject[] => {
          const result = validateLearningObjects(learningObjects);
          if (result.ok) return result.value as LearningObject[];
          this.boundaryLogger.warn("[boundary:L→I] learningObjects validation failed — skipping improve stage", {
            data: { taskId: input.taskId, boundary: "L→I" },
          });
          return [] as LearningObject[];
        })();

        if (validatedLearningObjects.length === 0) {
          runtimeMetricsRegistry.recordOapeflirStageEntry("improve");
          runtimeMetricsRegistry.recordOapeflirStageEntry("release");
          runtimeMetricsRegistry.recordOapeflirStageExit("improve", "skipped", 0);
          runtimeMetricsRegistry.recordOapeflirStageExit("release", "skipped", 0);
          timeline.record("improve", "skipped", null, "improvement.validation_failed", "Skipped improvement because no validated learning objects remained after boundary checks.");
          timeline.record("release", "skipped", null, "release.improve_skipped", "Release was skipped because no improvement candidate was produced.");
          // R5-3: Record improve and release as skipped in FSM
          fsm.recordStageEntry("improve");
          fsm.recordStageSkipped("improve", "improvement.validation_failed");
          this.emitStageEvent("improve", input.taskId, { status: "skipped", reason: "improvement.validation_failed" });
          fsm.recordStageEntry("release");
          fsm.recordStageSkipped("release", "release.improve_skipped");
          this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.improve_skipped" });
        } else {
          // R5-3: Improve stage transition check
          const improveTransition = fsm.canTransitionTo("improve");
          if (!improveTransition.allowed) {
            this.boundaryLogger.error("[fsm:improve] Stage transition not allowed", {
              data: { taskId: input.taskId, reasonCode: improveTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
            });
            throw new Error(`FSM transition denied: improve - ${improveTransition.reasonCode}`);
          }
          fsm.recordStageEntry("improve");

          const boundary = await this.runStage("improve", () => this.autonomyBoundary.decide("planning_policy", validatedLearningObjects), {
          taskId: input.taskId,
          learningObjectCount: validatedLearningObjects.length,
        });
        if (boundary.allowed) {
          const candidate = this.candidateRegistry.register({
            taskId: input.taskId,
            target: "planning_policy",
            learningObjects: validatedLearningObjects,
            description: "Promote feedback-derived planning guidance into the shadow rollout lane.",
            expectedBenefit: "Reduce repeat repair loops without changing live execution.",
          });

          // R13-03: Add gates before approval - no immediate approval
          // EvaluationGate: only approve if evaluation verdict is "accept"
          let approved = candidate;
          if (loopEvaluationReport.verdict === "accept") {
            // Offline eval gate: check that quality score meets threshold
            const qualityScore = loopEvaluationReport.score ?? 0;
            if (qualityScore >= 0.95) {
              // Risk scan gate: security-related proposals need higher scrutiny
              const hasSecurityContent = validatedLearningObjects.some(
                (obj) =>
                  obj.learningType === "failure_pattern" &&
                  (obj.title.toLowerCase().includes("security") ||
                    obj.summary.toLowerCase().includes("security") ||
                    obj.recommendation.toLowerCase().includes("security"))
              );
              if (!hasSecurityContent || candidate.changeScope !== "policy") {
                approved = this.candidateRegistry.updateStatus(candidate.candidateId, "approved") ?? candidate;
                this.boundaryLogger.info("[gate:improve] Candidate passed all gates, approved for shadow rollout", {
                  data: { candidateId: candidate.candidateId, taskId: input.taskId },
                });
              } else {
                this.boundaryLogger.warn("[gate:improve] Security-related proposal requires manual review", {
                  data: { candidateId: candidate.candidateId, taskId: input.taskId },
                });
              }
            } else {
              this.boundaryLogger.warn("[gate:improve] Quality score too low for auto-approval", {
                data: { candidateId: candidate.candidateId, qualityScore, taskId: input.taskId },
              });
            }
          } else {
            this.boundaryLogger.warn("[gate:improve] EvaluationGate blocked approval", {
              data: { candidateId: candidate.candidateId, verdict: loopEvaluationReport.verdict, taskId: input.taskId },
            });
          }
          timeline.record("improve", "completed", approved.candidateId, null, "Registered and approved an improvement candidate for shadow rollout.");
          fsm.recordStageCompletion("improve");

          // R19-06 fix: Emit stage completion event
          this.emitStageEvent("improve", input.taskId, { status: "completed", candidateId: approved.candidateId });

          // R5-3: Release stage transition check
          const releaseTransition = fsm.canTransitionTo("release");
          if (!releaseTransition.allowed) {
            this.boundaryLogger.error("[fsm:release] Stage transition not allowed", {
              data: { taskId: input.taskId, reasonCode: releaseTransition.reasonCode, fsmState: fsm.getExecutionSummary() },
            });
            throw new Error(`FSM transition denied: release - ${releaseTransition.reasonCode}`);
          }
          fsm.recordStageEntry("release");

          // R5-8: Add gates before calling PolicyRolloutService.start()
          // EvaluationGate: only proceed if evaluation verdict is "accept"
          if (loopEvaluationReport.verdict !== "accept") {
            this.boundaryLogger.warn("[gate:release] EvaluationGate blocked release", {
              data: { taskId: input.taskId, verdict: loopEvaluationReport.verdict },
            });
            timeline.record("release", "skipped", null, "release.evaluation_gate_blocked", `Release blocked by EvaluationGate with verdict: ${loopEvaluationReport.verdict}`);
            fsm.recordStageSkipped("release", "release.evaluation_gate_blocked");
            this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.evaluation_gate_blocked" });
            rolloutRecord = null;
          } else {
            // Approval check: if assessment requires approval, block release
            const approvalRequired = validatedAssessment.approvalPolicy.required;
            if (approvalRequired) {
              this.boundaryLogger.warn("[gate:release] Approval required - blocking release", {
                data: { taskId: input.taskId, approvalLevel: validatedAssessment.approvalPolicy.level },
              });
              timeline.record("release", "skipped", null, "release.approval_required", `Release blocked by approval requirement: ${validatedAssessment.approvalPolicy.level}`);
              fsm.recordStageSkipped("release", "release.approval_required");
              this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.approval_required" });
              rolloutRecord = null;
            } else {
              // Canary check: only proceed if not in blocked canary state
              const canaryBlocked = loopEvaluationReport.notes?.includes("canary_blocked") ?? false;
              if (canaryBlocked) {
                this.boundaryLogger.warn("[gate:release] Canary blocked - rolling back", {
                  data: { taskId: input.taskId },
                });
                timeline.record("release", "skipped", null, "release.canary_blocked", "Release blocked due to canary routing failure");
                fsm.recordStageSkipped("release", "release.canary_blocked");
                this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.canary_blocked" });
                rolloutRecord = null;
              } else {
                const strategyVersion = createStrategyVersion("Evaluation planning guidance", validatedLearningObjects, "L1_evaluate");
                // R5-8: All gates passed - call PolicyRolloutService.start() with gates
                let rawRolloutRecord = await this.runStage("release", () => this.rollout.start(approved, strategyVersion, "system"), {
                  taskId: input.taskId,
                  candidateId: approved.candidateId,
                });
                // I→R boundary: validate rollout record — skip release on failure (per §L.14)
                const rolloutValidation = validateRolloutRecord(rawRolloutRecord);
                rolloutRecord = rolloutValidation.ok ? rolloutValidation.value : null;
                if (!rolloutValidation.ok) {
                  this.boundaryLogger.warn("[boundary:I→R] rolloutRecord validation failed — nulling rollout record", {
                    data: { taskId: input.taskId, boundary: "I→R" },
                  });
                }
                timeline.record(
                  "release",
                  rolloutRecord ? "completed" : "skipped",
                  rolloutRecord?.recordId ?? null,
                  rolloutRecord ? null : "release.validation_failed",
                  rolloutRecord
                    ? "Started rollout for the approved strategy version."
                    : "Rollout output failed validation and was nulled before release completion.",
                );
                // R5-3: Record release completion or skip
                if (rolloutRecord) {
                  fsm.recordStageCompletion("release");
                  this.emitStageEvent("release", input.taskId, { status: "completed", recordId: rolloutRecord.recordId });
                } else {
                  fsm.recordStageSkipped("release", "release.validation_failed");
                  this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.validation_failed" });
                }
              }
            }
          }
        } else {
          runtimeMetricsRegistry.recordOapeflirStageEntry("improve");
          runtimeMetricsRegistry.recordOapeflirStageEntry("release");
          runtimeMetricsRegistry.recordOapeflirStageExit("improve", "skipped", 0);
          runtimeMetricsRegistry.recordOapeflirStageExit("release", "skipped", 0);
          timeline.record("improve", "skipped", null, boundary.reasonCode, "Autonomy boundary blocked promotion of the candidate into improve.");
          timeline.record("release", "skipped", null, "release.improve_blocked", "Release was blocked because the improvement candidate did not clear the autonomy boundary.");
          // R5-3: Record improve and release as skipped in FSM
          fsm.recordStageSkipped("improve", boundary.reasonCode);
          this.emitStageEvent("improve", input.taskId, { status: "skipped", reason: boundary.reasonCode });
          fsm.recordStageSkipped("release", "release.improve_blocked");
          this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.improve_blocked" });
        }
        }
      } else {
        runtimeMetricsRegistry.recordOapeflirStage("improve", "skipped", 0);
        runtimeMetricsRegistry.recordOapeflirStage("release", "skipped", 0);
        timeline.record("improve", "skipped", null, "improvement.no_learning_objects");
        timeline.record("release", "skipped", null, "release.no_candidate");
        // R5-3: Record improve and release as skipped in FSM
        fsm.recordStageEntry("improve");
        fsm.recordStageSkipped("improve", "improvement.no_learning_objects");
        this.emitStageEvent("improve", input.taskId, { status: "skipped", reason: "improvement.no_learning_objects" });
        fsm.recordStageEntry("release");
        fsm.recordStageSkipped("release", "release.no_candidate");
        this.emitStageEvent("release", input.taskId, { status: "skipped", reason: "release.no_candidate" });
      }

      // R5-4: Integrate HarnessLoopController for loop control decisions
      const harnessDecision = await this.runStage<HarnessDecision | null>("harness_decide", async () => {
        // R5-4: Evaluate loop progress using controller with accurate remaining iterations
        const loopProgress = loopController.evaluateProgress(
          loopReplanDecision.shouldReplan ? "replan" : "accept",
          constraintPack.budgetEnvelope ? constraintPack.budgetEnvelope.maxSteps > 0 : true,
        );

        // R5-4: Check all loop guards and abort if any limit is breached
        const guardViolation = loopController.getGuardViolation();

        if (guardViolation !== null) {
          return {
            decisionId: newId("harness_decision"),
            harnessDecisionId: newId("harness_decision"),
            decisionKind: "abort" as const,
            reasonCode: guardViolation,
            action: "abort" as const,
            reasonCodes: [guardViolation],
            confidence: 0,
            createdAt: nowIso(),
          };
        }

        const reasonCodes = loopReplanDecision.shouldReplan
          ? ["oapeflir.replan_decision", "harness.loop_continue"]
          : ["oapeflir.accept_decision", "harness.loop_continue"];
        const reasonCode = reasonCodes[0] ?? "harness.accepted";
        return {
          decisionId: newId("harness_decision"),
          harnessDecisionId: newId("harness_decision"),
          decisionKind: loopReplanDecision.shouldReplan ? "replan" as const : "approve" as const,
          reasonCode,
          action: loopReplanDecision.shouldReplan ? "replan" : "accept",
          reasonCodes,
          confidence: 0.95,
          createdAt: nowIso(),
        };
      }, {
        taskId: input.taskId,
        shouldReplan: loopReplanDecision.shouldReplan,
      });

      if (harnessDecision) {
        this.emitStageEvent("harness_decide", input.taskId, { status: "completed", action: harnessDecision.action });
      }

      return {
        observation: taskObservation,
        assessment: validatedAssessment,
        plan: loopPlan,
        planGraphBundle: loopPlanGraphBundle,
        stepOutputs: loopStepOutputs,
        feedback: loopFeedback,
        learningSignals,
        learningObjects,
        rolloutRecord,
        timeline: timeline.build(),
        outcome: {
          score: loopEvaluationReport.score ?? 0,
          issues: loopEvaluationReport.issues ?? [],
          confidence: loopEvaluationReport.confidence ?? 0.5,
        },
        evaluationReport: loopEvaluationReport,
        qualityGate: loopQualityGate,
        replanDecision: loopReplanDecision,
        graphPatch: loopGraphPatch,
        harnessDecision,
      };
    });
  }

  private async executeViaBridge(plan: Plan, context: ExecutionContext): Promise<DualChannelStepOutput[]> {
    const executionResult = await this.executeBridge.executePlan(plan, context);
    return this.executeBridge.toDualChannelStepOutputs(executionResult);
  }

  public async produceStageRationale(input: OapeflirLoopInput): Promise<OapeflirLoopResult & {
    normalizationReport: { normalizedNodes: number; normalizedEdges: number };
    validationReport: { valid: boolean; findings: Array<{ code: string; message: string }> };
    riskPropagation: { riskScore: number; criticalPathNodes: string[]; findings: string[] } | null;
    worstPath: { pathLength: number; estimatedDurationMs: number; budgetEstimate: number; riskClass: string } | null;
  }> {
    const taskSituation: TaskSituation = this.situationBuilder.build({
      taskId: input.taskId,
      objective: input.objective,
      currentPhase: "planning",
      blockers: input.blockerSummaries ?? [],
      fileRefs: input.fileRefs ?? [],
      metrics: { workflowSteps: input.workflow.executionSteps.length },
    });
    const taskObservation = this.observationAggregator.aggregate(
      taskSituation,
      this.systemSituationBuilder.build(),
      this.createEmptyEventFlowSituation(),
      this.createEmptyGoalDecompositionSituation(),
      this.createEmptyMemorySituation(),
    );
    const observedTask = this.normalizeObservationTask(taskObservation.task, input);
    const assessResult = this.assessment.assess(observedTask, input.constraintPack, input.effectivePolicy);
    const validatedAssessment: UnifiedAssessment = validateUnifiedAssessment(assessResult.assessment).ok
      ? assessResult.assessment
      : {
        taskId: input.taskId,
        timestamp: Date.now(),
        situationRef: `assessment:${input.taskId}:fallback`,
        phase: "pre-execution",
        complexity: "moderate",
        risk: "medium",
        riskAssessment: { level: "medium", factors: ["assessment_validation_failed"] },
        routingDecision: { division: "coding", workflow: "multi-step", rationale: "fallback_due_to_validation_error" },
        resourceAllocation: { modelClass: "medium", maxTokens: 5000, timeoutMs: 60000 },
        approvalPolicy: { required: false, level: "none" },
        executionMode: "auto",
        suggestedActions: [],
      };
    const planGraphBundle = this.buildPlanGraphBundleForInput({
      observation: observedTask,
      assessment: validatedAssessment,
      workflow: input.workflow,
    }, { normalizeGraph: true, propagateRisk: true });
    const plan = this.toLegacyPlan(planGraphBundle, input.taskId);
    const executionContext = this.buildExecutionContext(input, planGraphBundle, plan, validatedAssessment);
    const stepOutputs = input.stepOutputs ?? await this.executeViaBridge(plan, executionContext);
    const feedbackSignals = input.feedbackSignals ?? this.buildFeedbackSignals(input.taskId, stepOutputs);
    const feedback = this.feedbackCollector.collect({
      taskId: input.taskId,
      planId: plan.planId,
      signals: feedbackSignals,
    });
    const evaluationReport = this.outcomeEvaluator.evaluate(planGraphBundle, feedback);
    const qualityGate = this.qualityGate.decide(evaluationReport);
    const replanTrigger = this.replanning.createTrigger(
      input.taskId,
      qualityGate.accepted ? "planning.no_replan_required" : "planning.quality_gate_replan",
      "feedback",
      qualityGate.reasonCodes.join(","),
    );
    const replanDecision = this.replanning.decide(plan, feedback, replanTrigger);
    const graphPatch = replanDecision.shouldReplan ? this.buildGraphPatch(plan, plan.version + 1) : null;
    const learningSignals = this.feedbackCollector.toLearningSignals(feedback);
    const learningObjects = await this.learning.learn(learningSignals);
    if (learningObjects.length > 0) {
      await this.knowledgePromotion.promote(learningObjects, input.taskId);
    }
    const validationReport = planGraphBundle.validationReport;
    return {
      assessment: validatedAssessment,
      plan,
      planGraphBundle,
      stepOutputs,
      feedback,
      learningSignals,
      learningObjects,
      rolloutRecord: null,
      timeline: [],
      outcome: {
        score: evaluationReport.score ?? 0,
        issues: evaluationReport.issues ?? [],
        confidence: evaluationReport.confidence ?? 0.5,
      },
      evaluationReport,
      qualityGate,
      replanDecision,
      graphPatch,
      harnessDecision: null,
      observation: {
        ...taskObservation,
        task: observedTask,
      },
      normalizationReport: {
        normalizedNodes: validationReport.normalizedNodeIds?.length ?? planGraphBundle.graph.nodes.length,
        normalizedEdges: planGraphBundle.graph.edges.length,
      },
      validationReport: {
        valid: validationReport.valid,
        findings: validationReport.findings.map((message, index) => ({
          code: `validation.issue.${index}`,
          message,
        })),
      },
      riskPropagation: this.buildRiskPropagationSummary(planGraphBundle),
      worstPath: validationReport.worstPath == null
        ? null
        : {
          pathLength: validationReport.worstPath.pathNodeIds.length,
          estimatedDurationMs: validationReport.worstPath.timeoutMs,
          budgetEstimate: validationReport.worstPath.estimatedBudgetAmount,
          riskClass: validationReport.worstPath.riskClass,
        },
    };
  }

}
