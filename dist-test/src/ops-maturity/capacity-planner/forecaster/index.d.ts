export declare function forecastCapacityUsage(currentUsage: number, growthRatePercent: number, periods: number): number[];
export declare function forecastCapacityPeak(currentUsage: number, growthRatePercent: number, periods: number): number;
export interface ForecastSeries {
    readonly projectedUsage: readonly number[];
    readonly peak: number;
}
export declare class CapacityForecasterService {
    forecast(currentUsage: number, growthRatePercent: number, periods: number): ForecastSeries;
}
