import { nowIso } from "../../platform/contracts/types/ids.js";
import { aggregateCostAttribution } from "./attribution-engine/index.js";
import { buildCostOptimizationRecommendation, } from "./recommendation-engine/index.js";
import { simulateCostOptimization } from "./simulator/index.js";
export class CostOptimizationService {
    records = [];
    unsourcedRecordCount = 0;
    recordCost(record) {
        if (record.decisionRef.trim().length === 0) {
            this.unsourcedRecordCount += 1;
            throw new Error(`cost_optimizer.unsourced_record:${record.subjectId}`);
        }
        this.records.push(record);
        return record;
    }
    aggregate(subjectType) {
        const filtered = subjectType == null
            ? this.records
            : this.records.filter((item) => item.subjectType === subjectType);
        return aggregateCostAttribution(filtered.map((item) => ({
            subjectId: item.subjectId,
            amountUsd: item.amountUsd,
        })));
    }
    buildRecommendations(subjectType) {
        return Object.entries(this.aggregate(subjectType))
            .map(([subjectId, cost]) => buildCostOptimizationRecommendation(subjectId, cost))
            .filter((item) => item != null)
            .map((item) => ({
            ...item,
            riskLevel: this.riskLevelForSubject(item.subjectId, item.riskLevel),
        }));
    }
    simulate(scenarios) {
        const aggregated = this.aggregate();
        return scenarios.map((scenario) => {
            const currentCostUsd = aggregated[scenario.subjectId] ?? 0;
            const simulatedCostUsd = simulateCostOptimization(currentCostUsd, scenario.reductionPercent);
            return {
                scenarioId: scenario.scenarioId,
                subjectId: scenario.subjectId,
                currentCostUsd,
                simulatedCostUsd,
                deltaUsd: Number((simulatedCostUsd - currentCostUsd).toFixed(2)),
            };
        });
    }
    buildDashboardSlice(generatedAt = nowIso()) {
        const bySubject = this.aggregate();
        const totalCostUsd = Number(Object.values(bySubject).reduce((sum, item) => sum + item, 0).toFixed(4));
        return {
            generatedAt,
            totalCostUsd,
            bySubject,
            recommendations: this.buildRecommendations(),
            unsourcedRecordCount: this.unsourcedRecordCount,
        };
    }
    listRecords() {
        return [...this.records];
    }
    riskLevelForSubject(subjectId, baseRisk) {
        const records = this.records.filter((item) => item.subjectId === subjectId);
        if (records.some((item) => item.subjectType === "model" && item.costType === "model")) {
            return baseRisk === "low" ? "medium" : baseRisk;
        }
        return baseRisk;
    }
}
//# sourceMappingURL=cost-optimization-service.js.map