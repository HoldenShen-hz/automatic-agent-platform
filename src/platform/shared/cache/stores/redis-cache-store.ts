/**
 * Redis Cache Store
 *
 * Provides a Redis-backed implementation of the CacheStore interface
 * for multi-instance shared caching.
 */

import { Redis } from "ioredis";
import type { CacheStore } from "./cache-store.js";
import type { CacheLookupResult, CacheMeta } from "../cache-types.js";
import { stableStringify } from "../utils/stable-stringify.js";
import type { RedisConnectionConfig } from "../../utils/redis-client-options.js";
import { buildRedisClientOptions } from "../../utils/redis-client-options.js";
import { StructuredLogger } from "../../observability/structured-logger.js";
import { runtimeMetricsRegistry } from "../../observability/runtime-metrics-registry.js";

const logger = new StructuredLogger({ retentionLimit: 200 });
const REDIS_INDEX_TTL_GRACE_MS = 60_000;
const CLEANUP_BATCH_SIZE = 100;

export interface RedisCacheConfig extends RedisConnectionConfig {
  keyPrefix?: string;
}

export class RedisCacheStore implements CacheStore {
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(config: RedisCacheConfig) {
    this.prefix = config.keyPrefix ?? "aacache:";
    this.redis = new Redis(buildRedisClientOptions(config));
    this.redis.on("error", (err) => {
      runtimeMetricsRegistry.incrementCounter("redis_connection_errors", { component: "redis-cache-store" }, 1);
      logger.error("redis.connection_error", { err: err instanceof Error ? err.message : String(err) });
    });
  }

  private encodeComponent(value: string): string {
    return encodeURIComponent(value);
  }

  private cacheKey(namespace: string, key: string): string {
    return `${this.prefix}entry:${this.encodeComponent(namespace)}:${this.encodeComponent(key)}`;
  }

  private tagSetKey(tag: string): string {
    return `${this.prefix}index:tag:${this.encodeComponent(tag)}`;
  }

  private namespaceSetKey(namespace: string): string {
    return `${this.prefix}index:namespace:${this.encodeComponent(namespace)}`;
  }

