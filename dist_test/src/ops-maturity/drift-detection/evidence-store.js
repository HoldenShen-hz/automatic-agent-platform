/**
 * Evidence Store
 *
 * Stores task execution evidence including traces, failures, and successes.
 * Serves as the input source for the Reflection Engine.
 */
export class InMemoryEvidenceStore {
    records = [];
    async append(record) {
        this.records.push(record);
    }
    async getById(id) {
        return this.records.find((r) => r.id === id) ?? null;
    }
    async listByTaskType(taskType, limit = 100) {
        return this.records.filter((r) => r.taskType === taskType).slice(-limit);
    }
    async listFailures(taskType, limit = 100) {
        const filtered = taskType
            ? this.records.filter((r) => !r.success && r.taskType === taskType)
            : this.records.filter((r) => !r.success);
        return filtered.slice(-limit);
    }
    async listSuccesses(taskType, limit = 100) {
        const filtered = taskType
            ? this.records.filter((r) => r.success && r.taskType === taskType)
            : this.records.filter((r) => r.success);
        return filtered.slice(-limit);
    }
    async getRecent(limit = 100) {
        return this.records.slice(-limit);
    }
    async getStatistics() {
        const totalRecords = this.records.length;
        const successCount = this.records.filter((r) => r.success).length;
        const failureCount = totalRecords - successCount;
        const avgCost = totalRecords > 0
            ? this.records.reduce((sum, r) => sum + r.costUsd, 0) / totalRecords
            : 0;
        const avgLatency = totalRecords > 0
            ? this.records.reduce((sum, r) => sum + r.latencyMs, 0) / totalRecords
            : 0;
        const byTaskType = {};
        for (const record of this.records) {
            const taskStats = byTaskType[record.taskType];
            if (!taskStats) {
                byTaskType[record.taskType] = { count: 1, successCount: record.success ? 1 : 0, successRate: 0 };
            }
            else {
                taskStats.count++;
                if (record.success) {
                    taskStats.successCount++;
                }
            }
        }
        for (const taskType of Object.keys(byTaskType)) {
            const stats = byTaskType[taskType];
            stats.successRate = stats.count > 0 ? stats.successCount / stats.count : 0;
        }
        return {
            totalRecords,
            successCount,
            failureCount,
            averageCostUsd: avgCost,
            averageLatencyMs: avgLatency,
            byTaskType,
        };
    }
}
//# sourceMappingURL=evidence-store.js.map