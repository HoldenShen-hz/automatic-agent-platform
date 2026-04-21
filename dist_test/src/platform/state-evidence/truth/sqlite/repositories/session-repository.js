/**
 * SessionRepository - Data access for sessions and messages.
 *
 * This repository handles:
 * - SessionRecord (sessions table)
 * - MessageRecord (messages table)
 * - GatewayTargetRecord (gateway_targets table)
 *
 * All SQL queries use proper column aliasing to match camelCase domain types.
 */
import { StructuredLogger } from "../../../../shared/observability/structured-logger.js";
import { queryAll, queryOne, execute } from "../query-helper.js";
import { resolveTenantScope, } from "../authoritative-task-store-types.js";
import { maybeCreateTerminalSessionSummary } from "../session-summary-autogen.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class SessionRepository {
    conn;
    dualStorage;
    constructor(conn, dualStorage = null) {
        this.conn = conn;
        this.dualStorage = dualStorage;
    }
    // === Session Records ===
    insertSession(session) {
        this.conn
            .prepare(`INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(session.id, session.taskId, session.channel, session.status, session.externalSessionId, session.createdAt, session.updatedAt);
        this.recordDualStorage("insertSession", () => {
            this.dualStorage?.recordSessionCreated(session);
        });
    }
    getSession(sessionId) {
        return queryOne(this.conn, `SELECT
        id, task_id AS taskId, channel, status,
        external_session_id AS externalSessionId, created_at AS createdAt, updated_at AS updatedAt
       FROM sessions WHERE id = ?`, sessionId);
    }
    listSessionsByTask(taskId) {
        return queryAll(this.conn, `SELECT
        id, task_id AS taskId, channel, status,
        external_session_id AS externalSessionId, created_at AS createdAt, updated_at AS updatedAt
       FROM sessions WHERE task_id = ? ORDER BY created_at DESC`, taskId);
    }
    updateSessionStatus(sessionId, status, updatedAt) {
        execute(this.conn, `UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?`, status, updatedAt, sessionId);
        maybeCreateTerminalSessionSummary(this.conn, sessionId, status, updatedAt);
        this.recordDualStorage("updateSessionStatus", () => {
            if (this.dualStorage == null) {
                return;
            }
            const session = this.getSession(sessionId);
            if (session == null) {
                return;
            }
            if (status === "completed") {
                this.dualStorage.recordSessionCompleted(session.id, session.taskId);
                return;
            }
            if (status === "failed") {
                this.dualStorage.recordSessionFailed(session.id, session.taskId);
                return;
            }
            if (status === "cancelled") {
                this.dualStorage.recordSessionCancelled(session.id, session.taskId);
                return;
            }
            this.dualStorage.recordSessionUpdated(session);
        });
    }
    insertCompactionRecord(record) {
        this.conn
            .prepare(`INSERT INTO compaction_records (
          id, session_id, task_id, stage, source_message_ids_json, summary_text, summary_ref,
          compaction_reason, overflow_triggered, auto_triggered, token_reduction_estimate, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.sessionId, record.taskId, record.stage, record.sourceMessageIdsJson, record.summaryText, record.summaryRef, record.compactionReason, record.overflowTriggered, record.autoTriggered, record.tokenReductionEstimate, record.createdAt);
        this.recordDualStorage("insertCompactionRecord", () => {
            this.dualStorage?.recordCompaction(record.sessionId, record.taskId, {
                id: record.id,
                stage: record.stage,
                compactionReason: record.compactionReason,
                sourceMessageIdsJson: record.sourceMessageIdsJson,
                tokenReductionEstimate: record.tokenReductionEstimate,
                createdAt: record.createdAt,
            });
        });
    }
    // === Message Records ===
    insertMessage(message) {
        this.conn
            .prepare(`INSERT INTO messages (
          id, session_id, direction, message_type, content,
          parts_json, attachments_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(message.id, message.sessionId, message.direction, message.messageType, message.content, message.partsJson ?? null, message.attachmentsJson, message.createdAt);
        this.recordDualStorage("insertMessage", () => {
            if (this.dualStorage == null) {
                return;
            }
            const session = this.getSession(message.sessionId);
            if (session == null) {
                return;
            }
            this.dualStorage.recordMessageAdded(message, session.taskId);
        });
    }
    listMessagesBySession(sessionId, limit) {
        const sql = `SELECT
        id, session_id AS sessionId, direction, message_type AS messageType,
        content, parts_json AS partsJson, attachments_json AS attachmentsJson,
        created_at AS createdAt
       FROM messages WHERE session_id = ? ORDER BY created_at ASC${limit ? ` LIMIT ${limit}` : ""}`;
        return queryAll(this.conn, sql, sessionId);
    }
    insertSessionSummary(summary) {
        this.conn
            .prepare(`INSERT INTO session_summaries (
          id, session_id, task_id, agent_id, summary_text,
          key_decisions, key_outcomes, memory_ids_referenced,
          token_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(summary.id, summary.sessionId, summary.taskId, summary.agentId, summary.summaryText, summary.keyDecisions, summary.keyOutcomes, summary.memoryIdsReferenced, summary.tokenCount, summary.createdAt);
    }
    getLatestSessionSummary(sessionId) {
        return (queryOne(this.conn, `SELECT
          id,
          session_id AS sessionId,
          task_id AS taskId,
          agent_id AS agentId,
          summary_text AS summaryText,
          key_decisions AS keyDecisions,
          key_outcomes AS keyOutcomes,
          memory_ids_referenced AS memoryIdsReferenced,
          token_count AS tokenCount,
          created_at AS createdAt
         FROM session_summaries
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT 1`, sessionId) ?? null);
    }
    insertSessionEvent(record) {
        this.conn
            .prepare(`INSERT INTO session_events (
          id, session_id, event_type, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?)`)
            .run(record.id, record.sessionId, record.eventType, record.payloadJson, record.createdAt);
    }
    listSessionEvents(sessionId, limit = 100) {
        return queryAll(this.conn, `SELECT
        id,
        session_id AS sessionId,
        event_type AS eventType,
        payload_json AS payloadJson,
        created_at AS createdAt
       FROM session_events
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT ?`, sessionId, limit);
    }
    // === Gateway Target Records ===
    upsertGatewayTarget(target) {
        this.conn
            .prepare(`INSERT INTO gateway_targets (
          target_id, channel, target_kind, external_target_id, display_name,
          aliases_json, metadata_json, source, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(target_id) DO UPDATE SET
           channel = excluded.channel,
           target_kind = excluded.target_kind,
           external_target_id = excluded.external_target_id,
           display_name = excluded.display_name,
           aliases_json = excluded.aliases_json,
           metadata_json = excluded.metadata_json,
           source = excluded.source,
           last_seen_at = excluded.last_seen_at,
           updated_at = excluded.updated_at`)
            .run(target.targetId, target.channel, target.targetKind, target.externalTargetId, target.displayName, target.aliasesJson, target.metadataJson, target.source, target.lastSeenAt, target.createdAt, target.updatedAt);
    }
    getGatewayTarget(targetId) {
        return queryOne(this.conn, `SELECT
        target_id AS targetId, channel, target_kind AS targetKind,
        external_target_id AS externalTargetId, display_name AS displayName,
        aliases_json AS aliasesJson, metadata_json AS metadataJson,
        source, last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt
       FROM gateway_targets WHERE target_id = ?`, targetId);
    }
    listGatewayTargetsByChannel(channel) {
        return queryAll(this.conn, `SELECT
        target_id AS targetId, channel, target_kind AS targetKind,
        external_target_id AS externalTargetId, display_name AS displayName,
        aliases_json AS aliasesJson, metadata_json AS metadataJson,
        source, last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt
       FROM gateway_targets WHERE channel = ? ORDER BY display_name`, channel);
    }
    listGatewaySessionTargetCandidates(limit = 100, channel, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        const tenantClause = scopedTenantId !== undefined ? "AND t.tenant_id = ?" : "";
        const tenantParams = scopedTenantId !== undefined ? [scopedTenantId] : [];
        const rows = channel
            ? queryAll(this.conn, `SELECT
             s.id AS sessionId,
             s.task_id AS taskId,
             s.channel,
             s.status AS sessionStatus,
             s.external_session_id AS externalSessionId,
             t.title AS taskTitle,
             (
               SELECT m.content
               FROM messages m
               WHERE m.session_id = s.id
               ORDER BY m.created_at DESC, m.rowid DESC
               LIMIT 1
             ) AS latestMessage,
             (
               SELECT m.created_at
               FROM messages m
               WHERE m.session_id = s.id
               ORDER BY m.created_at DESC, m.rowid DESC
               LIMIT 1
             ) AS latestMessageAt,
             s.updated_at AS lastSeenAt
           FROM sessions s
           LEFT JOIN tasks t ON t.id = s.task_id
           WHERE s.channel = ?
             ${tenantClause}
           ORDER BY s.updated_at DESC, s.created_at DESC, s.id ASC
           LIMIT ?`, channel, ...tenantParams, limit)
            : queryAll(this.conn, `SELECT
             s.id AS sessionId,
             s.task_id AS taskId,
             s.channel,
             s.status AS sessionStatus,
             s.external_session_id AS externalSessionId,
             t.title AS taskTitle,
             (
               SELECT m.content
               FROM messages m
               WHERE m.session_id = s.id
               ORDER BY m.created_at DESC, m.rowid DESC
               LIMIT 1
             ) AS latestMessage,
             (
               SELECT m.created_at
               FROM messages m
               WHERE m.session_id = s.id
               ORDER BY m.created_at DESC, m.rowid DESC
               LIMIT 1
             ) AS latestMessageAt,
             s.updated_at AS lastSeenAt
           FROM sessions s
           LEFT JOIN tasks t ON t.id = s.task_id
           ${scopedTenantId !== undefined ? "WHERE t.tenant_id = ?" : ""}
           ORDER BY s.updated_at DESC, s.created_at DESC, s.id ASC
           LIMIT ?`, ...tenantParams, limit);
        return rows.map((row) => ({
            sessionId: String(row.sessionId),
            taskId: String(row.taskId),
            channel: String(row.channel),
            sessionStatus: row.sessionStatus,
            externalSessionId: row.externalSessionId ?? null,
            taskTitle: row.taskTitle ?? null,
            latestMessage: row.latestMessage ?? null,
            latestMessageAt: row.latestMessageAt ?? null,
            lastSeenAt: String(row.lastSeenAt),
        }));
    }
    listCompactionRecordsBySession(sessionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT
          c.id,
          c.session_id AS sessionId,
          c.task_id AS taskId,
          c.stage,
          c.source_message_ids_json AS sourceMessageIdsJson,
          c.summary_text AS summaryText,
          c.summary_ref AS summaryRef,
          c.compaction_reason AS compactionReason,
          c.overflow_triggered AS overflowTriggered,
          c.auto_triggered AS autoTriggered,
          c.token_reduction_estimate AS tokenReductionEstimate,
          c.created_at AS createdAt
         FROM compaction_records c
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE c.session_id = ?
           AND t.tenant_id = ?
         ORDER BY c.created_at ASC, c.id ASC`, sessionId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT
        id,
        session_id AS sessionId,
        task_id AS taskId,
        stage,
        source_message_ids_json AS sourceMessageIdsJson,
        summary_text AS summaryText,
        summary_ref AS summaryRef,
        compaction_reason AS compactionReason,
        overflow_triggered AS overflowTriggered,
        auto_triggered AS autoTriggered,
        token_reduction_estimate AS tokenReductionEstimate,
        created_at AS createdAt
       FROM compaction_records
       WHERE session_id = ?
       ORDER BY created_at ASC, id ASC`, sessionId);
    }
    recordDualStorage(action, work) {
        if (this.dualStorage == null) {
            return;
        }
        try {
            work();
        }
        catch (error) {
            logger.warn("session dual storage write failed", {
                action,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
//# sourceMappingURL=session-repository.js.map