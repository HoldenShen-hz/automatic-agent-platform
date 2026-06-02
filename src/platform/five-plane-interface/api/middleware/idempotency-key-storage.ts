/**
 * Idempotency Key Storage Backend
 *
 * Provides storage implementations for idempotency keys.
 * Supports in-memory, Redis, and SQLite backends.
 *
 * Part of R18-30: Idempotency-key enforcement middleware per §6.2
 */

import type { RedisConnectionConfig } from "../../../shared/utils/redis-client-options.js";
import { buildRedisClientOptions } from "../../../shared/utils/redis-client-options.js";
import { Redis } from "ioredis";
import type { AuthoritativeSqlDatabase } from "../../../five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { ValidationError } from "../../../contracts/errors.js";

/**
 * Idempotency key entry stored in cache.
 */
export interface IdempotencyEntry {
  /** Request method that created this key */
  method: string;
  /** Response status code */
  statusCode: number;
  /** Cached response body as JSON string */
  responseBody: string | null;
  /** When this entry expires (Unix timestamp in ms) */
  expiresAt: number;
  /** Request hash for validation */
  requestHash: string | null;
}

/**
 * Storage backend interface for idempotency keys.
 */
export interface IdempotencyStorage {
  /**
   * Get an idempotency entry by key.
   * @returns The entry if found and not expired, null otherwise
   */
  get(key: string): Promise<IdempotencyEntry | null>;
  /**
   * Atomically reserve a key with a pending marker.
   * Returns the existing entry when the reservation cannot be acquired.
   */
  reservePending(key: string, method: string, ttlMs: number): Promise<{
    acquired: boolean;
    entry: IdempotencyEntry | null;
  }>;
  /**
   * Set an idempotency entry.
   * @param key - The idempotency key
   * @param entry - The entry to store
   * @param ttlMs - Time to live in milliseconds
   */
  set(key: string, entry: Omit<IdempotencyEntry, "expiresAt">, ttlMs: number): Promise<void>;
  /**
   * Delete an idempotency entry.
   */
  delete(key: string): Promise<void>;
  /**
   * Clean up expired entries.
   * @param maxDelete - Maximum number of entries to delete (0 = unlimited)
   */
  cleanup(maxDelete?: number): Promise<number>;
}

/**
 * In-memory idempotency storage for single-instance deployments.
 */
export class InMemoryIdempotencyStorage implements IdempotencyStorage {
  private readonly entries = new Map<string, IdempotencyEntry>();
  private readonly maxEntries: number;

  public constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = Math.max(1, Math.trunc(options.maxEntries ?? 10_000));
  }

  async get(key: string): Promise<IdempotencyEntry | null> {
    const entry = this.entries.get(key);
    if (entry == null) return null;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  async reservePending(
    key: string,
    method: string,
    ttlMs: number,
  ): Promise<{ acquired: boolean; entry: IdempotencyEntry | null }> {
    const now = Date.now();
    this.cleanupExpired(now);
    const existing = this.entries.get(key) ?? null;
    if (existing != null) {
      return { acquired: false, entry: existing };
    }
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      this.evictOldestEntry();
    }
    this.entries.set(key, {
      method,
      statusCode: 0,
      responseBody: null,
      expiresAt: now + ttlMs,
      requestHash: null,
    });
    return { acquired: true, entry: null };
  }

  async set(key: string, entry: Omit<IdempotencyEntry, "expiresAt">, ttlMs: number): Promise<void> {
    this.cleanupExpired(Date.now());
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      this.evictOldestEntry();
    }
    this.entries.set(key, {
      ...entry,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async cleanup(maxDelete = 0): Promise<number> {
    return this.cleanupExpired(Date.now(), maxDelete);
  }

  private cleanupExpired(now: number, maxDelete = 0): number {
    let deleted = 0;
    for (const [key, entry] of this.entries.entries()) {
      if (now >= entry.expiresAt) {
        this.entries.delete(key);
        deleted++;
        if (maxDelete > 0 && deleted >= maxDelete) break;
      }
    }
    return deleted;
  }

  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestExpiresAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt < oldestExpiresAt) {
        oldestKey = key;
        oldestExpiresAt = entry.expiresAt;
      }
    }
    if (oldestKey != null) {
      this.entries.delete(oldestKey);
    }
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get current entry count.
   */
  size(): number {
    return this.entries.size;
  }
}

