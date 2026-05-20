/**
 * SqliteDeadLetterQueueRepository - SQLite-backed DLQ persistence.
 *
 * Provides persistent storage for Dead Letter Queue records using SQLite.
 * This replaces the in-memory Map to survive process restarts.
 */

import type { DeadLetterRecord, DeadLetterQueueRepository } from "../../../dlq/index.js";
import type { SqliteConnection } from "../query-helper.js";
import { queryAll, queryOne } from "../query-helper.js";

export class SqliteDeadLetterQueueRepository implements DeadLetterQueueRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insert(record: DeadLetterRecord): void {
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
  }

  public findById(deadLetterId: string): DeadLetterRecord | null {
    return queryOne<DeadLetterRecord>(
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
    ) ?? null;
  }

  public update(record: DeadLetterRecord): void {
    this.conn
      .prepare(
        `INSERT INTO dlq_records (
          dead_letter_id, source_event_id, consumer_id, error_code, payload_json,
          status, retry_count, next_retry_at, created_at, updated_at,
          original_timestamp, failure_category, retry_exhausted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(dead_letter_id) DO UPDATE SET
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
        `,
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
      );
  }

  public listAll(): DeadLetterRecord[] {
    return queryAll<DeadLetterRecord>(
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
  }

  public listByConsumer(consumerId: string): DeadLetterRecord[] {
    return queryAll<DeadLetterRecord>(
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
  }

  public listRetryable(asOf: string): DeadLetterRecord[] {
    return queryAll<DeadLetterRecord>(
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
  }
}
