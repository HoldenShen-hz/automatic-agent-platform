import { nowIso } from "../../contracts/types/ids.js";
export function getMemoryState(record, evaluatedAt = nowIso()) {
    if (record.revokedAt != null && record.revokedAt <= evaluatedAt) {
        return "revoked";
    }
    if (record.expiresAt != null && record.expiresAt <= evaluatedAt) {
        return "expired";
    }
    return "active";
}
export function matchesMemoryRecallQuery(record, query) {
    const evaluatedAt = query.evaluatedAt ?? nowIso();
    const state = getMemoryState(record, evaluatedAt);
    if (!query.includeRevoked && state === "revoked") {
        return false;
    }
    if (!query.includeExpired && state === "expired") {
        return false;
    }
    if (query.taskId != null && record.taskId !== query.taskId) {
        return false;
    }
    if (query.sessionId != null && record.sessionId !== query.sessionId) {
        return false;
    }
    if (query.agentId != null && record.agentId !== query.agentId) {
        return false;
    }
    if (query.executionId != null && record.executionId !== query.executionId) {
        return false;
    }
    if (query.scopes != null && query.scopes.length > 0 && !query.scopes.includes(record.scope)) {
        return false;
    }
    if (query.memoryLayers != null && query.memoryLayers.length > 0 && !query.memoryLayers.includes(record.memoryLayer)) {
        return false;
    }
    if (query.classifications != null && query.classifications.length > 0 && !query.classifications.includes(record.classification)) {
        return false;
    }
    if (query.sourceTrustLevels != null &&
        query.sourceTrustLevels.length > 0 &&
        !query.sourceTrustLevels.includes(record.sourceTrustLevel)) {
        return false;
    }
    if (query.minQualityScore != null && (record.qualityScore == null || record.qualityScore < query.minQualityScore)) {
        return false;
    }
    return true;
}
export function filterAndSortMemories(records, query = {}) {
    const filtered = records
        .filter((record) => matchesMemoryRecallQuery(record, query))
        .sort((left, right) => {
        if (left.createdAt === right.createdAt) {
            return left.id.localeCompare(right.id);
        }
        return right.createdAt.localeCompare(left.createdAt);
    });
    if (query.limit == null || query.limit <= 0) {
        return filtered;
    }
    return filtered.slice(0, query.limit);
}
function buildBreakdown(records, keySelector, evaluatedAt) {
    const breakdown = new Map();
    for (const record of records) {
        const key = keySelector(record);
        const item = breakdown.get(key) ?? {
            key,
            totalCount: 0,
            activeCount: 0,
        };
        item.totalCount += 1;
        if (getMemoryState(record, evaluatedAt) === "active") {
            item.activeCount += 1;
        }
        breakdown.set(key, item);
    }
    return Array.from(breakdown.values()).sort((left, right) => {
        if (left.totalCount === right.totalCount) {
            return left.key.localeCompare(right.key);
        }
        return right.totalCount - left.totalCount;
    });
}
export function buildMemoryQualityReport(records, evaluatedAt = nowIso()) {
    let activeCount = 0;
    let expiredCount = 0;
    let revokedCount = 0;
    let recalledCount = 0;
    let qualityScoreTotal = 0;
    let qualityScoreCount = 0;
    for (const record of records) {
        const state = getMemoryState(record, evaluatedAt);
        if (state === "active") {
            activeCount += 1;
        }
        else if (state === "expired") {
            expiredCount += 1;
        }
        else {
            revokedCount += 1;
        }
        if (record.hitCount > 0) {
            recalledCount += 1;
        }
        if (record.qualityScore != null) {
            qualityScoreTotal += record.qualityScore;
            qualityScoreCount += 1;
        }
    }
    return {
        generatedAt: evaluatedAt,
        totalCount: records.length,
        activeCount,
        expiredCount,
        revokedCount,
        recalledCount,
        neverRecalledCount: records.length - recalledCount,
        averageQualityScore: qualityScoreCount > 0 ? qualityScoreTotal / qualityScoreCount : null,
        byScope: buildBreakdown(records, (record) => record.scope, evaluatedAt),
        byLayer: buildBreakdown(records, (record) => record.memoryLayer, evaluatedAt),
        byClassification: buildBreakdown(records, (record) => record.classification, evaluatedAt),
    };
}
//# sourceMappingURL=memory-quality.js.map