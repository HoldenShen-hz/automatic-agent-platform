/**
 * AsyncSessionRepository - Async data access for sessions and messages.
 *
 * This is the async PostgreSQL-compatible version of SessionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type {
  CompactionRecord,
  GatewayTargetRecord,
  MessageRecord,
  SessionEventRecord,
  SessionRecord,
  SessionSummaryRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncSessionRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  // === Session Records ===

  public async insertSession(session: SessionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO sessions (id, task_id, channel, status, external_session_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      session.id,
      session.taskId,
      session.channel,
      session.status,
      session.externalSessionId,
      session.createdAt,
      session.updatedAt,
    );
  }

  public async getSession(sessionId: string): Promise<SessionRecord | null> {
    const result = await asyncQueryOne<SessionRecord>(
      this.conn,
      `SELECT
        id, task_id AS "taskId", channel, status,
        external_session_id AS "externalSessionId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM sessions WHERE id = $1`,
      sessionId,
    );
    return result ?? null;
  }

  public async listSessionsByTask(taskId: string): Promise<SessionRecord[]> {
    return asyncQueryAll<SessionRecord>(
      this.conn,
      `SELECT
        id, task_id AS "taskId", channel, status,
        external_session_id AS "externalSessionId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM sessions WHERE task_id = $1 ORDER BY created_at DESC`,
      taskId,
    );
  }

  public async updateSessionStatus(sessionId: string, status: string, updatedAt: string): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE sessions SET status = $1, updated_at = $2 WHERE id = $3`,
      status,
      updatedAt,
      sessionId,
    );
  }

  public async insertCompactionRecord(record: CompactionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO compaction_records (
        id, session_id, task_id, stage, source_message_ids_json, summary_text, summary_ref,
        compaction_reason, overflow_triggered, auto_triggered, token_reduction_estimate, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      record.id,
      record.sessionId,
      record.taskId,
      record.stage,
      record.sourceMessageIdsJson,
      record.summaryText,
      record.summaryRef,
      record.compactionReason,
      record.overflowTriggered,
      record.autoTriggered,
      record.tokenReductionEstimate,
      record.createdAt,
    );
  }

  // === Message Records ===

  public async insertMessage(message: MessageRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO messages (
        id, session_id, direction, message_type, content,
        parts_json, attachments_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      message.id,
      message.sessionId,
      message.direction,
      message.messageType,
      message.content,
      message.partsJson ?? null,
      message.attachmentsJson,
      message.createdAt,
    );
  }

  public async listMessagesBySession(sessionId: string, limit?: number): Promise<MessageRecord[]> {
    const limitClause = limit ? ` LIMIT ${limit}` : "";
    const sql = `SELECT
        id, session_id AS "sessionId", direction, message_type AS "messageType",
        content, parts_json AS "partsJson", attachments_json AS "attachmentsJson",
        created_at AS "createdAt"
       FROM messages WHERE session_id = $1 ORDER BY created_at ASC${limitClause}`;
    return asyncQueryAll<MessageRecord>(this.conn, sql, sessionId);
  }

  public async insertSessionSummary(summary: SessionSummaryRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO session_summaries (
        id, session_id, task_id, agent_id, summary_text,
        key_decisions, key_outcomes, memory_ids_referenced,
        token_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      summary.id,
      summary.sessionId,
      summary.taskId,
      summary.agentId,
      summary.summaryText,
      summary.keyDecisions,
      summary.keyOutcomes,
      summary.memoryIdsReferenced,
      summary.tokenCount,
      summary.createdAt,
    );
  }

  public async getLatestSessionSummary(sessionId: string): Promise<SessionSummaryRecord | null> {
    const result = await asyncQueryOne<SessionSummaryRecord>(
      this.conn,
      `SELECT
          id,
          session_id AS "sessionId",
          task_id AS "taskId",
          agent_id AS "agentId",
          summary_text AS "summaryText",
          key_decisions AS "keyDecisions",
          key_outcomes AS "keyOutcomes",
          memory_ids_referenced AS "memoryIdsReferenced",
          token_count AS "tokenCount",
          created_at AS "createdAt"
         FROM session_summaries
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
      sessionId,
    );
    return result ?? null;
  }

  public async insertSessionEvent(record: SessionEventRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO session_events (
        id, session_id, event_type, payload_json, created_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      record.id,
      record.sessionId,
      record.eventType,
      record.payloadJson,
      record.createdAt,
    );
  }

  public async listSessionEvents(sessionId: string, limit: number = 100): Promise<SessionEventRecord[]> {
    return asyncQueryAll<SessionEventRecord>(
      this.conn,
      `SELECT
        id,
        session_id AS "sessionId",
        event_type AS "eventType",
        payload_json AS "payloadJson",
        created_at AS "createdAt"
       FROM session_events
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      sessionId,
      limit,
    );
  }

  // === Gateway Target Records ===

  public async upsertGatewayTarget(target: GatewayTargetRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO gateway_targets (
        target_id, channel, target_kind, external_target_id, display_name,
        aliases_json, metadata_json, source, last_seen_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT(target_id) DO UPDATE SET
         channel = excluded.channel,
         target_kind = excluded.target_kind,
         external_target_id = excluded.external_target_id,
         display_name = excluded.display_name,
         aliases_json = excluded.aliases_json,
         metadata_json = excluded.metadata_json,
         source = excluded.source,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
      target.targetId,
      target.channel,
      target.targetKind,
      target.externalTargetId,
      target.displayName,
      target.aliasesJson,
      target.metadataJson,
      target.source,
      target.lastSeenAt,
      target.createdAt,
      target.updatedAt,
    );
  }

  public async getGatewayTarget(targetId: string): Promise<GatewayTargetRecord | null> {
    const result = await asyncQueryOne<GatewayTargetRecord>(
      this.conn,
      `SELECT
        target_id AS "targetId", channel, target_kind AS "targetKind",
        external_target_id AS "externalTargetId", display_name AS "displayName",
        aliases_json AS "aliasesJson", metadata_json AS "metadataJson",
        source, last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM gateway_targets WHERE target_id = $1`,
      targetId,
    );
    return result ?? null;
  }

  public async listGatewayTargetsByChannel(channel: string): Promise<GatewayTargetRecord[]> {
    return asyncQueryAll<GatewayTargetRecord>(
      this.conn,
      `SELECT
        target_id AS "targetId", channel, target_kind AS "targetKind",
        external_target_id AS "externalTargetId", display_name AS "displayName",
        aliases_json AS "aliasesJson", metadata_json AS "metadataJson",
        source, last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM gateway_targets WHERE channel = $1 ORDER BY display_name`,
      channel,
    );
  }

  public async listCompactionRecordsBySession(sessionId: string, tenantId?: string | null): Promise<CompactionRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<CompactionRecord>(
        this.conn,
        `SELECT
          c.id,
          c.session_id AS "sessionId",
          c.task_id AS "taskId",
          c.stage,
          c.source_message_ids_json AS "sourceMessageIdsJson",
          c.summary_text AS "summaryText",
          c.summary_ref AS "summaryRef",
          c.compaction_reason AS "compactionReason",
          c.overflow_triggered AS "overflowTriggered",
          c.auto_triggered AS "autoTriggered",
          c.token_reduction_estimate AS "tokenReductionEstimate",
          c.created_at AS "createdAt"
         FROM compaction_records c
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE c.session_id = $1
           AND t.tenant_id = $2
         ORDER BY c.created_at ASC, c.id ASC`,
        sessionId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<CompactionRecord>(
      this.conn,
      `SELECT
        id,
        session_id AS "sessionId",
        task_id AS "taskId",
        stage,
        source_message_ids_json AS "sourceMessageIdsJson",
        summary_text AS "summaryText",
        summary_ref AS "summaryRef",
        compaction_reason AS "compactionReason",
        overflow_triggered AS "overflowTriggered",
        auto_triggered AS "autoTriggered",
        token_reduction_estimate AS "tokenReductionEstimate",
        created_at AS "createdAt"
       FROM compaction_records
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
      sessionId,
    );
  }
}
