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
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * Transactional Event Appender
 *
 * Ensures atomic updates to both the event log and truth table.
 * Uses database transactions to guarantee consistency.
 */
export class TransactionalEventAppender {
    db;
    eventRepository;
    outboxRepository;
    constructor(db, eventRepository, outboxRepository) {
        this.db = db;
        this.eventRepository = eventRepository;
        this.outboxRepository = outboxRepository;
    }
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
    appendEvent(eventData, options = {}) {
        const eventId = eventData.id ?? newId("evt");
        const now = nowIso();
        const event = {
            id: eventId,
            taskId: eventData.taskId ?? null,
            sessionId: null,
            executionId: eventData.executionId ?? null,
            eventType: eventData.eventType,
            eventTier: options.eventTier ?? "tier_2",
            payloadJson: eventData.payloadJson,
            traceId: options.traceId ?? null,
            createdAt: now,
        };
        // Use a transaction to ensure atomicity
        this.db.connection.exec("BEGIN TRANSACTION");
        try {
            // Step 1: Insert event into event store
            const insertedEvent = this.insertEventInternal(event);
            // Step 2: Optionally write to outbox
            let outboxEntryId;
            if (options.writeToOutbox) {
                outboxEntryId = this.writeOutboxEntryInternal(event, options.traceId);
            }
            this.db.connection.exec("COMMIT");
            return {
                event: insertedEvent,
                outboxEntryId,
            };
        }
        catch (error) {
            this.db.connection.exec("ROLLBACK");
            throw error;
        }
    }
    /**
     * Append multiple events in a single transaction
     */
    appendEvents(events, options = {}) {
        const results = [];
        this.db.connection.exec("BEGIN TRANSACTION");
        try {
            for (const eventData of events) {
                const eventId = eventData.id ?? newId("evt");
                const now = nowIso();
                const event = {
                    id: eventId,
                    taskId: eventData.taskId ?? null,
                    sessionId: null,
                    executionId: eventData.executionId ?? null,
                    eventType: eventData.eventType,
                    eventTier: options.eventTier ?? "tier_2",
                    payloadJson: eventData.payloadJson,
                    traceId: options.traceId ?? null,
                    createdAt: now,
                };
                const insertedEvent = this.insertEventInternal(event);
                let outboxEntryId;
                if (options.writeToOutbox) {
                    outboxEntryId = this.writeOutboxEntryInternal(event, options.traceId);
                }
                results.push({ event: insertedEvent, outboxEntryId });
            }
            this.db.connection.exec("COMMIT");
            return results;
        }
        catch (error) {
            this.db.connection.exec("ROLLBACK");
            throw error;
        }
    }
    /**
     * Insert event without transaction wrapper (internal use)
     */
    insertEventInternal(event) {
        this.db.connection
            .prepare(`INSERT INTO events (
          id, task_id, session_id, execution_id, event_type, event_tier,
          payload_json, trace_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(event.id, event.taskId, event.sessionId, event.executionId, event.eventType, event.eventTier, event.payloadJson, event.traceId, event.createdAt);
        return event;
    }
    /**
     * Write outbox entry without transaction wrapper (internal use)
     */
    writeOutboxEntryInternal(event, traceId) {
        const outboxId = newId("outbox");
        const payload = {
            eventId: event.id,
            eventType: event.eventType,
            taskId: event.taskId,
            executionId: event.executionId,
            payload: JSON.parse(event.payloadJson),
        };
        this.db.connection
            .prepare(`INSERT INTO outbox (
          id, aggregate_type, aggregate_id, event_type,
          payload_json, trace_id, created_at, published_at, retry_count, last_error, last_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL)`)
            .run(outboxId, event.taskId ? "task" : "system", event.taskId ?? "unknown", event.eventType, JSON.stringify(payload), traceId ?? null, event.createdAt);
        return outboxId;
    }
}
//# sourceMappingURL=transactional-event-appender.js.map