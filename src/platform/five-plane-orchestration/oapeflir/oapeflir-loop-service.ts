import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import type { ConstraintPack, HarnessDecision } from "../harness/index.js";
import { createPlanGraphBundle, createGraphPatch, type GraphPatch, type PlanGraphBundle, type JsonValue } from "../../contracts/executable-contracts/index.js";
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
import { PlanBuilder } from "../planner/plan-builder.js";
import { FeedbackCollector } from "../../../scale-ecosystem/feedback-loop/collector/feedback-collector.js";
import type { FeedbackBatch, LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { ExecutionOutcomeEvaluator, type ExecutionOutcomeEvaluation, type EvaluationReport } from "../../prompt-engine/eval/execution-outcome-evaluator.js";
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
  evaluationReport: EvaluationReport;
  qualityGate: PostExecutionQualityGateDecision;
  replanDecision: ReplanningDecision;
  graphPatch: GraphPatch | null;
  harnessDecision: HarnessDecision | null;
}

export interface EvaluationReport {
  verdict: "accept" | "replan" | "retry" | "escalate";
  score: number;
  evidenceRefs: readonly string[];
  notes?: string;
}

export interface OapeflirLoopServiceOptions {
  /** Execute bridge for the OAPEFLIR execute phase. */
  executeBridge?: ExecuteBridge;
  /** Path to the SQLite database (required for RuntimeExecuteBridge). */
  dbPath?: string;
  /** Event publisher for emitting OAPEFLIR lifecycle events. */
  eventPublisher?: import("../../state-evidence/events/typed-event-publisher.js").TypedEventPublisher | null;
}

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

  constructor(options: OapeflirLoopServiceOptions = {}) {
    if (options.executeBridge) {
      this.executeBridge = options.executeBridge;
    } else if (options.dbPath) {
      this.executeBridge = new RuntimeExecuteBridge(options.dbPath);
    } else {
      this.executeBridge = new MockExecuteBridge();
    }
    // G7: Wire eventPublisher to KnowledgePromotionService for learning:knowledge_promoted events
    this.knowledgePromotion = new KnowledgePromotionService({
      eventPublisher: options.eventPublisher ?? null,
    });
  }

  public async run(input: OapeflirLoopInput): Promise<OapeflirLoopResult> {
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
          data: { taskId: input.taskId, reasonCode: observeTransition.reasonCode },
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
        this.observationAggregator.createEmptyEventFlowSituation(),
        this.observationAggregator.createEmptyGoalDecompositionSituation(),
        this.observationAggregator.createEmptyMemorySituation(),
      );
      }, {
        taskId: input.taskId,
        workflowStepCount: input.workflow.executionSteps.length,
      });
      timeline.record("observe", "completed", taskObservation.task.taskId, null, "Aggregated task and system observations for downstream assessment.");
      fsm.recordStageCompletion("observe");

      // R5-3: Assess stage transition check
      const assessTransition = fsm.canTransitionTo("assess");
      if (!assessTransition.allowed) {
        this.boundaryLogger.error("[fsm:assess] Stage transition not allowed", {
          data: { taskId: input.taskId, reasonCode: assessTransition.reasonCode },
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
          userIntent: { raw: input.objective, normalized: input.objective, confidence: 0.5 },
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
      const riskAssessment = assessResult.riskAssessment;
      timeline.record("assess", "completed", assessment.situationRef, null, assessment.routingDecision.rationale);
      fsm.recordStageCompletion("assess");

      // R5-3: Plan stage transition check
      const planTransition = fsm.canTransitionTo("plan");
      if (!planTransition.allowed) {
        this.boundaryLogger.error("[fsm:plan] Stage transition not allowed", {
          data: { taskId: input.taskId, reasonCode: planTransition.reasonCode },
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

      // R5-2: Initial plan build
      loopPlan = await this.runStage<Plan>("plan", () => this.planBuilder.build({
        observation: observedTask,
        assessment: validatedAssessment,
        workflow: input.workflow,
      }), {
        taskId: input.taskId,
      });
      timeline.record("plan", "completed", loopPlan.planId, null, "Built an execution plan from validated observation, assessment, and workflow inputs.");
      fsm.recordStageCompletion("plan");

      // P→E boundary: validate Plan DTO — abort on failure (per §L.14)
      const planValidation = validatePlan(loopPlan);
      if (!planValidation.ok) {
        throw planValidation.error;
      }

      // R5-2: Main loop — execute until no replan needed and quality gate passes
      while (true) {
        // R5-1: Build PlanGraphBundle from Plan
        loopPlanGraphBundle = this.buildPlanGraphBundle(loopPlan, input.taskId, input.workflow.executionSteps.length);

        // R5-3: Execute stage transition check
        const executeTransition = fsm.canTransitionTo("execute");
        if (!executeTransition.allowed) {
          this.boundaryLogger.error("[fsm:execute] Stage transition not allowed", {
            data: { taskId: input.taskId, reasonCode: executeTransition.reasonCode },
          });
          throw new Error(`FSM transition denied: execute - ${executeTransition.reasonCode}`);
        }
        fsm.recordStageEntry("execute");

        loopStepOutputs = await this.runStage<DualChannelStepOutput[]>("execute", async () => (
          input.stepOutputs ?? await this.executeViaBridge(loopPlan, { taskId: input.taskId })
        ), {
          taskId: input.taskId,
          planId: loopPlan.planId,
        });
        timeline.record("execute", "completed", loopStepOutputs[loopStepOutputs.length - 1]?.stepId ?? loopPlan.planId, null, "Executed the plan or consumed supplied step outputs for the task.");
        fsm.recordStageCompletion("execute");

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
            data: { taskId: input.taskId, reasonCode: feedbackTransition.reasonCode },
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

        // R5-2: Compute quality gate and replan decision after each feedback collection
        loopOutcome = this.outcomeEvaluator.evaluateWithBreakdown(loopPlan, loopFeedback) as ExecutionOutcomeEvaluation;
        loopQualityGate = this.qualityGate.decide(loopOutcome);
        loopReplanTrigger = this.replanning.createTrigger(
          input.taskId,
          loopQualityGate.accepted ? "planning.no_replan_required" : "planning.quality_gate_replan",
          "feedback",
          loopQualityGate.reasonCodes.join(","),
        );
        loopReplanDecision = this.replanning.decide(loopPlan, loopFeedback, loopReplanTrigger);

        // R5-7: Build EvaluationReport from ExecutionOutcomeEvaluation
        loopEvaluationReport = {
          verdict: loopQualityGate.accepted ? "accept" : loopOutcome.nextAction === "replan" ? "replan" : loopOutcome.nextAction === "retry" ? "retry" : "escalate",
          score: loopOutcome.qualityScore,
          evidenceRefs: loopOutcome.reasons,
          notes: loopOutcome.reasons.join("; "),
        };

        // R5-12: Build GraphPatch if replan is needed
        loopGraphPatch = loopReplanDecision.shouldReplan ? this.buildGraphPatch(loopPlan, loopPlan.version + 1) : null;

        // R5-2: Exit loop if no replan needed and quality gate passed
        if (!loopReplanDecision.shouldReplan && loopQualityGate.accepted) {
          break;
        }

        // R5-2: Re-enter at Plan stage — record replan and rebuild plan
        fsm.resetToStage("plan");

        const replanTransition = fsm.canTransitionTo("plan");
        if (!replanTransition.allowed) {
          this.boundaryLogger.error("[fsm:replan] Stage transition not allowed", {
            data: { taskId: input.taskId, reasonCode: replanTransition.reasonCode },
          });
          throw new Error(`FSM transition denied: replan - ${replanTransition.reasonCode}`);
        }
        fsm.recordStageEntry("plan");

        loopPlan = await this.runStage<Plan>("plan", () => this.planBuilder.build({
          observation: observedTask,
          assessment: validatedAssessment,
          workflow: input.workflow,
        }), {
          taskId: input.taskId,
        });
        timeline.record("plan", "completed", loopPlan.planId, null, "Re-built execution plan from validated observation, assessment, and workflow inputs.");
        fsm.recordStageCompletion("plan");

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
          data: { taskId: input.taskId, reasonCode: learnTransition.reasonCode },
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
      } else {
        fsm.recordStageSkipped("learn", "learning.no_objects");
      }

      // G7: Promote validated learning objects into the knowledge plane
      if (learningObjects.length > 0) {
        this.knowledgePromotion.promote(learningObjects, input.taskId);
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
          fsm.recordStageEntry("release");
          fsm.recordStageSkipped("release", "release.improve_skipped");
        } else {
          // R5-3: Improve stage transition check
          const improveTransition = fsm.canTransitionTo("improve");
          if (!improveTransition.allowed) {
            this.boundaryLogger.error("[fsm:improve] Stage transition not allowed", {
              data: { taskId: input.taskId, reasonCode: improveTransition.reasonCode },
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
          const approved = this.candidateRegistry.updateStatus(candidate.candidateId, "approved") ?? candidate;
          timeline.record("improve", "completed", approved.candidateId, null, "Registered and approved an improvement candidate for shadow rollout.");
          fsm.recordStageCompletion("improve");

          // R5-3: Release stage transition check
          const releaseTransition = fsm.canTransitionTo("release");
          if (!releaseTransition.allowed) {
            this.boundaryLogger.error("[fsm:release] Stage transition not allowed", {
              data: { taskId: input.taskId, reasonCode: releaseTransition.reasonCode },
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
                rolloutRecord = null;
              } else {
                const strategyVersion = createStrategyVersion("Shadow planning guidance", validatedLearningObjects, "shadow");
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
                } else {
                  fsm.recordStageSkipped("release", "release.validation_failed");
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
          fsm.recordStageSkipped("release", "release.improve_blocked");
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
        fsm.recordStageEntry("release");
        fsm.recordStageSkipped("release", "release.no_candidate");
      }

      // R5-4: Integrate HarnessLoopController for loop control decisions
      const harnessDecision = await this.runStage<HarnessDecision | null>("harness_decide", async () => {
        const defaultConstraintPack: ConstraintPack = {
          policyIds: [],
          approvalMode: "none",
          autonomyMode: "full_auto",
          tool_policy: { allowedTools: [] },
          sandboxRequirement: { sandboxMode: "none", timeoutMs: 300000 },
          approvalRequirement: { requiredForRiskClass: [], approverRoles: [], escalationTimeoutMs: 60000 },
        };
        const controller = new HarnessLoopController(defaultConstraintPack, {}, { startedAt: Date.now() });

        // R5-4: Evaluate loop progress using controller
        const loopProgress = controller.evaluateProgress(
          loopReplanDecision.shouldReplan ? "replan" : "accept",
          true,
        );

        // R5-4: Create HarnessDecision based on loop state
        if (loopProgress.violation !== null) {
          return {
            decisionId: newId("harness_decision"),
            harnessDecisionId: newId("harness_decision"),
            action: "abort" as const,
            reasonCodes: [loopProgress.violation, ...loopProgress.reasonCodes],
            confidence: 0,
            createdAt: nowIso(),
          };
        }

        return {
          decisionId: newId("harness_decision"),
          harnessDecisionId: newId("harness_decision"),
          action: loopReplanDecision.shouldReplan ? "replan" : "accept",
          reasonCodes: loopReplanDecision.shouldReplan
            ? ["oapeflir.replan_decision", "harness.loop_continue"]
            : ["oapeflir.accept_decision", "harness.loop_continue"],
          confidence: 0.95,
          createdAt: nowIso(),
        };
      }, {
        taskId: input.taskId,
        shouldReplan: loopReplanDecision.shouldReplan,
      });

      return {
        observation: taskObservation,
        assessment,
        plan: loopPlan,
        planGraphBundle: loopPlanGraphBundle,
        stepOutputs: loopStepOutputs,
        feedback: loopFeedback,
        learningSignals,
        learningObjects,
        rolloutRecord,
        timeline: timeline.build(),
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
    return stepOutputs.map((output, index) => ({
      signalId: `signal_${index + 1}`,
      taskId,
      source: index === stepOutputs.length - 1 ? "user" : "execution",
      category: "success",
      severity: "info",
      payload: {
        summary: output.userFacingResult.summary,
        durationMs: output.systemTelemetry.durationMs,
      },
      stepOutputRefs: [output.stepId],
      timestamp: Date.now() + index,
    }));
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

  /**
   * R5-1: Builds a PlanGraphBundle from a Plan per §13.7 "Plan must be Graph"
   */
  private buildPlanGraphBundle(plan: Plan, taskId: string, stepCount: number): PlanGraphBundle {
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

  /**
   * R5-12: Builds a GraphPatch from a Plan for replanning per §13.13
   */
  private buildGraphPatch(basePlan: Plan, newVersion: number): GraphPatch {
    const operations = basePlan.steps.map((step) => {
      const payload: Record<string, JsonValue> = {
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
      harnessRunId: `harness:${basePlan.taskId}`,
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
}
