export type DeadLetterStatus = "pending" | "retrying" | "discarded" | "resolved";
export interface DeadLetterRecord {
    deadLetterId: string;
    sourceEventId: string;
    consumerId: string;
    errorCode: string;
    payloadJson: string;
    status: DeadLetterStatus;
    retryCount: number;
    nextRetryAt: string | null;
    createdAt: string;
    updatedAt: string;
    /** §28: Original timestamp when the failed event occurred */
    originalTimestamp: string | null;
    /** §28: Category classification for the failure */
    failureCategory: string | null;
    /** §28: Timestamp when all retries were exhausted */
    retryExhaustedAt: string | null;
}
export interface DeadLetterQueueSummary {
    totalRecords: number;
    statusCounts: Record<DeadLetterStatus, number>;
    consumerCounts: Record<string, number>;
    pendingConsumers: string[];
    maxRetryCount: number;
}
/**
 * Repository interface for DLQ persistence.
 * Implementations can use SQLite, PostgreSQL, or in-memory storage.
 */
export interface DeadLetterQueueRepository {
    /** Insert a new DLQ record */
    insert(record: DeadLetterRecord): void;
    /** Find a DLQ record by ID */
    findById(deadLetterId: string): DeadLetterRecord | null;
    /** Update an existing DLQ record */
    update(record: DeadLetterRecord): void;
    /** List all DLQ records */
    listAll(): DeadLetterRecord[];
    /** List DLQ records by consumer ID */
    listByConsumer(consumerId: string): DeadLetterRecord[];
    /** List retryable DLQ records due by the specified instant */
    listRetryable(asOf: string): DeadLetterRecord[];
}
/**
 * In-memory implementation of DLQ repository for backward compatibility
 * and environments without persistent storage.
 */
export declare class InMemoryDeadLetterQueueRepository implements DeadLetterQueueRepository {
    private readonly records;
    insert(record: DeadLetterRecord): void;
    findById(deadLetterId: string): DeadLetterRecord | null;
    update(record: DeadLetterRecord): void;
    listAll(): DeadLetterRecord[];
    listByConsumer(consumerId: string): DeadLetterRecord[];
    listRetryable(asOf: string): DeadLetterRecord[];
}
export declare class DeadLetterQueueService {
    private readonly repo;
    /**
     * Create a DLQ service with an optional repository.
     * @param repo - Optional repository for persistence. Defaults to in-memory storage.
     */
    constructor(repo?: DeadLetterQueueRepository);
    enqueue(input: {
        sourceEventId: string;
        consumerId: string;
        errorCode: string;
        payloadJson: string;
        originalTimestamp?: string | null;
        failureCategory?: string | null;
    }): DeadLetterRecord;
    scheduleRetry(deadLetterId: string, delayMs: number): DeadLetterRecord;
    markResolved(deadLetterId: string): DeadLetterRecord;
    discard(deadLetterId: string, reason: string): DeadLetterRecord;
    /** §28: Mark a DLQ entry as retry-exhausted */
    markRetryExhausted(deadLetterId: string): DeadLetterRecord;
    /** §28: Set failure category on a DLQ entry */
    setFailureCategory(deadLetterId: string, category: string): DeadLetterRecord;
    listByConsumer(consumerId: string): DeadLetterRecord[];
    listAll(): DeadLetterRecord[];
    get(deadLetterId: string): DeadLetterRecord | null;
    listRetryable(asOf?: string): DeadLetterRecord[];
    summarize(): DeadLetterQueueSummary;
    private getRequired;
}
export interface DeadLetterQueueRetryWorkerResult {
    attempted: number;
    resolved: number;
    rescheduled: number;
    failed: number;
}
export declare class DeadLetterQueueRetryWorker {
    private readonly queue;
    constructor(queue: DeadLetterQueueService);
    runDueRetries(retry: (record: DeadLetterRecord) => {
        outcome: "resolved" | "retry";
        delayMs?: number;
    } | Promise<{
        outcome: "resolved" | "retry";
        delayMs?: number;
    }>, asOf?: string): Promise<DeadLetterQueueRetryWorkerResult>;
    private process;
}
