import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";

import {
  DEFAULT_RETRY_POLICY,
  type DequeueResult,
  type EnqueueInput,
  type QueueAdapter,
  type QueueBackendKind,
  type QueueJobRecord,
  type QueueJobStatus,
  type QueueStats,
  type RawRow,
} from "./queue-adapter-types.js";

export class SqliteQueueAdapter implements QueueAdapter {
  readonly backendKind: QueueBackendKind = "sqlite";

  constructor(private readonly db: AuthoritativeSqlDatabase) {}

  enqueue(input: EnqueueInput): QueueJobRecord {
    const now = nowIso();

    if (input.idempotencyKey) {
      const existing = this.db.connection
        .prepare(`SELECT * FROM queue_jobs WHERE queue_name = ? AND idempotency_key = ?`)
        .get(input.queueName, input.idempotencyKey) as RawRow | undefined;
      if (existing) {
        return this.mapRow(existing);
      }
    }

    const isDelayed = input.delayUntil != null && input.delayUntil > now;
    const status: QueueJobStatus = isDelayed ? "delayed" : "waiting";

    const job: QueueJobRecord = {
      id: newId("qjob"),
      queueName: input.queueName,
      payload: JSON.stringify(input.payload),
      status,
      priority: input.priority ?? 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
      lastError: null,
      delayUntil: input.delayUntil ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    this.db.connection
      .prepare(
        `INSERT INTO queue_jobs (id, queue_name, payload, status, priority, attempts, max_attempts, last_error, delay_until, idempotency_key, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.id, job.queueName, job.payload, job.status, job.priority,
        job.attempts, job.maxAttempts, job.lastError, job.delayUntil,
        job.idempotencyKey, job.createdAt, job.updatedAt, job.completedAt,
      );

    // R29-11: Record queue enqueue metric
    runtimeMetricsRegistry.recordQueueEnqueue(input.queueName);

    return job;
  }

  dequeue(queueName: string): DequeueResult | null {
    const now = nowIso();
    this.db.connection
      .prepare(`UPDATE queue_jobs SET status = 'waiting', updated_at = ? WHERE queue_name = ? AND status = 'delayed' AND delay_until <= ?`)
      .run(now, queueName, now);

    const row = this.db.connection
      .prepare(`SELECT * FROM queue_jobs WHERE queue_name = ? AND status = 'waiting' ORDER BY priority DESC, created_at ASC LIMIT 1`)
      .get(queueName) as RawRow | undefined;
    if (!row) return null;

    const job = this.mapRow(row);
    this.db.connection
      .prepare(`UPDATE queue_jobs SET status = 'active', attempts = attempts + 1, updated_at = ? WHERE id = ? AND status = 'waiting'`)
      .run(now, job.id);
    job.status = "active";
    job.attempts += 1;
    job.updatedAt = now;

    // R29-11: Record queue dequeue metric
    runtimeMetricsRegistry.recordQueueDequeue(queueName);

    const jobId = job.id;
    return {
      job,
      ack: () => {
        const ts = nowIso();
        this.db.connection
          .prepare(`UPDATE queue_jobs SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`)
          .run(ts, ts, jobId);
      },
      nack: (error?: string) => {
        const ts = nowIso();
        const current = this.db.connection
          .prepare(`SELECT attempts, max_attempts FROM queue_jobs WHERE id = ?`)
          .get(jobId) as RawRow | undefined;
        if (current && Number(current.attempts) >= Number(current.max_attempts)) {
          this.db.connection
            .prepare(`UPDATE queue_jobs SET status = 'dead_letter', last_error = ?, updated_at = ? WHERE id = ?`)
            .run(error ?? "max_attempts_exceeded", ts, jobId);
          // R29-11: Record queue failure (max attempts exceeded)
          runtimeMetricsRegistry.recordQueueFailure(queueName, "max_attempts_exceeded");
        } else {
          this.db.connection
            .prepare(`UPDATE queue_jobs SET status = 'waiting', last_error = ?, updated_at = ? WHERE id = ?`)
            .run(error ?? null, ts, jobId);
          // R29-11: Record queue failure (requeue)
          runtimeMetricsRegistry.recordQueueFailure(queueName, "requeued");
        }
      },
    };
  }

  getJob(jobId: string): QueueJobRecord | null {
    const row = this.db.connection.prepare(`SELECT * FROM queue_jobs WHERE id = ?`).get(jobId) as RawRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  listJobs(queueName: string, status?: QueueJobStatus, limit: number = 100): QueueJobRecord[] {
    if (status) {
      return (this.db.connection
        .prepare(`SELECT * FROM queue_jobs WHERE queue_name = ? AND status = ? ORDER BY priority DESC, created_at ASC LIMIT ?`)
        .all(queueName, status, limit) as RawRow[]).map((r) => this.mapRow(r));
    }
    return (this.db.connection
      .prepare(`SELECT * FROM queue_jobs WHERE queue_name = ? ORDER BY priority DESC, created_at ASC LIMIT ?`)
      .all(queueName, limit) as RawRow[]).map((r) => this.mapRow(r));
  }

  moveToDeadLetter(jobId: string, reason: string): void {
    const now = nowIso();
    this.db.connection
      .prepare(`UPDATE queue_jobs SET status = 'dead_letter', last_error = ?, updated_at = ? WHERE id = ?`)
      .run(reason, now, jobId);
  }

  retryJob(jobId: string): QueueJobRecord | null {
    const now = nowIso();
    const result = this.db.connection
      .prepare(`UPDATE queue_jobs SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = ? WHERE id = ? AND status IN ('failed', 'dead_letter')`)
      .run(now, jobId);
    if (Number(result.changes ?? 0) === 0) {
      return this.getJob(jobId);
    }
    return this.getJob(jobId);
  }

  purge(queueName: string, olderThan: string): number {
    const before = this.db.connection
      .prepare(`SELECT id FROM queue_jobs WHERE queue_name = ? AND status IN ('completed', 'dead_letter') AND updated_at < ?`)
      .all(queueName, olderThan) as RawRow[];
    if (before.length === 0) return 0;
    this.db.connection
      .prepare(`DELETE FROM queue_jobs WHERE queue_name = ? AND status IN ('completed', 'dead_letter') AND updated_at < ?`)
      .run(queueName, olderThan);
    return before.length;
  }

  stats(queueName: string): QueueStats {
    const rows = this.db.connection
      .prepare(`SELECT status, COUNT(*) as cnt FROM queue_jobs WHERE queue_name = ? GROUP BY status`)
      .all(queueName) as RawRow[];
    const counts: Record<string, number> = {};
    for (const row of rows) counts[String(row.status)] = Number(row.cnt);
    return {
      queueName,
      waiting: counts["waiting"] ?? 0,
      delayed: counts["delayed"] ?? 0,
      active: counts["active"] ?? 0,
      completed: counts["completed"] ?? 0,
      failed: counts["failed"] ?? 0,
      deadLetter: counts["dead_letter"] ?? 0,
    };
  }

  listQueues(): string[] {
    return (this.db.connection
      .prepare(`SELECT DISTINCT queue_name FROM queue_jobs ORDER BY queue_name`)
      .all() as RawRow[]).map((r) => String(r.queue_name));
  }

  private mapRow(row: RawRow): QueueJobRecord {
    return {
      id: String(row.id),
      queueName: String(row.queue_name ?? ""),
      payload: String(row.payload ?? ""),
      status: String(row.status ?? "waiting") as QueueJobStatus,
      priority: Number(row.priority ?? 0),
      attempts: Number(row.attempts ?? 0),
      maxAttempts: Number(row.max_attempts ?? 3),
      lastError: row.last_error != null ? String(row.last_error) : null,
      delayUntil: row.delay_until != null ? String(row.delay_until) : null,
      idempotencyKey: row.idempotency_key != null ? String(row.idempotency_key) : null,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      completedAt: row.completed_at != null ? String(row.completed_at) : null,
    };
  }
}