/**
 * Redis-backed idempotency storage for distributed deployments.
 */
export class RedisIdempotencyStorage implements IdempotencyStorage {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(config: RedisConnectionConfig & { keyPrefix?: string } = {}) {
    this.keyPrefix = config.keyPrefix ?? "idempotency:";
    this.redis = new Redis(buildRedisClientOptions(config, {
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
      connectTimeout: config.connectTimeout ?? 500,
    }));
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<IdempotencyEntry | null> {
    const fullKey = this.buildKey(key);
    const data = await this.redis.get(fullKey);
    if (data == null) return null;
    try {
      const entry = JSON.parse(data) as IdempotencyEntry;
      if (Date.now() >= entry.expiresAt) {
        await this.redis.del(fullKey);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  async reservePending(
    key: string,
    method: string,
    ttlMs: number,
  ): Promise<{ acquired: boolean; entry: IdempotencyEntry | null }> {
    const fullKey = this.buildKey(key);
    const data = JSON.stringify({
      method,
      statusCode: 0,
      responseBody: null,
      expiresAt: Date.now() + ttlMs,
      requestHash: null,
    } satisfies IdempotencyEntry);
    const acquired = await this.redis.set(fullKey, data, "PX", ttlMs, "NX");
    if (acquired === "OK") {
      return { acquired: true, entry: null };
    }
    return { acquired: false, entry: await this.get(key) };
  }

  async set(key: string, entry: Omit<IdempotencyEntry, "expiresAt">, ttlMs: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const data = JSON.stringify({
      ...entry,
      expiresAt: Date.now() + ttlMs,
    });
    await this.redis.set(fullKey, data, "PX", ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.buildKey(key));
  }

  async cleanup(maxDelete = 0): Promise<number> {
    let cursor = "0";
    let deleted = 0;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${this.keyPrefix}*`, "COUNT", "200");
      cursor = nextCursor;
      for (const fullKey of keys) {
        const payload = await this.redis.get(fullKey);
        if (payload == null) {
          continue;
        }
        try {
          const entry = JSON.parse(payload) as IdempotencyEntry;
          if (Date.now() < entry.expiresAt) {
            continue;
          }
        } catch {
          // Corrupt payloads are treated as expired and removed.
        }
        await this.redis.del(fullKey);
        deleted += 1;
        if (maxDelete > 0 && deleted >= maxDelete) {
          return deleted;
        }
      }
    } while (cursor !== "0");
    return deleted;
  }
}

/**
 * SQLite-backed idempotency storage.
 */
export class SqliteIdempotencyStorage implements IdempotencyStorage {
  private readonly db: AuthoritativeSqlDatabase;
  private readonly tableName: string;

  constructor(db: AuthoritativeSqlDatabase, tableName = "idempotency_keys") {
    this.db = db;
    this.tableName = validateSqlIdentifier(tableName);
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.transaction(() => {
      this.db.connection.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key TEXT PRIMARY KEY,
          method TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_body TEXT,
          request_hash TEXT,
          expires_at TEXT NOT NULL
        )
      `);
      this.db.connection.exec(`
        CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
        ON ${this.tableName}(expires_at)
      `);
    });
  }

  async get(key: string): Promise<IdempotencyEntry | null> {
    return this.db.transaction(() => {
      const stmt = this.db.connection.prepare(`
        SELECT method, status_code, response_body, request_hash, expires_at
        FROM ${this.tableName}
        WHERE key = ?
      `);
      const row = stmt.get(key) as {
        method: string;
        status_code: number;
        response_body: string | null;
        request_hash: string | null;
        expires_at: number | string;
      } | undefined;
      if (row == null) return null;
      const expiresAtMs = parseSqliteExpiresAt(row.expires_at);
      if (Date.now() >= expiresAtMs) {
        this.db.connection.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(key);
        return null;
      }
      return {
        method: row.method,
        statusCode: row.status_code,
        responseBody: row.response_body,
        expiresAt: expiresAtMs,
        requestHash: row.request_hash,
      };
    });
  }

