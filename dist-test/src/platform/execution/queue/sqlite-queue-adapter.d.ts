import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type DequeueResult, type EnqueueInput, type QueueAdapter, type QueueBackendKind, type QueueJobRecord, type QueueJobStatus, type QueueStats } from "./queue-adapter-types.js";
export declare class SqliteQueueAdapter implements QueueAdapter {
    private readonly db;
    readonly backendKind: QueueBackendKind;
    constructor(db: AuthoritativeSqlDatabase);
    enqueue(input: EnqueueInput): QueueJobRecord;
    dequeue(queueName: string): DequeueResult | null;
    getJob(jobId: string): QueueJobRecord | null;
    listJobs(queueName: string, status?: QueueJobStatus, limit?: number): QueueJobRecord[];
    moveToDeadLetter(jobId: string, reason: string): void;
    retryJob(jobId: string): QueueJobRecord | null;
    purge(queueName: string, olderThan: string): number;
    stats(queueName: string): QueueStats;
    listQueues(): string[];
    private mapRow;
}
