import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import { LockingError } from "../../contracts/errors.js";
import { buildRedisClientOptions } from "../../shared/utils/redis-client-options.js";
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
    set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
    keys(pattern: string): Promise<string[]>;
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
    this.redis.on("error", () => {});
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
      return;
    }
    if (this.redis.status === "end") {
      await this.redis.connect().catch(() => {
        throw new LockingError("lock.redis_connection_closed", "lock.redis_connection_closed");
      });
    }
  }

  public acquire(input: AcquireLockInput): AcquireLockResult {
    const { lockKey, owner } = input;
    const ttlMs = input.ttlMs ?? 30_000;
    const ttlSec = Math.ceil(ttlMs / 1000);
    const now = new Date().toISOString();
    this.fencingCounter += 1;
    const fencingToken = this.fencingCounter;
    try {
      const fullKey = `lock:${lockKey}`;
      const lockData: LockData = {
        id: `lock_${Date.now()}_${this.fencingCounter}`,
        owner,
        fencingToken,
        ttlMs,
        acquiredAt: now,
        metadata: null,
      };
      const result = spawnSync(
        this.cliPath,
        ["-h", this.host, "-p", String(this.port), "SET", fullKey, JSON.stringify(lockData), "NX", "EX", String(ttlSec)],
        { timeout: this.connectTimeoutMs, encoding: "utf8" },
      );
      if (result.status === 0 && result.stdout?.trim() === "OK") {
        return {
          acquired: true,
          lock: {
            lockKey,
            owner,
            fencingToken,
            status: "held",
            acquiredAt: now,
            ttlMs,
            metadata: null,
          },
        };
      }
      return { acquired: false };
    } catch (error) {
      lockLogger.log({
        level: "warn",
        message: "Redis lock acquire failed",
        data: { lockKey, owner, error: error instanceof Error ? error.message : String(error) },
      });
      return { acquired: false };
    }
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
    this.fencingCounter += 1;
    const lockData: LockData = {
      id: `lock_${Date.now()}_${this.fencingCounter}`,
      owner: input.owner,
      fencingToken: this.fencingCounter,
      ttlMs,
      acquiredAt: now,
      metadata: null,
    };
    const result = await this.redis.set(lockKey, JSON.stringify(lockData), "EX", ttlSec, "NX");
    if (result !== "OK") {
      return { acquired: false };
    }
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
    return Number(await this.redis.eval(script, 1, `lock:${lockKey}`, owner)) === 1;
  }

  public async extendAsync(lockKey: string, owner: string, additionalMs: number): Promise<LockRecord | null> {
    await this.ensureConnected();
    const key = `lock:${lockKey}`;
    const current = await this.redis.get(key);
    if (!current) {
      return null;
    }
    const data = JSON.parse(current) as LockData;
    if (data.owner !== owner) {
      return null;
    }
    const newTtlMs = Math.min(additionalMs, 600_000);
    data.ttlMs = newTtlMs;
    await this.redis.set(key, JSON.stringify(data), "EX", Math.ceil(newTtlMs / 1000));
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
    await this.redis.del(key);
    const now = new Date().toISOString();
    this.fencingCounter += 1;
    const ttlMs = 30_000;
    const lockData: LockData = {
      id: `lock_${Date.now()}_${this.fencingCounter}`,
      owner: newOwner,
      fencingToken: this.fencingCounter,
      ttlMs,
      acquiredAt: now,
      metadata: JSON.stringify({ forceStealReason: reason }),
    };
    await this.redis.set(key, JSON.stringify(lockData), "EX", Math.ceil(ttlMs / 1000));
    return {
      lockKey,
      owner: newOwner,
      fencingToken: this.fencingCounter,
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
    const keys = await this.redis.keys("lock:*");
    const records: LockRecord[] = [];
    for (const key of keys.slice(0, limit)) {
      const current = await this.redis.get(key);
      if (!current) {
        continue;
      }
      const data = JSON.parse(current) as LockData;
      records.push({
        lockKey: key.slice(5),
        owner: data.owner,
        fencingToken: data.fencingToken,
        status: "held",
        acquiredAt: data.acquiredAt,
        ttlMs: data.ttlMs,
        metadata: data.metadata,
      });
    }
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