  async reservePending(
    key: string,
    method: string,
    ttlMs: number,
  ): Promise<{ acquired: boolean; entry: IdempotencyEntry | null }> {
    return this.db.transaction(() => {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      this.db.connection.prepare(`
        DELETE FROM ${this.tableName}
        WHERE key = ?
          AND ((typeof(expires_at) = 'integer' AND expires_at <= ?)
            OR (typeof(expires_at) != 'integer' AND expires_at <= ?))
      `).run(key, nowMs, nowIso);
      const insert = this.db.connection.prepare(`
        INSERT OR IGNORE INTO ${this.tableName}
        (key, method, status_code, response_body, request_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        key,
        method,
        0,
        null,
        null,
        new Date(nowMs + ttlMs).toISOString(),
      );
      if (Number(insert.changes) > 0) {
        return { acquired: true, entry: null };
      }
      const row = this.db.connection.prepare(`
        SELECT method, status_code, response_body, request_hash, expires_at
        FROM ${this.tableName}
        WHERE key = ?
      `).get(key) as {
        method: string;
        status_code: number;
        response_body: string | null;
        request_hash: string | null;
        expires_at: number | string;
      } | undefined;
      if (row == null) {
        return { acquired: false, entry: null };
      }
      return {
        acquired: false,
        entry: {
          method: row.method,
          statusCode: row.status_code,
          responseBody: row.response_body,
          expiresAt: parseSqliteExpiresAt(row.expires_at),
          requestHash: row.request_hash,
        },
      };
    });
  }

  async set(key: string, entry: Omit<IdempotencyEntry, "expiresAt">, ttlMs: number): Promise<void> {
    this.db.transaction(() => {
      const stmt = this.db.connection.prepare(`
        INSERT OR REPLACE INTO ${this.tableName}
        (key, method, status_code, response_body, request_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        key,
        entry.method,
        entry.statusCode,
        entry.responseBody,
        entry.requestHash,
        new Date(Date.now() + ttlMs).toISOString(),
      );
    });
  }

  async delete(key: string): Promise<void> {
    this.db.transaction(() => {
      this.db.connection.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(key);
    });
  }

  async cleanup(maxDelete = 0): Promise<number> {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    return this.db.transaction(() => {
      if (maxDelete > 0) {
        const keys = this.db.connection.prepare(`
          SELECT key FROM ${this.tableName}
          WHERE (typeof(expires_at) = 'integer' AND expires_at <= ?)
             OR (typeof(expires_at) != 'integer' AND expires_at <= ?)
          ORDER BY expires_at ASC, key ASC
          LIMIT ?
        `).all(nowMs, nowIso, Math.trunc(maxDelete)) as Array<{ key: string }>;
        for (const row of keys) {
          this.db.connection.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(row.key);
        }
        return keys.length;
      }
      const result = this.db.connection.prepare(`
        DELETE FROM ${this.tableName}
        WHERE (typeof(expires_at) = 'integer' AND expires_at <= ?)
           OR (typeof(expires_at) != 'integer' AND expires_at <= ?)
      `).run(nowMs, nowIso);
      return Number(result.changes);
    });
  }
}

function validateSqlIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new ValidationError(
      "idempotency_storage.invalid_table_name",
      "SqliteIdempotencyStorage tableName must be a safe SQL identifier",
      { retryable: false, details: { tableName: value } },
    );
  }
  return value;
}

function parseSqliteExpiresAt(value: number | string): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Creates an idempotency storage based on configuration.
 */
export function createIdempotencyStorage(
  type: "memory" | "redis" | "sqlite",
  config?: RedisConnectionConfig | { db?: AuthoritativeSqlDatabase; tableName?: string },
): IdempotencyStorage {
  const sqliteConfig = config as { db?: AuthoritativeSqlDatabase; tableName?: string } | undefined;
  switch (type) {
    case "memory":
      return new InMemoryIdempotencyStorage();
    case "redis":
      return new RedisIdempotencyStorage(config as RedisConnectionConfig);
    case "sqlite":
      if (sqliteConfig == null) {
        throw new ValidationError(
          "idempotency_storage.sqlite_db_required",
          "SqliteIdempotencyStorage requires a db option",
        );
      }
      if (sqliteConfig.db == null) {
        throw new ValidationError(
          "idempotency_storage.sqlite_db_required",
          "SqliteIdempotencyStorage requires a non-null db option",
        );
      }
      return new SqliteIdempotencyStorage(sqliteConfig.db, sqliteConfig.tableName);
  }
}
