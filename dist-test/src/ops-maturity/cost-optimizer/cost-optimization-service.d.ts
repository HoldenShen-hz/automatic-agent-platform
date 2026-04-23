/**
 * @fileoverview Cost Optimization Service
 *
 * Provides cost attribution, aggregation, recommendations, and simulation.
 *
 * §65 Model Right-Sizing Online Profiling Capability (P2 Enhancement for Phase 3):
 * Current implementation supports recommendation generation and simulation based on historical cost data.
 * To implement "online profiling" capability, real-time traffic analysis needs to be integrated,
 * dynamically building model usage distribution profiles, and generating right-sizing recommendations
 * based on actual traffic patterns. Currently recommendation-engine can make static recommendations
 * based on model-metadata-registry, lacking real-time traffic-driven dynamic optimization.
 */
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
export interface CostSimulationScenarioInput {
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
    simulate(scenarios: readonly CostSimulationScenarioInput[]): CostSimulationResult[];
    buildDashboardSlice(generatedAt?: string): CostDashboardSlice;
    listRecords(): CostAttributionRecord[];
    private riskLevelForSubject;
    private resolveRepresentativeModelRef;
}
