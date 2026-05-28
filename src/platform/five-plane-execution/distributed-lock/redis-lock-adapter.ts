import { randomUUID } from "node:crypto";
import IORedis from "ioredis";

import { LockingError } from "../../contracts/errors.js";
import { buildRedisClientOptions, RedisConnectionConfig } from "../../shared/utils/redis-client-options.js";
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
import { LockDataSchema } from "./distributed-lock-types.js";

export class RedisLockAdapter implements DistributedLockAdapter {
  readonly backendKind: LockBackendKind = "redis";
  private static readonly FENCING_COUNTER_KEY = "lock:fencing-counter";

  /**
   * Safely parse and validate lock data from Redis JSON payload.
   * Throws a descriptive error if the payload is malformed or malicious.
   */
  private parseLockData(raw: string): LockData {
    const parsed = JSON.parse(raw) as Partial<LockData> & Record<string, unknown>;
    if (typeof parsed === "object" && parsed !== null && typeof parsed.id !== "string") {
      parsed.id = `legacy_${String(parsed.owner ?? "unknown")}_${String(parsed.fencingToken ?? 0)}`;
    }
    const result = LockDataSchema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new LockingError(
        "lock.invalid_payload",
        `lock.invalid_payload: ${issue?.message ?? "validation failed"} at ${issue?.path.join(".") ?? "root"}`,
      );
    }
    return result.data;
  }

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
    const effectiveConfig = {
      host: this.host,
      port: this.port,
      password: config?.password,
      db: config?.db,
      tls: config?.tls,
      connectTimeout: config?.connectTimeout,
      maxRetriesPerRequest: config?.maxRetriesPerRequest,
      lazyConnect: config?.lazyConnect,
      enableOfflineQueue: config?.enableOfflineQueue,
      retryBaseDelayMs: config?.retryBaseDelayMs,
      retryMaxDelayMs: config?.retryMaxDelayMs,
      mode: config?.mode,
      sentinelName: config?.sentinelName,
      sentinels: config?.sentinels,
      sentinelPassword: config?.sentinelPassword,
    };
    this.redis = new (IORedis as unknown as new (options: Record<string, unknown>) => RedisLockAdapter["redis"])(buildRedisClientOptions(
      Object.fromEntries(
        Object.entries(effectiveConfig).filter(([, v]) => v !== undefined)
      ) as RedisConnectionConfig,
      {
        connectTimeout: config?.connectTimeout ?? this.connectTimeoutMs,
        maxRetriesPerRequest: config?.maxRetriesPerRequest ?? 1,
      },
    ));
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

  private async nextFencingToken(): Promise<number> {
    if (typeof this.redis.incr !== "function") {
      throw new LockingError(
        "lock.fencing_counter_unavailable",
        "lock.fencing_counter_unavailable: Redis backend requires atomic INCR support for fencing tokens",
      );
    }
    const token = await this.redis.incr(RedisLockAdapter.FENCING_COUNTER_KEY);
    this.fencingCounter = token;
    return token;
  }

  private toLockRecord(lockKey: string, data: LockData): LockRecord {
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

  public acquire(input: AcquireLockInput): AcquireLockResult {
    throw new LockingError("lock.sync_acquire_deprecated", "lock.sync_acquire_deprecated: Use acquireAsync instead");
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
    const lockKey = `lock:${input.lockKey}`;
    const fencingToken = await this.nextFencingToken();
    const lockData: LockData = {
      id: `lock_${fencingToken}_${randomUUID()}`,
      owner: input.owner,
      fencingToken,
      ttlMs,
      acquiredAt: now,
      metadata: null,
    };
    const result = await this.redis.set(lockKey, JSON.stringify(lockData), "PX", ttlMs, "NX");
    if (result !== "OK") {
      return { acquired: false };
    }
    return {
      acquired: true,
      lock: this.toLockRecord(input.lockKey, lockData),
    };
  }

  public async releaseAsync(lockKey: string, owner: string): Promise<boolean> {
    await this.ensureConnected();
    const script = `
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
local decoded = pcall(cjson.decode, current)
if not decoded or type(decoded) ~= 'table' then return -2 end
local data = decoded
if data.owner ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])
`;
    return Number(await this.redis.eval(script, 1, `lock:${lockKey}`, owner)) === 1;
  }

  public async extendAsync(lockKey: string, owner: string, additionalMs: number): Promise<LockRecord | null> {
    await this.ensureConnected();
    const key = `lock:${lockKey}`;
    const fencingToken = await this.nextFencingToken();
    const now = new Date().toISOString();
    const extendLua = `
local current = redis.call('get', KEYS[1])
if not current then return -1 end
local data = cjson.decode(current)
if data.owner ~= ARGV[1] then return 0 end
local newTtl = math.min((tonumber(data.ttlMs) or 0) + tonumber(ARGV[2]), 600000)
data.ttlMs = newTtl
data.fencingToken = tonumber(ARGV[3])
data.acquiredAt = ARGV[4]
local updated = cjson.encode(data)
redis.call('set', KEYS[1], updated, 'PX', newTtl)
return updated`;
    const result = await this.redis.eval(extendLua, 1, key, owner, String(additionalMs), String(fencingToken), now);
    if (result !== 1 && typeof result !== "string") {
      return null;
    }
    const current = typeof result === "string" ? result : await this.redis.get(key);
    if (!current) {
      return null;
    }
    const data = this.parseLockData(current);
    return this.toLockRecord(lockKey, data);
  }

  public async forceStealAsync(lockKey: string, newOwner: string, reason: string): Promise<LockRecord> {
    await this.ensureConnected();
    const key = `lock:${lockKey}`;
    const now = new Date().toISOString();
    const fencingToken = await this.nextFencingToken();
    const ttlMs = 30_000;
    const lockData: LockData = {
      id: `lock_${fencingToken}_${randomUUID()}`,
      owner: newOwner,
      fencingToken,
      ttlMs,
      acquiredAt: now,
      metadata: JSON.stringify({ forceStealReason: reason }),
    };
    const result = await this.redis.eval(
      "local current=redis.call('GET',KEYS[1]) if not current then return -1 end redis.call('SET',KEYS[1],ARGV[1],'PX',ARGV[2]) return 1",
      1,
      key,
      JSON.stringify(lockData),
      String(ttlMs),
    );
    if (Number(result) !== 1) {
      throw new LockingError(
        "lock.forceSteal_lock_not_found",
        `lock.forceSteal_lock_not_found: Cannot force-steal non-existent lock ${lockKey}`,
      );
    }
    return this.toLockRecord(lockKey, lockData);
  }

  public async inspectAsync(lockKey: string): Promise<LockRecord | null> {
    await this.ensureConnected();
    const current = await this.redis.get(`lock:${lockKey}`);
    if (!current) {
      return null;
    }
    const data = this.parseLockData(current);
    return this.toLockRecord(lockKey, data);
  }

  public async listHeldAsync(limit: number = 100): Promise<LockRecord[]> {
    await this.ensureConnected();
    const records: LockRecord[] = [];
    let cursor = 0;
    const lockPrefix = "lock:";
    const prefixLen = lockPrefix.length;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${lockPrefix}*`, "COUNT", 100);
      const parsedCursor = Number.parseInt(nextCursor, 10);
      cursor = Number.isFinite(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;

      if (keys.length > 0) {
        const values = await this.redis.mget(...keys);
        for (let i = 0; i < keys.length; i++) {
          if (records.length >= limit) break;
          const key = keys[i]!;
          const value = values[i];
          if (!value) continue;

          const data = this.parseLockData(value);
          records.push(this.toLockRecord(key.slice(prefixLen), data));
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
    try {
      await this.redis.quit();
    } catch (err) {
      lockLogger.log({
        level: "warn",
        message: "redis.quit_failed",
        data: { err: err instanceof Error ? err.message : String(err) },
      });
      this.redis.disconnect();
    }
  }
}
