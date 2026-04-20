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

export interface RedisCacheConfig extends RedisConnectionConfig {
  keyPrefix?: string;
}

export class RedisCacheStore implements CacheStore {
  private readonly redis: Redis;
  private readonly prefix: string;

  constructor(config: RedisCacheConfig) {
    this.prefix = config.keyPrefix ?? "aacache:";
    this.redis = new Redis(buildRedisClientOptions(config, {
      keyPrefix: this.prefix,
    }));
    this.redis.on("error", () => {});
  }

  private cacheKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  private tagSetKey(tag: string): string {
    return `_tag:${tag}`;
  }

  private namespaceSetKey(namespace: string): string {
    return `_ns:${namespace}`;
  }

  async get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>> {
    const fullKey = this.cacheKey(namespace, key);
    const raw = await this.redis.get(fullKey);
    if (raw === null) {
      return { hit: false, value: null, reason: "not_found" };
    }
    try {
      const entry = JSON.parse(raw) as { value: T; meta: CacheMeta };
      if (entry.meta.expiresAt && entry.meta.expiresAt <= Date.now()) {
        await this.redis.del(fullKey);
        return { hit: false, value: null, reason: "expired" };
      }
      return { hit: true, value: entry.value, layer: "L2" };
    } catch {
      await this.redis.del(fullKey);
      return { hit: false, value: null, reason: "not_found" };
    }
  }

  async set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void> {
    const fullKey = this.cacheKey(namespace, key);
    const payload = stableStringify({ value, meta });
    const pipeline = this.redis.pipeline();

    if (meta.expiresAt) {
      const ttlMs = meta.expiresAt - Date.now();
      if (ttlMs <= 0) return;
      pipeline.set(fullKey, payload, "PX", ttlMs);
    } else {
      pipeline.set(fullKey, payload);
    }

    // Maintain tag→key index for invalidation
    for (const tag of meta.tags) {
      pipeline.sadd(this.tagSetKey(tag), fullKey);
      if (meta.expiresAt) {
        const ttlS = Math.ceil((meta.expiresAt - Date.now()) / 1000);
        pipeline.expire(this.tagSetKey(tag), ttlS + 60);
      }
    }

    // Maintain namespace→key index
    pipeline.sadd(this.namespaceSetKey(namespace), fullKey);

    await pipeline.exec();
  }

  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = this.cacheKey(namespace, key);
    await this.redis.del(fullKey);
  }

  async invalidateByTag(tag: string): Promise<number> {
    const tagKey = this.tagSetKey(tag);
    const members = await this.redis.smembers(tagKey);
    if (members.length === 0) return 0;

    const pipeline = this.redis.pipeline();
    for (const member of members) {
      pipeline.del(member);
    }
    pipeline.del(tagKey);
    await pipeline.exec();
    return members.length;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    const nsKey = this.namespaceSetKey(namespace);
    const members = await this.redis.smembers(nsKey);
    if (members.length === 0) return 0;

    const pipeline = this.redis.pipeline();
    for (const member of members) {
      pipeline.del(member);
    }
    pipeline.del(nsKey);
    await pipeline.exec();
    return members.length;
  }

  async cleanupExpired(): Promise<number> {
    // Redis handles TTL-based expiration natively.
    // This method cleans up stale tag/namespace index entries.
    let cleaned = 0;
    const tagPattern = `${this.prefix}_tag:*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor, "MATCH", tagPattern, "COUNT", 100
      );
      cursor = nextCursor;
      for (const tagKey of keys) {
        const strippedKey = tagKey.slice(this.prefix.length);
        const members = await this.redis.smembers(strippedKey);
        const pipeline = this.redis.pipeline();
        for (const member of members) {
          pipeline.exists(member);
        }
        const results = await pipeline.exec();
        const deadMembers = members.filter((_: string, i: number) => results?.[i]?.[1] === 0);
        if (deadMembers.length > 0) {
          await this.redis.srem(strippedKey, ...deadMembers);
          cleaned += deadMembers.length;
        }
      }
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
    await this.redis.quit();
  }
}
