export function forecastCapacityUsage(currentUsage, growthRatePercent, periods) {
    const result = [];
    let usage = currentUsage;
    for (let index = 0; index < periods; index += 1) {
        usage = Number((usage * (1 + growthRatePercent / 100)).toFixed(2));
        result.push(usage);
    }
    return result;
}
//# sourceMappingURL=index.js.map