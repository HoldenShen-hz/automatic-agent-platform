import { type FeedbackAnalysisSummary } from "./analyzer/index.js";
import { type FeedbackCollectorInput } from "./collector/feedback-collector.js";
import type { FeedbackBatch, FeedbackSignal, LearningSignal } from "./collector/index.js";
export interface ImprovementCandidate {
    readonly candidateId: string;
    readonly candidateType: "prompt_tuning" | "workflow_patch" | "policy_adjustment" | "playbook_update";
    readonly sourceSignalIds: readonly string[];
    readonly proposedChange: string;
    readonly riskAssessment: "low" | "medium" | "high";
    readonly reviewStatus: "proposed" | "reviewing" | "approved" | "rejected" | "released";
}
export interface ImprovementReviewDecision {
    readonly candidateId: string;
    readonly decision: "approved" | "rejected";
    readonly reviewer: string;
    readonly reviewedAt: string;
    readonly rolloutGatePassed: boolean;
    readonly policyGatePassed: boolean;
}
export interface FeedbackLoopSnapshot {
    readonly generatedAt: string;
    readonly analysis: FeedbackAnalysisSummary;
    readonly trackingSummary: Readonly<Record<string, number>>;
    readonly candidateCount: number;
}
export declare class FeedbackImprovementService {
    private readonly collector;
    private readonly records;
    private readonly candidates;
    ingest(input: FeedbackCollectorInput): {
        feedback: FeedbackBatch;
        learningSignals: LearningSignal[];
        candidates: ImprovementCandidate[];
    };
    createCandidate(signal: LearningSignal): ImprovementCandidate;
    review(candidateId: string, reviewer: string, decision: "approved" | "rejected", options: {
        readonly rolloutGatePassed: boolean;
        readonly policyGatePassed: boolean;
        readonly reviewedAt?: string;
    }): ImprovementReviewDecision;
    release(candidateId: string, owner: string): ImprovementCandidate;
    buildSnapshot(signals: readonly FeedbackSignal[], generatedAt?: string): FeedbackLoopSnapshot;
    listCandidates(): ImprovementCandidate[];
    private mapCandidateType;
    private requireCandidate;
}
