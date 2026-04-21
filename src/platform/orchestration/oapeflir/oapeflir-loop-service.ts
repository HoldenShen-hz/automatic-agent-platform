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

export interface OapeflirLoopInput {
  taskId: string;
  objective: string;
  workflow: PlannedWorkflow;
  feedbackSignals?: FeedbackSignal[];
  blockerSummaries?: string[];
  fileRefs?: string[];
  stepOutputs?: DualChannelStepOutput[];
}

export interface OapeflirLoopResult {
  observation: UnifiedObservation;
  assessment: UnifiedAssessment;
  plan: Plan;
  stepOutputs: DualChannelStepOutput[];
  feedback: FeedbackBatch;
  learningSignals: LearningSignal[];
  learningObjects: LearningObject[];
  rolloutRecord: RolloutRecord | null;
  timeline: OapeflirStageRecord[];
  outcome: ExecutionOutcomeEvaluation;
  qualityGate: PostExecutionQualityGateDecision;
  replanDecision: ReplanningDecision;
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
        return this.observationAggregator.aggregate(taskSituation, systemObservation);
      }, {
        taskId: input.taskId,
        workflowStepCount: input.workflow.executionSteps.length,
      });
      timeline.record("observe", "completed", taskObservation.task.taskId, null, "Aggregated task and system observations for downstream assessment.");

      // O→A boundary: validate TaskSituation — degrade to default on failure (per §L.14)
      const observedTask: TaskSituation = (() => {
        const result = validateTaskSituation(taskObservation.task);
        if (result.ok) return result.value;
        console.warn("[boundary:O→A] TaskSituation validation failed — degrading to default");
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

      const assessment = await this.runStage<UnifiedAssessment>("assess", () => this.assessment.assess(observedTask), {
        taskId: input.taskId,
      });
      timeline.record("assess", "completed", assessment.situationRef, null, assessment.routingDecision.rationale);

      // A→P boundary: validate UnifiedAssessment — default to fallback on failure (per §L.14)
      const validatedAssessment: UnifiedAssessment = (() => {
        const result = validateUnifiedAssessment(assessment);
        if (result.ok) return result.value;
        console.warn("[boundary:A→P] UnifiedAssessment validation failed — using default");
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

      const plan = await this.runStage<Plan>("plan", () => this.planBuilder.build({
        observation: observedTask,
        assessment: validatedAssessment,
        workflow: input.workflow,
      }), {
        taskId: input.taskId,
      });
      timeline.record("plan", "completed", plan.planId, null, "Built an execution plan from validated observation, assessment, and workflow inputs.");

      // P→E boundary: validate Plan DTO — abort on failure (per §L.14)
      const planValidation = validatePlan(plan);
      if (!planValidation.ok) {
        throw planValidation.error;
      }

      const stepOutputs = await this.runStage<DualChannelStepOutput[]>("execute", async () => (
        input.stepOutputs ?? await this.executeViaBridge(plan, { taskId: input.taskId })
      ), {
        taskId: input.taskId,
        planId: plan.planId,
      });
      timeline.record("execute", "completed", stepOutputs[stepOutputs.length - 1]?.stepId ?? plan.planId, null, "Executed the plan or consumed supplied step outputs for the task.");

      // E→F boundary: validate step outputs and feedback signals — skip feedback on failure (per §L.14)
      const validatedStepOutputs: DualChannelStepOutput[] = (() => {
        const result = validateStepOutputs(stepOutputs);
        if (result.ok) return result.value;
        console.warn("[boundary:E→F] stepOutputs validation failed — skipping feedback stage");
        return [];
      })();

      const feedbackSignals: FeedbackSignal[] = (() => {
        const result = validateFeedbackSignals(input.feedbackSignals ?? this.buildFeedbackSignals(input.taskId, validatedStepOutputs));
        if (result.ok) return result.value;
        console.warn("[boundary:E→F] feedbackSignals validation failed — skipping feedback stage");
        return [];
      })();
      const feedback = await this.runStage<FeedbackBatch>("feedback", () => this.feedbackCollector.collect({
        taskId: input.taskId,
        planId: plan.planId,
        signals: feedbackSignals,
      }), {
        taskId: input.taskId,
        signalCount: feedbackSignals.length,
      });
      timeline.record("feedback", "completed", feedback.feedbackId, null, "Collected execution feedback signals and normalized them for learning.");

      const learningSignals: LearningSignal[] = this.feedbackCollector.toLearningSignals(feedback);
      // F→L boundary: validate learning signals — skip learn on failure (per §L.14)
      const validatedLearningSignals: LearningSignal[] = ((): LearningSignal[] => {
        const result = validateLearningSignalsArray(learningSignals);
        if (result.ok) return result.value as LearningSignal[];
        console.warn("[boundary:F→L] learningSignals validation failed — skipping learn stage");
        return [] as LearningSignal[];
      })();

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

      // G7: Promote validated learning objects into the knowledge plane
      if (learningObjects.length > 0) {
        this.knowledgePromotion.promote(learningObjects, input.taskId);
      }

      const outcome = this.outcomeEvaluator.evaluate(plan, feedback);
      const qualityGate = this.qualityGate.decide(outcome);
      const replanTrigger = this.replanning.createTrigger(
        input.taskId,
        qualityGate.accepted ? "planning.no_replan_required" : "planning.quality_gate_replan",
        "feedback",
        qualityGate.reasonCodes.join(","),
      );
      const replanDecision = this.replanning.decide(plan, feedback, replanTrigger);
      let rolloutRecord: RolloutRecord | null = null;

      if (learningObjects.length > 0) {
        // L→I boundary: validate LearningObject[] — skip improve on failure (per §L.14)
        const validatedLearningObjects: LearningObject[] = ((): LearningObject[] => {
          const result = validateLearningObjects(learningObjects);
          if (result.ok) return result.value as LearningObject[];
          console.warn("[boundary:L→I] learningObjects validation failed — skipping improve stage");
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
          const strategyVersion = createStrategyVersion("Shadow planning guidance", validatedLearningObjects, "shadow");
          let rawRolloutRecord = await this.runStage("release", () => this.rollout.start(approved, strategyVersion, "system"), {
            taskId: input.taskId,
            candidateId: approved.candidateId,
          });
          // I→R boundary: validate rollout record — skip release on failure (per §L.14)
          const rolloutValidation = validateRolloutRecord(rawRolloutRecord);
          rolloutRecord = rolloutValidation.ok ? rolloutValidation.value : null;
          if (!rolloutValidation.ok) {
            console.warn("[boundary:I→R] rolloutRecord validation failed — nulling rollout record");
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

      return {
        observation: taskObservation,
        assessment,
        plan,
        stepOutputs,
        feedback,
        learningSignals,
        learningObjects,
        rolloutRecord,
        timeline: timeline.build(),
        outcome,
        qualityGate,
        replanDecision,
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
}
