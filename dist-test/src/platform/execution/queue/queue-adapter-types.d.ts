/**
 * @fileoverview Shared queue adapter types and SQLite DDL.
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { RedisConnectionConfig } from "../../shared/utils/redis-client-options.js";
export type QueueBackendKind = "sqlite" | "redis";
export type QueueJobStatus = "waiting" | "delayed" | "active" | "completed" | "failed" | "dead_letter";
export interface QueueJobRecord {
    id: string;
    queueName: string;
    payload: string;
    status: QueueJobStatus;
    priority: number;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    delayUntil: string | null;
    idempotencyKey: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}
export interface EnqueueInput {
    queueName: string;
    payload: unknown;
    priority?: number;
    maxAttempts?: number;
    delayUntil?: string | null;
    idempotencyKey?: string | null;
}
export interface DequeueResult {
    job: QueueJobRecord;
    ack: () => void | Promise<void>;
    nack: (error?: string) => void | Promise<void>;
}
export interface QueueStats {
    queueName: string;
    waiting: number;
    delayed: number;
    active: number;
    completed: number;
    failed: number;
    deadLetter: number;
}
export interface RetryPolicy {
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
}
export declare const DEFAULT_RETRY_POLICY: RetryPolicy;
export interface QueueAdapter {
    readonly backendKind: QueueBackendKind;
    enqueue(input: EnqueueInput): QueueJobRecord;
    dequeue(queueName: string): DequeueResult | null;
    getJob(jobId: string): QueueJobRecord | null;
    listJobs(queueName: string, status?: QueueJobStatus, limit?: number): QueueJobRecord[];
    moveToDeadLetter(jobId: string, reason: string): void;
    retryJob(jobId: string): QueueJobRecord | null;
    purge(queueName: string, olderThan: string): number;
    stats(queueName: string): QueueStats;
    listQueues(): string[];
}
export declare const QUEUE_JOBS_DDL = "\nCREATE TABLE IF NOT EXISTS queue_jobs (\n  id TEXT PRIMARY KEY,\n  queue_name TEXT NOT NULL,\n  payload TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'waiting',\n  priority INTEGER NOT NULL DEFAULT 0,\n  attempts INTEGER NOT NULL DEFAULT 0,\n  max_attempts INTEGER NOT NULL DEFAULT 3,\n  last_error TEXT NULL,\n  delay_until TEXT NULL,\n  idempotency_key TEXT NULL,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n  completed_at TEXT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_status_priority ON queue_jobs(queue_name, status, priority DESC, created_at ASC);\nCREATE UNIQUE INDEX IF NOT EXISTS idx_queue_jobs_idempotency ON queue_jobs(queue_name, idempotency_key) WHERE idempotency_key IS NOT NULL;\n";
export type RawRow = Record<string, unknown>;
export interface QueueBackendConfig {
    kind: QueueBackendKind;
    redis?: RedisQueueConfig;
}
export interface RedisQueueConfig extends RedisConnectionConfig {
    prefix?: string;
}
export type QueueAdapterFactory = (config: QueueBackendConfig, db?: AuthoritativeSqlDatabase) => QueueAdapter;
