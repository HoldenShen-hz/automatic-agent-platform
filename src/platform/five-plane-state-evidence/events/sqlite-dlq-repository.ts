/**
 * SqliteDlqRepository - SQLite-backed DLQ persistence for ExtendedDeadLetterRecord.
 *
 * Provides persistent storage for Dead Letter Queue records using SQLite.
 * This replaces the in-memory Map to survive process restarts.
 *
 * R16-37 FIX: Persistent DLQ repository to replace in-memory Map storage.
 */

import type {
  DlqRepository,
  ExtendedDeadLetterRecord,
  OperatorActionRecord,
  DeadLetterStatus,
} from "./dlq-service.js";
import type { SqliteConnection } from "../truth/sqlite/query-helper.js";
import { queryAll, queryOne } from "../truth/sqlite/query-helper.js";

export class SqliteDlqRepository implements DlqRepository {
  public constructor(private readonly conn: SqliteConnection) {
    this.ensureDetailsTable();
  }

  public insert(record: ExtendedDeadLetterRecord): void {
    this.conn
      .prepare(
        `INSERT INTO dlq_records (
          dead_letter_id, source_event_id, consumer_id, error_code, payload_json,
          status, retry_count, next_retry_at, created_at, updated_at,
          original_timestamp, failure_category, retry_exhausted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.deadLetterId,
        record.sourceEventId,
        record.consumerId,
        record.errorCode,
        record.payloadJson,
        record.status,
        record.retryCount,
        record.nextRetryAt,
        record.createdAt,
        record.updatedAt,
        record.originalTimestamp,
        record.failureCategory,
        record.retryExhaustedAt,
      );
    this.upsertDetails(record);
  }

  public findById(deadLetterId: string): ExtendedDeadLetterRecord | null {
    const row = queryOne<SqliteDlqBaseRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        consumer_id AS consumerId,
        error_code AS errorCode,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        retry_exhausted_at AS retryExhaustedAt
       FROM dlq_records
       WHERE dead_letter_id = ?`,
      deadLetterId,
    );
    return row ? this.rowToRecord(row, this.getDetails(row.deadLetterId)) : null;
  }

  public update(record: ExtendedDeadLetterRecord): void {
    const result = this.conn
      .prepare(
        `UPDATE dlq_records SET
          source_event_id = ?,
          consumer_id = ?,
          error_code = ?,
          payload_json = ?,
          status = ?,
          retry_count = ?,
          next_retry_at = ?,
          updated_at = ?,
          original_timestamp = ?,
          failure_category = ?,
          retry_exhausted_at = ?
         WHERE dead_letter_id = ?`,
      )
      .run(
        record.sourceEventId,
        record.consumerId,
        record.errorCode,
        record.payloadJson,
        record.status,
        record.retryCount,
        record.nextRetryAt,
        record.updatedAt,
        record.originalTimestamp,
        record.failureCategory,
        record.retryExhaustedAt,
        record.deadLetterId,
      );

    if (result.changes === 0) {
      // Record doesn't exist, insert it
      this.insert(record);
      return;
    }
    this.upsertDetails(record);
  }

