import { createRequire } from "node:module";

import { StorageError, ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
import { buildRedisClientOptions } from "../../shared/utils/redis-client-options.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { LocalTypedEventEmitter } from "../../shared/events/local-typed-event-emitter.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

interface RedisLike {
  status: string;
  connect(): Promise<void>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hincrby(key: string, field: string, incr: number): Promise<number>;
  hmset(key: string, data: Record<string, string>): Promise<unknown>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number | string, max: number | string, ...args: Array<string | number>): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
  zcount(key: string, min: number | string, max: number | string): Promise<number>;
  scard(key: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
  disconnect(): void;
  on(event: "error", listener: (error: unknown) => void): void;
  pipeline(): {
    hmset(key: string, data: Record<string, string>): unknown;
    expire(key: string, seconds: number): unknown;
    sadd(key: string, member: string): unknown;
    zadd(key: string, score: number, member: string): unknown;
    exec(): Promise<Array<[unknown, unknown]>>;
  };
}

class InMemoryRedisLike extends LocalTypedEventEmitter<Record<string, unknown>> implements RedisLike {
  public status = "ready";
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly sortedSets = new Map<string, Map<string, number>>();

  connect(): Promise<void> {
    this.status = "ready";
    return Promise.resolve();
  }

  disconnect(): void {
    this.status = "end";
  }

  quit(): Promise<unknown> {
    this.status = "end";
    return Promise.resolve("OK");
  }

  ping(): Promise<string> {
    return Promise.resolve("PONG");
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.ensureHash(key);
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key)?.entries() ?? []);
  }

  async hincrby(key: string, field: string, incr: number): Promise<number> {
    const hash = this.ensureHash(key);
    const value = Number.parseInt(hash.get(field) ?? "0", 10) + incr;
    hash.set(field, String(value));
    return value;
  }

  async hmset(key: string, data: Record<string, string>): Promise<unknown> {
    const hash = this.ensureHash(key);
    for (const [field, value] of Object.entries(data)) {
      hash.set(field, value);
    }
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.hashes.delete(key) || this.sets.delete(key) || this.sortedSets.delete(key);
    return existed ? 1 : 0;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const zset = this.ensureSortedSet(key);
    const isNew = !zset.has(member);
    zset.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrangebyscore(key: string, min: number | string, max: number | string, ...args: Array<string | number>): Promise<string[]> {
    const minValue = this.parseScore(min);
    const maxValue = this.parseScore(max);
    const low = Math.min(minValue, maxValue);
    const high = Math.max(minValue, maxValue);
    const descending = minValue > maxValue;
    const rows = [...(this.sortedSets.get(key)?.entries() ?? [])]
      .filter(([, score]) => score >= low && score <= high)
      .sort((left, right) => descending ? right[1] - left[1] : left[1] - right[1]);
    let offset = 0;
    let count = rows.length;
    const limitIndex = args.indexOf("LIMIT");
    if (limitIndex >= 0) {
      offset = Number(args[limitIndex + 1] ?? 0);
      count = Number(args[limitIndex + 2] ?? rows.length);
    }
    return rows.slice(offset, offset + count).map(([member]) => member);
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.sortedSets.get(key)?.delete(member) ? 1 : 0;
  }

  async zcard(key: string): Promise<number> {
    return this.sortedSets.get(key)?.size ?? 0;
  }

  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    return (await this.zrangebyscore(key, min, max)).length;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }

  async sadd(key: string, member: string): Promise<number> {
    const set = this.ensureSet(key);
    const isNew = !set.has(member);
    set.add(member);
    return isNew ? 1 : 0;
  }

  async srem(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.delete(member) ? 1 : 0;
  }

  pipeline(): ReturnType<RedisLike["pipeline"]> {
    const operations: Array<() => Promise<unknown>> = [];
    const pipeline = {
      hmset: (key: string, data: Record<string, string>) => {
        operations.push(() => this.hmset(key, data));
        return pipeline;
      },
      expire: (key: string, seconds: number) => {
        operations.push(() => this.expire(key, seconds));
        return pipeline;
      },
      sadd: (key: string, member: string) => {
        operations.push(() => this.sadd(key, member));
        return pipeline;
      },
      zadd: (key: string, score: number, member: string) => {
        operations.push(() => this.zadd(key, score, member));
        return pipeline;
      },
      exec: async () => {
        const results: Array<[unknown, unknown]> = [];
        for (const operation of operations) {
          results.push([null, await operation()]);
        }
        return results;
      },
    };
    return pipeline;
  }

  private ensureHash(key: string): Map<string, string> {
    const existing = this.hashes.get(key);
    if (existing !== undefined) return existing;
    const created = new Map<string, string>();
    this.hashes.set(key, created);
    return created;
  }

  private ensureSet(key: string): Set<string> {
    const existing = this.sets.get(key);
    if (existing !== undefined) return existing;
    const created = new Set<string>();
    this.sets.set(key, created);
    return created;
  }

  private ensureSortedSet(key: string): Map<string, number> {
    const existing = this.sortedSets.get(key);
    if (existing !== undefined) return existing;
    const created = new Map<string, number>();
    this.sortedSets.set(key, created);
    return created;
  }

  private parseScore(value: number | string): number {
    if (value === "-inf") return -Infinity;
    if (value === "+inf") return Infinity;
    return typeof value === "number" ? value : Number.parseFloat(value);
  }
}

