import type { MemoryLayer, MemoryRecord, MemorySourceTrustLevel } from "../../contracts/types/domain.js";
export type MemoryState = "active" | "expired" | "revoked";
export interface MemoryRecallQuery {
    taskId?: string;
    sessionId?: string;
    agentId?: string;
    executionId?: string;
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
export declare function getMemoryState(record: MemoryRecord, evaluatedAt?: string): MemoryState;
export declare function matchesMemoryRecallQuery(record: MemoryRecord, query: MemoryRecallQuery): boolean;
export declare function filterAndSortMemories(records: MemoryRecord[], query?: MemoryRecallQuery): MemoryRecord[];
export declare function buildMemoryQualityReport(records: MemoryRecord[], evaluatedAt?: string): MemoryQualityReport;
