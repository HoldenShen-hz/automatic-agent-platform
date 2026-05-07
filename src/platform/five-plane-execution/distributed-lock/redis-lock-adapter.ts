import { createRequire } from "node:module";

import { LockingError } from "../../contracts/errors.js";
import { buildRedisClientOptions } from "../../shared/utils/redis-client-options.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
import { lockLogger } from "./locking-support.js";
import type {
  AcquireLockInput,
  AcquireLockResult,
  DistributedLockAdapter,
  LockBackendKind,
  LockData,
  LockRecord,
  RedisLockConfig,
} from "./distributed-lock-types.js";

export class RedisLockAdapter implements DistributedLockAdapter {
  readonly backendKind: LockBackendKind = "redis";

  private readonly redis: {
    status: string;
    connect(): Promise<void>;
    incr?(key: string): Promise<number>;
    set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
    scan(cursor: number, ...args: Array<string | number>): Promise<[string, string[]]>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    quit(): Promise<unknown>;
    disconnect(): void;
    on(event: "error", listener: (error: unknown) => void): void;
  };
  private fencingCounter = 0;
  private readonly cliPath: string;
  private readonly connectTimeoutMs: number;
  private readonly host: string;
  private readonly port: number;

  public constructor(config?: RedisLockConfig & { cliPath?: string; connectTimeoutMs?: number }) {
    this.host = config?.host ?? "localhost";
    this.port = config?.port ?? 6379;
    this.cliPath = config?.cliPath ?? "redis-cli";
    this.connectTimeoutMs = config?.connectTimeoutMs ?? 500;
    const require = createRequire(import.meta.url);
    const RedisCtor = require("ioredis") as new (options: Record<string, unknown>) => RedisLockAdapter["redis"];
    this.redis = new RedisCtor(buildRedisClientOptions(config ?? {}, {
      connectTimeout: config?.connectTimeout ?? this.connectTimeoutMs,
      maxRetriesPerRequest: config?.maxRetriesPerRequest ?? 1,
    }));
    this.redis.on("error", (err) => {
      runtimeMetricsRegistry.incrementCounter("redis_connection_errors", { component: "distributed-lock" }, 1);
      lockLogger.log({ level: "error", message: "redis.connection_error", data: { err: err instanceof Error ? err.message : String(err) } });
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status !== "wait" && this.redis.status !== "end") {
      return;
    }

    try {
      await this.redis.connect();
    } catch (error) {
      throw new LockingError("lock.redis_connection_closed", "lock.redis_connection_closed", {
        status: this.redis.status,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public acquire(input: AcquireLockInput): AcquireLockResult {
    throw new LockingError("lock.sync_acquire_deprecated", "lock.sync_acquire_deprecated: Use acquireAsync instead");
  }

  private async nextFencingToken(): Promise<number> {
    const localNext = this.fencingCounter + 1;
    if (typeof this.redis.incr !== "function") {
      this.fencingCounter = localNext;
      return this.fencingCounter;
    }

    const remoteToken = await this.redis.incr("lock:fencing_counter");
    this.fencingCounter = Math.max(localNext, remoteToken);
    return this.fencingCounter;
  }

  public release(_lockKey: string, _owner: string): boolean {
    throw new LockingError("lock.sync_release_not_supported", "lock.sync_release_not_supported: Use releaseAsync for Redis backend");
  }

  public extend(_lockKey: string, _owner: string, _additionalMs: number): LockRecord | null {
    throw new LockingError("lock.sync_extend_not_supported", "lock.sync_extend_not_supported: Use extendAsync for Redis backend");
  }

  public forceSteal(_lockKey: string, _newOwner: string, _reason: string): LockRecord {
    throw new LockingError("lock.sync_forceSteal_not_supported", "lock.sync_forceSteal_not_supported: Use forceStealAsync for Redis backend");
  }

  public inspect(_lockKey: string): LockRecord | null {
    throw new LockingError("lock.sync_inspect_not_supported", "lock.sync_inspect_not_supported: Use inspectAsync for Redis backend");
  }

  public async acquireAsync(input: AcquireLockInput): Promise<AcquireLockResult> {
    await this.ensureConnected();
    const now = new Date().toISOString();
    const ttlMs = input.ttlMs ?? 30_000;
    const ttlSec = Math.ceil(ttlMs / 1000);
    const lockKey = `lock:${input.lockKey}`;
    const fencingToken = await this.nextFencingToken();
    const lockData: LockData = {
      id: `lock_${Date.now()}_${fencingToken}`,
      owner: input.owner,
      fencingToken,
      ttlMs,
      acquiredAt: now,
      metadata: null,
    };
    const result = await this.redis.set(lockKey, JSON.stringify(lockData), "EX", ttlSec, "NX");
    if (result !== "OK") {
      // R29-12: Record lock acquisition failure (lock held)
      runtimeMetricsRegistry.recordLockFailed(input.lockKey, "redis", "lock_held");
      return { acquired: false };
    }
    // R29-12: Record successful lock acquisition
    runtimeMetricsRegistry.recordLockAcquired(input.lockKey, "redis");
    return {
      acquired: true,
      lock: {
        lockKey: input.lockKey,
        owner: lockData.owner,
        fencingToken: lockData.fencingToken,
        status: "held",
        acquiredAt: lockData.acquiredAt,
        ttlMs: lockData.ttlMs,
        metadata: lockData.metadata,
      },
    };
  }

  public async releaseAsync(lockKey: string, owner: string): Promise<boolean> {
    await this.ensureConnected();
    const script = "local current=redis.call('GET',KEYS[1]) if not current then return -1 end local data=cjson.decode(current) if data.owner~=ARGV[1] then return 0 end return redis.call('DEL',KEYS[1])";
    const result = Number(await this.redis.eval(script, 1, `lock:${lockKey}`, owner)) === 1;
    // R29-12: Record lock release
    if (result) {
      runtimeMetricsRegistry.recordLockReleased(lockKey, "redis");
    }
    return result;
  }

  public async extendAsync(lockKey: string, owner: string, additionalMs: number): Promise<LockRecord | null> {
    await this.ensureConnected();
    const key = `lock:${lockKey}`;
    // Lua script that atomically checks owner and extends TTL
    // ARGV[1] = owner string to compare
    // ARGV[2] = new TTL in milliseconds
    const extendLua = `
local current = redis.call('get', KEYS[1])
if not current then return -1 end
local data = cjson.decode(current)
if data.owner ~= ARGV[1] then return 0 end
local newTtl = math.min(tonumber(ARGV[2]), 600000)
data.ttlMs = newTtl
redis.call('set', KEYS[1], cjson.encode(data), 'PX', newTtl)
return 1`;
    const newTtlMs = Math.min(additionalMs, 600_000);
    const result = await this.redis.eval(extendLua, 1, key, owner, String(newTtlMs));
    if (result !== 1) {
      // R29-12: Record lock extension failure
      runtimeMetricsRegistry.recordLockFailed(lockKey, "redis", "extend_failed");
      return null;
    }
    // R29-12: Record lock extension
    runtimeMetricsRegistry.recordLockExtension(lockKey, owner, newTtlMs);
    const current = await this.redis.get(key);
    if (!current) {
      return null;
    }
    const data = JSON.parse(current) as LockData;
    return {
      lockKey,
      owner: data.owner,
      fencingToken: data.fencingToken,
      status: "held",
      acquiredAt: data.acquiredAt,
      ttlMs: data.ttlMs,
      metadata: data.metadata,
    };
  }

  public async forceStealAsync(lockKey: string, newOwner: string, reason: string): Promise<LockRecord> {
    await this.ensureConnected();
    const key = `lock:${lockKey}`;
    const now = new Date().toISOString();
    const fencingToken = await this.nextFencingToken();
    const ttlMs = 30_000;
    const lockData: LockData = {
      id: `lock_${Date.now()}_${fencingToken}`,
      owner: newOwner,
      fencingToken,
      ttlMs,
      acquiredAt: now,
      metadata: JSON.stringify({ forceStealReason: reason }),
    };
    // R16-16 FIX: Use SET with PX (ms TTL) without XX to steal regardless of lock existence
    // Previous: SET with "XX" only succeeds if lock exists, fails if original lock expired
    // Fix: Use SET with NX (only if not exists) doesn't help either - we want to create
    // the lock if expired. Use plain SET without NX/XX to unconditionally set the lock.
    const result = await this.redis.set(key, JSON.stringify(lockData), "PX", String(Math.ceil(ttlMs)));
    // Note: result is always OK when SET succeeds without NX/XX constraint
    if (result === null) {
      throw new LockingError(
        "lock.forceSteal_lock_not_found",
        `lock.forceSteal_lock_not_found: Cannot force-steal missing lock ${lockKey}`,
      );
    }
    return {
      lockKey,
      owner: newOwner,
      fencingToken,
      status: "held",
      acquiredAt: now,
      ttlMs,
      metadata: lockData.metadata,
    };
  }

  public async inspectAsync(lockKey: string): Promise<LockRecord | null> {
    await this.ensureConnected();
    const current = await this.redis.get(`lock:${lockKey}`);
    if (!current) {
      return null;
    }
    const data = JSON.parse(current) as LockData;
    return {
      lockKey,
      owner: data.owner,
      fencingToken: data.fencingToken,
      status: "held",
      acquiredAt: data.acquiredAt,
      ttlMs: data.ttlMs,
      metadata: data.metadata,
    };
  }

  public async listHeldAsync(limit: number = 100): Promise<LockRecord[]> {
    await this.ensureConnected();
    const records: LockRecord[] = [];
    let cursor = 0;
    const lockPrefix = "lock:";
    const prefixLen = lockPrefix.length;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'COUNT', 100);
      cursor = parseInt(nextCursor, 10);

      if (keys.length > 0) {
        const values = await this.redis.mget(...keys);
        for (let i = 0; i < keys.length; i++) {
          if (records.length >= limit) break;
          const key = keys[i]!;
          const value = values[i];
          if (!value) continue;

          const data = JSON.parse(value) as LockData;
          records.push({
            lockKey: key.slice(prefixLen),
            owner: data.owner,
            fencingToken: data.fencingToken,
            status: "held",
            acquiredAt: data.acquiredAt,
            ttlMs: data.ttlMs,
            metadata: data.metadata,
          });
        }
      }
    } while (cursor !== 0 && records.length < limit);

    return records;
  }

  public async close(): Promise<void> {
    if (this.redis.status === "wait" || this.redis.status === "end") {
      this.redis.disconnect();
      return;
    }
    await this.redis.quit();
  }
}
