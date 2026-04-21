/**
 * MemoryRepository - Data access for memories and memory quality reporting.
 *
 * This repository handles all data access for:
 * - MemoryRecord (memories table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { MemoryRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
import { type MemoryQualityReport, type MemoryRecallQuery } from "../../../memory/memory-quality.js";
export declare class MemoryRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertMemory(memory: MemoryRecord): void;
    /**
     * List memories with optional filtering and sorting.
     */
    listMemories(query?: MemoryRecallQuery): MemoryRecord[];
    /**
     * Get a memory by ID.
     */
    getMemory(memoryId: string): MemoryRecord | null;
    /**
     * Record memory access (increment hit count).
     */
    recordMemoryAccess(memoryId: string, accessedAt: string): void;
    /**
     * Revoke a memory.
     */
    revokeMemory(memoryId: string, revokedAt: string, reason: string): void;
    /**
     * Find an active memory by content hash and scope.
     */
    findMemoryByContentHash(contentHash: string, scope: string): MemoryRecord | null;
    /**
     * Build a memory quality report.
     */
    getMemoryQualityReport(query?: Omit<MemoryRecallQuery, "includeExpired" | "includeRevoked">): MemoryQualityReport;
}