import {
  DEFAULT_RETRY_POLICY,
  type DequeueResult,
  type EnqueueInput,
  type QueueAdapter,
  type QueueBackendKind,
  type QueueJobRecord,
  type QueueJobStatus,
  type QueueStats,
  type RedisQueueConfig,
} from "./queue-adapter-types.js";

class RedisQueueClient {
  private readonly redis: RedisLike;
  private readonly host: string;
  private readonly port: number;
  private readonly password: string | undefined;
  private readonly db: number;
  private readonly prefix: string;

  constructor(config: RedisQueueConfig) {
    const clientOptions = buildRedisClientOptions(config, {
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
      connectTimeout: config.connectTimeout ?? 500,
    });
    this.host = config.host?.trim() ?? "";
    this.port = config.port ?? 6379;
    this.password = config.password;
    this.db = config.db ?? 0;
    this.prefix = config.prefix ?? "aa:";
    if (process.env.AA_RUNNING_TESTS === "1") {
      if (process.env.NODE_ENV === "production") {
        throw new StorageError(
          "queue.redis_test_memory_forbidden_in_production",
          "queue.redis_test_memory_forbidden_in_production",
          { retryable: false },
        );
      }
      this.redis = new InMemoryRedisLike();
    } else {
      const require = createRequire(import.meta.url);
      const RedisCtor = require("ioredis") as new (options: Record<string, unknown>) => RedisLike;
      this.redis = new RedisCtor(clientOptions);
    }
    this.redis.on("error", (err) => {
      runtimeMetricsRegistry.incrementCounter("redis_connection_errors", { component: "redis-queue-adapter" }, 1);
      logger.error("redis.connection_error", { err: err instanceof Error ? err.message : String(err) });
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
      return;
    }
    if (this.redis.status === "end") {
      await this.redis.connect().catch(() => {
        throw new StorageError("queue.redis_connection_failed: connection closed", "queue.redis_connection_failed: connection closed", {
          retryable: true,
        });
      });
    }
  }

  key(suffix: string): string {
    return `${this.prefix}${suffix}`;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.hset(this.key(key), field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    await this.ensureConnected();
    return this.redis.hget(this.key(key), field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    await this.ensureConnected();
    return this.redis.hgetall(this.key(key));
  }

  async hincrby(key: string, field: string, incr: number): Promise<number> {
    await this.ensureConnected();
    return this.redis.hincrby(this.key(key), field, incr);
  }

  async hmset(key: string, data: Record<string, string>): Promise<void> {
    await this.ensureConnected();
    const args: (string | number)[] = [this.key(key)];
    for (const [k, v] of Object.entries(data)) args.push(k, v);
    await this.redis.hmset(args[0] as string, data);
  }

  async del(key: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.del(this.key(key));
  }
  async expire(key: string, seconds: number): Promise<number> {
    await this.ensureConnected();
    return this.redis.expire(this.key(key), seconds);
  }
  async zadd(key: string, score: number, member: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.zadd(this.key(key), score, member);
  }
  async zrangebyscore(key: string, min: number | string, max: number | string, offset?: number, count?: number): Promise<string[]> {
    await this.ensureConnected();
    if (offset !== undefined && count !== undefined) {
      return this.redis.zrangebyscore(this.key(key), min, max, "LIMIT", offset, count);
    }
    return this.redis.zrangebyscore(this.key(key), min, max);
  }
  async zrem(key: string, member: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.zrem(this.key(key), member);
  }
  async zcard(key: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.zcard(this.key(key));
  }
  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    await this.ensureConnected();
    return this.redis.zcount(this.key(key), min, max);
  }
  async scard(key: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.scard(this.key(key));
  }
  async smembers(key: string): Promise<string[]> {
    await this.ensureConnected();
    return this.redis.smembers(this.key(key));
  }
  async sadd(key: string, member: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.sadd(this.key(key), member);
  }
  async srem(key: string, member: string): Promise<number> {
    await this.ensureConnected();
    return this.redis.srem(this.key(key), member);
  }
  async ping(): Promise<string> {
    await this.ensureConnected();
    return this.redis.ping();
  }
  async close(): Promise<void> {
    if (this.redis.status === "wait" || this.redis.status === "end") {
      this.redis.disconnect();
      return;
    }
    try {
      await this.redis.quit();
    } catch (error) {
      logger.warn("redis.quit_failed", { error: error instanceof Error ? error.message : String(error) });
      this.redis.disconnect();
    }
  }

  pipeline(): {
    hmset(key: string, data: Record<string, string>): unknown;
    expire(key: string, seconds: number): unknown;
    sadd(key: string, member: string): unknown;
    zadd(key: string, score: number, member: string): unknown;
    exec(): Promise<Array<[unknown, unknown]>>;
  } {
    return this.redis.pipeline();
  }
}

export class RedisQueueAdapter implements QueueAdapter {
  readonly backendKind: QueueBackendKind = "redis";
  private readonly client: RedisQueueClient;
  private readonly jobTtlSeconds = 86400 * 7;

  constructor(private readonly config: RedisQueueConfig) {
    this.client = new RedisQueueClient(config);
  }

  private jobKey(jobId: string): string { return `job:${jobId}`; }
  private waitingKey(queueName: string): string { return `queue:${queueName}:waiting`; }
  private activeKey(queueName: string): string { return `queue:${queueName}:active`; }
  private completedKey(queueName: string): string { return `queue:${queueName}:completed`; }
  private deadLetterKey(queueName: string): string { return `queue:${queueName}:dead_letter`; }
  private queueSetKey(): string { return "queues"; }

  enqueue(input: EnqueueInput): QueueJobRecord {
    const now = nowIso();
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

    const pipeline = this.client.pipeline();
    pipeline.hmset(this.jobKey(job.id), {
      id: job.id,
      queue_name: job.queueName,
      payload: job.payload,
      status: job.status,
      priority: String(job.priority),
      attempts: String(job.attempts),
      max_attempts: String(job.maxAttempts),
      last_error: "",
      delay_until: job.delayUntil ?? "",
      idempotency_key: job.idempotencyKey ?? "",
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      completed_at: "",
    });
    pipeline.expire(this.jobKey(job.id), this.jobTtlSeconds);
    pipeline.sadd(this.queueSetKey(), input.queueName);
    const waitingScore = isDelayed
      ? new Date(job.delayUntil!).getTime()
      : job.priority * 1e13 + new Date(job.createdAt).getTime();
    pipeline.zadd(this.waitingKey(input.queueName), waitingScore, job.id);

    pipeline.exec()
      .then((results) => {
        const firstFailure = results.find(([err]) => err != null)?.[0];
        if (firstFailure == null) {
          return;
        }
        this.recordSyncEnqueueFailure(job, firstFailure);
      })
      .catch((error: unknown) => {
        this.recordSyncEnqueueFailure(job, error);
      });

    return job;
  }

  dequeue(_queueName: string): DequeueResult | null { throw this.unsupported("dequeue"); }
  getJob(_jobId: string): QueueJobRecord | null { throw this.unsupported("getJob"); }
  listJobs(_queueName: string, _status?: QueueJobStatus, _limit?: number): QueueJobRecord[] { throw this.unsupported("listJobs"); }
  moveToDeadLetter(_jobId: string, _reason: string): void { throw this.unsupported("moveToDeadLetter"); }
  retryJob(_jobId: string): QueueJobRecord | null { throw this.unsupported("retryJob"); }
  purge(_queueName: string, _olderThan: string): number { throw this.unsupported("purge"); }
  stats(_queueName: string): QueueStats { throw this.unsupported("stats"); }
  listQueues(): string[] { throw this.unsupported("listQueues"); }

  private unsupported(method: string): ValidationError {
    return new ValidationError(`queue.sync_${method}_not_supported: Use ${method}Async for Redis backend`, `queue.sync_${method}_not_supported: Use ${method}Async for Redis backend`, {
      retryable: false,
    });
  }

  private recordSyncEnqueueFailure(job: QueueJobRecord, error: unknown): void {
    runtimeMetricsRegistry.incrementCounter("queue_enqueue_failures_total", { backend: "redis", mode: "sync" }, 1);
    logger.error("queue.enqueue_pipeline_failed", {
      jobId: job.id,
      queueName: job.queueName,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  async enqueueAsync(input: EnqueueInput): Promise<QueueJobRecord> {
    try {
      const now = nowIso();
      const isDelayed = input.delayUntil != null && input.delayUntil > now;
      const status: QueueJobStatus = isDelayed ? "delayed" : "waiting";
      if (input.idempotencyKey) {
        const existingId = await this.client.hget(`idx:${input.queueName}:idempotency`, input.idempotencyKey);
        if (existingId) {
          const existing = await this.getJobAsync(existingId);
          if (existing) return existing;
        }
      }
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
      await this.client.hmset(this.jobKey(job.id), {
        id: job.id, queue_name: job.queueName, payload: job.payload, status: job.status,
        priority: String(job.priority), attempts: String(job.attempts), max_attempts: String(job.maxAttempts),
        last_error: "", delay_until: job.delayUntil ?? "", idempotency_key: job.idempotencyKey ?? "",
        created_at: job.createdAt, updated_at: job.updatedAt, completed_at: "",
      });
      await this.client.expire(this.jobKey(job.id), this.jobTtlSeconds);
      await this.client.sadd(this.queueSetKey(), input.queueName);
      if (input.idempotencyKey) {
        await this.client.hset(`idx:${input.queueName}:idempotency`, input.idempotencyKey, job.id);
        await this.client.expire(`idx:${input.queueName}:idempotency`, this.jobTtlSeconds);
      }
      if (isDelayed) {
        await this.client.zadd(this.waitingKey(input.queueName), new Date(input.delayUntil!).getTime(), job.id);
      } else {
        await this.client.zadd(this.waitingKey(input.queueName), job.priority * 1e13 + new Date(job.createdAt).getTime(), job.id);
      }
      return job;
    } catch (error) {
      runtimeMetricsRegistry.incrementCounter("queue_enqueue_failures_total", { backend: "redis", mode: "async" }, 1);
      const err = error instanceof Error ? error : new Error(String(error));
      throw new StorageError(
        `queue.enqueue_failed: ${err.message}`,
        "queue.enqueue_failed",
        { cause: err, retryable: true },
      );
    }
  }

  async dequeueAsync(queueName: string): Promise<DequeueResult | null> {
    const now = Date.now();
    const delayedJobs = await this.client.zrangebyscore(this.waitingKey(queueName), "-inf", now, 0, 100);
    for (const jobId of delayedJobs) {
      const jobData = await this.client.hgetall(this.jobKey(jobId));
      if (jobData.status === "delayed") {
        await this.client.hmset(this.jobKey(jobId), { status: "waiting", delay_until: "" });
        const priority = Number.parseInt(jobData.priority || "0", 10);
        await this.client.zadd(this.waitingKey(queueName), priority * 1e13 + Date.now(), jobId);
      }
    }
    const waitingJobs = await this.client.zrangebyscore(this.waitingKey(queueName), "-inf", "+inf");
    if (waitingJobs.length === 0) return null;
    const jobId = waitingJobs[waitingJobs.length - 1] ?? "";
    const jobData = await this.client.hgetall(this.jobKey(jobId));
    if (!jobData.id || jobData.status === "delayed") return null;
    if (jobData.status !== "waiting") {
      await this.client.zrem(this.waitingKey(queueName), jobId);
      return null;
    }
    const attempts = await this.client.hincrby(this.jobKey(jobId), "attempts", 1);
    const maxAttempts = parseInt(jobData.max_attempts || "3", 10);
    await this.client.hmset(this.jobKey(jobId), { status: "active", last_error: "" });
    await this.client.sadd(this.activeKey(queueName), jobId);
    await this.client.zrem(this.waitingKey(queueName), jobId);
    const job: QueueJobRecord = {
      id: jobData.id,
      queueName: jobData.queue_name ?? queueName,
      payload: jobData.payload ?? "",
      status: "active",
      priority: parseInt(jobData.priority || "0", 10),
      attempts,
      maxAttempts,
      lastError: null,
      delayUntil: jobData.delay_until || null,
      idempotencyKey: jobData.idempotency_key || null,
      createdAt: jobData.created_at ?? nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    };
    return {
      job,
      ack: async () => {
        await this.client.hmset(this.jobKey(jobId), { status: "completed", completed_at: nowIso() });
        await this.client.srem(this.activeKey(queueName), jobId);
        await this.client.sadd(this.completedKey(queueName), jobId);
        await this.client.zrem(this.waitingKey(queueName), jobId);
        await this.client.expire(this.jobKey(jobId), 3600);
      },
      nack: async (error?: string) => {
        const currentAttempts = parseInt((await this.client.hget(this.jobKey(jobId), "attempts")) || "0", 10);
        const currentMaxAttempts = parseInt((await this.client.hget(this.jobKey(jobId), "max_attempts")) || "3", 10);
        if (currentAttempts >= currentMaxAttempts) {
          await this.client.hmset(this.jobKey(jobId), { status: "dead_letter", last_error: error ?? "max_attempts_exceeded" });
          await this.client.srem(this.activeKey(queueName), jobId);
          await this.client.sadd(this.deadLetterKey(queueName), jobId);
        } else {
          await this.client.hmset(this.jobKey(jobId), { status: "waiting", last_error: error ?? "" });
          await this.client.srem(this.activeKey(queueName), jobId);
          const score = parseInt(jobData.priority || "0", 10) * 1e13 + Date.now();
          await this.client.zadd(this.waitingKey(queueName), score, jobId);
        }
      },
    };
  }

  async getJobAsync(jobId: string): Promise<QueueJobRecord | null> {
    const data = await this.client.hgetall(this.jobKey(jobId));
    if (!data.id) return null;
    return this.mapRedisToJobRecord(data);
  }

  private mapRedisToJobRecord(data: Record<string, string>): QueueJobRecord {
    return {
      id: data.id ?? "",
      queueName: data.queue_name ?? "",
      payload: data.payload ?? "",
      status: (data.status ?? "waiting") as QueueJobStatus,
      priority: parseInt(data.priority || "0", 10),
      attempts: parseInt(data.attempts || "0", 10),
      maxAttempts: parseInt(data.max_attempts || "3", 10),
      lastError: data.last_error || null,
      delayUntil: data.delay_until || null,
      idempotencyKey: data.idempotency_key || null,
      createdAt: data.created_at ?? nowIso(),
      updatedAt: data.updated_at ?? nowIso(),
      completedAt: data.completed_at || null,
    };
  }

  async listJobsAsync(queueName: string, status?: QueueJobStatus, limit: number = 100): Promise<QueueJobRecord[]> {
    let jobIds: string[] = [];
    if (!status || status === "waiting") {
      jobIds = [...jobIds, ...(await this.client.zrangebyscore(this.waitingKey(queueName), "-inf", "+inf", 0, limit))];
    }
    if (!status || status === "active") jobIds = [...jobIds, ...(await this.client.smembers(this.activeKey(queueName)))];
    if (!status || status === "completed") jobIds = [...jobIds, ...(await this.client.smembers(this.completedKey(queueName)))];
    if (!status || status === "dead_letter") jobIds = [...jobIds, ...(await this.client.smembers(this.deadLetterKey(queueName)))];
    const uniqueIds = Array.from(new Set(jobIds)).slice(0, limit);
    const jobs: QueueJobRecord[] = [];
    for (const id of uniqueIds) {
      const job = await this.getJobAsync(id);
      if (job && (!status || job.status === status)) jobs.push(job);
    }
    return jobs;
  }

  async moveToDeadLetterAsync(jobId: string, reason: string): Promise<void> {
    const job = await this.getJobAsync(jobId);
    if (!job) return;
    await this.client.hmset(this.jobKey(jobId), { status: "dead_letter", last_error: reason });
    await this.client.srem(this.activeKey(job.queueName), jobId);
    await this.client.sadd(this.deadLetterKey(job.queueName), jobId);
  }

  async retryJobAsync(jobId: string): Promise<QueueJobRecord | null> {
    const job = await this.getJobAsync(jobId);
    const retryableWaiting = job?.status === "waiting" && (job.attempts > 0 || job.lastError != null);
    if (!job || (job.status !== "failed" && job.status !== "dead_letter" && !retryableWaiting)) return null;
    await this.client.hmset(this.jobKey(jobId), { status: "waiting", attempts: "0", last_error: "" });
    await this.client.srem(this.activeKey(job.queueName), jobId);
    await this.client.srem(this.deadLetterKey(job.queueName), jobId);
    await this.client.zadd(this.waitingKey(job.queueName), job.priority * 1e13 + Date.now(), jobId);
    return this.getJobAsync(jobId);
  }

  async purgeAsync(queueName: string, olderThan: string): Promise<number> {
    const cutoff = new Date(olderThan).getTime();
    let purged = 0;
    for (const id of await this.client.smembers(this.completedKey(queueName))) {
      const job = await this.getJobAsync(id);
      if (job?.completedAt && new Date(job.completedAt).getTime() < cutoff) {
        await this.client.del(this.jobKey(id));
        await this.client.srem(this.completedKey(queueName), id);
        purged += 1;
      }
    }
    for (const id of await this.client.smembers(this.deadLetterKey(queueName))) {
      const job = await this.getJobAsync(id);
      if (job?.updatedAt && new Date(job.updatedAt).getTime() < cutoff) {
        await this.client.del(this.jobKey(id));
        await this.client.srem(this.deadLetterKey(queueName), id);
        purged += 1;
      }
    }
    return purged;
  }

  async statsAsync(queueName: string): Promise<QueueStats> {
    const [waitingTotal, scoreDelayed, active, completed, deadLetter] = await Promise.all([
      this.client.zcard(this.waitingKey(queueName)),
      this.client.zcount(this.waitingKey(queueName), Date.now(), "+inf"),
      this.client.scard(this.activeKey(queueName)),
      this.client.scard(this.completedKey(queueName)),
      this.client.scard(this.deadLetterKey(queueName)),
    ]);
    let waiting = Math.max(0, waitingTotal - scoreDelayed);
    let delayed = scoreDelayed;
    const queuedIds = await this.client.zrangebyscore(this.waitingKey(queueName), "-inf", "+inf");
    let statusWaiting = 0;
    let statusDelayed = 0;
    let observedRecords = 0;
    for (const id of queuedIds) {
      const job = await this.getJobAsync(id);
      if (job == null) continue;
      observedRecords += 1;
      if (job.status === "delayed") {
        statusDelayed += 1;
      } else if (job.status === "waiting") {
        statusWaiting += 1;
      }
    }
    if (observedRecords > 0) {
      waiting = statusWaiting;
      delayed = statusDelayed;
    }
    return {
      queueName,
      waiting,
      delayed,
      active,
      completed,
      failed: 0,
      deadLetter,
    };
  }

  async listQueuesAsync(): Promise<string[]> { return this.client.smembers(this.queueSetKey()); }
  async ping(): Promise<string> { return this.client.ping(); }
  async close(): Promise<void> { await this.client.close(); }
}
