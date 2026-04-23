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
export declare class TransactionalEventAppender {
    private readonly db;
    private readonly eventRepository;
    private readonly outboxRepository;
    constructor(db: AuthoritativeSqlDatabase, eventRepository: EventRepository, outboxRepository: OutboxRepository);
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
    appendEvent(eventData: {
        id?: string;
        taskId?: string | null;
        executionId?: string | null;
        eventType: string;
        payloadJson: string;
    }, options?: TransactionalAppendOptions): TransactionalAppendResult;
    /**
     * Append multiple events in a single transaction
     */
    appendEvents(events: Array<{
        id?: string;
        taskId?: string | null;
        executionId?: string | null;
        eventType: string;
        payloadJson: string;
    }>, options?: TransactionalAppendOptions): TransactionalAppendResult[];
    /**
     * Insert event without transaction wrapper (internal use)
     */
    private insertEventInternal;
    /**
     * Write outbox entry without transaction wrapper (internal use)
     */
    private writeOutboxEntryInternal;
}
