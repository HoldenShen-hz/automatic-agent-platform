/**
 * AsyncMemoryRepository - Async data access for memories and memory quality reporting.
 *
 * This is the async PostgreSQL-compatible version of MemoryRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { buildMemoryQualityReport, filterAndSortMemories, } from "../../memory/memory-quality.js";
import { nowIso } from "../../../contracts/types/ids.js";
export class AsyncMemoryRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async insertMemory(memory) {
        await this.conn.execute(`INSERT INTO memories (
        id, task_id, session_id, agent_id, execution_id, memory_layer, scope, content_json,
        classification, source_trust_level, quality_score, hit_count, created_at,
        last_accessed_at, expires_at, revoked_at, revocation_reason,
        kind, status, importance_score, freshness_score, content_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`, memory.id, memory.taskId, memory.sessionId, memory.agentId, memory.executionId, memory.memoryLayer, memory.scope, memory.contentJson, memory.classification, memory.sourceTrustLevel, memory.qualityScore, memory.hitCount, memory.createdAt, memory.lastAccessedAt, memory.expiresAt, memory.revokedAt, memory.revocationReason, memory.kind, memory.status, memory.importanceScore, memory.freshnessScore, memory.contentHash);
    }
    /**
     * List memories with optional filtering and sorting.
     */
    async listMemories(query = {}) {
        const filters = [];
        const values = [];
        if (query.taskId != null) {
            filters.push(`task_id = $${values.length + 1}`);
            values.push(query.taskId);
        }
        if (query.sessionId != null) {
            filters.push(`session_id = $${values.length + 1}`);
            values.push(query.sessionId);
        }
        if (query.agentId != null) {
            filters.push(`agent_id = $${values.length + 1}`);
            values.push(query.agentId);
        }
        if (query.executionId != null) {
            filters.push(`execution_id = $${values.length + 1}`);
            values.push(query.executionId);
        }
        if (query.scopes != null && query.scopes.length > 0) {
            const placeholders = query.scopes.map((_, i) => `$${values.length + 1 + i}`).join(", ");
            filters.push(`scope IN (${placeholders})`);
            values.push(...query.scopes);
        }
        if (query.memoryLayers != null && query.memoryLayers.length > 0) {
            const offset = values.length;
            const placeholders = query.memoryLayers.map((_, i) => `$${offset + 1 + i}`).join(", ");
            filters.push(`memory_layer IN (${placeholders})`);
            values.push(...query.memoryLayers);
        }
        if (query.classifications != null && query.classifications.length > 0) {
            const offset = values.length;
            const placeholders = query.classifications.map((_, i) => `$${offset + 1 + i}`).join(", ");
            filters.push(`classification IN (${placeholders})`);
            values.push(...query.classifications);
        }
        if (query.sourceTrustLevels != null && query.sourceTrustLevels.length > 0) {
            const offset = values.length;
            const placeholders = query.sourceTrustLevels.map((_, i) => `$${offset + 1 + i}`).join(", ");
            filters.push(`source_trust_level IN (${placeholders})`);
            values.push(...query.sourceTrustLevels);
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        const rows = await asyncQueryAll(this.conn, `SELECT
        id,
        task_id AS "taskId",
        session_id AS "sessionId",
        agent_id AS "agentId",
        execution_id AS "executionId",
        memory_layer AS "memoryLayer",
        scope,
        content_json AS "contentJson",
        classification,
        source_trust_level AS "sourceTrustLevel",
        quality_score AS "qualityScore",
        hit_count AS "hitCount",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        revocation_reason AS "revocationReason",
        kind,
        status,
        importance_score AS "importanceScore",
        freshness_score AS "freshnessScore",
        content_hash AS "contentHash"
       FROM memories
       ${whereClause}
       ORDER BY created_at DESC, id ASC`, ...values);
        return filterAndSortMemories(rows, query);
    }
    /**
     * Get a memory by ID.
     */
    async getMemory(memoryId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        id,
        task_id AS "taskId",
        session_id AS "sessionId",
        agent_id AS "agentId",
        execution_id AS "executionId",
        memory_layer AS "memoryLayer",
        scope,
        content_json AS "contentJson",
        classification,
        source_trust_level AS "sourceTrustLevel",
        quality_score AS "qualityScore",
        hit_count AS "hitCount",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        revocation_reason AS "revocationReason",
        kind,
        status,
        importance_score AS "importanceScore",
        freshness_score AS "freshnessScore",
        content_hash AS "contentHash"
       FROM memories
       WHERE id = $1`, memoryId);
        return result ?? null;
    }
    /**
     * Record memory access (increment hit count).
     */
    async recordMemoryAccess(memoryId, accessedAt) {
        return asyncExecute(this.conn, `UPDATE memories
       SET hit_count = hit_count + 1,
           last_accessed_at = $1
       WHERE id = $2`, accessedAt, memoryId);
    }
    /**
     * Revoke a memory.
     */
    async revokeMemory(memoryId, revokedAt, reason) {
        return asyncExecute(this.conn, `UPDATE memories
       SET revoked_at = $1,
           revocation_reason = $2
       WHERE id = $3`, revokedAt, reason, memoryId);
    }
    /**
     * Find an active memory by content hash and scope.
     */
    async findMemoryByContentHash(contentHash, scope) {
        const result = await asyncQueryOne(this.conn, `SELECT
        id,
        task_id AS "taskId",
        session_id AS "sessionId",
        agent_id AS "agentId",
        execution_id AS "executionId",
        memory_layer AS "memoryLayer",
        scope,
        content_json AS "contentJson",
        classification,
        source_trust_level AS "sourceTrustLevel",
        quality_score AS "qualityScore",
        hit_count AS "hitCount",
        created_at AS "createdAt",
        last_accessed_at AS "lastAccessedAt",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        revocation_reason AS "revocationReason",
        kind,
        status,
        importance_score AS "importanceScore",
        freshness_score AS "freshnessScore",
        content_hash AS "contentHash"
       FROM memories
       WHERE content_hash = $1 AND scope = $2 AND status = 'active'`, contentHash, scope);
        return result ?? null;
    }
    /**
     * Build a memory quality report.
     */
    async getMemoryQualityReport(query = {}) {
        const evaluatedAt = query.evaluatedAt ?? nowIso();
        return buildMemoryQualityReport(await this.listMemories({
            ...query,
            includeExpired: true,
            includeRevoked: true,
            evaluatedAt,
        }), evaluatedAt);
    }
}
//# sourceMappingURL=memory-repository.js.map