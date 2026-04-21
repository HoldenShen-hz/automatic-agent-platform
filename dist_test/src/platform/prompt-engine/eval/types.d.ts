/**
 * Quality Gate Configuration Types
 *
 * Configuration for quality evaluation thresholds and weights.
 * Loaded from config/quality/default.json
 */
export interface QualityGateConfig {
    readonly qualityGate: {
        readonly defaultPassThreshold: number;
        readonly criticalPassThreshold: number;
        readonly enforcement: "blocking" | "warning";
    };
    readonly qualityScoreWeights: {
        readonly successSignal: number;
        readonly completionOutcome: number;
        readonly failureSignal: number;
        readonly partialSignal: number;
    };
    readonly actionThresholds: {
        readonly completeMinScore: number;
        readonly approvalRequiredScore: number;
        readonly retryMaxFailures: number;
    };
    readonly evidence: {
        readonly enabled: boolean;
        readonly artifactKind: string;
        readonly retentionDays: number;
    };
}
export interface QualityEvaluationEvidence {
    readonly evaluationId: string;
    readonly taskId: string;
    readonly executionId?: string;
    readonly qualityScore: number;
    readonly passed: boolean;
    readonly verdict: "pass" | "fail" | "degraded" | "inconclusive";
    readonly releaseStage: "released" | "repair" | "approval" | "blocked";
    readonly reasonCodes: readonly string[];
    readonly factorBreakdown: {
        readonly successSignals: number;
        readonly failureSignals: number;
        readonly partialSignals: number;
        readonly completionBonus: number;
        readonly failurePenalty: number;
        readonly partialPenalty: number;
    };
    readonly evaluatedAt: string;
    readonly configSnapshot: {
        readonly passThreshold: number;
        readonly weights: QualityGateConfig["qualityScoreWeights"];
    };
}
