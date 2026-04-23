export interface CapacitySample {
    readonly timestamp: string;
    readonly load: number;
    readonly capacity: number;
}
export interface CapacityPrediction {
    readonly currentLoad: number;
    readonly projectedLoad: number;
    readonly riskLevel: "low" | "medium" | "high";
    readonly headroomPercent: number;
    readonly utilizationPercent: number;
    readonly projectedUtilizationPercent: number;
    readonly confidencePercent: number;
    readonly recommendation: string;
}
export interface CapacityRiskAssessment {
    readonly riskLevel: "low" | "medium" | "high";
    readonly reasonCodes: readonly string[];
    readonly trend: CapacityTrend | null;
    readonly confidencePercent: number;
    readonly recommendedBufferPercent: number;
}
export interface CapacityTrend {
    readonly direction: "growing" | "stable" | "shrinking";
    readonly growthRatePercent: number;
    readonly averageGrowthPercent: number;
    readonly projectedCapacityExhaustionAt: string | null;
}
export interface CapacityThreshold {
    readonly warningPercent: number;
    readonly criticalPercent: number;
    readonly maxLoadPercent: number;
}
export declare function predictOpsCapacityRisk(currentLoad: number, projectedLoad: number, thresholds?: CapacityThreshold): "low" | "medium" | "high";
export declare function predictCapacityRiskWithHistory(currentLoad: number, projectedLoad: number, samples: readonly CapacitySample[], thresholds?: CapacityThreshold): "low" | "medium" | "high";
export declare function estimateCapacityHeadroom(currentLoad: number, projectedLoad: number): number;
export declare function calculateCapacityPrediction(currentLoad: number, projectedLoad: number, currentCapacity: number, projectedCapacity: number, samples?: readonly CapacitySample[]): CapacityPrediction;
export declare function projectFutureCapacity(currentLoad: number, growthRatePercent: number, periods: number): number[];
export declare class OpsCapacityPredictorService {
    private readonly thresholds;
    constructor(thresholds?: CapacityThreshold);
    assessRisk(currentLoad: number, projectedLoad: number, samples?: readonly CapacitySample[]): CapacityRiskAssessment;
    buildPrediction(currentLoad: number, projectedLoad: number, currentCapacity: number, projectedCapacity: number, samples?: readonly CapacitySample[]): CapacityPrediction & {
        readonly assessment: CapacityRiskAssessment;
    };
    private calculateConfidence;
    private calculateRecommendedBuffer;
    private buildReasonCodes;
}
