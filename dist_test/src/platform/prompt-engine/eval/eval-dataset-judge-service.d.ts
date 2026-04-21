export type EvalDatasetStage = "observe" | "assess" | "plan" | "feedback";
export type EvalDatasetStatus = "draft" | "active" | "archived";
export type EvalCasePriority = "critical" | "standard";
export type QualityCriterionType = "exact_match" | "contains" | "json_schema" | "semantic_similarity" | "llm_judge" | "custom_function";
export type EvalRunPhase = "offline" | "canary";
export type EvalDatasetGateDecision = "promote" | "hold" | "rollback";
export type JudgeProfileStatus = "ready" | "cooldown" | "disabled";
export interface EvalDatasetQualityCriterion {
    criterionId: string;
    type: QualityCriterionType;
    config: Record<string, unknown>;
    weight: number;
    threshold: number;
}
export interface EvalDatasetCase {
    caseId: string;
    input: Record<string, unknown>;
    expectedOutput?: unknown;
    qualityCriteria: EvalDatasetQualityCriterion[];
    tags: string[];
    priority: EvalCasePriority;
}
export interface EvalDatasetRecord {
    datasetId: string;
    name: string;
    version: string;
    stage: EvalDatasetStage;
    cases: EvalDatasetCase[];
    createdBy: string;
    packId: string | null;
    status: EvalDatasetStatus;
    createdAt: string;
    updatedAt: string;
}
export interface JudgeProfileRecord {
    judgeId: string;
    provider: string;
    providerFamily: string;
    modelId: string;
    capabilities: string[];
    maxCostUsd: number;
    status: JudgeProfileStatus;
    createdAt: string;
    updatedAt: string;
}
export interface EvalCaseSubmission {
    caseId: string;
    output: unknown;
    latencyMs?: number;
    costUsd?: number;
    criterionSignals?: Record<string, number>;
    metadata?: Record<string, unknown>;
}
export interface EvalDatasetBaselineMetrics {
    passRate?: number;
    averageLatencyMs?: number;
    averageCostUsd?: number;
    weightedQualityScore?: number;
}
export interface EvalDatasetGatePolicy {
    minPassRate?: number;
    requireCriticalPass?: boolean;
    maxLatencyRegressionRatio?: number;
    maxCostRegressionRatio?: number;
    minQualityDelta?: number;
}
export interface EvalCriterionResult {
    criterionId: string;
    type: QualityCriterionType;
    score: number;
    passed: boolean;
    weight: number;
    threshold: number;
    reason: string;
}
export interface EvalDatasetCaseResult {
    caseId: string;
    passed: boolean;
    weightedQualityScore: number;
    priority: EvalCasePriority;
    latencyMs: number;
    costUsd: number;
    criterionResults: EvalCriterionResult[];
}
export interface EvalDatasetRunReport {
    runId: string;
    datasetId: string;
    candidateProvider: string;
    candidateModel: string;
    judgeId: string | null;
    phase: EvalRunPhase;
    gateDecision: EvalDatasetGateDecision;
    passRate: number;
    criticalPassRate: number;
    averageLatencyMs: number;
    averageCostUsd: number;
    weightedQualityScore: number;
    blockingFindings: string[];
    advisoryFindings: string[];
    caseResults: EvalDatasetCaseResult[];
    createdAt: string;
}
export type CustomCriterionEvaluator = (input: {
    criterion: EvalDatasetQualityCriterion;
    expectedOutput: unknown;
    output: unknown;
    criterionSignals: Record<string, number>;
    metadata: Record<string, unknown>;
}) => {
    score: number;
    passed?: boolean;
    reason?: string;
};
export interface EvalDatasetEvaluationInput {
    datasetId: string;
    candidateProvider: string;
    candidateProviderFamily?: string | undefined;
    candidateModel: string;
    results: readonly EvalCaseSubmission[];
    judgeId?: string | null | undefined;
    phase?: EvalRunPhase | undefined;
    baseline?: EvalDatasetBaselineMetrics | undefined;
    gatePolicy?: EvalDatasetGatePolicy | undefined;
}
export declare class EvalDatasetJudgeService {
    private readonly customEvaluators;
    private readonly datasets;
    private readonly judges;
    private readonly reports;
    constructor(customEvaluators?: Readonly<Record<string, CustomCriterionEvaluator>>);
    registerDataset(input: {
        datasetId: string;
        name: string;
        version: string;
        stage: EvalDatasetStage;
        cases: readonly EvalDatasetCase[];
        createdBy: string;
        packId?: string | null;
        status?: EvalDatasetStatus;
    }): EvalDatasetRecord;
    activateDataset(datasetId: string): EvalDatasetRecord;
    getDataset(datasetId: string): EvalDatasetRecord | null;
    listDatasets(status?: EvalDatasetStatus): EvalDatasetRecord[];
    registerJudge(input: {
        judgeId: string;
        provider: string;
        providerFamily?: string;
        modelId: string;
        capabilities?: readonly string[];
        maxCostUsd: number;
        status?: JudgeProfileStatus;
    }): JudgeProfileRecord;
    getJudge(judgeId: string): JudgeProfileRecord | null;
    suggestJudges(input: {
        candidateProvider: string;
        candidateProviderFamily?: string | undefined;
        requiredCapability?: string | undefined;
    }): JudgeProfileRecord[];
    evaluateDataset(input: EvalDatasetEvaluationInput): EvalDatasetRunReport;
    listReports(datasetId?: string): EvalDatasetRunReport[];
    private resolveJudge;
    private getDatasetOrThrow;
    private evaluateCriterion;
}
