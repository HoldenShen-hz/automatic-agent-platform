/**
 * SqliteDeadLetterQueueRepository - SQLite-backed DLQ persistence.
 *
 * Provides persistent storage for Dead Letter Queue records using SQLite.
 * This replaces the in-memory Map to survive process restarts.
 */
import type { DeadLetterRecord, DeadLetterQueueRepository } from "../../../dlq/index.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class SqliteDeadLetterQueueRepository implements DeadLetterQueueRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insert(record: DeadLetterRecord): void;
    findById(deadLetterId: string): DeadLetterRecord | null;
    update(record: DeadLetterRecord): void;
    listAll(): DeadLetterRecord[];
    listByConsumer(consumerId: string): DeadLetterRecord[];
    listRetryable(asOf: string): DeadLetterRecord[];
}
