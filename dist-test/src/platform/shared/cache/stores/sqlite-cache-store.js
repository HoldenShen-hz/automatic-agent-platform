/**
 * SQLite Cache Store
 *
 * Persistent cache store using SQLite for L2/L3 caching.
 * Provides tag-based invalidation and TTL support.
 */
import { stableStringify } from '../utils/stable-stringify.js';
export class SqliteCacheStore {
    db;
    constructor(db) {
        this.db = db;
    }
    async get(namespace, key) {
        const rows = await this.db.query(`SELECT namespace, cache_key, value_json, scope, version, tags_json,
              size_bytes, created_at, expires_at, last_accessed_at, hit_count
       FROM cache_entries
       WHERE namespace = ? AND cache_key = ?`, [namespace, key]);
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
        await this.db.execute(`UPDATE cache_entries
       SET last_accessed_at = ?, hit_count = hit_count + 1
       WHERE namespace = ? AND cache_key = ?`, [Date.now(), namespace, key]);
        return {
            hit: true,
            value: JSON.parse(row.value_json),
            layer: 'L3',
        };
    }
    async set(namespace, key, value, meta) {
        const valueJson = stableStringify(value);
        const tagsJson = stableStringify(meta.tags);
        await this.db.execute(`INSERT INTO cache_entries
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
         hit_count = excluded.hit_count`, [
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
        ]);
        // Insert tag index entries
        for (const tag of meta.tags) {
            await this.db.execute(`INSERT OR IGNORE INTO cache_tag_index (tag, namespace, cache_key)
         VALUES (?, ?, ?)`, [tag, namespace, key]);
        }
    }
    async delete(namespace, key) {
        await this.db.execute(`DELETE FROM cache_entries WHERE namespace = ? AND cache_key = ?`, [namespace, key]);
        await this.db.execute(`DELETE FROM cache_tag_index WHERE namespace = ? AND cache_key = ?`, [namespace, key]);
    }
    async invalidateByTag(tag) {
        // Find all entries with this tag
        const entries = await this.db.query(`SELECT namespace, cache_key FROM cache_tag_index WHERE tag = ?`, [tag]);
        if (entries.length === 0) {
            return 0;
        }
        let count = 0;
        for (const entry of entries) {
            await this.delete(entry.namespace, entry.cache_key);
            count++;
        }
        return count;
    }
    async invalidateNamespace(namespace) {
        const result = await this.db.execute(`DELETE FROM cache_entries WHERE namespace = ?`, [namespace]);
        await this.db.execute(`DELETE FROM cache_tag_index WHERE namespace = ?`, [namespace]);
        return result.changes ?? 0;
    }
    async cleanupExpired() {
        const now = Date.now();
        const result = await this.db.execute(`DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at <= ?`, [now]);
        return result.changes ?? 0;
    }
}
//# sourceMappingURL=sqlite-cache-store.js.map