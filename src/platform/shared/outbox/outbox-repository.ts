/**
 * OutboxRepository - Data access for the transactional outbox pattern.
 */

import type { SQLInputValue } from "node:sqlite";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { type OutboxInsertPayload, type OutboxRecord, OutboxStatus } from "./outbox-types.js";
import type { SqliteConnection } from "../../five-plane-state-evidence/truth/sqlite/query-helper.js";
import { execute, queryAll, queryOne } from "../../five-plane-state-evidence/truth/sqlite/query-helper.js";

const OUTBOX_COLS = `id,
  aggregate_type AS aggregateType,
  aggregate_id AS aggregateId,
  event_type AS eventType,
  payload_json AS payloadJson,
  trace_id AS traceId,
  created_at AS createdAt,
  published_at AS publishedAt,
  retry_count AS retryCount,
  last_error AS lastError,
  last_attempt_at AS lastAttemptAt,
  dead_lettered_at AS deadLetteredAt,
  dead_letter_reason AS deadLetterReason`;
const SQLITE_MAX_BATCH_VARIABLES = 900;

export class OutboxRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertOutboxEntry(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payloadJson: string,
    traceId: string | null,
    createdAt: string,
  ): OutboxRecord {
    const id = newId("outbox");
    this.conn
      .prepare(
        `INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at, dead_lettered_at, dead_letter_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, NULL, NULL)`,
      )
      .run(id, aggregateType, aggregateId, eventType, payloadJson, traceId, createdAt);

    return {
      id,
      aggregateType,
      aggregateId,
      eventType,
      payloadJson,
      traceId,
      createdAt,
      publishedAt: null,
      retryCount: 0,
      lastError: null,
      lastAttemptAt: null,
      deadLetteredAt: null,
      deadLetterReason: null,
    };
  }

  public insertOutboxEntries(entries: OutboxInsertPayload[]): OutboxRecord[] {
    if (entries.length === 0) return [];

    const now = nowIso();
    const records: OutboxRecord[] = [];

    // Use bulk INSERT for efficiency when publishing multiple events
    const placeholders = entries.map(() => "(?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, NULL, NULL)").join(", ");
    const values: SQLInputValue[] = [];
    for (const entry of entries) {
      const id = newId("outbox");
      values.push(
        id,
        entry.aggregateType,
        entry.aggregateId,
        entry.eventType,
        JSON.stringify(entry.payload),
        entry.traceId ?? null,
        now,
      );
      records.push({
        id,
        aggregateType: entry.aggregateType,
        aggregateId: entry.aggregateId,
        eventType: entry.eventType,
        payloadJson: JSON.stringify(entry.payload),
        traceId: entry.traceId ?? null,
        createdAt: now,
        publishedAt: null,
        retryCount: 0,
        lastError: null,
        lastAttemptAt: null,
        deadLetteredAt: null,
        deadLetterReason: null,
      });
    }

    this.conn
      .prepare(
        `INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at, dead_lettered_at, dead_letter_reason
        ) VALUES ${placeholders}`,
      )
      .run(...values);

    return records;
  }

  /**
   * Bulk inserts outbox entries with pre-generated IDs.
   * Use this when you need to control the IDs yourself.
   *
   * @param entries - Array of entries with pre-generated IDs
   * @param ids - Array of pre-generated IDs (must match entries length)
   */
  public insertOutboxEntriesBulk(entries: OutboxInsertPayload[], ids: string[]): OutboxRecord[] {
    if (entries.length === 0) return [];
    if (entries.length !== ids.length) {
      throw new TypeError("entries and ids must have the same length");
    }

    const now = nowIso();
    const records: OutboxRecord[] = [];

    // Use bulk INSERT for efficiency
    const placeholders = entries.map(() => "(?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, NULL, NULL)").join(", ");
    const values: SQLInputValue[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const id = ids[i]!;
      values.push(
        id,
        entry.aggregateType,
        entry.aggregateId,
        entry.eventType,
        JSON.stringify(entry.payload),
        entry.traceId ?? null,
        now,
      );
      records.push({
        id,
        aggregateType: entry.aggregateType,
        aggregateId: entry.aggregateId,
        eventType: entry.eventType,
        payloadJson: JSON.stringify(entry.payload),
        traceId: entry.traceId ?? null,
        createdAt: now,
        publishedAt: null,
        retryCount: 0,
        lastError: null,
        lastAttemptAt: null,
        deadLetteredAt: null,
        deadLetterReason: null,
      });
    }

    this.conn
      .prepare(
        `INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at, dead_lettered_at, dead_letter_reason
        ) VALUES ${placeholders}`,
      )
      .run(...values);

    return records;
  }

  public markPublished(id: string, publishedAt: string): void {
    execute(
      this.conn,
      `UPDATE outbox
       SET published_at = ?
       WHERE id = ?`,
      publishedAt,
      id,
    );
  }

  public markPublishedBatch(ids: string[], publishedAt: string): void {
    if (ids.length === 0) return;
    for (const chunk of chunkValues(ids, SQLITE_MAX_BATCH_VARIABLES)) {
      const placeholders = chunk.map(() => "?").join(", ");
      execute(
        this.conn,
        `UPDATE outbox
         SET published_at = ?
         WHERE id IN (${placeholders})`,
        publishedAt,
        ...chunk,
      );
    }
  }

  public markFailed(id: string, error: string, newRetryCount: number, lastAttemptAt: string): void {
    execute(
      this.conn,
      `UPDATE outbox
       SET last_error = ?,
           retry_count = ?,
           last_attempt_at = ?
       WHERE id = ?`,
      error,
      newRetryCount,
      lastAttemptAt,
      id,
    );
  }

  public markDeadLettered(id: string, error: string, retryCount: number, deadLetteredAt: string): void {
    execute(
      this.conn,
      `UPDATE outbox
       SET last_error = ?,
           retry_count = ?,
           last_attempt_at = ?,
           dead_lettered_at = ?,
           dead_letter_reason = ?
       WHERE id = ?`,
      error,
      retryCount,
      deadLetteredAt,
      deadLetteredAt,
      error,
      id,
    );
  }

  public listPendingEntries(limit: number = 100): OutboxRecord[] {
    return queryAll<OutboxRecord>(
      this.conn,
      `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE published_at IS NULL
         AND dead_lettered_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      limit,
    );
  }

  public listFailedEntries(limit: number = 100): OutboxRecord[] {
    return queryAll<OutboxRecord>(
      this.conn,
      `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE published_at IS NULL
         AND dead_lettered_at IS NULL
         AND retry_count > 0
       ORDER BY created_at ASC
       LIMIT ?`,
      limit,
    );
  }

  public countPending(): number {
    const result = queryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count
       FROM outbox
       WHERE published_at IS NULL
         AND dead_lettered_at IS NULL`,
    );
    return Number(result?.count ?? 0);
  }

  public countFailed(): number {
    const result = queryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count
       FROM outbox
       WHERE published_at IS NULL
         AND dead_lettered_at IS NULL
         AND retry_count > 0`,
    );
    return Number(result?.count ?? 0);
  }

  public getStatus(id: string): { status: OutboxStatus; retryCount: number } | undefined {
    const record = queryOne<OutboxRecord>(
      this.conn,
      `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE id = ?`,
      id,
    );
    if (!record) return undefined;

    if (record.publishedAt !== null) {
      return { status: OutboxStatus.PUBLISHED, retryCount: record.retryCount };
    }
    if (record.deadLetteredAt !== null) {
      return { status: OutboxStatus.FAILED, retryCount: record.retryCount };
    }
    if (record.retryCount > 0) {
      return { status: OutboxStatus.FAILED, retryCount: record.retryCount };
    }
    return { status: OutboxStatus.PENDING, retryCount: 0 };
  }

  public cleanupPublishedBefore(daysOld: number): number {
    const cutoff = new Date(Date.now() - Math.max(0, daysOld) * 24 * 60 * 60 * 1000).toISOString();
    const result = this.conn
      .prepare(
        `DELETE FROM outbox
         WHERE published_at IS NOT NULL
           AND created_at < ?`,
      )
      .run(cutoff);
    return Number(result.changes ?? 0);
  }
}

function chunkValues<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
