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
  public constructor(private readonly conn: SqliteConnection) {}

  public insert(record: ExtendedDeadLetterRecord): void {
    this.conn
      .prepare(
        `INSERT INTO dlq_records (
          dead_letter_id, source_event_id, event_type, consumer_id, error_code,
          error_message, payload_json, status, retry_count, max_retries,
          next_retry_at, created_at, updated_at, original_timestamp,
          failure_category, reason, retry_exhausted_at, last_attempt_at,
          operator_action_log_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.deadLetterId,
        record.sourceEventId,
        record.eventType,
        record.consumerId,
        record.errorCode,
        record.errorMessage,
        record.payloadJson,
        record.status,
        record.retryCount,
        record.maxRetries,
        record.nextRetryAt,
        record.createdAt,
        record.updatedAt,
        record.originalTimestamp,
        record.failureCategory,
        record.reason,
        record.retryExhaustedAt,
        record.lastAttemptAt,
        JSON.stringify(record.operatorActionLog),
      );
  }

  public findById(deadLetterId: string): ExtendedDeadLetterRecord | null {
    const row = queryOne<SqliteDlqRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        event_type AS eventType,
        consumer_id AS consumerId,
        error_code AS errorCode,
        error_message AS errorMessage,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        max_retries AS maxRetries,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        reason,
        retry_exhausted_at AS retryExhaustedAt,
        last_attempt_at AS lastAttemptAt,
        operator_action_log_json AS operatorActionLogJson
       FROM dlq_records
       WHERE dead_letter_id = ?`,
      deadLetterId,
    );
    return row ? this.rowToRecord(row) : null;
  }

  public update(record: ExtendedDeadLetterRecord): void {
    const result = this.conn
      .prepare(
        `UPDATE dlq_records SET
          source_event_id = ?,
          event_type = ?,
          consumer_id = ?,
          error_code = ?,
          error_message = ?,
          payload_json = ?,
          status = ?,
          retry_count = ?,
          max_retries = ?,
          next_retry_at = ?,
          updated_at = ?,
          original_timestamp = ?,
          failure_category = ?,
          reason = ?,
          retry_exhausted_at = ?,
          last_attempt_at = ?,
          operator_action_log_json = ?
         WHERE dead_letter_id = ?`,
      )
      .run(
        record.sourceEventId,
        record.eventType,
        record.consumerId,
        record.errorCode,
        record.errorMessage,
        record.payloadJson,
        record.status,
        record.retryCount,
        record.maxRetries,
        record.nextRetryAt,
        record.updatedAt,
        record.originalTimestamp,
        record.failureCategory,
        record.reason,
        record.retryExhaustedAt,
        record.lastAttemptAt,
        JSON.stringify(record.operatorActionLog),
        record.deadLetterId,
      );

    if (result.changes === 0) {
      // Record doesn't exist, insert it
      this.insert(record);
    }
  }

  public listAll(): ExtendedDeadLetterRecord[] {
    const rows = queryAll<SqliteDlqRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        event_type AS eventType,
        consumer_id AS consumerId,
        error_code AS errorCode,
        error_message AS errorMessage,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        max_retries AS maxRetries,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        reason,
        retry_exhausted_at AS retryExhaustedAt,
        last_attempt_at AS lastAttemptAt,
        operator_action_log_json AS operatorActionLogJson
       FROM dlq_records
       ORDER BY created_at ASC`,
    );
    return rows.map((row) => this.rowToRecord(row));
  }

  public listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
    const rows = queryAll<SqliteDlqRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        event_type AS eventType,
        consumer_id AS consumerId,
        error_code AS errorCode,
        error_message AS errorMessage,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        max_retries AS maxRetries,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        reason,
        retry_exhausted_at AS retryExhaustedAt,
        last_attempt_at AS lastAttemptAt,
        operator_action_log_json AS operatorActionLogJson
       FROM dlq_records
       WHERE consumer_id = ?
       ORDER BY created_at ASC`,
      consumerId,
    );
    return rows.map((row) => this.rowToRecord(row));
  }

  public listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
    const rows = queryAll<SqliteDlqRow>(
      this.conn,
      `SELECT
        dead_letter_id AS deadLetterId,
        source_event_id AS sourceEventId,
        event_type AS eventType,
        consumer_id AS consumerId,
        error_code AS errorCode,
        error_message AS errorMessage,
        payload_json AS payloadJson,
        status,
        retry_count AS retryCount,
        max_retries AS maxRetries,
        next_retry_at AS nextRetryAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        original_timestamp AS originalTimestamp,
        failure_category AS failureCategory,
        reason,
        retry_exhausted_at AS retryExhaustedAt,
        last_attempt_at AS lastAttemptAt,
        operator_action_log_json AS operatorActionLogJson
       FROM dlq_records
       WHERE status = 'retrying'
         AND next_retry_at IS NOT NULL
         AND next_retry_at <= ?
       ORDER BY next_retry_at ASC, created_at ASC`,
      asOf,
    );
    return rows.map((row) => this.rowToRecord(row));
  }

  private rowToRecord(row: SqliteDlqRow): ExtendedDeadLetterRecord {
    return {
      deadLetterId: row.deadLetterId,
      sourceEventId: row.sourceEventId,
      eventType: row.eventType ?? "",
      consumerId: row.consumerId,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      payloadJson: row.payloadJson,
      status: row.status as DeadLetterStatus,
      retryCount: row.retryCount,
      maxRetries: row.maxRetries,
      nextRetryAt: row.nextRetryAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      originalTimestamp: row.originalTimestamp,
      failureCategory: row.failureCategory as ExtendedDeadLetterRecord["failureCategory"],
      reason: row.reason,
      retryExhaustedAt: row.retryExhaustedAt,
      lastAttemptAt: row.lastAttemptAt,
      operatorActionLog: row.operatorActionLogJson
        ? (JSON.parse(row.operatorActionLogJson) as OperatorActionRecord[])
        : [],
    };
  }
}

interface SqliteDlqRow {
  deadLetterId: string;
  sourceEventId: string;
  eventType: string | null;
  consumerId: string;
  errorCode: string;
  errorMessage: string | null;
  payloadJson: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  originalTimestamp: string | null;
  failureCategory: string | null;
  reason: string | null;
  retryExhaustedAt: string | null;
  lastAttemptAt: string | null;
  operatorActionLogJson: string | null;
}
