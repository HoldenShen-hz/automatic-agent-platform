/**
 * OutboxRepository - Data access for the transactional outbox pattern.
 */
import { type OutboxInsertPayload, type OutboxRecord, OutboxStatus } from "./outbox-types.js";
import type { SqliteConnection } from "../../state-evidence/truth/sqlite/query-helper.js";
export declare class OutboxRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertOutboxEntry(aggregateType: string, aggregateId: string, eventType: string, payloadJson: string, traceId: string | null, createdAt: string): OutboxRecord;
    insertOutboxEntries(entries: OutboxInsertPayload[]): OutboxRecord[];
    markPublished(id: string, publishedAt: string): void;
    markFailed(id: string, error: string, newRetryCount: number, lastAttemptAt: string): void;
    listPendingEntries(limit?: number): OutboxRecord[];
    listFailedEntries(limit?: number): OutboxRecord[];
    countPending(): number;
    countFailed(): number;
    getStatus(id: string): {
        status: OutboxStatus;
        retryCount: number;
    } | undefined;
    cleanupPublishedBefore(daysOld: number): number;
}
