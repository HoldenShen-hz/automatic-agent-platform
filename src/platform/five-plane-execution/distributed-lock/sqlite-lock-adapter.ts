import type { DatabaseSync } from "node:sqlite";

import { LockingError } from "../../contracts/errors.js";
import { DISTRIBUTED_LOCKS_DDL } from "./distributed-lock-types.js";
import { lockLogger } from "./locking-support.js";
import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord, LockStatus } from "./distributed-lock-types.js";

export class SqliteLockAdapter implements DistributedLockAdapter {
  readonly backendKind: LockBackendKind = "sqlite";
  private static readonly MAX_LOCK_TTL_MS = 600_000;
  private static readonly EXPIRY_SKEW_MS = 1_000;

  constructor(private readonly db: DatabaseSync) {
    this.db.exec(DISTRIBUTED_LOCKS_DDL);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS distributed_lock_fencing_tokens (
        token_id INTEGER PRIMARY KEY AUTOINCREMENT
      );
    `);
  }

  private nextFencingToken(): number {
    const result = this.db.prepare(`INSERT INTO distributed_lock_fencing_tokens DEFAULT VALUES`).run();
    return Number(result.lastInsertRowid);
  }

  private normalizeAcquireInput(
    input: AcquireLockInput | { lockName: string; ownerId: string; ttlMs?: number },
  ): AcquireLockInput {
    if ("lockKey" in input && "owner" in input) {
      return input;
    }
    return {
      lockKey: input.lockName,
      owner: input.ownerId,
      ...(input.ttlMs != null ? { ttlMs: input.ttlMs } : {}),
    };
  }

  acquire(input: AcquireLockInput | { lockName: string; ownerId: string; ttlMs?: number }): AcquireLockResult {
    const normalized = this.normalizeAcquireInput(input);
    const { lockKey, owner, ttlMs = 30000 } = normalized;
    const existing = this.db.prepare(`SELECT * FROM distributed_locks WHERE lock_key = ?`).get(lockKey) as { owner: string; fencing_token: number; status: string; acquired_at: string; ttl_ms: number } | undefined;
    if (existing) {
      if (existing.owner === owner && existing.status === "held") {
        const fencingToken = this.nextFencingToken();
        const acquiredAt = new Date().toISOString();
        const normalizedTtlMs = Math.min(ttlMs, SqliteLockAdapter.MAX_LOCK_TTL_MS);
        this.db.prepare(`UPDATE distributed_locks SET ttl_ms = ?, acquired_at = ?, fencing_token = ? WHERE lock_key = ? AND owner = ?`).run(normalizedTtlMs, acquiredAt, fencingToken, lockKey, owner);
        return { acquired: true, lock: { lockKey, owner, fencingToken, status: "held", acquiredAt, ttlMs: normalizedTtlMs, metadata: null } };
      }
      // RT-03: honour TTL on stale locks. Previously any existing row blocked
      // acquisition forever, so a crashed owner would hold the lock until
      // someone ran forceSteal manually. We now compute the expiry from
      // acquired_at + ttl_ms and, if elapsed, evict the stale row and take
      // over with a freshly incremented fencing token.
      const existingAcquiredMs = Date.parse(existing.acquired_at);
      const expiresAt = existing.ttl_ms === 0
        ? Number.POSITIVE_INFINITY
        : Number.isFinite(existingAcquiredMs)
        ? existingAcquiredMs + (existing.ttl_ms ?? 0)
        : Number.POSITIVE_INFINITY;
      if (Date.now() + SqliteLockAdapter.EXPIRY_SKEW_MS < expiresAt) {
        return { acquired: false };
      }
      this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ?`).run(lockKey);
      lockLogger.log({
        level: "info",
        message: "sqlite_lock.evicted_expired",
        data: { lockKey, previousOwner: existing.owner, expiresAt, skewMs: SqliteLockAdapter.EXPIRY_SKEW_MS },
      });
    }
    const fencingToken = this.nextFencingToken();
    const acquiredAt = new Date().toISOString();
    const normalizedTtlMs = Math.min(ttlMs, SqliteLockAdapter.MAX_LOCK_TTL_MS);
    try {
      this.db.prepare(`INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms) VALUES (?, ?, ?, 'held', ?, ?)`)
        .run(lockKey, owner, fencingToken, acquiredAt, normalizedTtlMs);
      return { acquired: true, lock: { lockKey, owner, fencingToken, status: "held", acquiredAt, ttlMs: normalizedTtlMs, metadata: null } };
    } catch (err) {
      lockLogger.log({ level: "warn", message: "Lock acquire operation failed", data: { lockKey, owner, error: err instanceof Error ? err.message : String(err) } });
      return { acquired: false };
    }
  }

  release(lockKey: string, owner: string): boolean {
    if (typeof lockKey === "object" && lockKey != null) {
      const legacyInput = lockKey as unknown as { lockName: string; ownerId: string };
      return this.release(legacyInput.lockName, legacyInput.ownerId);
    }
    try {
      const result = this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ? AND owner = ?`).run(lockKey, owner);
      return result.changes > 0;
    } catch (err) {
      lockLogger.log({ level: "warn", message: "Lock release operation failed", data: { lockKey, owner, error: err instanceof Error ? err.message : String(err) } });
      return false;
    }
  }

  extend(lockKey: string, owner: string, additionalMs: number): LockRecord | null {
    try {
      const newFencingToken = this.nextFencingToken();
      const now = new Date().toISOString();
      const result = this.db.prepare(`UPDATE distributed_locks SET ttl_ms = MIN(ttl_ms + ?, ?), acquired_at = ?, fencing_token = ? WHERE lock_key = ? AND owner = ?`).run(
        additionalMs,
        SqliteLockAdapter.MAX_LOCK_TTL_MS,
        now,
        newFencingToken,
        lockKey,
        owner,
      );
      if (result.changes === 0) return null;
      return this.inspect(lockKey);
    } catch (err) {
      lockLogger.log({ level: "warn", message: "Lock extend operation failed", data: { lockKey, owner, additionalMs, error: err instanceof Error ? err.message : String(err) } });
      return null;
    }
  }

  forceSteal(lockKey: string, newOwner: string, reason: string): LockRecord {
    try {
      this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ?`).run(lockKey);
      const fencingToken = this.nextFencingToken();
      const now = new Date().toISOString();
      const ttlMs = 30000;
      const metadata = JSON.stringify({ forceStealReason: reason });
      this.db.prepare(`INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms, metadata) VALUES (?, ?, ?, 'held', ?, ?, ?)`)
        .run(lockKey, newOwner, fencingToken, now, ttlMs, metadata);
      return { lockKey, owner: newOwner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata };
    } catch (err) {
      lockLogger.log({ level: "warn", message: "Lock forceSteal failed", data: { lockKey, newOwner, error: err instanceof Error ? err.message : String(err) } });
      throw new LockingError("lock.force_steal_failed", "Lock force steal operation failed", { details: { lockKey, newOwner } });
    }
  }

  inspect(lockKey: string): LockRecord | null {
    if (typeof lockKey === "object" && lockKey != null) {
      const legacyInput = lockKey as unknown as { lockName: string };
      return this.inspect(legacyInput.lockName);
    }
    try {
      const row = this.db.prepare(`SELECT * FROM distributed_locks WHERE lock_key = ?`).get(lockKey) as { lock_key: string; owner: string; fencing_token: number; status: string; acquired_at: string; ttl_ms: number; metadata: string } | undefined;
      return row
        ? { lockKey: row.lock_key, owner: row.owner, fencingToken: row.fencing_token, status: row.status as LockStatus, acquiredAt: row.acquired_at, ttlMs: row.ttl_ms || 0, metadata: row.metadata }
        : null;
    } catch (err) {
      lockLogger.log({ level: "warn", message: "Lock inspect operation failed", data: { lockKey, error: err instanceof Error ? err.message : String(err) } });
      return null;
    }
  }

  public queryLock(lockKey: string): LockRecord | null {
    return this.inspect(lockKey);
  }
}
