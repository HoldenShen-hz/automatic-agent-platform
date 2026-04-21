export class ChangepointDetectorService {
    detect(samples, baselineWindow = 3, recentWindow = 3) {
        const baseline = samples.slice(0, baselineWindow);
        const recent = samples.slice(-recentWindow);
        const baselineMean = average(baseline.map((sample) => sample.score));
        const recentMean = average(recent.map((sample) => sample.score));
        const absoluteShift = Math.abs(recentMean - baselineMean);
        return {
            detected: absoluteShift >= 0.15,
            baselineMean,
            recentMean,
            absoluteShift,
            reasonCode: absoluteShift >= 0.15 ? "drift.changepoint_detected" : "drift.stable",
        };
    }
}
function average(values) {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
//# sourceMappingURL=index.js.map