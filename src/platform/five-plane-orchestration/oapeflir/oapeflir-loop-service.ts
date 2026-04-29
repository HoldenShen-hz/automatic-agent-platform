import { newId, nowIso } from "../../contracts/types/ids.js";
import { createPlanGraphBundle, createGraphPatch, type PlanGraphBundle, type GraphPatch, type GraphValidationReport, type ArtifactRef } from "../../contracts/executable-contracts/index.js";
import type { PlannedWorkflow } from "../routing/workflow-planner.js";
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
import { createStageTransitionFSM, type StageTransitionFSM } from "./stage-transition-fsm.js";
import { HarnessLoopController } from "../harness/loop/index.js";
import type { HarnessDecision, ConstraintPack } from "../harness/index.js";

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
  /** GraphPatch produced during replan (R5-12) */
  graphPatch: GraphPatch | null;
  /** HarnessDecision from loop controller (R5-14) */
  harnessDecision: HarnessDecision | null;
}

export interface OapeflirLoopServiceOptions {
  /** Execute bridge for the OAPEFLIR execute phase. */
  executeBridge?: ExecuteBridge;
  /** Path to the SQLite database (required for RuntimeExecuteBridge). */
  dbPath?: string;
  /** Event publisher for emitting OAPEFLIR lifecycle events. */
  eventPublisher?: import("../../state-evidence/events/typed-event-publisher.js").TypedEventPublisher | null;
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