  public listAll(): ExtendedDeadLetterRecord[] {
    const rows = queryAll<SqliteDlqBaseRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        consumer_id AS consumerId,
        error_code AS errorCode,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        retry_exhausted_at AS retryExhaustedAt
       FROM dlq_records
       ORDER BY created_at ASC`,
    );
    const detailsById = this.getDetailsByIds(rows.map((row) => row.deadLetterId));
    return rows.map((row) => this.rowToRecord(row, detailsById.get(row.deadLetterId) ?? null));
  }

  public listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
    const rows = queryAll<SqliteDlqBaseRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        consumer_id AS consumerId,
        error_code AS errorCode,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        retry_exhausted_at AS retryExhaustedAt
       FROM dlq_records
       WHERE consumer_id = ?
       ORDER BY created_at ASC`,
      consumerId,
    );
    const detailsById = this.getDetailsByIds(rows.map((row) => row.deadLetterId));
    return rows.map((row) => this.rowToRecord(row, detailsById.get(row.deadLetterId) ?? null));
  }

  public listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
    const rows = queryAll<SqliteDlqBaseRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        consumer_id AS consumerId,
        error_code AS errorCode,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        retry_exhausted_at AS retryExhaustedAt
       FROM dlq_records
       WHERE status = 'retrying'
         AND next_retry_at IS NOT NULL
         AND next_retry_at <= ?
       ORDER BY next_retry_at ASC, created_at ASC`,
      asOf,
    );
    const detailsById = this.getDetailsByIds(rows.map((row) => row.deadLetterId));
    return rows.map((row) => this.rowToRecord(row, detailsById.get(row.deadLetterId) ?? null));
  }

  private ensureDetailsTable(): void {
    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS dlq_record_details (
        dead_letter_id TEXT PRIMARY KEY,
        event_type TEXT NULL,
        error_message TEXT NULL,
        max_retries INTEGER NULL,
        first_failed_at TEXT NULL,
        last_failed_at TEXT NULL,
        reason TEXT NULL,
        last_attempt_at TEXT NULL,
        linked_incident_id TEXT NULL,
        operator_action_log_json TEXT NULL,
        FOREIGN KEY(dead_letter_id) REFERENCES dlq_records(dead_letter_id) ON DELETE CASCADE
      );
    `);
  }

  private upsertDetails(record: ExtendedDeadLetterRecord): void {
    this.conn
      .prepare(
        `INSERT INTO dlq_record_details (
          dead_letter_id, event_type, error_message, max_retries,
          first_failed_at, last_failed_at, reason, last_attempt_at,
          linked_incident_id, operator_action_log_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dead_letter_id) DO UPDATE SET
          event_type = excluded.event_type,
          error_message = excluded.error_message,
          max_retries = excluded.max_retries,
          first_failed_at = excluded.first_failed_at,
          last_failed_at = excluded.last_failed_at,
          reason = excluded.reason,
          last_attempt_at = excluded.last_attempt_at,
          linked_incident_id = excluded.linked_incident_id,
          operator_action_log_json = excluded.operator_action_log_json`,
      )
      .run(
        record.deadLetterId,
        record.eventType,
        record.errorMessage,
        record.maxRetries,
        record.firstFailedAt,
        record.lastFailedAt,
        record.reason,
        record.lastAttemptAt,
        record.linkedIncidentId,
        JSON.stringify(record.operatorActionLog),
      );
  }

  private getDetails(deadLetterId: string): SqliteDlqDetailsRow | null {
    return queryOne<SqliteDlqDetailsRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        event_type AS eventType,
        error_message AS errorMessage,
        max_retries AS maxRetries,
        first_failed_at AS firstFailedAt,
        last_failed_at AS lastFailedAt,
        reason,
        last_attempt_at AS lastAttemptAt,
        linked_incident_id AS linkedIncidentId,
        operator_action_log_json AS operatorActionLogJson
       FROM dlq_record_details
       WHERE dead_letter_id = ?`,
      deadLetterId,
    ) ?? null;
  }

  private getDetailsByIds(deadLetterIds: readonly string[]): Map<string, SqliteDlqDetailsRow> {
    if (deadLetterIds.length === 0) {
      return new Map();
    }
    const placeholders = deadLetterIds.map(() => "?").join(", ");
    const rows = queryAll<SqliteDlqDetailsRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        event_type AS eventType,
        error_message AS errorMessage,
        max_retries AS maxRetries,
        first_failed_at AS firstFailedAt,
        last_failed_at AS lastFailedAt,
        reason,
        last_attempt_at AS lastAttemptAt,
        linked_incident_id AS linkedIncidentId,
        operator_action_log_json AS operatorActionLogJson
       FROM dlq_record_details
       WHERE dead_letter_id IN (${placeholders})`,
      ...deadLetterIds,
    );
    return new Map(rows.map((row) => [row.deadLetterId, row]));
  }

  private rowToRecord(row: SqliteDlqBaseRow, details: SqliteDlqDetailsRow | null): ExtendedDeadLetterRecord {
    return {
      deadLetterId: row.deadLetterId,
      sourceEventId: row.sourceEventId,
      eventType: details?.eventType ?? row.errorCode,
      consumerId: row.consumerId,
      errorCode: row.errorCode,
      errorMessage: details?.errorMessage ?? null,
      payloadJson: row.payloadJson,
      status: row.status as DeadLetterStatus,
      retryCount: row.retryCount,
      maxRetries: details?.maxRetries ?? 5,
      nextRetryAt: row.nextRetryAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      originalTimestamp: row.originalTimestamp,
      firstFailedAt: details?.firstFailedAt ?? row.originalTimestamp ?? row.createdAt,
      lastFailedAt: details?.lastFailedAt ?? row.updatedAt,
      failureCategory: row.failureCategory as ExtendedDeadLetterRecord["failureCategory"],
      reason: details?.reason ?? null,
      retryExhaustedAt: row.retryExhaustedAt,
      lastAttemptAt: details?.lastAttemptAt ?? null,
      linkedIncidentId: details?.linkedIncidentId ?? null,
      operatorActionLog: details?.operatorActionLogJson
        ? (JSON.parse(details.operatorActionLogJson) as OperatorActionRecord[])
        : [],
    };
  }
}

interface SqliteDlqBaseRow {
  deadLetterId: string;
  sourceEventId: string;
  consumerId: string;
  errorCode: string;
  payloadJson: string;
  status: string;
  retryCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  originalTimestamp: string | null;
  failureCategory: string | null;
  retryExhaustedAt: string | null;
}

interface SqliteDlqDetailsRow {
  deadLetterId: string;
  eventType: string | null;
  errorMessage: string | null;
  maxRetries: number | null;
  firstFailedAt: string | null;
  lastFailedAt: string | null;
  reason: string | null;
  lastAttemptAt: string | null;
  linkedIncidentId: string | null;
  operatorActionLogJson: string | null;
}
