/**
 * EventRepository - Data access for events, acknowledgements, and Tier 1 audit state.
 */
import type { DispatchDecisionTrace, EventConsumerAckRecord, EventDeadLetterRecord, EventRecord } from "../../../../contracts/types/domain.js";
import { type Tier1AuditIntegrityReport } from "../../../../control-plane/iam/audit-event-integrity.js";
import type { SqliteConnection } from "../query-helper.js";
import { type PendingAckEvent, type PendingTier1AckRecord, type Tier1EventRegistryCoverageRecord } from "../authoritative-task-store-types.js";
export declare class EventRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & {
        eventTier?: EventRecord["eventTier"];
        sessionId?: string | null;
    }): EventRecord;
    insertEventDeadLetter(record: EventDeadLetterRecord): void;
    listEventDeadLetters(limit?: number): EventDeadLetterRecord[];
    listEventsByType(eventType: string, limit?: number): EventRecord[];
    /**
     * List all events with optional pagination and filtering.
     * Used for projection rebuild to replay all events.
     */
    listAllEvents(limit?: number, offset?: number): EventRecord[];
    insertEventConsumerAck(ack: EventConsumerAckRecord): void;
    markEventAck(eventId: string, consumerId: string): void;
    markEventAck(input: {
        eventId: string;
        consumerId: string;
        status: EventConsumerAckRecord["status"];
        occurredAt: string;
        errorCode?: string | null;
    }): void;
    markEventDeadLettered(input: {
        eventId: string;
        consumerId: string;
        occurredAt: string;
        errorCode: string;
    }): void;
    getEventConsumerAck(eventId: string, consumerId: string): EventConsumerAckRecord | undefined;
    getRequiredConsumerIds(eventId: string): string[];
    ackAllConsumersForEvent(eventId: string, occurredAt: string): void;
    ensureEventConsumerAckPending(eventId: string, consumerId: string): void;
    listPendingEventsForConsumer(consumerId: string, limit?: number): PendingAckEvent[];
    listFailedEventsForConsumer(consumerId: string): PendingAckEvent[];
    resetConsumerReplayState(consumerId: string): number;
    listEventsForTask(taskId: string, limit?: number): EventRecord[];
    listEventsForTask(taskId: string, tenantId?: string | null): EventRecord[];
    getEvent(eventId: string): EventRecord | undefined;
    listDispatchDecisionTracesByTask(taskId: string, tenantId?: string | null): DispatchDecisionTrace[];
    listDispatchDecisionTracesByExecution(executionId: string): DispatchDecisionTrace[];
    listTier1EventRegistryCoverage(): Tier1EventRegistryCoverageRecord[];
    getTier1AuditIntegrityReport(): Tier1AuditIntegrityReport;
    bootstrapTier1AuditIntegrityRecords(): void;
    listPendingTier1Acks(createdBefore: string): PendingTier1AckRecord[];
    countPendingTier1Acks(): number;
    countFailedTier1Acks(): number;
    createTier1StatusEvent(input: {
        taskId: string;
        executionId: string | null;
        eventType: string;
        traceId: string;
        payload: Record<string, unknown>;
    }): EventRecord;
}
