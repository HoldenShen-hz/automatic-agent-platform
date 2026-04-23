export function forecastCapacityUsage(currentUsage, growthRatePercent, periods) {
    const result = [];
    let usage = currentUsage;
    for (let index = 0; index < periods; index += 1) {
        usage = Number((usage * (1 + growthRatePercent / 100)).toFixed(2));
        result.push(usage);
    }
    return result;
}
export function forecastCapacityPeak(currentUsage, growthRatePercent, periods) {
    return Math.max(...forecastCapacityUsage(currentUsage, growthRatePercent, periods), currentUsage);
}
export class CapacityForecasterService {
    forecast(currentUsage, growthRatePercent, periods) {
        const projectedUsage = forecastCapacityUsage(currentUsage, growthRatePercent, periods);
        return {
            projectedUsage,
            peak: forecastCapacityPeak(currentUsage, growthRatePercent, periods),
        };
    }
}
//# sourceMappingURL=index.js.map