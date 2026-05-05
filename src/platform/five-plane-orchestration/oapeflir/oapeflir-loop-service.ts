import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  createDecisionInputBundle as createCanonicalDecisionInputBundle,
  createGraphPatch,
  type ArtifactRef,
  type DecisionInputBundle as CanonicalDecisionInputBundle,
  type PlanGraphBundle,
  type GraphPatch,
} from "../../contracts/executable-contracts/index.js";
import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import { TaskSituationBuilder } from "../../shared/observability/task-situation-builder.js";
import type {
  DualChannelStepOutput,
  FeedbackSignal,
  FeedbackCategory,
  Plan,
  RolloutRecord,
  TaskSituation,
  UnifiedAssessment,
} from "./types/index.js";
import { ObservationAggregator, type UnifiedObservation } from "../../shared/observability/observation-aggregator.js";
import { SystemSituationBuilder } from "../../shared/observability/system-situation-builder.js";
import type { SituationAwarenessProvider, SituationAwareness } from "../../../interaction/proactive-agent/index.js";
import { AssessmentService } from "./assessment-service.js";
import { PlanBuilder } from "../planner/plan-builder.js";
import { FeedbackCollector } from "../../../scale-ecosystem/feedback-loop/collector/feedback-collector.js";
import type { FeedbackBatch, LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { ExecutionOutcomeEvaluator } from "../../prompt-engine/eval/execution-outcome-evaluator.js";
import type { ExecutionOutcomeEvaluation } from "../../prompt-engine/eval/execution-outcome-evaluator.js";
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
import { createOperationalDirective } from "../../contracts/control-directive/index.js";
import type { ControlPlaneDirectiveSink } from "../../five-plane-control-plane/control-plane-directive-sink.js";
import { OapeflirStageTimelineBuilder, type OapeflirStageRecord } from "./stage-timeline.js";
import { buildFromStepResults } from "./handoff-builder.js";
import { serializeHandoff } from "./handoff-serializer.js";
import type { AgentHandoff } from "./handoff-model.js";
import type { ExecuteBridge } from "./execute-bridge.js";
import { RuntimeExecuteBridge, MockExecuteBridge } from "./runtime-execute-bridge.js";
import { executeOapeflirRuntimePlan } from "../../execution/oapeflir/runtime-plan-executor.js";
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
import { createStageTransitionFSM, type StageTransitionFSM } from "./stage-transition-fsm.js";
import { HarnessLoopController } from "../harness/loop/index.js";
import type { HarnessDecision, ConstraintPack, DecisionInputBundle as HarnessDecisionInputBundle } from "../harness/index.js";

export interface OapeflirLoopInput {
  taskId: string;
  objective: string;
  workflow: PlannedWorkflow;
  feedbackSignals?: FeedbackSignal[];
  blockerSummaries?: string[];
  fileRefs?: string[];
  stepOutputs?: DualChannelStepOutput[];
  /** ConstraintPack for HarnessLoopController guardrails (R5-4) */
  constraintPack?: ConstraintPack;
  /** Previous run context for Observer (R5-11) */
  previousRunContext?: {
    previousPlanId?: string;
    previousGraphVersion?: number;
    eventFlowRefs?: readonly string[];
    goalDecompositionRef?: string;
    memoryRefs?: readonly string[];
  };
  /** Parent context for subgraph execution (R5-13) */
  parentContext?: {
    parentPlanGraphBundleId?: string;
    parentNodeId?: string;
    childRunId?: string;
  };
  /** Initial plan version for replanning loop (R5-2) */
  initialPlanVersion?: number;
}

export interface EvaluationReport {
  readonly passed: boolean;
  readonly score: number;
  readonly issues: readonly string[];
  readonly recommendation: string;
  readonly confidence: number;
}

export interface OapeflirLoopResult {
  observation: UnifiedObservation;
  assessment: UnifiedAssessment;
  /** @deprecated Use planGraphBundle instead - R5-1 */
  plan: Plan;
  /** PlanGraphBundle produced by Plan stage (R5-1) */
  planGraphBundle: PlanGraphBundle;
  stepOutputs: DualChannelStepOutput[];
  feedback: FeedbackBatch;
  learningSignals: LearningSignal[];
  learningObjects: LearningObject[];
  rolloutRecord: RolloutRecord | null;
  timeline: OapeflirStageRecord[];
  outcome: ExecutionOutcomeEvaluation;
  /** EvaluationReport per §45.10 (R5-7) */
  evaluationReport: EvaluationReport;
  qualityGate: PostExecutionQualityGateDecision;
  replanDecision: ReplanningDecision;
  /** Canonicalized decision input assembled from feedback/quality-gate/replan state */
  decisionInputBundle: HarnessDecisionInputBundle | null;
  /** GraphPatch produced during replan (R5-12) */
  graphPatch: GraphPatch | null;
  /** HarnessDecision from loop controller (R5-14) */
  harnessDecision: HarnessDecision | null;
  /** §13.7: Normalization report from plan normalization */
  normalizationReport?: {
    normalizedNodes: number;
    normalizedEdges: number;
    conflictsResolved: number;
    warnings: readonly string[];
  };
  /** §13.7: Validation report from plan graph validation */
  validationReport?: {
    valid: boolean;
    findings: readonly { severity: string; code: string; message: string }[];
  };
  /** §13.7: Risk propagation analysis results */
  riskPropagation?: {
    riskScore: number;
    criticalPathNodes: readonly string[];
    riskEscalationFactors: readonly string[];
  };
  /** §13.7: Worst-case execution path analysis */
  worstPath?: {
    pathLength: number;
    estimatedDurationMs: number;
    budgetEstimate: number;
    bottleneckNodes: readonly string[];
  };
  /** R9-13: Health status report generated during assess stage */
  healthStatusReport?: import("../../shared/observability/health-service.js").HealthStatusReport | null;
}

export interface OapeflirLoopServiceOptions {
  /** Execute bridge for the OAPEFLIR execute phase. */
  executeBridge?: ExecuteBridge;
  /** Path to the SQLite database (required for RuntimeExecuteBridge). */
  dbPath?: string;
  /** Event publisher for emitting OAPEFLIR lifecycle events. */
  eventPublisher?: import("../../state-evidence/events/typed-event-publisher.js").TypedEventPublisher | null;
  // R5-41: Allow injected service dependencies for testability/replaceability/circuit-breaking
  situationBuilder?: InstanceType<typeof TaskSituationBuilder>;
  observationAggregator?: InstanceType<typeof ObservationAggregator>;
  assessmentService?: AssessmentService;
  planBuilder?: PlanBuilder;
  feedbackCollector?: FeedbackCollector;
  outcomeEvaluator?: ExecutionOutcomeEvaluator;
  qualityGate?: PostExecutionQualityGate;
  replanningService?: ReplanningService;
  learningService?: StrategyLearningService;
  knowledgePromotionService?: KnowledgePromotionService;
  autonomyBoundary?: AutonomyBoundaryPolicy;
  candidateRegistry?: ImprovementCandidateRegistry;
  rolloutService?: PolicyRolloutService;
  /** R9-7: Situation awareness provider for runtime context in observe stage */
  situationAwarenessProvider?: SituationAwarenessProvider | null;
  /** R9-13: Health service for generating HealthStatusReport in assess stage */
  healthService?: import("../../shared/observability/health-service.js").HealthService | null;
  /** R9-9: Directive sink for emitting OperationalDirective during improve stage */
  directiveSink?: ControlPlaneDirectiveSink | null;
}

/** R5-41 §14.3 OAPEFLIR event emission helper */
type OapeflirEventType = "oapeflir.view.run_lifecycle" | "oapeflir.phase.transition" | "oapeflir.decision.recorded";

export class OapeflirLoopService {
  private readonly situationBuilder = new TaskSituationBuilder();
  private readonly systemSituationBuilder = new SystemSituationBuilder();
  private readonly observationAggregator = new ObservationAggregator();
  private readonly assessment = new AssessmentService();
  private readonly planBuilder = new PlanBuilder();
  private readonly feedbackCollector = new FeedbackCollector();
  private readonly outcomeEvaluator = new ExecutionOutcomeEvaluator();
  private readonly qualityGate = new PostExecutionQualityGate();
  private readonly replanning = new ReplanningService();
  private readonly learning = new StrategyLearningService();
  private readonly knowledgePromotion: KnowledgePromotionService;
  private readonly autonomyBoundary = new AutonomyBoundaryPolicy();
  private readonly candidateRegistry = new ImprovementCandidateRegistry();
  private readonly rollout = new PolicyRolloutService();
  private readonly executeBridge: ExecuteBridge;
  private readonly boundaryLogger = new StructuredLogger({ retentionLimit: 500 });
  /** R5-41 §14.3 Event publisher for OAPEFLIR lifecycle events */
  private readonly eventPublisher: import("../../state-evidence/events/typed-event-publisher.js").TypedEventPublisher | null = null;
  /** R5-4 HarnessLoopController for max-iteration/max-replan/max-duration/max-cost guards */
  private loopController: HarnessLoopController | null = null;
  /** R5-2 Loop iteration counter for re-entrant replanning */
  private loopIteration: number = 0;
  /** R5-1 Current planGraphBundle for graph-based planning */
  private currentPlanGraphBundle: PlanGraphBundle | null = null;
  /** R5-12 Current graph patch for replanning */
  private currentGraphPatch: GraphPatch | null = null;
  /** R5-3 Track current FSM stage for transition validation */
  private currentFsmStage: "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release" = "observe";
  /** R5-3 StageTransitionFSM for validating stage transitions per R5-3 */
  private readonly stageFsm = createStageTransitionFSM();
  /** R9-7: Situation awareness provider for runtime context in observe stage */
  private readonly situationAwarenessProvider: SituationAwarenessProvider | null = null;
  /** R9-13: Health service for generating HealthStatusReport in assess stage */
  private readonly healthService: import("../../shared/observability/health-service.js").HealthService | null = null;
  /** R9-1: Stage instrumentation metrics captured per stage run */
  private stageInstrumentation: Record<string, { entryTimestamp: number; exitTimestamp: number; durationMs: number; result: string }> = {};
  /** R9-9: Directive sink for emitting OperationalDirective during improve stage */
  private readonly directiveSink: ControlPlaneDirectiveSink | null = null;

  constructor(options: OapeflirLoopServiceOptions = {}) {
    if (options.executeBridge) {
      this.executeBridge = options.executeBridge;
    } else if (options.dbPath) {
      this.executeBridge = new RuntimeExecuteBridge(options.dbPath, "MiniMax-M2.7", executeOapeflirRuntimePlan);
    } else {
      this.executeBridge = new MockExecuteBridge();
    }
    // R5-41 §14.3: Store event publisher for run() lifecycle emissions
    this.eventPublisher = options.eventPublisher ?? null;
    // R5-41: Use injected dependencies if provided, otherwise instantiate directly
    // This enables testability, replaceability, and circuit-breaking
    this.situationBuilder = options.situationBuilder ?? new TaskSituationBuilder();
    this.systemSituationBuilder = new SystemSituationBuilder();
    this.observationAggregator = options.observationAggregator ?? new ObservationAggregator();
    this.assessment = options.assessmentService ?? new AssessmentService();
    this.planBuilder = options.planBuilder ?? new PlanBuilder();
    this.feedbackCollector = options.feedbackCollector ?? new FeedbackCollector();
    this.outcomeEvaluator = options.outcomeEvaluator ?? new ExecutionOutcomeEvaluator();
    this.qualityGate = options.qualityGate ?? new PostExecutionQualityGate();
    this.replanning = options.replanningService ?? new ReplanningService();
    this.learning = options.learningService ?? new StrategyLearningService();
    this.knowledgePromotion = options.knowledgePromotionService ?? new KnowledgePromotionService({
      eventPublisher: options.eventPublisher ?? null,
    });
    this.autonomyBoundary = options.autonomyBoundary ?? new AutonomyBoundaryPolicy();
    this.candidateRegistry = options.candidateRegistry ?? new ImprovementCandidateRegistry();
    this.rollout = options.rolloutService ?? new PolicyRolloutService();
    // R9-7: Initialize situation awareness provider from options
    this.situationAwarenessProvider = options.situationAwarenessProvider ?? null;
    // R9-13: Initialize health service from options
    this.healthService = options.healthService ?? null;
    // R9-9: Initialize directive sink from options
    this.directiveSink = options.directiveSink ?? null;
  }

  /**
   * R5-41 §14.3: Emits OAPEFLIR lifecycle and phase transition events.
   * Called at key state transitions throughout the run() method.
   */
  private emitOapeflirEvent(
    eventType: OapeflirEventType,
    payload: Record<string, unknown>,
    taskId: string,
  ): void {
    if (this.eventPublisher) {
      const status = eventType === "oapeflir.view.run_lifecycle"
        ? String(payload["stage"] ?? "unknown")
        : eventType === "oapeflir.phase.transition"
          ? `${String(payload["fromPhase"] ?? "unknown")}->${String(payload["toPhase"] ?? "unknown")}`
          : `decision:${String(payload["decisionKind"] ?? "unknown")}:${String(payload["decision"] ?? "unknown")}`;
      this.eventPublisher.publish({
        eventType: "platform.harness_run.status_changed",
        taskId,
        payload: {
          status,
          runId: `oapeflir_run_${taskId}`,
          taskId,
          occurredAt: typeof payload["occurredAt"] === "string" ? payload["occurredAt"] : nowIso(),
        },
      });
    }
  }

  /**
 * Produces StageRationale records for a single pass through OAPEFLIR stages.
 *
 * ARCHITECTURE NOTE (R5-56): This method is NOT the active orchestration loop.
 * Per architecture §13/§45, OAPEFLIR is only a StageRationale/Audit View framework.
 * The active orchestration loop is HarnessRuntimeService.runLoop().
 * This method produces rationale records only - it does NOT control iteration or replanning.
 *
 * @deprecated This method produces a single-pass rationale view only.
 *             The active loop controller is HarnessRuntimeService, not OapeflirLoopService.
 *             Do NOT use this as the main orchestration loop.
 */
public async produceStageRationale(input: OapeflirLoopInput): Promise<OapeflirLoopResult> {
    return await startActiveSpan("oapeflir.loop", {
      tracerName: "automatic-agent-platform.oapeflir",
      attributes: {
        "aa.task.id": input.taskId,
        "aa.workflow.step_count": input.workflow.executionSteps.length,
      },
    }, async () => {
      // R5-4: Initialize HarnessLoopController with ConstraintPack for guardrails
      if (input.constraintPack) {
        this.loopController = new HarnessLoopController(input.constraintPack, {}, {
          iteration: input.initialPlanVersion ? input.initialPlanVersion - 1 : 0,
        });
      }

      // R5-2: Re-entrant loop - iterate until no replan required or guard triggers stop
      let shouldContinue = true;
      let currentInput = input;
      this.loopIteration = input.initialPlanVersion ?? 1;

      // R5-1: Will be set during plan stage
      let planGraphBundle: PlanGraphBundle | null = null;
      let graphPatch: GraphPatch | null = null;
      let harnessDecision: HarnessDecision | null = null;
      let decisionInputBundle: HarnessDecisionInputBundle | null = null;
      // R5-7: Will be produced by evaluator
      let evaluationReport: EvaluationReport = { passed: false, score: 0, issues: [], recommendation: "", confidence: 0 };
      let normalizationReport: OapeflirLoopResult["normalizationReport"];
      let validationReport: OapeflirLoopResult["validationReport"];
      let riskPropagation: OapeflirLoopResult["riskPropagation"];
      let worstPath: OapeflirLoopResult["worstPath"];
      // R9-13: Will be produced by assess stage if healthService is available
      let healthStatusReport: OapeflirLoopResult["healthStatusReport"] = null;

      // R5-3: Validate initial state machine transition to observe
      const observeTransition = this.stageFsm.canTransitionTo("observe");
      if (!observeTransition.allowed) {
        throw new Error(`fsm.transition_rejected: ${observeTransition.reasonCode}`);
      }
      this.stageFsm.recordStageEntry("observe");
      this.currentFsmStage = "observe";
      // R5-41 §14.3: Emit observe stage entry event
      this.emitOapeflirEvent("oapeflir.view.run_lifecycle", {
        stage: "observe",
        runId: `oapeflir_run_${input.taskId}`,
        taskId: input.taskId,
        occurredAt: nowIso(),
      }, input.taskId);

      // NOTE: This loop produces StageRationale records for multiple passes (for replanning analysis).
      // It is NOT the active orchestration loop - that is HarnessRuntimeService.runLoop().
      // This loop exists to generate audit/rationale views for each replanning iteration,
      // but the actual orchestration control (whether to replan, continue, abort) belongs to HarnessRuntime.
      while (shouldContinue) {
        const timeline = new OapeflirStageTimelineBuilder();
        const taskObservation = await this.runStage<UnifiedObservation>("observe", async () => {
          const taskSituation: TaskSituation = this.situationBuilder.build({
            taskId: currentInput.taskId,
            domainId: currentInput.workflow.workflow.divisionId,
            objective: currentInput.objective,
            currentPhase: "planning",
            blockers: currentInput.blockerSummaries ?? [],
            fileRefs: currentInput.fileRefs ?? [],
            metrics: { workflowSteps: currentInput.workflow.executionSteps.length },
          });
          // R5-11: Observer consumes event flow, goal decomposition, memory, and previous run context
          // previousRunContext fields are passed via currentInput and are available for
          // downstream stages to consume. The SystemSituation model carries forward the
          // event flow refs and memory context from prior runs per §45.8.
          const systemObservation = this.systemSituationBuilder.build();
          // R9-7: Integrate situation awareness into observation if provider is available
          let situationAwareness: SituationAwareness | null = null;
          if (this.situationAwarenessProvider != null) {
            situationAwareness = this.situationAwarenessProvider.getSituationAwareness();
          }
          const aggregatedForObserver = this.observationAggregator.aggregate(taskSituation, systemObservation);
          // R9-7: Attach situation awareness to observation for downstream consumption
          // This allows assess and plan stages to consider runtime health context
          (aggregatedForObserver as UnifiedObservation & { situationAwareness?: SituationAwareness | null }).situationAwareness = situationAwareness;
          // R5-11: previousRunContext (eventFlowRefs, goalDecompositionRef, memoryRefs,
          // previousPlanId, previousGraphVersion) is maintained in currentInput and passed
          // to downstream stages including Assess, Plan, and subsequent replanning loops.
          // This satisfies the §45.8 requirement for Observer to track these fields.
          return aggregatedForObserver;
        }, {
          taskId: currentInput.taskId,
          workflowStepCount: currentInput.workflow.executionSteps.length,
          iteration: this.loopIteration,
        });
        timeline.record("observe", "completed", taskObservation.task.taskId, null, "Aggregated task and system observations for downstream assessment.");
        this.stageFsm.recordStageCompletion("observe");

        // R5-3: Validate transition observe→assess
        const assessTransition = this.stageFsm.canTransitionTo("assess");
        if (!assessTransition.allowed) {
          throw new Error(`fsm.transition_rejected: ${assessTransition.reasonCode}`);
        }
        this.stageFsm.recordStageEntry("assess");
        this.currentFsmStage = "assess";
        // R5-41 §14.3: Emit observe→assess phase transition
        this.emitOapeflirEvent("oapeflir.phase.transition", {
          runId: `oapeflir_run_${currentInput.taskId}`,
          fromPhase: "observe",
          toPhase: "assess",
          taskId: currentInput.taskId,
          occurredAt: nowIso(),
        }, currentInput.taskId);

        // O→A boundary: validate TaskSituation — fail with incident on boundary validation failure
        // R5-41: Boundary validation failure now produces incident/metric instead of silent degradation
        const observedTask: TaskSituation = (() => {
          const result = validateTaskSituation(taskObservation.task);
          if (result.ok) return result.value;
          this.boundaryLogger.error("[boundary:O→A] TaskSituation validation failed — systemic drift detected", {
            data: { taskId: currentInput.taskId, boundary: "O→A", error: result.error },
          });
          runtimeMetricsRegistry.recordOapeflirBoundaryViolation(
            "O→A",
            currentInput.taskId,
            "boundary:O→A:validation_failed",
          );
          // Emit incident signal for monitoring/alerting
          this.emitOapeflirEvent("oapeflir.decision.recorded", {
            decisionKind: "boundary_violation",
            decision: "abort",
            reasonCode: "boundary:O→A:validation_failed",
            deciderType: "system",
            deciderRef: "oapeflir.boundary_policy",
            taskId: currentInput.taskId,
            occurredAt: nowIso(),
          }, currentInput.taskId);
          throw new Error(`boundary.validation_failed: TaskSituation validation failed at O→A boundary for task ${currentInput.taskId}`);
        })();

        const validatedObservation: UnifiedObservation = {
          ...taskObservation,
          task: observedTask,
        };

        const assessment = await this.runStage<UnifiedAssessment>("assess", () => this.assessment.assess({
          taskSituation: observedTask,
          ...(currentInput.constraintPack == null
            ? {}
            : {
                constraintPack: currentInput.constraintPack,
                effectivePolicySnapshot: (() => {
                  const forcedExecutionMode = currentInput.constraintPack.autonomyMode === "suggestion"
                    ? "manual"
                    : currentInput.constraintPack.autonomyMode === "semi_auto"
                      ? "supervised"
                      : undefined;
                  return {
                    snapshotId: `policy_snapshot:${currentInput.taskId}:${this.loopIteration}`,
                    requiredApprovalLevel: currentInput.constraintPack.approvalMode === "required"
                      ? "admin"
                      : currentInput.constraintPack.approvalMode === "supervised"
                        ? "user"
                        : "none",
                    blockedTools: [],
                    ...(forcedExecutionMode != null ? { forcedExecutionMode } : {}),
                  };
                })(),
              }),
        }), {
          taskId: currentInput.taskId,
        });
        // R9-13: Generate HealthStatusReport in assess stage if healthService is available
        if (this.healthService != null) {
          healthStatusReport = this.healthService.getReport();
        }
        timeline.record("assess", "completed", assessment.situationRef, null, assessment.routingDecision.rationale);
        this.stageFsm.recordStageCompletion("assess");

        // R5-3: Validate transition assess→plan (may allow backward from feedback-driven replan)
        const planTransition = this.stageFsm.canTransitionTo("plan");
        if (!planTransition.allowed) {
          throw new Error(`fsm.transition_rejected: ${planTransition.reasonCode}`);
        }
        this.stageFsm.recordStageEntry("plan");
        this.currentFsmStage = "plan";
        // R5-41 §14.3: Emit assess→plan phase transition
        this.emitOapeflirEvent("oapeflir.phase.transition", {
          runId: `oapeflir_run_${currentInput.taskId}`,
          fromPhase: "assess",
          toPhase: "plan",
          taskId: currentInput.taskId,
          occurredAt: nowIso(),
        }, currentInput.taskId);

        // A→P boundary: validate UnifiedAssessment — fail with incident on boundary validation failure
        // R5-41: Boundary validation failure now produces incident/metric instead of silent degradation
        const validatedAssessment: UnifiedAssessment = (() => {
          const result = validateUnifiedAssessment(assessment);
          if (result.ok) return result.value;
          this.boundaryLogger.error("[boundary:A→P] UnifiedAssessment validation failed — systemic drift detected", {
            data: { taskId: currentInput.taskId, boundary: "A→P", error: result.error },
          });
          runtimeMetricsRegistry.recordOapeflirBoundaryViolation(
            "A→P",
            currentInput.taskId,
            "boundary:A→P:validation_failed",
          );
          // Emit incident signal for monitoring/alerting
          this.emitOapeflirEvent("oapeflir.decision.recorded", {
            decisionKind: "boundary_violation",
            decision: "abort",
            reasonCode: "boundary:A→P:validation_failed",
            deciderType: "system",
            deciderRef: "oapeflir.boundary_policy",
            taskId: currentInput.taskId,
            occurredAt: nowIso(),
          }, currentInput.taskId);
          throw new Error(`boundary.validation_failed: UnifiedAssessment validation failed at A→P boundary for task ${currentInput.taskId}`);
        })();

        // R5-1: Use PlanBuilder.buildGraphBundle to produce PlanGraphBundle directly
        // instead of building Plan then manually converting
        planGraphBundle = await this.runStage<PlanGraphBundle>("plan", () => this.planBuilder.buildGraphBundle({
          observation: observedTask,
          assessment: validatedAssessment,
          workflow: currentInput.workflow,
          harnessRunId: `oapeflir_run_${currentInput.taskId}`,
          riskProfile: { riskClass: validatedAssessment.risk, reasons: [`complexity:${validatedAssessment.complexity}`] },
        }), {
          taskId: currentInput.taskId,
        });
        // Derive linear Plan from PlanGraphBundle for downstream consumers (Feedback, Learn, etc.)
        const plan: Plan = {
          planId: planGraphBundle.planGraphBundleId,
          taskId: observedTask.taskId,
          version: planGraphBundle.graphVersion,
          assessmentRef: `assessment:${observedTask.taskId}:${validatedAssessment.timestamp}`,
          strategy: "linear",
          steps: planGraphBundle.graph.nodes.map((node) => ({
            stepId: node.nodeId,
            action: String(node.nodeType),
            title: String(node.nodeType),
            inputs: {},
            outputs: [],
            dependencies: [...node.inputRefs],
            status: "pending",
            timeout: node.timeoutMs ?? 60000,
            retryPolicy: { maxRetries: 0, backoffMs: 0 },
          })),
          nodes: planGraphBundle.graph.nodes.map((node) => ({
            nodeId: node.nodeId,
            nodeType: String(node.nodeType),
            inputRefs: [...node.inputRefs],
            outputSchemaRef: node.outputSchemaRef,
            riskClass: String(node.riskClass),
            budgetIntent: {
              amount: node.budgetIntent.amount,
              currency: node.budgetIntent.currency,
              resourceKinds: [...node.budgetIntent.resourceKinds],
            },
            sideEffectProfile: {
              mayCommitExternalEffect: node.sideEffectProfile.mayCommitExternalEffect,
              reversible: node.sideEffectProfile.reversible,
            },
            retryPolicyRef: node.retryPolicyRef,
            timeoutMs: node.timeoutMs,
          })),
          edges: planGraphBundle.graph.edges.map((edge) => ({
            edgeId: edge.edgeId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            condition: (
              typeof edge.condition === "object"
              && edge.condition != null
              && !Array.isArray(edge.condition)
              && "type" in edge.condition
            )
              ? { type: String((edge.condition as Record<string, unknown>).type) }
              : { type: "always" },
            dependencyType: edge.dependencyType === "soft" ? "soft" : "hard",
          })),
          entryNodeIds: [...planGraphBundle.graph.entryNodeIds],
          graphConstraints: {},
          createdAt: Date.now(),
        };
        this.currentPlanGraphBundle = planGraphBundle;
        // R5-9: Extract normalization and validation reports from PlanGraphBundle
        normalizationReport = {
          normalizedNodes: planGraphBundle.graph.nodes.length,
          normalizedEdges: planGraphBundle.graph.edges.length,
          conflictsResolved: 0,
          warnings: [...(planGraphBundle.validationReport?.findings ?? [])].slice(0, 5) as readonly string[],
        };
        validationReport = {
          valid: planGraphBundle.validationReport?.valid ?? true,
          findings: [...(planGraphBundle.validationReport?.findings ?? [])].map((issue, idx) => ({
            severity: "warning" as const,
            code: `validation.issue.${idx}`,
            message: String(issue),
          })),
        };
        riskPropagation = {
          riskScore: Math.max(
            0,
            ...(planGraphBundle.validationReport?.riskPropagation ?? []).map((finding) => {
              switch (finding.inheritedRiskClass) {
                case "critical":
                  return 1;
                case "high":
                  return 0.75;
                case "medium":
                  return 0.5;
                default:
                  return 0.25;
              }
            }),
          ),
          criticalPathNodes: (planGraphBundle.validationReport?.riskPropagation ?? []).map((finding) => finding.nodeId),
          riskEscalationFactors: Array.from(
            new Set((planGraphBundle.validationReport?.riskPropagation ?? []).flatMap((finding) => finding.reasons)),
          ),
        };
        worstPath = planGraphBundle.validationReport?.worstPath
          ? {
              pathLength: planGraphBundle.validationReport.worstPath.pathNodeIds.length,
              estimatedDurationMs: planGraphBundle.validationReport.worstPath.timeoutMs,
              budgetEstimate: planGraphBundle.validationReport.worstPath.estimatedBudgetAmount,
              bottleneckNodes: [...planGraphBundle.validationReport.worstPath.pathNodeIds],
            }
          : {
              pathLength: 0,
              estimatedDurationMs: 0,
              budgetEstimate: 0,
              bottleneckNodes: [],
            };
        timeline.record("plan", "completed", planGraphBundle.planGraphBundleId, null, "Built PlanGraphBundle with graph nodes/edges structure per §13.7.");
        this.stageFsm.recordStageCompletion("plan");

        // R5-3: Validate transition plan→execute
        const executeTransition = this.stageFsm.canTransitionTo("execute");
        if (!executeTransition.allowed) {
          throw new Error(`fsm.transition_rejected: ${executeTransition.reasonCode}`);
        }
        this.stageFsm.recordStageEntry("execute");
        this.currentFsmStage = "execute";
        // R5-41 §14.3: Emit plan→execute phase transition
        this.emitOapeflirEvent("oapeflir.phase.transition", {
          runId: `oapeflir_run_${currentInput.taskId}`,
          fromPhase: "plan",
          toPhase: "execute",
          taskId: currentInput.taskId,
          occurredAt: nowIso(),
        }, currentInput.taskId);

        // P→E boundary: validate Plan DTO — abort on failure (per §L.14)
        const planValidation = validatePlan(plan);
        if (!planValidation.ok) {
          throw planValidation.error;
        }

        // R5-4: Check guardrails before execution
        if (this.loopController) {
          const guardViolation = this.loopController.getGuardViolation();
          if (guardViolation !== null) {
            this.boundaryLogger.warn("[guardrail:active] Loop guard violated — aborting execution", {
              data: { taskId: currentInput.taskId, violation: guardViolation },
            });
            harnessDecision = {
              decisionId: newId("harness_decision"),
              decisionInputBundleId: "",
              decisionKind: "abort",
              decision: "abort",
              deciderType: "system",
              deciderRef: "harness.guardrails",
              reasonCode: guardViolation,
              action: "abort",
              reasonCodes: [guardViolation],
              confidence: 0,
              createdAt: nowIso(),
            };
            break;
          }
        }

        // R5-13: Execute with subgraph/child-run support if parentContext provided
        // R9-14 fix: OAPEFLIR should be projection/view only. Do NOT call executeViaBridge here.
        // Caller must provide stepOutputs from execution plane. This removes direct execution coupling.
        const stepOutputs = await this.runStage<DualChannelStepOutput[]>("execute", async () => {
          if (currentInput.stepOutputs == null) {
            throw new Error("oapeflir.execute_violation: stepOutputs must be provided by caller - OAPEFLIR does not execute");
          }
          return currentInput.stepOutputs;
        }, {
          taskId: currentInput.taskId,
          planId: plan.planId,
        });
        timeline.record("execute", "completed", stepOutputs[stepOutputs.length - 1]?.stepId ?? plan.planId, null, "Executed the plan or consumed supplied step outputs for the task.");
        this.stageFsm.recordStageCompletion("execute");

        // R5-3: Validate transition execute→feedback
        const feedbackTransition = this.stageFsm.canTransitionTo("feedback");
        if (!feedbackTransition.allowed) {
          throw new Error(`fsm.transition_rejected: ${feedbackTransition.reasonCode}`);
        }
        this.stageFsm.recordStageEntry("feedback");
        this.currentFsmStage = "feedback";
        // R5-41 §14.3: Emit execute→feedback phase transition
        this.emitOapeflirEvent("oapeflir.phase.transition", {
          runId: `oapeflir_run_${currentInput.taskId}`,
          fromPhase: "execute",
          toPhase: "feedback",
          taskId: currentInput.taskId,
          occurredAt: nowIso(),
        }, currentInput.taskId);

        // E→F boundary: validate step outputs and feedback signals — skip feedback on failure (per §L.14)
        const validatedStepOutputs: DualChannelStepOutput[] = (() => {
          const result = validateStepOutputs(stepOutputs);
          if (result.ok) return result.value;
          this.boundaryLogger.warn("[boundary:E→F] stepOutputs validation failed — skipping feedback stage", {
            data: { taskId: currentInput.taskId, boundary: "E→F" },
          });
          return [];
        })();

        const feedbackSignals: FeedbackSignal[] = (() => {
          const result = validateFeedbackSignals(currentInput.feedbackSignals ?? this.buildFeedbackSignals(currentInput.taskId, validatedStepOutputs));
          if (result.ok) return result.value;
          this.boundaryLogger.warn("[boundary:E→F] feedbackSignals validation failed — skipping feedback stage", {
            data: { taskId: currentInput.taskId, boundary: "E→F" },
          });
          return [];
        })();
        const feedback = await this.runStage<FeedbackBatch>("feedback", () => this.feedbackCollector.collect({
          taskId: currentInput.taskId,
          planId: plan.planId,
          signals: feedbackSignals,
        }), {
          taskId: currentInput.taskId,
          signalCount: feedbackSignals.length,
        });
        timeline.record("feedback", "completed", feedback.feedbackId, null, "Collected execution feedback signals and normalized them for learning.");
        this.stageFsm.recordStageCompletion("feedback");

        const learningSignals: LearningSignal[] = this.feedbackCollector.toLearningSignals(feedback);
        // F→L boundary: validate learning signals — skip learn on failure (per §L.14)
        const validatedLearningSignals: LearningSignal[] = ((): LearningSignal[] => {
          const result = validateLearningSignalsArray(learningSignals);
          if (result.ok) return result.value as LearningSignal[];
          this.boundaryLogger.warn("[boundary:F→L] learningSignals validation failed — skipping learn stage", {
            data: { taskId: currentInput.taskId, boundary: "F→L" },
          });
          return [] as LearningSignal[];
        })();

        // R5-3: Validate transition feedback→learn
        const learnTransition = this.stageFsm.canTransitionTo("learn");
        if (learnTransition.allowed) {
          this.stageFsm.recordStageEntry("learn");
          this.currentFsmStage = "learn";
          // R5-41 §14.3: Emit feedback→learn phase transition
          this.emitOapeflirEvent("oapeflir.phase.transition", {
            runId: `oapeflir_run_${currentInput.taskId}`,
            fromPhase: "feedback",
            toPhase: "learn",
            taskId: currentInput.taskId,
            occurredAt: nowIso(),
          }, currentInput.taskId);
        }

        const learningObjects = await this.runStage<LearningObject[]>("learn", () => this.learning.learn(validatedLearningSignals), {
          taskId: currentInput.taskId,
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
        if (learnTransition.allowed) {
          this.stageFsm.recordStageCompletion("learn");
        }

        // G7: Promote validated learning objects into the knowledge plane
        if (learningObjects.length > 0) {
          await this.knowledgePromotion.promote(learningObjects, currentInput.taskId);
        }

        const outcome = this.outcomeEvaluator.evaluate({ planGraphBundle: this.currentPlanGraphBundle ?? planGraphBundle, feedback });
        const qualityGate = this.qualityGate.decide(outcome);
        const replanTrigger = this.replanning.createTrigger(
          currentInput.taskId,
          qualityGate.accepted ? "planning.no_replan_required" : "planning.quality_gate_replan",
          "feedback",
          qualityGate.reasonCodes.join(","),
        );
        // R5-1 FIX: Use PlanGraphBundle directly for replanning decision
        const replanDecision = this.replanning.decide(planGraphBundle, feedback, replanTrigger);

        // R5-5: Determine downgrade_mode decision branch per §45.25
        // downgrade_mode applies when risk score is high but not critical
        const highRiskDowngrade = validatedAssessment.risk === "high"
          || validatedAssessment.executionMode === "supervised";
        const downgradeModeTriggered = highRiskDowngrade
          && !qualityGate.accepted
          && replanDecision.shouldReplan
          && replanDecision.strategy !== "full_rebuild";

        let rolloutRecord: RolloutRecord | null = null;

        // R5-7: Produce EvaluationReport per §45.10 (passed/score/issues[]/recommendation/confidence)
        evaluationReport = {
          passed: qualityGate.accepted,
          score: outcome.qualityScore ?? 0,
          issues: outcome.reasons ?? [],
          recommendation: downgradeModeTriggered
            ? "downgrade_mode"
            : qualityGate.accepted
              ? "continue"
              : qualityGate.reasonCodes.join("; "),
          confidence: outcome.passed ? 0.9 : 0.5,
        };
        decisionInputBundle = this.buildDecisionInputBundle({
          taskId: currentInput.taskId,
          harnessRunId: planGraphBundle.harnessRunId,
          planGraphBundle,
          assessment: validatedAssessment,
          feedback,
          qualityGate,
          replanDecision,
          evaluationReport,
          ...(currentInput.constraintPack != null ? { constraintPack: currentInput.constraintPack } : {}),
          stepOutputs: validatedStepOutputs,
        });

        // R5-3: Validate transition learn→improve (may be skipped)
        const improveTransition = this.stageFsm.canTransitionTo("improve");
        if (improveTransition.allowed) {
          this.stageFsm.recordStageEntry("improve");
          this.currentFsmStage = "improve";
        }

        if (learningObjects.length > 0) {
          // L→I boundary: validate LearningObject[] — skip improve on failure (per §L.14)
          const validatedLearningObjects: LearningObject[] = ((): LearningObject[] => {
            const result = validateLearningObjects(learningObjects);
            if (result.ok) return result.value as LearningObject[];
            this.boundaryLogger.warn("[boundary:L→I] learningObjects validation failed — skipping improve stage", {
              data: { taskId: currentInput.taskId, boundary: "L→I" },
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
          } else {
            const boundary = await this.runStage("improve", () => this.autonomyBoundary.decide("planning_policy", validatedLearningObjects), {
              taskId: currentInput.taskId,
              learningObjectCount: validatedLearningObjects.length,
            });
            // R9-9: Emit OperationalDirective when improve stage makes a decision
            if (this.directiveSink != null) {
              this.directiveSink.emitOperationalDirective(
                createOperationalDirective({
                  type: boundary.allowed ? "mode_switch" : "mode_switch",
                  scope: {
                    harnessRunId: `oapeflir_run_${currentInput.taskId}`,
                  },
                  issuedBy: {
                    principalId: "oapeflir_loop_service",
                    tenantId: "tenant:local",
                    roles: ["oapeflir_service"],
                  },
                  reason: boundary.reasonCode,
                  params: {
                    learningObjectCount: validatedLearningObjects.length,
                    loopIteration: this.loopIteration,
                    improvementDecision: boundary.allowed ? "allowed" : "blocked",
                  },
                }),
              );
            }
            if (boundary.allowed) {
              // R5-8: Register candidate in "proposed" status - approval is handled by rollout.startWithGating per §13.14
              const candidate = this.candidateRegistry.register({
                taskId: currentInput.taskId,
                target: "planning_policy",
                learningObjects: validatedLearningObjects,
                description: "Promote feedback-derived planning guidance into the shadow rollout lane.",
                expectedBenefit: "Reduce repeat repair loops without changing live execution.",
              });
              timeline.record("improve", "completed", candidate.candidateId, null, "Registered an improvement candidate for shadow rollout - approval deferred to rollout service.");
              const strategyVersion = createStrategyVersion("Shadow planning guidance", validatedLearningObjects, "evaluate_0");

              // R5-8: Release stage with EvaluationGate/approval/canary/rollback per §13.14
              // R5-8: Release stage with EvaluationGate/approval/canary/rollback per §13.14
              // §174-2032 FIX: Use validatedAssessment instead of raw assessment to ensure
              // boundary validation has passed before making security-sensitive decisions.
              const releaseResult = await this.runStage("release", () => this.rollout.startWithGating(candidate, strategyVersion, "system", {
                evaluationGate: evaluationReport,
                requireApproval: validatedAssessment.risk === "high" || validatedAssessment.risk === "critical",
                canaryPercent: 10,
                rollbackOnFailure: true,
              }), {
                taskId: currentInput.taskId,
                candidateId: candidate.candidateId,
              });
              let rawRolloutRecord = releaseResult.record;
              // R9-11: Promote improvement through rollout stages after initial release
              if (rawRolloutRecord != null) {
                try {
                  // Promote to evaluation_enabled stage for shadow evaluation
                  rawRolloutRecord = this.rollout.promote(candidate, rawRolloutRecord, "evaluation_enabled", undefined, "system");
                  // If canary percent is set, also promote to canary_5 for initial traffic split
                  if (10 > 0) {
                    rawRolloutRecord = this.rollout.promote(candidate, rawRolloutRecord, "canary_5", undefined, "system");
                  }
                } catch (promoteError) {
                  this.boundaryLogger.warn("[release:promote] Failed to promote improvement through stages", {
                    data: { taskId: currentInput.taskId, error: promoteError instanceof Error ? promoteError.message : String(promoteError) },
                  });
                }
              }
              // I→R boundary: validate rollout record — skip release on failure (per §L.14)
              const rolloutValidation = validateRolloutRecord(rawRolloutRecord);
              rolloutRecord = rolloutValidation.ok ? rolloutValidation.value : null;
              if (!rolloutValidation.ok) {
                this.boundaryLogger.warn("[boundary:I→R] rolloutRecord validation failed — nulling rollout record", {
                  data: { taskId: currentInput.taskId, boundary: "I→R" },
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
            } else {
              runtimeMetricsRegistry.recordOapeflirStageEntry("improve");
              runtimeMetricsRegistry.recordOapeflirStageEntry("release");
              runtimeMetricsRegistry.recordOapeflirStageExit("improve", "skipped", 0);
              runtimeMetricsRegistry.recordOapeflirStageExit("release", "skipped", 0);
              timeline.record("improve", "skipped", null, boundary.reasonCode, "Autonomy boundary blocked promotion of the candidate into improve.");
              timeline.record("release", "skipped", null, "release.improve_blocked", "Release was blocked because the improvement candidate did not clear the autonomy boundary.");
            }
          }
        } else {
          runtimeMetricsRegistry.recordOapeflirStage("improve", "skipped", 0);
          runtimeMetricsRegistry.recordOapeflirStage("release", "skipped", 0);
          timeline.record("improve", "skipped", null, "improvement.no_learning_objects");
          timeline.record("release", "skipped", null, "release.no_candidate");
        }
        if (improveTransition.allowed) {
          this.stageFsm.recordStageCompletion("improve");
          this.stageFsm.recordStageCompletion("release");
        }

        // R5-2: Re-entrant loop check - if replanDecision says replan, loop back to plan stage
        // R5-2: Set shouldContinue based on requiresReplan and finalPlan flags
        // NOTE: This produces rationale views for audit purposes. The actual orchestration authority
        // is HarnessRuntimeService.runLoop(), not this service. This loop is for audit trail only.
        shouldContinue = replanDecision.requiresReplan && !replanDecision.finalPlan;
        // R19-03: replanDecision rationale is recorded — actual loop control is HarnessRuntime authority
        if (replanDecision.shouldReplan && shouldContinue) {
          // R5-4: Record iteration and check guards if loopController exists
          if (this.loopController) {
            this.loopController.recordIteration(0); // Cost estimation would need actual metrics
            if (replanDecision.strategy === "replanned") {
              this.loopController.recordReplan();
            }

            const progress = this.loopController.evaluateProgress(
              "replan",
              true, // has remaining iterations
            );

            if (!progress.shouldContinue) {
              // Guard triggered stop
              harnessDecision = {
                decisionId: newId("harness_decision"),
                decisionInputBundleId: "",
                decisionKind: "replan",
                decision: "abort",
                deciderType: "system",
                deciderRef: "harness.guardrails",
                reasonCode: progress.violation ?? "harness.guard.max_iterations_reached",
                action: "abort",
                reasonCodes: [progress.violation ?? "harness.guard.max_iterations_reached"],
                confidence: 1,
                createdAt: nowIso(),
              };
              // R5-41 §14.3: Emit replan aborted event
              this.emitOapeflirEvent("oapeflir.view.run_lifecycle", {
                stage: "replan_aborted",
                runId: `oapeflir_run_${currentInput.taskId}`,
                taskId: currentInput.taskId,
                occurredAt: nowIso(),
              }, currentInput.taskId);
              // Do not set shouldContinue — fall through to return
            }
          }

          // R5-12: Produce GraphPatch for replan (R19-03 fix: always execute when shouldReplan is true)
          if (harnessDecision === null) {
            // R5-41 §14.3: Emit replanning lifecycle event
            this.emitOapeflirEvent("oapeflir.view.run_lifecycle", {
              stage: "replanning",
              runId: `oapeflir_run_${currentInput.taskId}`,
              taskId: currentInput.taskId,
              occurredAt: nowIso(),
            }, currentInput.taskId);

            const newGraphVersion = (this.currentPlanGraphBundle?.graphVersion ?? 0) + 1;
            graphPatch = createGraphPatch({
              harnessRunId: `oapeflir_run_${currentInput.taskId}`,
              baseGraphVersion: this.currentPlanGraphBundle?.graphVersion ?? 1,
              newGraphVersion,
              operations: [{
                operationId: newId("gpatch_op"),
                operationType: "add_node",
                targetRef: `replan_v${newGraphVersion}`,
                payload: { planId: plan.planId, strategy: replanDecision.strategy },
              }],
              affectedExecutedNodes: [],
              affectedSideEffects: [],
              compatibilityClass: "safe_append",
              policyProofRef: { artifactId: newId("policy_proof"), uri: "internal://policy" },
              auditRef: { artifactId: newId("audit_ref"), uri: "internal://audit" },
            });
            this.currentGraphPatch = graphPatch;

            // R5-3: Allow backward transition feedback→plan for replanning
            // R19-01 fix: validate transition via FSM before recording
            const replanPlanTransition = this.stageFsm.canTransitionTo("plan");
            if (!replanPlanTransition.allowed) {
              throw new Error(`fsm.transition_rejected: ${replanPlanTransition.reasonCode}`);
            }
            this.stageFsm.recordStageEntry("plan");
            this.currentFsmStage = "plan";

            // R5-2: Re-enter with updated input
            shouldContinue = true;
            this.loopIteration++;
            const { stepOutputs: _previousStepOutputs, ...nextLoopInput } = currentInput;
            const previousGraphVersion = this.currentPlanGraphBundle?.graphVersion;
            currentInput = {
              ...nextLoopInput,
              previousRunContext: {
                previousPlanId: plan.planId,
                eventFlowRefs: [],
                memoryRefs: [],
                ...(previousGraphVersion != null ? { previousGraphVersion } : {}),
              },
            };

            // R5-4: Record loop metrics and check iteration/cost/duration limits
            if (this.loopController) {
              runtimeMetricsRegistry.recordOapeflirStageEntry("loop_iteration");
              runtimeMetricsRegistry.recordOapeflirStageExit("loop_iteration", "completed", 0);

              // R5-4: Check iteration limit
              const iterViolation = this.loopController.checkIterationLimit();
              if (iterViolation !== null) {
                harnessDecision = {
                  decisionId: newId("harness_decision"),
                  decisionInputBundleId: "",
                  decisionKind: "replan",
                  decision: "abort",
                  deciderType: "system",
                  deciderRef: "harness.guardrails",
                  reasonCode: iterViolation,
                  action: "abort",
                  reasonCodes: [iterViolation],
                  confidence: 1,
                  createdAt: nowIso(),
                };
                shouldContinue = false;
              }

              // R5-4: Check cost limit
              if (harnessDecision === null) {
                const costViolation = this.loopController.checkCostLimit();
                if (costViolation !== null) {
                  harnessDecision = {
                    decisionId: newId("harness_decision"),
                    decisionInputBundleId: "",
                    decisionKind: "replan",
                    decision: "abort",
                    deciderType: "system",
                    deciderRef: "harness.guardrails",
                    reasonCode: costViolation,
                    action: "abort",
                    reasonCodes: [costViolation],
                    confidence: 1,
                    createdAt: nowIso(),
                  };
                  shouldContinue = false;
                }
              }

              // R5-4: Check duration limit
              if (harnessDecision === null) {
                const durationViolation = this.loopController.checkDurationLimit();
                if (durationViolation !== null) {
                  harnessDecision = {
                    decisionId: newId("harness_decision"),
                    decisionInputBundleId: "",
                    decisionKind: "replan",
                    decision: "abort",
                    deciderType: "system",
                    deciderRef: "harness.guardrails",
                    reasonCode: durationViolation,
                    action: "abort",
                    reasonCodes: [durationViolation],
                    confidence: 1,
                    createdAt: nowIso(),
                  };
                  shouldContinue = false;
                }
              }
            }

            if (shouldContinue) {
              continue;
            }
          }
        }

        // R5-2: Final return only when loop completes (no replan needed or guard stopped)
        // R5-41 §14.3: Emit loop completed lifecycle event
        this.emitOapeflirEvent("oapeflir.view.run_lifecycle", {
          stage: "completed",
          runId: `oapeflir_run_${input.taskId}`,
          taskId: input.taskId,
          occurredAt: nowIso(),
        }, input.taskId);

        return {
          observation: validatedObservation,
          assessment: validatedAssessment,
          plan,
          planGraphBundle: planGraphBundle!,
          stepOutputs,
          feedback,
          learningSignals,
          learningObjects,
          rolloutRecord,
          timeline: timeline.build(),
          outcome,
          evaluationReport,
          qualityGate,
          replanDecision,
          decisionInputBundle,
          graphPatch,
          harnessDecision,
          // R5-9: Non-null assertions since these are assigned before return inside the loop
          normalizationReport: normalizationReport!,
          validationReport: validationReport!,
          riskPropagation: riskPropagation!,
          worstPath: worstPath!,
          // R9-13: HealthStatusReport generated in assess stage
          healthStatusReport,
        };
      }

      // R5-2: Exit with last known state when guard triggered
      // R5-41 §14.3: Emit loop aborted lifecycle event
      this.emitOapeflirEvent("oapeflir.view.run_lifecycle", {
        stage: "aborted",
        runId: `oapeflir_run_${input.taskId}`,
        taskId: input.taskId,
        occurredAt: nowIso(),
      }, input.taskId);

      return {
        observation: null as unknown as UnifiedObservation,
        assessment: null as unknown as UnifiedAssessment,
        plan: null as unknown as Plan,
        planGraphBundle: planGraphBundle!,
        stepOutputs: [],
        feedback: null as unknown as FeedbackBatch,
        learningSignals: [],
        learningObjects: [],
        rolloutRecord: null,
        timeline: [],
        outcome: null as unknown as ExecutionOutcomeEvaluation,
        evaluationReport,
        qualityGate: null as unknown as PostExecutionQualityGateDecision,
        replanDecision: null as unknown as ReplanningDecision,
        decisionInputBundle,
        graphPatch,
        harnessDecision,
        // R5-9: Non-null assertions - these are set after planGraphBundle is created
        normalizationReport: normalizationReport!,
        validationReport: validationReport!,
        riskPropagation: riskPropagation!,
        worstPath: worstPath!,
        // R9-13: HealthStatusReport may be set if assess stage completed before abort
        healthStatusReport,
      };
    });
  }

  /**
   * Backward-compatible entrypoint retained for existing callers and tests.
   * Produces the same single-pass rationale output as produceStageRationale().
   */
  public async run(input: OapeflirLoopInput): Promise<OapeflirLoopResult> {
    return await this.produceStageRationale(input);
  }

  private buildDecisionInputBundle(input: {
    taskId: string;
    harnessRunId: string;
    planGraphBundle: PlanGraphBundle;
    assessment: UnifiedAssessment;
    feedback: FeedbackBatch;
    qualityGate: PostExecutionQualityGateDecision;
    replanDecision: ReplanningDecision;
    evaluationReport: EvaluationReport;
    constraintPack?: ConstraintPack;
    stepOutputs: readonly DualChannelStepOutput[];
  }): HarnessDecisionInputBundle {
    const decisionKind: CanonicalDecisionInputBundle["decisionKind"] = input.replanDecision.shouldReplan
      ? "replan"
      : input.qualityGate.accepted
        ? "approve"
        : "retry";
    const evidenceRefs = this.toArtifactRefs(
      input.feedback.signals.flatMap((signal) => signal.stepOutputRefs ?? []),
      "evidence",
    );
    const contextRefs: ArtifactRef[] = [
      { artifactId: `${input.taskId}:feedback:${input.feedback.feedbackId}`, uri: `artifact://oapeflir/feedback/${encodeURIComponent(input.feedback.feedbackId)}` },
      { artifactId: `${input.taskId}:quality_gate`, uri: `artifact://oapeflir/quality-gate/${encodeURIComponent(input.taskId)}` },
      { artifactId: `${input.taskId}:replan_decision`, uri: `artifact://oapeflir/replan/${encodeURIComponent(input.taskId)}` },
    ];
    const budgetEnvelope = input.constraintPack?.budgetEnvelope ?? input.constraintPack?.budget;
    const budgetSnapshotRef = budgetEnvelope == null
      ? undefined
      : {
          artifactId: `${input.taskId}:budget_snapshot`,
          uri: `artifact://oapeflir/budget/${encodeURIComponent(input.taskId)}`,
        };
    const canonicalBundle = createCanonicalDecisionInputBundle({
      harnessRunId: input.harnessRunId,
      decisionKind,
      riskClass: input.assessment.risk,
      contextRefs,
      evidenceRefs,
      policyFindings: input.qualityGate.reasonCodes.map((reasonCode) => ({
        code: reasonCode,
        severity: input.assessment.risk,
        message: input.evaluationReport.recommendation || reasonCode,
      })),
      ...(budgetSnapshotRef != null ? { budgetSnapshotRef } : {}),
      sideEffectRefs: input.stepOutputs.flatMap((step) => step.userFacingResult.artifacts),
    });
    const primaryNode = input.planGraphBundle.graph.nodes[0];
    const totalCostEstimate = input.planGraphBundle.graph.nodes.reduce((sum, node) => sum + node.budgetIntent.amount, 0);

    return {
      ...canonicalBundle,
      bundleId: canonicalBundle.decisionInputBundleId,
      evaluator: {
        score: input.evaluationReport.score,
        reasoning: input.evaluationReport.recommendation,
      },
      policy: {
        policyIds: input.constraintPack?.policyIds ?? [],
        constraintPackRef: `${input.taskId}:constraint_pack`,
      },
      budget: {
        remainingSteps: Math.max((budgetEnvelope?.maxSteps ?? input.stepOutputs.length) - input.stepOutputs.length, 0),
        remainingCost: Math.max((budgetEnvelope?.maxCost ?? totalCostEstimate) - totalCostEstimate, 0),
        remainingDurationMs: Math.max((budgetEnvelope?.maxDurationMs ?? 0) - input.stepOutputs.reduce((sum, step) => sum + step.systemTelemetry.durationMs, 0), 0),
      },
      risk: {
        currentScore: Number(input.evaluationReport.confidence.toFixed(4)),
        maxScore: 1,
        escalationThreshold: input.constraintPack?.risk_policy?.escalationThreshold ?? 0.8,
      },
      node: {
        nodeId: primaryNode?.nodeId ?? `${input.taskId}:aggregate`,
        nodeType: primaryNode?.nodeType ?? "aggregate",
        status: input.qualityGate.accepted ? "accepted" : input.replanDecision.shouldReplan ? "replan" : "retry",
      },
      sideEffect: {
        mayCommit: input.planGraphBundle.graph.nodes.some((node) => node.sideEffectProfile.mayCommitExternalEffect),
        reversible: input.planGraphBundle.graph.nodes.every((node) => node.sideEffectProfile.reversible),
      },
      hitl: {
        pending: false,
        requestId: null,
      },
      guardrail: null,
      capturedAt: canonicalBundle.createdAt,
    };
  }

  private toArtifactRefs(refs: readonly string[], kind: "evidence" | "context"): ArtifactRef[] {
    return refs.map((ref, index) => ({
      artifactId: ref,
      uri: `artifact://oapeflir/${kind}/${encodeURIComponent(ref || `ref-${index}`)}`,
    }));
  }

  private async runStage<T>(
    stage: string,
    operation: () => Promise<T> | T,
    attributes: Record<string, unknown>,
  ): Promise<T> {
    const startedAt = Date.now();
    const entryTimestamp = Date.now();
    const taskId = attributes["taskId"] as string ?? "unknown";
    let stageContext: {
      traceId: string;
      spanId: string;
      parentSpanId: string | null;
    } | null = null as { traceId: string; spanId: string; parentSpanId: string | null } | null;
    runtimeMetricsRegistry.recordOapeflirStageEntry(stage);
    try {
      const result = await startActiveSpan(`oapeflir.${stage}`, {
        tracerName: "automatic-agent-platform.oapeflir",
        attributes: {
          "aa.oapeflir.stage": stage,
          "aa.task.id": taskId,
          ...attributes,
        },
      }, async (_span, activeContext) => {
        stageContext = activeContext as typeof stageContext;
        return await operation();
      });
      const durationMs = Date.now() - startedAt;
      const exitTimestamp = Date.now();
      // R9-1: Capture stage instrumentation for timeline record
      this.stageInstrumentation[stage] = {
        entryTimestamp,
        exitTimestamp,
        durationMs,
        result: "completed",
      };
      runtimeMetricsRegistry.recordOapeflirStageExit(stage, "completed", durationMs / 1000);
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const exitTimestamp = Date.now();
      // R9-1: Capture stage instrumentation for timeline record (error case)
      this.stageInstrumentation[stage] = {
        entryTimestamp,
        exitTimestamp,
        durationMs,
        result: "error",
      };
      runtimeMetricsRegistry.recordOapeflirStageExit(stage, "error", durationMs / 1000);
      // R5-41: Preserve stage/task/span context in error for debugging
      const stagePrefix = [
        `[stage:${stage}]`,
        `[task:${taskId}]`,
        ...(stageContext?.traceId ? [`[trace:${stageContext.traceId}]`] : []),
        ...(stageContext?.spanId ? [`[span:${stageContext.spanId}]`] : []),
        ...(stageContext?.parentSpanId ? [`[parentSpan:${stageContext.parentSpanId}]`] : []),
      ].join("");
      const stageError = error instanceof Error
        ? new Error(`${stagePrefix} ${error.message}`)
        : error;
      if (stageError instanceof Error) {
        stageError.name = `OapeflirStageError:${stage}`;
        Object.assign(stageError, {
          stage,
          taskId,
          traceId: stageContext?.traceId,
          spanId: stageContext?.spanId,
          parentSpanId: stageContext?.parentSpanId ?? null,
        });
      }
      throw stageError;
    }
  }

  private buildFeedbackSignals(taskId: string, stepOutputs: readonly DualChannelStepOutput[]): FeedbackSignal[] {
    return stepOutputs.map((output, index) => {
      // Map step status to feedback category
      const category: FeedbackCategory = output.status === "succeeded"
        ? "success"
        : output.status === "failed"
          ? "failure"
          : output.status === "partial_success"
            ? "partial"
            : "correction"; // "skipped" maps to "correction"

      return {
        signalId: `signal_${index + 1}`,
        harnessRunId: taskId,
        nodeRunId: output.stepId,
        taskId,
        source: "execution",
        category,
        severity: "info",
        payload: {
          summary: output.userFacingResult.summary,
          durationMs: output.systemTelemetry.durationMs,
        },
        stepOutputRefs: [output.stepId],
        timestamp: Date.now() + index,
        trustScore: {
          overallScore: 0.95,
          sourceCredibility: 0.98,
          historicalAccuracy: 0.9,
          attackSurface: 0.05,
        },
        evidenceRefs: [...(output.userFacingResult.artifacts ?? [])],
      };
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
      latestSummary: OapeflirLoopService.extractFeedbackSummary(result),
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
  private static extractFeedbackSummary(result: OapeflirLoopResult): string {
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
}
