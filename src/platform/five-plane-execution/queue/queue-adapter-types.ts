/**
 * @fileoverview Shared queue adapter types and SQLite DDL.
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { RedisConnectionConfig } from "../../shared/utils/redis-client-options.js";

export type QueueBackendKind = "sqlite" | "redis";
export type QueueJobStatus = "waiting" | "delayed" | "active" | "completed" | "dead_letter";

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
  deadLetter: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
};

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

export const QUEUE_JOBS_DDL = `
CREATE TABLE IF NOT EXISTS queue_jobs (
  id TEXT PRIMARY KEY,
  queue_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT NULL,
  delay_until TEXT NULL,
  idempotency_key TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue_status_priority ON queue_jobs(queue_name, status, priority DESC, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_jobs_idempotency ON queue_jobs(queue_name, idempotency_key) WHERE idempotency_key IS NOT NULL;
`;

export type RawRow = Record<string, unknown>;

export interface QueueBackendConfig {
  kind: QueueBackendKind;
  redis?: RedisQueueConfig;
}

export interface RedisQueueConfig extends RedisConnectionConfig {
  prefix?: string;
  driver?: "redis" | "memory";
}

export type QueueAdapterFactory = (config: QueueBackendConfig, db?: AuthoritativeSqlDatabase) => QueueAdapter;
