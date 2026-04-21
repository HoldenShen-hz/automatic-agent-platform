import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { LockingError } from "../../contracts/errors.js";
import { buildRedisClientOptions } from "../../shared/utils/redis-client-options.js";
import { lockLogger } from "./locking-support.js";
export class RedisLockAdapter {
    backendKind = "redis";
    redis;
    fencingCounter = 0;
    cliPath;
    connectTimeoutMs;
    host;
    port;
    constructor(config) {
        this.host = config?.host ?? "localhost";
        this.port = config?.port ?? 6379;
        this.cliPath = config?.cliPath ?? "redis-cli";
        this.connectTimeoutMs = config?.connectTimeoutMs ?? 500;
        const require = createRequire(import.meta.url);
        const RedisCtor = require("ioredis");
        this.redis = new RedisCtor(buildRedisClientOptions(config ?? {}, {
            connectTimeout: config?.connectTimeout ?? this.connectTimeoutMs,
            maxRetriesPerRequest: config?.maxRetriesPerRequest ?? 1,
        }));
        this.redis.on("error", () => { });
    }
    async ensureConnected() {
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
    acquire(input) {
        const { lockKey, owner } = input;
        const ttlMs = input.ttlMs ?? 30_000;
        const ttlSec = Math.ceil(ttlMs / 1000);
        const now = new Date().toISOString();
        this.fencingCounter += 1;
        const fencingToken = this.fencingCounter;
        try {
            const fullKey = `lock:${lockKey}`;
            const lockData = {
                id: `lock_${Date.now()}_${this.fencingCounter}`,
                owner,
                fencingToken,
                ttlMs,
                acquiredAt: now,
                metadata: null,
            };
            const result = spawnSync(this.cliPath, ["-h", this.host, "-p", String(this.port), "SET", fullKey, JSON.stringify(lockData), "NX", "EX", String(ttlSec)], { timeout: this.connectTimeoutMs, encoding: "utf8" });
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
        }
        catch (error) {
            lockLogger.log({
                level: "warn",
                message: "Redis lock acquire failed",
                data: { lockKey, owner, error: error instanceof Error ? error.message : String(error) },
            });
            return { acquired: false };
        }
    }
    release(_lockKey, _owner) {
        throw new LockingError("lock.sync_release_not_supported", "lock.sync_release_not_supported: Use releaseAsync for Redis backend");
    }
    extend(_lockKey, _owner, _additionalMs) {
        throw new LockingError("lock.sync_extend_not_supported", "lock.sync_extend_not_supported: Use extendAsync for Redis backend");
    }
    forceSteal(_lockKey, _newOwner, _reason) {
        throw new LockingError("lock.sync_forceSteal_not_supported", "lock.sync_forceSteal_not_supported: Use forceStealAsync for Redis backend");
    }
    inspect(_lockKey) {
        throw new LockingError("lock.sync_inspect_not_supported", "lock.sync_inspect_not_supported: Use inspectAsync for Redis backend");
    }
    async acquireAsync(input) {
        await this.ensureConnected();
        const now = new Date().toISOString();
        const ttlMs = input.ttlMs ?? 30_000;
        const ttlSec = Math.ceil(ttlMs / 1000);
        const lockKey = `lock:${input.lockKey}`;
        this.fencingCounter += 1;
        const lockData = {
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
    async releaseAsync(lockKey, owner) {
        await this.ensureConnected();
        const script = "local current=redis.call('GET',KEYS[1]) if not current then return -1 end local data=cjson.decode(current) if data.owner~=ARGV[1] then return 0 end return redis.call('DEL',KEYS[1])";
        return Number(await this.redis.eval(script, 1, `lock:${lockKey}`, owner)) === 1;
    }
    async extendAsync(lockKey, owner, additionalMs) {
        await this.ensureConnected();
        const key = `lock:${lockKey}`;
        const current = await this.redis.get(key);
        if (!current) {
            return null;
        }
        const data = JSON.parse(current);
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
    async forceStealAsync(lockKey, newOwner, reason) {
        await this.ensureConnected();
        const key = `lock:${lockKey}`;
        await this.redis.del(key);
        const now = new Date().toISOString();
        this.fencingCounter += 1;
        const ttlMs = 30_000;
        const lockData = {
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
    async inspectAsync(lockKey) {
        await this.ensureConnected();
        const current = await this.redis.get(`lock:${lockKey}`);
        if (!current) {
            return null;
        }
        const data = JSON.parse(current);
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
    async listHeldAsync(limit = 100) {
        await this.ensureConnected();
        const keys = await this.redis.keys("lock:*");
        const records = [];
        for (const key of keys.slice(0, limit)) {
            const current = await this.redis.get(key);
            if (!current) {
                continue;
            }
            const data = JSON.parse(current);
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
    async close() {
        if (this.redis.status === "wait" || this.redis.status === "end") {
            this.redis.disconnect();
            return;
        }
        await this.redis.quit();
    }
}
//# sourceMappingURL=redis-lock-adapter.js.map