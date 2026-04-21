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
export declare class DeadLetterQueueService {
    private readonly records;
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
    summarize(): DeadLetterQueueSummary;
    private getRequired;
}
