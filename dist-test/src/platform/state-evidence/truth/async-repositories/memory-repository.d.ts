/**
 * AsyncMemoryRepository - Async data access for memories and memory quality reporting.
 *
 * This is the async PostgreSQL-compatible version of MemoryRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { MemoryRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { type MemoryQualityReport, type MemoryRecallQuery } from "../../memory/memory-quality.js";
export declare class AsyncMemoryRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertMemory(memory: MemoryRecord): Promise<void>;
    /**
     * List memories with optional filtering and sorting.
     */
    listMemories(query?: MemoryRecallQuery): Promise<MemoryRecord[]>;
    /**
     * Get a memory by ID.
     */
    getMemory(memoryId: string): Promise<MemoryRecord | null>;
    /**
     * Record memory access (increment hit count).
     */
    recordMemoryAccess(memoryId: string, accessedAt: string): Promise<number>;
    /**
     * Revoke a memory.
     */
    revokeMemory(memoryId: string, revokedAt: string, reason: string): Promise<number>;
    /**
     * Find an active memory by content hash and scope.
     */
    findMemoryByContentHash(contentHash: string, scope: string): Promise<MemoryRecord | null>;
    /**
     * Build a memory quality report.
     */
    getMemoryQualityReport(query?: Omit<MemoryRecallQuery, "includeExpired" | "includeRevoked">): Promise<MemoryQualityReport>;
}
