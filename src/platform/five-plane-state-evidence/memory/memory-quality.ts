import type { MemoryLayer, MemoryRecord, MemorySourceTrustLevel } from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";

export type MemoryState = "active" | "expired" | "revoked";

export interface MemoryRecallQuery {
  taskId?: string;
  sessionId?: string;
  agentId?: string;
  executionId?: string;
  /** §9.1: Tenant ID for multi-tenant query-level isolation */
  tenantId?: string;
  scopes?: string[];
  memoryLayers?: MemoryLayer[];
  classifications?: string[];
  sourceTrustLevels?: MemorySourceTrustLevel[];
  includeExpired?: boolean;
  includeRevoked?: boolean;
  minQualityScore?: number;
  limit?: number;
  evaluatedAt?: string;
}

export interface MemoryQualityBreakdownItem {
  key: string;
  totalCount: number;
  activeCount: number;
}

export interface MemoryQualityReport {
  generatedAt: string;
  totalCount: number;
  activeCount: number;
  expiredCount: number;
  revokedCount: number;
  recalledCount: number;
  neverRecalledCount: number;
  averageQualityScore: number | null;
  byScope: MemoryQualityBreakdownItem[];
  byLayer: MemoryQualityBreakdownItem[];
  byClassification: MemoryQualityBreakdownItem[];
}

export function getMemoryState(record: MemoryRecord, evaluatedAt: string = nowIso()): MemoryState {
  if (record.revokedAt != null && record.revokedAt <= evaluatedAt) {
    return "revoked";
  }
  if (record.expiresAt != null && record.expiresAt <= evaluatedAt) {
    return "expired";
  }
  return "active";
}

export function matchesMemoryRecallQuery(record: MemoryRecord, query: MemoryRecallQuery): boolean {
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
  // §9.1: Tenant isolation - memory records must have matching tenantId for multi-tenant security
  // Memory records store tenantId in their content JSON, so we check during recall
  // The memory service's recall() passes tenantId through for query-level isolation
  if (query.tenantId != null) {
    // Check if contentJson contains the tenantId (memories are tenant-scoped)
    if (typeof record.contentJson === "string") {
      try {
        const parsed = JSON.parse(record.contentJson);
        if (parsed.tenantId !== query.tenantId) {
          return false;
        }
      } catch {
        // If parsing fails, check can't be performed - fail secure by returning false
        return false;
      }
    } else if (typeof record.contentJson === "object" && record.contentJson !== null) {
      if ((record.contentJson as Record<string, unknown>).tenantId !== query.tenantId) {
        return false;
      }
    }
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
  if (
    query.sourceTrustLevels != null &&
    query.sourceTrustLevels.length > 0 &&
    !query.sourceTrustLevels.includes(record.sourceTrustLevel)
  ) {
    return false;
  }
  if (query.minQualityScore != null && (record.qualityScore == null || record.qualityScore < query.minQualityScore)) {
    return false;
  }
  return true;
}

export function filterAndSortMemories(records: MemoryRecord[], query: MemoryRecallQuery = {}): MemoryRecord[] {
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

function buildBreakdown(
  records: MemoryRecord[],
  keySelector: (record: MemoryRecord) => string,
  evaluatedAt: string,
): MemoryQualityBreakdownItem[] {
  const breakdown = new Map<string, MemoryQualityBreakdownItem>();
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

export function buildMemoryQualityReport(
  records: MemoryRecord[],
  evaluatedAt: string = nowIso(),
): MemoryQualityReport {
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
    } else if (state === "expired") {
      expiredCount += 1;
    } else {
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
