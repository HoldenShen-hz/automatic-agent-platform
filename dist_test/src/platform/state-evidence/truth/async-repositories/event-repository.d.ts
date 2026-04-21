/**
 * AsyncEventRepository - Async data access for events and acknowledgements.
 */
import type { EventConsumerAckRecord, EventDeadLetterRecord, EventRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncEventRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertEvent(event: Omit<EventRecord, "eventTier" | "sessionId"> & {
        eventTier?: EventRecord["eventTier"];
        sessionId?: string | null;
    }): Promise<EventRecord>;
    insertEventDeadLetter(record: EventDeadLetterRecord): Promise<void>;
    listEventDeadLetters(limit?: number): Promise<EventDeadLetterRecord[]>;
    listEventsByType(eventType: string, limit?: number): Promise<EventRecord[]>;
    insertEventConsumerAck(ack: EventConsumerAckRecord): Promise<void>;
    markEventAck(eventId: string, consumerId: string, status: EventConsumerAckRecord["status"], occurredAt: string, errorCode?: string | null): Promise<void>;
    markEventDeadLettered(input: {
        eventId: string;
        consumerId: string;
        occurredAt: string;
        errorCode: string;
    }): Promise<void>;
    getEventConsumerAck(eventId: string, consumerId: string): Promise<EventConsumerAckRecord | null>;
    getRequiredConsumerIds(eventId: string): Promise<string[]>;
    ackAllConsumersForEvent(eventId: string, occurredAt: string): Promise<void>;
    listEventsForTask(taskId: string, tenantIdOrLimit?: string | number | null): Promise<EventRecord[]>;
    getEvent(eventId: string): Promise<EventRecord | null>;
    countPendingTier1Acks(): Promise<number>;
    countFailedTier1Acks(): Promise<number>;
}
