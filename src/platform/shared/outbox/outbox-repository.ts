/**
 * OutboxRepository - Data access for the transactional outbox pattern.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { type OutboxInsertPayload, type OutboxRecord, OutboxStatus } from "./outbox-types.js";
import type { SqliteConnection } from "../../state-evidence/truth/sqlite/query-helper.js";
import { execute, queryAll, queryOne } from "../../state-evidence/truth/sqlite/query-helper.js";

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
  last_attempt_at AS lastAttemptAt`;

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
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)`,
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
    };
  }

  public insertOutboxEntries(entries: OutboxInsertPayload[]): OutboxRecord[] {
    const now = nowIso();
    const records: OutboxRecord[] = [];

    for (const entry of entries) {
      const record = this.insertOutboxEntry(
        entry.aggregateType,
        entry.aggregateId,
        entry.eventType,
        JSON.stringify(entry.payload),
        entry.traceId ?? null,
        now,
      );
      records.push(record);
    }

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

  public listPendingEntries(limit: number = 100): OutboxRecord[] {
    return queryAll<OutboxRecord>(
      this.conn,
      `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE published_at IS NULL
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
       WHERE published_at IS NULL`,
    );
    return Number(result?.count ?? 0);
  }

  public countFailed(): number {
    const result = queryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count
       FROM outbox
       WHERE published_at IS NULL
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
    if (record.retryCount > 0) {
      return { status: OutboxStatus.FAILED, retryCount: record.retryCount };
    }
    return { status: OutboxStatus.PENDING, retryCount: 0 };
  }

  public cleanupPublishedBefore(daysOld: number): number {
    const result = this.conn
      .prepare(
        `DELETE FROM outbox
         WHERE published_at IS NOT NULL
           AND created_at < datetime('now', '-' || ? || ' days')`,
      )
      .run(daysOld);
    return Number(result.changes ?? 0);
  }
}
