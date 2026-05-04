/**
 * Idempotency Key Storage Backend
 *
 * Provides storage implementations for idempotency keys.
 * Supports in-memory, Redis, and SQLite backends.
 *
 * Part of R18-30: Idempotency-key enforcement middleware per §6.2
 */

import type { RedisConnectionConfig } from "../../../../shared/utils/redis-client-options.js";
import { buildRedisClientOptions } from "../../../../shared/utils/redis-client-options.js";
import { Redis } from "ioredis";
import type { AuthoritativeSqlDatabase } from "../../../../state-evidence/truth/sqlite/sqlite-database.js";

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

  async get(key: string): Promise<IdempotencyEntry | null> {
    const entry = this.entries.get(key);
    if (entry == null) return null;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  async set(key: string, entry: Omit<IdempotencyEntry, "expiresAt">, ttlMs: number): Promise<void> {
    this.entries.set(key, {
      ...entry,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async cleanup(maxDelete = 0): Promise<number> {
    const now = Date.now();
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
      keyPrefix: this.keyPrefix,
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
    // Redis handles expiration automatically via PX argument
    // This is a no-op for Redis but useful for scanning and logging
    return 0;
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
    this.tableName = tableName;
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
          expires_at INTEGER NOT NULL
        )
      `);
      this.db.connection.exec(`
        CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
        ON ${this.tableName}(expires_at)
      `);
    });
  }

  async get(key: string): Promise<IdempotencyEntry | null> {
    return this.db.readTransaction(() => {
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
        expires_at: number;
      } | undefined;
      if (row == null) return null;
      if (Date.now() >= row.expires_at) {
        this.db.connection.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(key);
        return null;
      }
      return {
        method: row.method,
        statusCode: row.status_code,
        responseBody: row.response_body,
        expiresAt: row.expires_at,
        requestHash: row.request_hash,
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
        Date.now() + ttlMs,
      );
    });
  }

  async delete(key: string): Promise<void> {
    this.db.transaction(() => {
      this.db.connection.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(key);
    });
  }

  async cleanup(maxDelete = 0): Promise<number> {
    const now = Date.now();
    return this.db.transaction(() => {
      const limitClause = maxDelete > 0 ? `LIMIT ${maxDelete}` : "";
      const stmt = this.db.connection.prepare(`
        DELETE FROM ${this.tableName}
        WHERE expires_at <= ?
        ${limitClause}
      `);
      const result = stmt.run(now);
      return result.changes;
    });
  }
}

/**
 * Creates an idempotency storage based on configuration.
 */
export function createIdempotencyStorage(
  type: "memory" | "redis" | "sqlite",
  config?: RedisConnectionConfig | { db?: AuthoritativeSqlDatabase; tableName?: string },
): IdempotencyStorage {
  switch (type) {
    case "memory":
      return new InMemoryIdempotencyStorage();
    case "redis":
      return new RedisIdempotencyStorage(config as RedisConnectionConfig);
    case "sqlite":
      if (config == null || !("db" in config)) {
        throw new Error("SqliteIdempotencyStorage requires a db option");
      }
      return new SqliteIdempotencyStorage(config.db, config.tableName);
  }
}
