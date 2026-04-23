const DEFAULT_THRESHOLDS = {
    warningPercent: 70,
    criticalPercent: 85,
    maxLoadPercent: 95,
};
function calculateGrowthRate(earlier, later) {
    if (earlier.load === 0)
        return 0;
    return ((later.load - earlier.load) / earlier.load) * 100;
}
function analyzeTrend(samples) {
    if (samples.length < 2)
        return null;
    const sorted = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const overallGrowthRate = calculateGrowthRate(earliest, latest);
    let totalGrowthRate = 0;
    for (let i = 1; i < sorted.length; i++) {
        totalGrowthRate += calculateGrowthRate(sorted[i - 1], sorted[i]);
    }
    const averageGrowthRate = sorted.length > 1 ? totalGrowthRate / (sorted.length - 1) : 0;
    let direction;
    if (averageGrowthRate > 5) {
        direction = "growing";
    }
    else if (averageGrowthRate < -5) {
        direction = "shrinking";
    }
    else {
        direction = "stable";
    }
    let projectedCapacityExhaustionAt = null;
    if (direction === "growing" && latest.capacity > 0) {
        const utilizationRate = latest.load / latest.capacity;
        if (utilizationRate < 1) {
            const remainingCapacity = latest.capacity - latest.load;
            const growthPerSample = (latest.load - earliest.load) / (sorted.length - 1);
            if (growthPerSample > 0) {
                const samplesToExhaustion = remainingCapacity / growthPerSample;
                const exhaustionTimestamp = new Date(latest.timestamp);
                exhaustionTimestamp.setMilliseconds(exhaustionTimestamp.getMilliseconds() + samplesToExhaustion * 1000);
                projectedCapacityExhaustionAt = exhaustionTimestamp.toISOString();
            }
        }
    }
    return {
        direction,
        growthRatePercent: Number(overallGrowthRate.toFixed(2)),
        averageGrowthPercent: Number((averageGrowthRate / (sorted.length - 1)).toFixed(2)),
        projectedCapacityExhaustionAt,
    };
}
export function predictOpsCapacityRisk(currentLoad, projectedLoad, thresholds = DEFAULT_THRESHOLDS) {
    // Ratio of projected load to current load - measures load multiplier
    const ratio = currentLoad === 0 ? projectedLoad : projectedLoad / currentLoad;
    if (ratio >= 2)
        return "high";
    if (ratio >= 1.2)
        return "medium";
    return "low";
}
export function predictCapacityRiskWithHistory(currentLoad, projectedLoad, samples, thresholds = DEFAULT_THRESHOLDS) {
    const baseRisk = predictOpsCapacityRisk(currentLoad, projectedLoad, thresholds);
    const trend = analyzeTrend(samples);
    if (!trend)
        return baseRisk;
    if (trend.direction === "growing" && trend.growthRatePercent > 20) {
        return baseRisk === "low" ? "medium" : "high";
    }
    if (trend.direction === "shrinking") {
        return baseRisk === "high" ? "medium" : "low";
    }
    return baseRisk;
}
export function estimateCapacityHeadroom(currentLoad, projectedLoad) {
    if (projectedLoad <= 0) {
        return 0;
    }
    return Number((((projectedLoad - currentLoad) / projectedLoad) * 100).toFixed(2));
}
export function calculateCapacityPrediction(currentLoad, projectedLoad, currentCapacity, projectedCapacity, samples) {
    const headroomPercent = currentCapacity > 0
        ? Number((((currentCapacity - currentLoad) / currentCapacity) * 100).toFixed(2))
        : 0;
    const utilizationPercent = currentCapacity > 0
        ? Number(((currentLoad / currentCapacity) * 100).toFixed(2))
        : 0;
    const projectedUtilizationPercent = projectedCapacity > 0
        ? Number(((projectedLoad / projectedCapacity) * 100).toFixed(2))
        : 0;
    let confidencePercent = 50;
    if (samples) {
        if (samples.length >= 10)
            confidencePercent = 90;
        else if (samples.length >= 5)
            confidencePercent = 75;
        else if (samples.length >= 3)
            confidencePercent = 60;
    }
    let recommendation;
    if (utilizationPercent >= DEFAULT_THRESHOLDS.criticalPercent) {
        recommendation = "CRITICAL: Immediate scaling required";
    }
    else if (utilizationPercent >= DEFAULT_THRESHOLDS.warningPercent) {
        recommendation = "WARNING: Plan for scaling soon";
    }
    else if (projectedUtilizationPercent > utilizationPercent + 20) {
        recommendation = "INFO: Monitor growth trend";
    }
    else {
        recommendation = "OK: Capacity is sufficient";
    }
    const riskLevel = predictOpsCapacityRisk(currentLoad, projectedLoad);
    return {
        currentLoad,
        projectedLoad,
        riskLevel,
        headroomPercent,
        utilizationPercent,
        projectedUtilizationPercent,
        confidencePercent,
        recommendation,
    };
}
export function projectFutureCapacity(currentLoad, growthRatePercent, periods) {
    const projections = [];
    let load = currentLoad;
    for (let i = 0; i < periods; i++) {
        load = load * (1 + growthRatePercent / 100);
        projections.push(Number(load.toFixed(2)));
    }
    return projections;
}
export class OpsCapacityPredictorService {
    thresholds;
    constructor(thresholds = DEFAULT_THRESHOLDS) {
        this.thresholds = thresholds;
    }
    assessRisk(currentLoad, projectedLoad, samples = []) {
        const trend = analyzeTrend(samples);
        const riskLevel = predictCapacityRiskWithHistory(currentLoad, projectedLoad, samples, this.thresholds);
        const reasonCodes = this.buildReasonCodes(currentLoad, projectedLoad, trend, riskLevel);
        return {
            riskLevel,
            reasonCodes,
            trend,
            confidencePercent: this.calculateConfidence(samples, trend),
            recommendedBufferPercent: this.calculateRecommendedBuffer(riskLevel, trend),
        };
    }
    buildPrediction(currentLoad, projectedLoad, currentCapacity, projectedCapacity, samples = []) {
        const prediction = calculateCapacityPrediction(currentLoad, projectedLoad, currentCapacity, projectedCapacity, samples);
        const assessment = this.assessRisk(currentLoad, projectedLoad, samples);
        return {
            ...prediction,
            riskLevel: assessment.riskLevel,
            assessment,
        };
    }
    calculateConfidence(samples, trend) {
        if (samples.length >= 10 && trend != null) {
            return 92;
        }
        if (samples.length >= 5) {
            return 80;
        }
        if (samples.length >= 3) {
            return 65;
        }
        return 50;
    }
    calculateRecommendedBuffer(riskLevel, trend) {
        const base = riskLevel === "high" ? 30 : riskLevel === "medium" ? 20 : 10;
        if (trend?.direction === "growing") {
            return base + 5;
        }
        if (trend?.direction === "shrinking") {
            return Math.max(5, base - 5);
        }
        return base;
    }
    buildReasonCodes(currentLoad, projectedLoad, trend, riskLevel) {
        const ratio = currentLoad === 0 ? projectedLoad : projectedLoad / currentLoad;
        const reasonCodes = [`capacity.risk.${riskLevel}`];
        if (ratio >= 2) {
            reasonCodes.push("capacity.projected_ratio.ge_2x");
        }
        else if (ratio >= 1.2) {
            reasonCodes.push("capacity.projected_ratio.ge_1_2x");
        }
        if (trend?.direction === "growing") {
            reasonCodes.push("capacity.trend.growing");
        }
        if (trend?.projectedCapacityExhaustionAt != null) {
            reasonCodes.push("capacity.exhaustion.predicted");
        }
        return reasonCodes;
    }
}
//# sourceMappingURL=index.js.map