import { type CostOptimizationRecommendation } from "./recommendation-engine/index.js";
export type CostSubjectType = "task" | "workflow" | "agent" | "model" | "domain";
export interface CostAttributionRecord {
    readonly subjectType: CostSubjectType;
    readonly subjectId: string;
    readonly costType: "model" | "tool" | "storage" | "runtime" | "network";
    readonly amountUsd: number;
    readonly decisionRef: string;
    readonly modelRef?: string;
    readonly capturedAt: string;
}
export interface CostSimulationScenario {
    readonly scenarioId: string;
    readonly subjectId: string;
    readonly reductionPercent: number;
}
export interface CostDashboardSlice {
    readonly generatedAt: string;
    readonly totalCostUsd: number;
    readonly bySubject: Readonly<Record<string, number>>;
    readonly recommendations: readonly CostOptimizationRecommendation[];
    readonly unsourcedRecordCount: number;
}
export interface CostSimulationResult {
    readonly scenarioId: string;
    readonly subjectId: string;
    readonly currentCostUsd: number;
    readonly simulatedCostUsd: number;
    readonly deltaUsd: number;
}
export declare class CostOptimizationService {
    private readonly records;
    private unsourcedRecordCount;
    recordCost(record: CostAttributionRecord): CostAttributionRecord;
    aggregate(subjectType?: CostSubjectType): Record<string, number>;
    buildRecommendations(subjectType?: CostSubjectType): CostOptimizationRecommendation[];
    simulate(scenarios: readonly CostSimulationScenario[]): CostSimulationResult[];
    buildDashboardSlice(generatedAt?: string): CostDashboardSlice;
    listRecords(): CostAttributionRecord[];
    private riskLevelForSubject;
}