  private parseStoredEntry<T>(raw: string): { value: T; meta: CacheMeta } | null {
    try {
      return JSON.parse(raw) as { value: T; meta: CacheMeta };
    } catch (error) {
      logger.warn("redis_cache_store.invalid_cached_entry", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async loadStoredEntry<T>(fullKey: string): Promise<{ value: T; meta: CacheMeta } | null> {
    const raw = await this.redis.get(fullKey);
    if (raw === null) {
      return null;
    }
    return this.parseStoredEntry<T>(raw);
  }

  private async extendIndexTtl(indexKey: string, ttlMs: number | null): Promise<void> {
    if (ttlMs == null || ttlMs <= 0) {
      return;
    }
    const currentTtlMs = await this.redis.pttl(indexKey);
    if (currentTtlMs < ttlMs) {
      await this.redis.pexpire(indexKey, ttlMs);
    }
  }

  private async cleanupIndexSet(indexKey: string): Promise<number> {
    let cleaned = 0;
    let cursor = "0";
    do {
      const [nextCursor, members] = await this.redis.sscan(
        indexKey,
        cursor,
        "COUNT",
        CLEANUP_BATCH_SIZE,
      );
      cursor = nextCursor;
      if (members.length === 0) {
        continue;
      }
      const batches: string[][] = [];
      for (let i = 0; i < members.length; i += CLEANUP_BATCH_SIZE) {
        batches.push(members.slice(i, i + CLEANUP_BATCH_SIZE));
      }
      for (const batch of batches) {
        const results = await this.redis.mget(...batch);
        const deadMembers = batch.filter((_, index) => results[index] === null);
        if (deadMembers.length > 0) {
          await this.redis.srem(indexKey, ...deadMembers);
          cleaned += deadMembers.length;
        }
      }
    } while (cursor !== "0");
    return cleaned;
  }

  async get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>> {
    const fullKey = this.cacheKey(namespace, key);
    const entry = await this.loadStoredEntry<T>(fullKey);
    if (entry === null) {
      return { hit: false, value: null, reason: "not_found" };
    }
    try {
      if (entry.meta.expiresAt != null) {
        const ttlMs = await this.redis.pttl(fullKey);
        if (ttlMs <= 0) {
          await this.delete(namespace, key);
          return { hit: false, value: null, reason: "expired" };
        }
      }
      return { hit: true, value: entry.value, layer: "L2", meta: entry.meta };
    } catch (error) {
      logger.warn("redis_cache_store.expired_entry_cleanup_failed", {
        namespace,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.delete(namespace, key);
      return { hit: false, value: null, reason: "not_found" };
    }
  }

  async set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void> {
    const fullKey = this.cacheKey(namespace, key);
    const payload = stableStringify({ value, meta });
    const existingEntry = await this.loadStoredEntry<T>(fullKey);
    const ttlMs = meta.expiresAt != null ? meta.expiresAt - Date.now() : null;
    if (ttlMs != null && ttlMs <= 0) {
      await this.delete(namespace, key);
      return;
    }

    const pipeline = this.redis.pipeline();
    if (ttlMs != null) {
      pipeline.set(fullKey, payload, "PX", ttlMs);
    } else {
      pipeline.set(fullKey, payload);
    }

    pipeline.sadd(this.namespaceSetKey(namespace), fullKey);
    for (const tag of meta.tags) {
      pipeline.sadd(this.tagSetKey(tag), fullKey);
    }
    for (const previousTag of existingEntry?.meta.tags ?? []) {
      if (!meta.tags.includes(previousTag)) {
        pipeline.srem(this.tagSetKey(previousTag), fullKey);
      }
    }
    await pipeline.exec();

    const indexTtlMs = ttlMs != null ? ttlMs + REDIS_INDEX_TTL_GRACE_MS : null;
    await this.extendIndexTtl(this.namespaceSetKey(namespace), indexTtlMs);
    await Promise.all(meta.tags.map((tag) => this.extendIndexTtl(this.tagSetKey(tag), indexTtlMs)));
  }

  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = this.cacheKey(namespace, key);
    const existingEntry = await this.loadStoredEntry(fullKey);
    const pipeline = this.redis.pipeline();
    pipeline.del(fullKey);
    pipeline.srem(this.namespaceSetKey(namespace), fullKey);
    for (const tag of existingEntry?.meta.tags ?? []) {
      pipeline.srem(this.tagSetKey(tag), fullKey);
    }
    await pipeline.exec();
  }

  async invalidateByTag(tag: string): Promise<number> {
    const tagKey = this.tagSetKey(tag);
    const members = await this.redis.smembers(tagKey);
    if (members.length === 0) return 0;

    const payloads = await this.redis.mget(...members);
    const pipeline = this.redis.pipeline();
    const namespaceRemovals = new Map<string, string[]>();
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];
      const payload = payloads[index];
      if (member == null) {
        continue;
      }
      pipeline.del(member);
      if (payload != null) {
        const entry = this.parseStoredEntry(payload);
        if (entry != null) {
          for (const memberTag of entry.meta.tags) {
            pipeline.srem(this.tagSetKey(memberTag), member);
          }
        }
      }
    }
    pipeline.del(tagKey);
    for (const member of members) {
      const [, namespace] = member.split("entry:");
      if (namespace == null) {
        continue;
      }
      const decodedNamespace = decodeURIComponent(namespace.split(":")[0] ?? "");
      const values = namespaceRemovals.get(decodedNamespace) ?? [];
      values.push(member);
      namespaceRemovals.set(decodedNamespace, values);
    }
    for (const [namespace, keys] of namespaceRemovals.entries()) {
      pipeline.srem(this.namespaceSetKey(namespace), ...keys);
    }
    await pipeline.exec();
    return members.length;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    const nsKey = this.namespaceSetKey(namespace);
    const members = await this.redis.smembers(nsKey);
    if (members.length === 0) return 0;

    const payloads = await this.redis.mget(...members);
    const pipeline = this.redis.pipeline();
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];
      const payload = payloads[index];
      if (member == null) {
        continue;
      }
      pipeline.del(member);
      if (payload != null) {
        const entry = this.parseStoredEntry(payload);
        if (entry != null) {
          for (const tag of entry.meta.tags) {
            pipeline.srem(this.tagSetKey(tag), member);
          }
        }
      }
    }
    pipeline.del(nsKey);
    await pipeline.exec();
    return members.length;
  }

  async cleanupExpired(): Promise<number> {
    // Redis handles TTL-based expiration natively.
    // This method cleans up stale tag/namespace index entries.
    let cleaned = 0;
    const tagPattern = `${this.prefix}index:tag:*`;
    const namespacePattern = `${this.prefix}index:namespace:*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, "MATCH", tagPattern, "COUNT", 100
      );
      cursor = nextCursor;
      const counts = await Promise.all(keys.map((tagKey) => this.cleanupIndexSet(tagKey)));
      cleaned += counts.reduce((sum, count) => sum + count, 0);
    } while (cursor !== "0");
    cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, "MATCH", namespacePattern, "COUNT", 100
      );
      cursor = nextCursor;
      const counts = await Promise.all(keys.map((namespaceKey) => this.cleanupIndexSet(namespaceKey)));
      cleaned += counts.reduce((sum, count) => sum + count, 0);
    } while (cursor !== "0");
    return cleaned;
  }

  async connect(): Promise<void> {
    await this.redis.connect();
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
}
