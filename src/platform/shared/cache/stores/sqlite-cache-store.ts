/**
 * SQLite Cache Store
 *
 * Persistent cache store using SQLite for L2/L3 caching.
 * Provides tag-based invalidation and TTL support.
 */

import type { CacheLookupResult, CacheMeta } from '../cache-types.js';
import type { CacheStore } from './cache-store.js';
import { stableStringify } from '../utils/stable-stringify.js';

export interface SqliteCacheStoreDeps {
  execute(sql: string, params?: unknown[]): Promise<{ changes?: number }>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface SerializedSqliteCacheEntry<T = unknown> {
  value: T;
  meta?: CacheMeta;
}

export class SqliteCacheStore implements CacheStore {
  constructor(private readonly db: SqliteCacheStoreDeps) {}

  private deserializeValue<T>(valueJson: string): SerializedSqliteCacheEntry<T> {
    const parsed = JSON.parse(valueJson) as T | SerializedSqliteCacheEntry<T>;
    if (parsed != null && typeof parsed === "object" && "value" in parsed) {
      return parsed as SerializedSqliteCacheEntry<T>;
    }
    return { value: parsed as T };
  }

  async get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>> {
    const rows = await this.db.query<{
      namespace: string;
      cache_key: string;
      value_json: string;
      scope: string;
      version: string;
      tags_json: string;
      size_bytes: number;
      created_at: number;
      expires_at: number | null;
      last_accessed_at: number;
      hit_count: number;
    }>(
      `SELECT namespace, cache_key, value_json, scope, version, tags_json,
              size_bytes, created_at, expires_at, last_accessed_at, hit_count
       FROM cache_entries
       WHERE namespace = ? AND cache_key = ?`,
      [namespace, key]
    );

    if (rows.length === 0) {
      return { hit: false, value: null, reason: 'not_found' };
    }

    const row = rows[0];
    if (row === undefined) {
      return { hit: false, value: null, reason: 'not_found' };
    }

    // Check expiration
    if (row.expires_at && row.expires_at <= Date.now()) {
      await this.delete(namespace, key);
      return { hit: false, value: null, reason: 'expired' };
    }

    // Update access metadata
    await this.db.execute(
      `UPDATE cache_entries
       SET last_accessed_at = ?, hit_count = hit_count + 1
       WHERE namespace = ? AND cache_key = ?`,
      [Date.now(), namespace, key]
    );

    return {
      hit: true,
      value: this.deserializeValue<T>(row.value_json).value,
      layer: 'L3',
      meta: {
        scope: row.scope as CacheMeta["scope"],
        tags: JSON.parse(row.tags_json) as string[],
        version: row.version,
        createdAt: row.created_at,
        ...(row.expires_at != null ? { expiresAt: row.expires_at } : {}),
        lastAccessedAt: Date.now(),
        hitCount: row.hit_count + 1,
        sizeBytes: row.size_bytes,
      },
    };
  }

  async set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void> {
    const valueJson = stableStringify({ value, meta });
    const tagsJson = stableStringify(meta.tags);

    await this.db.execute(
      `INSERT INTO cache_entries
         (namespace, cache_key, scope, value_json, version, tags_json,
          size_bytes, created_at, expires_at, last_accessed_at, hit_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(namespace, cache_key) DO UPDATE SET
         scope = excluded.scope,
         value_json = excluded.value_json,
         version = excluded.version,
         tags_json = excluded.tags_json,
         size_bytes = excluded.size_bytes,
         expires_at = excluded.expires_at,
         last_accessed_at = excluded.last_accessed_at,
         hit_count = cache_entries.hit_count`,
      [
        namespace,
        key,
        meta.scope,
        valueJson,
        meta.version,
        tagsJson,
        meta.sizeBytes,
        meta.createdAt,
        meta.expiresAt ?? null,
        meta.lastAccessedAt,
        meta.hitCount,
      ]
    );

    // Insert tag index entries
    for (const tag of meta.tags) {
      await this.db.execute(
        `INSERT OR IGNORE INTO cache_tag_index (tag, namespace, cache_key)
         VALUES (?, ?, ?)`,
        [tag, namespace, key]
      );
    }
  }

  async delete(namespace: string, key: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM cache_entries WHERE namespace = ? AND cache_key = ?`,
      [namespace, key]
    );
    await this.db.execute(
      `DELETE FROM cache_tag_index WHERE namespace = ? AND cache_key = ?`,
      [namespace, key]
    );
  }

  async invalidateByTag(tag: string): Promise<number> {
    // Find all entries with this tag
    const entries = await this.db.query<{ namespace: string; cache_key: string }>(
      `SELECT namespace, cache_key FROM cache_tag_index WHERE tag = ?`,
      [tag]
    );

    if (entries.length === 0) {
      return 0;
    }

    const tuplePlaceholders = entries.map(() => "(?, ?)").join(", ");
    const tupleParams = entries.flatMap((entry) => [entry.namespace, entry.cache_key]);

    await this.db.execute("BEGIN");
    try {
      await this.db.execute(
        `DELETE FROM cache_entries
         WHERE (namespace, cache_key) IN (${tuplePlaceholders})`,
        tupleParams,
      );
      await this.db.execute(
        `DELETE FROM cache_tag_index
         WHERE (namespace, cache_key) IN (${tuplePlaceholders})`,
        tupleParams,
      );
      await this.db.execute("COMMIT");
    } catch (error) {
      await this.db.execute("ROLLBACK");
      throw error;
    }

    return entries.length;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    const result = await this.db.execute(
      `DELETE FROM cache_entries WHERE namespace = ?`,
      [namespace]
    );

    await this.db.execute(
      `DELETE FROM cache_tag_index WHERE namespace = ?`,
      [namespace]
    );

    return result.changes ?? 0;
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const result = await this.db.execute(
      `DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at <= ?`,
      [now]
    );

    return result.changes ?? 0;
  }
}
