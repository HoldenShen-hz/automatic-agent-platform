/**
 * Transactional Event Appender
 *
 * Implements §25.2 "Truth Table + Event Log dual model" requirement.
 * Provides transactional consistency between truth table updates and event append.
 *
 * ## Requirements per §25.2
 *
 * Truth table and event log must be updated in the SAME TRANSACTION:
 * - Truth table: saves current state (read optimization)
 * - Event log: saves historical changes (audit/replay optimization)
 * - Both updated atomically in one transaction for consistency
 *
 * @see docs_zh/architecture/00-platform-architecture.md §25.2
 */

import type { EventRecord } from "../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import type { EventRepository } from "../truth/sqlite/repositories/event-repository.js";
import type { OutboxRepository } from "../../shared/outbox/outbox-repository.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Options for transactional event append
 */
export interface TransactionalAppendOptions {
  /** Whether to also write to outbox for async processing */
  writeToOutbox?: boolean;
  /** Trace ID for distributed tracing */
  traceId?: string | null;
  /** Event tier (defaults to auto-detect based on event type) */
  eventTier?: EventRecord["eventTier"];
  /**
   * Optional truth-table mutation to run inside the same database transaction as the event append.
   * This closes the gap where callers previously had no way to atomically update truth + event.
   */
  mutateTruth?: (db: AuthoritativeSqlDatabase) => void;
}

/**
 * Result of transactional event append
 */
export interface TransactionalAppendResult {
  /** The appended event record */
  event: EventRecord;
  /** The outbox entry ID if written to outbox */
  outboxEntryId: string | undefined;
}

/**
 * Transactional Event Appender
 *
 * Ensures atomic updates to both the event log and truth table.
 * Uses database transactions to guarantee consistency.
 */
export class TransactionalEventAppender {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly eventRepository: EventRepository,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  /**
   * Append an event within a transaction, optionally also writing to outbox.
   *
   * This method ensures that both:
   * 1. The event is appended to the event store
   * 2. (Optionally) An outbox entry is written for async processing
   *
   * Both operations happen in the same transaction, guaranteeing consistency.
   *
   * @param eventData - The event data to append
   * @param options - Append options
   * @returns The appended event record and optional outbox entry ID
   */
  public appendEvent(
    eventData: {
      id?: string;
      taskId?: string | null;
      executionId?: string | null;
      eventType: string;
      payloadJson: string;
    },
    options: TransactionalAppendOptions = {},
  ): TransactionalAppendResult {
    const eventId = eventData.id ?? newId("evt");
    const now = nowIso();

    const event: EventRecord = {
      id: eventId,
      taskId: eventData.taskId ?? null,
      sessionId: null,
      executionId: eventData.executionId ?? null,
      eventType: eventData.eventType,
      eventTier: options.eventTier ?? "tier_2",
      payloadJson: eventData.payloadJson,
      traceId: options.traceId ?? null,
      createdAt: now,
      schemaVersion: null,
      aggregateId: null,
      runId: null,
      sequence: null,
      causationId: null,
      correlationId: null,
      payloadHash: null,
      idempotencyKey: null,
      replayBehavior: null,
      principal: null,
      evidenceRefs: [],
    };

    // Use a transaction to ensure atomicity - uses the db.transaction() wrapper
    // which properly handles BEGIN/COMMIT/ROLLBACK and provides nested transaction safety
    return this.db.transaction(() => {
      options.mutateTruth?.(this.db);

      // Step 1: Insert event into event store
      const insertedEvent = this.insertEventInternal(event);

      // Step 2: Optionally write to outbox
      let outboxEntryId: string | undefined;
      if (options.writeToOutbox) {
        outboxEntryId = this.writeOutboxEntryInternal(
          event,
          options.traceId,
        );
      }

      return {
        event: insertedEvent,
        outboxEntryId,
      };
    });
  }

  /**
   * Append multiple events in a single transaction
   */
  public appendEvents(
    events: Array<{
      id?: string;
      taskId?: string | null;
      executionId?: string | null;
      eventType: string;
      payloadJson: string;
    }>,
    options: TransactionalAppendOptions = {},
  ): TransactionalAppendResult[] {
    // Use a transaction to ensure atomicity - uses the db.transaction() wrapper
    // which properly handles BEGIN/COMMIT/ROLLBACK and provides nested transaction safety
    return this.db.transaction(() => {
      options.mutateTruth?.(this.db);

      const results: TransactionalAppendResult[] = [];

      for (const eventData of events) {
        const eventId = eventData.id ?? newId("evt");
        const now = nowIso();

        const event: EventRecord = {
          id: eventId,
          taskId: eventData.taskId ?? null,
          sessionId: null,
          executionId: eventData.executionId ?? null,
          eventType: eventData.eventType,
          eventTier: options.eventTier ?? "tier_2",
          payloadJson: eventData.payloadJson,
          traceId: options.traceId ?? null,
          createdAt: now,
          schemaVersion: null,
          aggregateId: null,
          runId: null,
          sequence: null,
          causationId: null,
          correlationId: null,
          payloadHash: null,
          idempotencyKey: null,
          replayBehavior: null,
          principal: null,
          evidenceRefs: [],
        };

        const insertedEvent = this.insertEventInternal(event);
        let outboxEntryId: string | undefined;

        if (options.writeToOutbox) {
          outboxEntryId = this.writeOutboxEntryInternal(event, options.traceId);
        }

        results.push({ event: insertedEvent, outboxEntryId });
      }

      return results;
    });
  }

  /**
   * Insert event without transaction wrapper (internal use)
   */
  private insertEventInternal(event: EventRecord): EventRecord {
    this.db.connection
      .prepare(
        `INSERT INTO events (
          id, task_id, session_id, execution_id, event_type, event_tier,
          payload_json, trace_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.taskId,
        event.sessionId,
        event.executionId,
        event.eventType,
        event.eventTier,
        event.payloadJson,
        event.traceId,
        event.createdAt,
      );

    return event;
  }

  /**
   * Write outbox entry without transaction wrapper (internal use)
   */
  private writeOutboxEntryInternal(
    event: EventRecord,
    traceId?: string | null,
  ): string {
    const outboxId = newId("outbox");
    const payload = {
      eventId: event.id,
      eventType: event.eventType,
      taskId: event.taskId,
      executionId: event.executionId,
      payload: JSON.parse(event.payloadJson),
    };

    this.db.connection
      .prepare(
        `INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)`,
      )
      .run(
        outboxId,
        event.taskId ? "task" : "system",
        event.taskId ?? "unknown",
        event.eventType,
        JSON.stringify(payload),
        traceId ?? null,
        event.createdAt,
      );

    return outboxId;
  }
}
