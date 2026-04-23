/**
 * MemoryRepository - Data access for memories and memory quality reporting.
 *
 * This repository handles all data access for:
 * - MemoryRecord (memories table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import { queryAll, queryOne, execute } from "../query-helper.js";
import { buildMemoryQualityReport, filterAndSortMemories, } from "../../../memory/memory-quality.js";
import { nowIso } from "../../../../contracts/types/ids.js";
export class MemoryRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertMemory(memory) {
        this.conn
            .prepare(`INSERT INTO memories (
          id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json,
          classification, source_trust_level, quality_score, hit_count, created_at,
          last_accessed_at, expires_at, revoked_at, revocation_reason,
          kind, status, importance_score, freshness_score, content_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(memory.id, memory.taskId, memory.sessionId, memory.agentId, memory.executionId, memory.memoryLayer, memory.scope, memory.contentJson, memory.classification, memory.sourceTrustLevel, memory.qualityScore, memory.hitCount, memory.createdAt, memory.lastAccessedAt, memory.expiresAt, memory.revokedAt, memory.revocationReason, memory.kind, memory.status, memory.importanceScore, memory.freshnessScore, memory.contentHash);
    }
    /**
     * List memories with optional filtering and sorting.
     */
    listMemories(query = {}) {
        const filters = [];
        const values = [];
        if (query.taskId != null) {
            filters.push("task_id = ?");
            values.push(query.taskId);
        }
        if (query.sessionId != null) {
            filters.push("session_id = ?");
            values.push(query.sessionId);
        }
        if (query.agentId != null) {
            filters.push("agent_id = ?");
            values.push(query.agentId);
        }
        if (query.executionId != null) {
            filters.push("execution_id = ?");
            values.push(query.executionId);
        }
        if (query.scopes != null && query.scopes.length > 0) {
            filters.push(`scope IN (${query.scopes.map(() => "?").join(", ")})`);
            values.push(...query.scopes);
        }
        if (query.memoryLayers != null && query.memoryLayers.length > 0) {
            filters.push(`memory_layer IN (${query.memoryLayers.map(() => "?").join(", ")})`);
            values.push(...query.memoryLayers);
        }
        if (query.classifications != null && query.classifications.length > 0) {
            filters.push(`classification IN (${query.classifications.map(() => "?").join(", ")})`);
            values.push(...query.classifications);
        }
        if (query.sourceTrustLevels != null && query.sourceTrustLevels.length > 0) {
            filters.push(`source_trust_level IN (${query.sourceTrustLevels.map(() => "?").join(", ")})`);
            values.push(...query.sourceTrustLevels);
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const rows = queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        session_id AS sessionId,
        agent_id AS agentId,
        execution_id AS executionId,
        memory_layer AS memoryLayer,
        scope,
        content_json AS contentJson,
        classification,
        source_trust_level AS sourceTrustLevel,
        quality_score AS qualityScore,
        hit_count AS hitCount,
        created_at AS createdAt,
        last_accessed_at AS lastAccessedAt,
        expires_at AS expiresAt,
        revoked_at AS revokedAt,
        revocation_reason AS revocationReason,
        kind,
        status,
        importance_score AS importanceScore,
        freshness_score AS freshnessScore,
        content_hash AS contentHash
       FROM memories
       ${whereClause}
       ORDER BY created_at DESC, id ASC`, ...values);
        return filterAndSortMemories(rows, query);
    }
    /**
     * Get a memory by ID.
     */
    getMemory(memoryId) {
        return queryOne(this.conn, `SELECT
        id,
        task_id AS taskId,
        session_id AS sessionId,
        agent_id AS agentId,
        execution_id AS executionId,
        memory_layer AS memoryLayer,
        scope,
        content_json AS contentJson,
        classification,
        source_trust_level AS sourceTrustLevel,
        quality_score AS qualityScore,
        hit_count AS hitCount,
        created_at AS createdAt,
        last_accessed_at AS lastAccessedAt,
        expires_at AS expiresAt,
        revoked_at AS revokedAt,
        revocation_reason AS revocationReason,
        kind,
        status,
        importance_score AS importanceScore,
        freshness_score AS freshnessScore,
        content_hash AS contentHash
       FROM memories
       WHERE id = ?`, memoryId) ?? null;
    }
    /**
     * Record memory access (increment hit count).
     */
    recordMemoryAccess(memoryId, accessedAt) {
        execute(this.conn, `UPDATE memories
       SET hit_count = hit_count + 1,
           last_accessed_at = ?
       WHERE id = ?`, accessedAt, memoryId);
    }
    /**
     * Revoke a memory.
     */
    revokeMemory(memoryId, revokedAt, reason) {
        execute(this.conn, `UPDATE memories
       SET revoked_at = ?,
           revocation_reason = ?
       WHERE id = ?`, revokedAt, reason, memoryId);
    }
    /**
     * Find an active memory by content hash and scope.
     */
    findMemoryByContentHash(contentHash, scope) {
        return queryOne(this.conn, `SELECT
        id,
        task_id AS taskId,
        session_id AS sessionId,
        agent_id AS agentId,
        execution_id AS executionId,
        memory_layer AS memoryLayer,
        scope,
        content_json AS contentJson,
        classification,
        source_trust_level AS sourceTrustLevel,
        quality_score AS qualityScore,
        hit_count AS hitCount,
        created_at AS createdAt,
        last_accessed_at AS lastAccessedAt,
        expires_at AS expiresAt,
        revoked_at AS revokedAt,
        revocation_reason AS revocationReason,
        kind,
        status,
        importance_score AS importanceScore,
        freshness_score AS freshnessScore,
        content_hash AS contentHash
       FROM memories
       WHERE content_hash = ? AND scope = ? AND status = 'active'`, contentHash, scope) ?? null;
    }
    /**
     * Build a memory quality report.
     */
    getMemoryQualityReport(query = {}) {
        const evaluatedAt = query.evaluatedAt ?? nowIso();
        return buildMemoryQualityReport(this.listMemories({
            ...query,
            includeExpired: true,
            includeRevoked: true,
            evaluatedAt,
        }), evaluatedAt);
    }
}
//# sourceMappingURL=memory-repository.js.map