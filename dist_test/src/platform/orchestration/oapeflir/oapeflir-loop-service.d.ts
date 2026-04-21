import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import type { DualChannelStepOutput, FeedbackSignal, Plan, RolloutRecord, UnifiedAssessment } from "./types/index.js";
import { type UnifiedObservation } from "../../shared/observability/observation-aggregator.js";
import type { FeedbackBatch, LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { ExecutionOutcomeEvaluation } from "../../prompt-engine/eval/execution-outcome-evaluator.js";
import type { PostExecutionQualityGateDecision } from "../../prompt-engine/eval/post-execution-quality-gate.js";
import type { ReplanningDecision } from "../planner/replanning-service.js";
import type { LearningObject } from "./learn/learning-object-model.js";
import { type OapeflirStageRecord } from "./stage-timeline.js";
import type { AgentHandoff } from "./handoff-model.js";
import type { ExecuteBridge } from "./execute-bridge.js";
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
export declare class OapeflirLoopService {
    private readonly situationBuilder;
    private readonly systemSituationBuilder;
    private readonly observationAggregator;
    private readonly assessment;
    private readonly planBuilder;
    private readonly feedbackCollector;
    private readonly outcomeEvaluator;
    private readonly qualityGate;
    private readonly replanning;
    private readonly learning;
    private readonly knowledgePromotion;
    private readonly autonomyBoundary;
    private readonly candidateRegistry;
    private readonly rollout;
    private readonly executeBridge;
    constructor(options?: OapeflirLoopServiceOptions);
    run(input: OapeflirLoopInput): Promise<OapeflirLoopResult>;
    private executeViaBridge;
    private runStage;
    private buildFeedbackSignals;
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
    buildSerializedHandoff(result: OapeflirLoopResult, fromAgentId: string, toAgentId: string, totalMaxTokens?: number): AgentHandoff;
    /**
     * Extracts a human-readable summary string from the first feedback signal's payload.
     * Falls back to an empty string if no signals are available or the payload is malformed.
     */
    private static extractFeedbackSummary;
}
