export function analyzeCapacityTrend(samples) {
    if (samples.length === 0) {
        return { average: 0, direction: "flat" };
    }
    const average = samples.reduce((sum, item) => sum + item, 0) / samples.length;
    const direction = samples.at(-1) > samples[0] ? "up" : samples.at(-1) < samples[0] ? "down" : "flat";
    return { average: Number(average.toFixed(2)), direction };
}
//# sourceMappingURL=index.js.map