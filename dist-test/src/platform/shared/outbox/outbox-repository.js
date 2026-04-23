/**
 * OutboxRepository - Data access for the transactional outbox pattern.
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { OutboxStatus } from "./outbox-types.js";
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
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertOutboxEntry(aggregateType, aggregateId, eventType, payloadJson, traceId, createdAt) {
        const id = newId("outbox");
        this.conn
            .prepare(`INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)`)
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
    insertOutboxEntries(entries) {
        if (entries.length === 0)
            return [];
        const now = nowIso();
        const records = [];
        // Use bulk INSERT for efficiency when publishing multiple events
        const placeholders = entries.map(() => "(?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)").join(", ");
        const values = [];
        for (const entry of entries) {
            const id = newId("outbox");
            values.push(id, entry.aggregateType, entry.aggregateId, entry.eventType, JSON.stringify(entry.payload), entry.traceId ?? null, now);
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
            });
        }
        this.conn
            .prepare(`INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES ${placeholders}`)
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
    insertOutboxEntriesBulk(entries, ids) {
        if (entries.length === 0)
            return [];
        if (entries.length !== ids.length) {
            throw new Error("entries and ids must have the same length");
        }
        const now = nowIso();
        const records = [];
        // Use bulk INSERT for efficiency
        const placeholders = entries.map(() => "(?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)").join(", ");
        const values = [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const id = ids[i];
            values.push(id, entry.aggregateType, entry.aggregateId, entry.eventType, JSON.stringify(entry.payload), entry.traceId ?? null, now);
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
            });
        }
        this.conn
            .prepare(`INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES ${placeholders}`)
            .run(...values);
        return records;
    }
    markPublished(id, publishedAt) {
        execute(this.conn, `UPDATE outbox
       SET published_at = ?
       WHERE id = ?`, publishedAt, id);
    }
    markPublishedBatch(ids, publishedAt) {
        if (ids.length === 0)
            return;
        const placeholders = ids.map(() => "?").join(", ");
        execute(this.conn, `UPDATE outbox
       SET published_at = ?
       WHERE id IN (${placeholders})`, publishedAt, ...ids);
    }
    markFailed(id, error, newRetryCount, lastAttemptAt) {
        execute(this.conn, `UPDATE outbox
       SET last_error = ?,
           retry_count = ?,
           last_attempt_at = ?
       WHERE id = ?`, error, newRetryCount, lastAttemptAt, id);
    }
    listPendingEntries(limit = 100) {
        return queryAll(this.conn, `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE published_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`, limit);
    }
    listFailedEntries(limit = 100) {
        return queryAll(this.conn, `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE published_at IS NULL
         AND retry_count > 0
       ORDER BY created_at ASC
       LIMIT ?`, limit);
    }
    countPending() {
        const result = queryOne(this.conn, `SELECT COUNT(*) AS count
       FROM outbox
       WHERE published_at IS NULL`);
        return Number(result?.count ?? 0);
    }
    countFailed() {
        const result = queryOne(this.conn, `SELECT COUNT(*) AS count
       FROM outbox
       WHERE published_at IS NULL
         AND retry_count > 0`);
        return Number(result?.count ?? 0);
    }
    getStatus(id) {
        const record = queryOne(this.conn, `SELECT ${OUTBOX_COLS}
       FROM outbox
       WHERE id = ?`, id);
        if (!record)
            return undefined;
        if (record.publishedAt !== null) {
            return { status: OutboxStatus.PUBLISHED, retryCount: record.retryCount };
        }
        if (record.retryCount > 0) {
            return { status: OutboxStatus.FAILED, retryCount: record.retryCount };
        }
        return { status: OutboxStatus.PENDING, retryCount: 0 };
    }
    cleanupPublishedBefore(daysOld) {
        const result = this.conn
            .prepare(`DELETE FROM outbox
         WHERE published_at IS NOT NULL
           AND created_at < datetime('now', '-' || ? || ' days')`)
            .run(daysOld);
        return Number(result.changes ?? 0);
    }
}
//# sourceMappingURL=outbox-repository.js.map