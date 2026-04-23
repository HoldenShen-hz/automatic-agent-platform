export declare function analyzeCapacityTrend(samples: readonly number[]): {
    readonly average: number;
    readonly direction: "up" | "down" | "flat";
};
export declare function estimateCapacityVolatility(samples: readonly number[]): number;
export interface CapacityTrendAnalysis {
    readonly average: number;
    readonly direction: "up" | "down" | "flat";
    readonly volatility: number;
    readonly confidencePercent: number;
}
export declare class CapacityTrendAnalyzerService {
    analyze(samples: readonly number[]): CapacityTrendAnalysis;
}