  constructor(options: OapeflirLoopServiceOptions = {}) {
    if (options.executeBridge) {
      this.executeBridge = options.executeBridge;
    } else if (options.dbPath) {
      this.executeBridge = new RuntimeExecuteBridge(options.dbPath);
    } else {
      this.executeBridge = new MockExecuteBridge();
    }
    // R5-41 §14.3: Store event publisher for run() lifecycle emissions
    this.eventPublisher = options.eventPublisher ?? null;
    // G7: Wire eventPublisher to KnowledgePromotionService for learning:knowledge_promoted events
    this.knowledgePromotion = new KnowledgePromotionService({
      eventPublisher: options.eventPublisher ?? null,
    });
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
      this.eventPublisher.publish({
        eventType,
        taskId,
        payload: payload as import("../../five-plane-state-evidence/events/typed-event-bus.js").TypedEventPayloadMap[OapeflirEventType],
      });
    }
  }

  public async run(input: OapeflirLoopInput): Promise<OapeflirLoopResult> {
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
      // R5-7: Will be produced by evaluator
      let evaluationReport: EvaluationReport = { passed: false, score: 0, issues: [], recommendation: "", confidence: 0 };

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
          const systemObservation = this.systemSituationBuilder.build();
          // Augment with previousRunContext if available
          if (currentInput.previousRunContext) {
            systemObservation.eventFlowRefs = currentInput.previousRunContext.eventFlowRefs ?? [];
            systemObservation.goalDecompositionRef = currentInput.previousRunContext.goalDecompositionRef;
            systemObservation.memoryRefs = currentInput.previousRunContext.memoryRefs ?? [];
          }
          return this.observationAggregator.aggregate(taskSituation, systemObservation);
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

        // O→A boundary: validate TaskSituation — degrade to default on failure (per §L.14)
        const observedTask: TaskSituation = (() => {
          const result = validateTaskSituation(taskObservation.task);
          if (result.ok) return result.value;
          this.boundaryLogger.warn("[boundary:O→A] TaskSituation validation failed — degrading to default", {
            data: { taskId: currentInput.taskId, boundary: "O→A" },
          });
          return {
            taskId: currentInput.taskId,
            domainId: currentInput.workflow.workflow.divisionId,
            timestamp: Date.now(),
            objective: currentInput.objective,
            currentPhase: "planning",
            userIntent: { raw: currentInput.objective, normalized: currentInput.objective, confidence: 0.75 },
            blockers: [],
            codebaseSnapshot: { rootPath: ".", fileCount: 0, relevantFiles: [] },
            environmentContext: { nodeVersion: process.version, platform: process.platform, workingDirectory: process.cwd(), availableTools: [] },
            historicalContext: { previousTaskIds: [], relatedMemoryRefs: [], lastExecutionOutcome: undefined },
            relevantMemory: [],
            fileRefs: currentInput.fileRefs ?? [],
            metrics: {},
          };
        })();

        const assessment = await this.runStage<UnifiedAssessment>("assess", () => this.assessment.assess({
          taskSituation: observedTask,
          constraintPack: currentInput.constraintPack,
          effectivePolicySnapshot: currentInput.constraintPack == null
            ? undefined
            : {
                snapshotId: `policy_snapshot:${currentInput.taskId}:${this.loopIteration}`,
                requiredApprovalLevel: currentInput.constraintPack.approvalMode === "required"
                  ? "admin"
                  : currentInput.constraintPack.approvalMode === "supervised"
                    ? "user"
                    : "none",
                blockedTools: [],
                forcedExecutionMode: currentInput.constraintPack.autonomyMode === "suggestion"
                  ? "manual"
                  : currentInput.constraintPack.autonomyMode === "supervised"
                    ? "supervised"
                    : undefined,
              },
        }), {
          taskId: currentInput.taskId,
        });
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

        // A→P boundary: validate UnifiedAssessment — default to fallback on failure (per §L.14)
        const validatedAssessment: UnifiedAssessment = (() => {
          const result = validateUnifiedAssessment(assessment);
          if (result.ok) return result.value;
          this.boundaryLogger.warn("[boundary:A→P] UnifiedAssessment validation failed — using default", {
            data: { taskId: currentInput.taskId, boundary: "A→P" },
          });
          return {
            taskId: currentInput.taskId,
            timestamp: Date.now(),
            situationRef: `assessment:${currentInput.taskId}:fallback`,
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

        // R5-1: Plan stage now produces PlanGraphBundle with graph nodes/edges structure
        const plan = await this.runStage<Plan>("plan", () => this.planBuilder.build({
          observation: observedTask,
          assessment: validatedAssessment,
          workflow: currentInput.workflow,
        }), {
          taskId: currentInput.taskId,
        });
        timeline.record("plan", "completed", plan.planId, null, "Built an execution plan from validated observation, assessment, and workflow inputs.");

        // R5-1: Convert Plan to PlanGraphBundle
        planGraphBundle = createPlanGraphBundle({
          harnessRunId: `oapeflir_run_${currentInput.taskId}`,
          graph: {
            graphId: plan.planId,
            nodes: plan.steps.map((step, idx) => ({
              nodeId: step.stepId,
              nodeType: "tool" as const,
              inputRefs: idx === 0 ? [] : [plan.steps[idx - 1]!.stepId],
              outputSchemaRef: `schema:step:${step.stepId}`,
              riskClass: "medium" as const,
              budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["compute"] },
              sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
              retryPolicyRef: "retry:default",
              timeoutMs: step.timeout,
            })),
            edges: plan.steps.slice(1).map((step, idx) => ({
              edgeId: `edge_${idx}`,
              fromNodeId: plan.steps[idx]!.stepId,
              toNodeId: step.stepId,
              condition: { type: "always" },
              dependencyType: "hard" as const,
            })),
            entryNodeIds: plan.steps[0] ? [plan.steps[0].stepId] : [],
            terminalNodeIds: plan.steps[plan.steps.length - 1] ? [plan.steps[plan.steps.length - 1].stepId] : [],
            joinStrategy: "all",
            graphHash: `plan_${plan.planId}_v${plan.version}`,
          },
          schedulerPolicy: { policyId: "scheduler:oapeflir.fifo", strategy: "deterministic_fifo" },
          budgetPlanRef: "budget:oapeflir.default",
          riskProfile: { riskClass: validatedAssessment.risk as "low" | "medium" | "high" | "critical", reasons: [`complexity:${validatedAssessment.complexity}`] },
          validationReport: { valid: true, findings: [] },
        });
        this.currentPlanGraphBundle = planGraphBundle;
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
              createdAt: nowIso(),
            };
            break;
          }
        }

        // R5-13: Execute with subgraph/child-run support if parentContext provided
        const stepOutputs = await this.runStage<DualChannelStepOutput[]>("execute", async () => (
          currentInput.stepOutputs ?? await this.executeViaBridge(plan, { taskId: currentInput.taskId })
        ), {
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

        const outcome = this.outcomeEvaluator.evaluate(plan, feedback);
        const qualityGate = this.qualityGate.decide(outcome);
        const replanTrigger = this.replanning.createTrigger(
          currentInput.taskId,
          qualityGate.accepted ? "planning.no_replan_required" : "planning.quality_gate_replan",
          "feedback",
          qualityGate.reasonCodes.join(","),
        );
        const replanDecision = this.replanning.decide(plan, feedback, replanTrigger);
        let rolloutRecord: RolloutRecord | null = null;

        // R5-7: Produce EvaluationReport per §45.10 (passed/score/issues[]/recommendation/confidence)
        evaluationReport = {
          passed: qualityGate.accepted,
          score: outcome.score ?? 0,
          issues: outcome.issues ?? [],
          recommendation: qualityGate.accepted ? "continue" : qualityGate.reasonCodes.join("; "),
          confidence: outcome.confidence ?? 0.5,
        };

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
              const strategyVersion = createStrategyVersion("Shadow planning guidance", validatedLearningObjects, "shadow");

              // R5-8: Release stage with EvaluationGate/approval/canary/rollback per §13.14
              const releaseResult = await this.runStage("release", () => this.rollout.startWithGating(candidate, strategyVersion, "system", {
                evaluationGate: evaluationReport,
                requireApproval: assessment.risk === "high" || assessment.risk === "critical",
                canaryPercent: 10,
                rollbackOnFailure: true,
              }), {
                taskId: currentInput.taskId,
                candidateId: candidate.candidateId,
              });
              let rawRolloutRecord = releaseResult.record;
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
        shouldContinue = false;
        // R19-03: replanDecision is authoritative — act on it regardless of loopController presence
        if (replanDecision.shouldReplan) {
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
            currentInput = {
              ...currentInput,
              stepOutputs: undefined, // Clear to re-execute
              previousRunContext: {
                previousPlanId: plan.planId,
                previousGraphVersion: this.currentPlanGraphBundle?.graphVersion,
                eventFlowRefs: [],
                goalDecompositionRef: undefined,
                memoryRefs: [],
              },
            };

            // R5-4: Record loop metrics
            if (this.loopController) {
              runtimeMetricsRegistry.recordOapeflirStageEntry("loop_iteration");
              runtimeMetricsRegistry.recordOapeflirStageExit("loop_iteration", "completed", 0);
            }
            continue;
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
          observation: taskObservation,
          assessment,
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
          graphPatch,
          harnessDecision,
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
        graphPatch,
        harnessDecision,
      };
    });
  }

  private async executeViaBridge(plan: Plan, context: ExecutionContext): Promise<DualChannelStepOutput[]> {
    const executionResult = await this.executeBridge.executePlan(plan, context);
    return this.executeBridge.toDualChannelStepOutputs(executionResult);
  }

  private async runStage<T>(
    stage: string,
    operation: () => Promise<T> | T,
    attributes: Record<string, unknown>,
  ): Promise<T> {
    const startedAt = Date.now();
    runtimeMetricsRegistry.recordOapeflirStageEntry(stage);
    try {
      const result = await startActiveSpan(`oapeflir.${stage}`, {
        tracerName: "automatic-agent-platform.oapeflir",
        attributes: {
          "aa.oapeflir.stage": stage,
          ...attributes,
        },
      }, async () => await operation());
      const durationSeconds = (Date.now() - startedAt) / 1000;
      runtimeMetricsRegistry.recordOapeflirStageExit(stage, "completed", durationSeconds);
      return result;
    } catch (error) {
      const durationSeconds = (Date.now() - startedAt) / 1000;
      runtimeMetricsRegistry.recordOapeflirStageExit(stage, "error", durationSeconds);
      throw error;
    }
  }

  private buildFeedbackSignals(taskId: string, stepOutputs: readonly DualChannelStepOutput[]): FeedbackSignal[] {
    return stepOutputs.map((output, index) => {
      // Map step status to feedback category
      const category = output.status === "succeeded"
        ? "success"
        : output.status === "failed"
          ? "failure"
          : output.status === "partial_success"
            ? "partial"
            : "correction"; // "skipped" maps to "correction"

      return {
        signalId: `signal_${index + 1}`,
        taskId,
        source: index === stepOutputs.length - 1 ? "user" : "execution",
        category,
        severity: "info",
        payload: {
          summary: output.userFacingResult.summary,
          durationMs: output.systemTelemetry.durationMs,
        },
        stepOutputRefs: [output.stepId],
        timestamp: Date.now() + index,
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
