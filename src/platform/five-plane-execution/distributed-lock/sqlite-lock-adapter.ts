import type { DatabaseSync } from "node:sqlite";

import { LockingError } from "../../contracts/errors.js";
import { DISTRIBUTED_LOCKS_DDL } from "./distributed-lock-types.js";
import { lockLogger } from "./locking-support.js";
import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord, LockStatus } from "./distributed-lock-types.js";

function isLegacyAcquireInput(input: AcquireLockInput | { lockName: string; ownerId: string; ttlMs?: number }): input is { lockName: string; ownerId: string; ttlMs?: number } {
  return "lockName" in input && "ownerId" in input;
}

function isLegacyReleaseInput(value: string | { lockName: string; ownerId: string }): value is { lockName: string; ownerId: string } {
  return typeof value === "object" && value != null && "lockName" in value && "ownerId" in value;
}

function isLegacyInspectInput(value: string | { lockName: string }): value is { lockName: string } {
  return typeof value === "object" && value != null && "lockName" in value;
}

export class SqliteLockAdapter implements DistributedLockAdapter {
  readonly backendKind: LockBackendKind = "sqlite";
  private static readonly MAX_LOCK_TTL_MS = 600_000;
  private static readonly MIN_LOCK_TTL_MS = 1_000;
  private static readonly EXPIRY_SKEW_MS = 1_000;
  private static readonly DEFAULT_FORCE_STEAL_TTL_MS = 30_000;
  private static readonly ALLOWED_FORCE_STEAL_REASONS = new Set([
    "incident_mitigation",
    "operator_override",
    "stale_owner_recovery",
  ]);

  constructor(private readonly db: DatabaseSync) {
    this.db.exec(DISTRIBUTED_LOCKS_DDL);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS distributed_lock_fencing_counter (
        counter INTEGER NOT NULL
      );
      INSERT INTO distributed_lock_fencing_counter (counter)
      SELECT 0
      WHERE NOT EXISTS (
        SELECT 1 FROM distributed_lock_fencing_counter
      );
    `);
  }

  private nextFencingToken(): number {
    this.db.prepare(`UPDATE distributed_lock_fencing_counter SET counter = counter + 1`).run();
    const row = this.db.prepare(`SELECT counter FROM distributed_lock_fencing_counter LIMIT 1`).get() as
      | { counter: number }
      | undefined;
    return row?.counter ?? 1;
  }

  private normalizeAcquireInput(
    input: AcquireLockInput | { lockName: string; ownerId: string; ttlMs?: number },
  ): AcquireLockInput {
    if (!isLegacyAcquireInput(input)) {
      return input;
    }
    return {
      lockKey: input.lockName,
      owner: input.ownerId,
      ...(input.ttlMs != null ? { ttlMs: input.ttlMs } : {}),
    };
  }

  private normalizeTtlMs(ttlMs: number | undefined): number {
    const resolved = ttlMs ?? SqliteLockAdapter.DEFAULT_FORCE_STEAL_TTL_MS;
    if (!Number.isFinite(resolved) || resolved < SqliteLockAdapter.MIN_LOCK_TTL_MS) {
      throw new LockingError(
        "lock.invalid_ttl",
        `lock.invalid_ttl: ttlMs must be >= ${SqliteLockAdapter.MIN_LOCK_TTL_MS}`,
      );
    }
    return Math.min(Math.trunc(resolved), SqliteLockAdapter.MAX_LOCK_TTL_MS);
  }

  private beginImmediateTransaction(): void {
    this.db.exec("BEGIN IMMEDIATE");
  }

  private commitTransaction(): void {
    this.db.exec("COMMIT");
  }

  private rollbackTransaction(): void {
    this.db.exec("ROLLBACK");
  }

  acquire(input: AcquireLockInput | { lockName: string; ownerId: string; ttlMs?: number }): AcquireLockResult {
    const normalized = this.normalizeAcquireInput(input);
    const { lockKey, owner } = normalized;
    const normalizedTtlMs = this.normalizeTtlMs(normalized.ttlMs);
    const acquiredAt = new Date().toISOString();
    try {
      this.beginImmediateTransaction();
      const existing = this.db.prepare(
        `SELECT rowid, owner, fencing_token, status, acquired_at, ttl_ms
         FROM distributed_locks
         WHERE lock_key = ?`,
      ).get(lockKey) as
        | {
            rowid: number;
            owner: string;
            fencing_token: number;
            status: string;
            acquired_at: string;
            ttl_ms: number;
          }
        | undefined;
      if (existing) {
        if (existing.owner === owner && existing.status === "held") {
          const fencingToken = this.nextFencingToken();
          this.db.prepare(
            `UPDATE distributed_locks
             SET ttl_ms = ?, acquired_at = ?, fencing_token = ?
             WHERE rowid = ?`,
          ).run(normalizedTtlMs, acquiredAt, fencingToken, existing.rowid);
          this.commitTransaction();
          return {
            acquired: true,
            lock: { lockKey, owner, fencingToken, status: "held", acquiredAt, ttlMs: normalizedTtlMs, metadata: null },
          };
        }
        const existingAcquiredMs = Date.parse(existing.acquired_at);
        const expiresAt = Number.isFinite(existingAcquiredMs)
          ? existingAcquiredMs + (existing.ttl_ms ?? 0)
          : Number.POSITIVE_INFINITY;
        if (Date.now() + SqliteLockAdapter.EXPIRY_SKEW_MS < expiresAt) {
          this.commitTransaction();
          return { acquired: false };
        }
        this.db.prepare(`DELETE FROM distributed_locks WHERE rowid = ?`).run(existing.rowid);
        lockLogger.log({
          level: "info",
          message: "sqlite_lock.evicted_expired",
          data: { lockKey, previousOwner: existing.owner, expiresAt, skewMs: SqliteLockAdapter.EXPIRY_SKEW_MS },
        });
      }
      const fencingToken = this.nextFencingToken();
      this.db.prepare(
        `INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
         VALUES (?, ?, ?, 'held', ?, ?)`,
      ).run(lockKey, owner, fencingToken, acquiredAt, normalizedTtlMs);
      this.commitTransaction();
      return {
        acquired: true,
        lock: { lockKey, owner, fencingToken, status: "held", acquiredAt, ttlMs: normalizedTtlMs, metadata: null },
      };
    } catch (err) {
      this.rollbackTransaction();
      lockLogger.log({ level: "warn", message: "Lock acquire operation failed", data: { lockKey, owner, error: err instanceof Error ? err.message : String(err) } });
      return { acquired: false };
    }
  }

  release(lockKey: string | { lockName: string; ownerId: string }, owner?: string): boolean {
    if (isLegacyReleaseInput(lockKey)) {
      const legacyInput = lockKey;
      return this.release(legacyInput.lockName, legacyInput.ownerId);
    }
    if (owner == null) {
      return false;
    }
    try {
      const result = this.db.prepare(`DELETE FROM distributed_locks WHERE lock_key = ? AND owner = ?`).run(lockKey, owner);
      if (result.changes === 0) {
        const existing = this.db.prepare(`SELECT owner FROM distributed_locks WHERE lock_key = ?`).get(lockKey) as
          | { owner: string }
          | undefined;
        if (existing) {
          lockLogger.log({
            level: "warn",
            message: "sqlite_lock.release_owner_mismatch",
            data: { lockKey, expectedOwner: existing.owner, attemptedOwner: owner },
          });
        }
      }
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
      const normalizedTtlMs = this.normalizeTtlMs(additionalMs);
      const result = this.db.prepare(
        `UPDATE distributed_locks
         SET ttl_ms = ?, acquired_at = ?, fencing_token = ?
         WHERE lock_key = ? AND owner = ?`,
      ).run(
        normalizedTtlMs,
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
    if (!SqliteLockAdapter.ALLOWED_FORCE_STEAL_REASONS.has(reason)) {
      throw new LockingError(
        "lock.force_steal_reason_not_allowed",
        "lock.force_steal_reason_not_allowed",
        { details: { allowedReasons: [...SqliteLockAdapter.ALLOWED_FORCE_STEAL_REASONS] } },
      );
    }
    try {
      this.beginImmediateTransaction();
      const existing = this.db.prepare(
        `SELECT rowid, ttl_ms FROM distributed_locks WHERE lock_key = ?`,
      ).get(lockKey) as
        | { rowid: number; ttl_ms: number }
        | undefined;
      if (existing) {
        this.db.prepare(`DELETE FROM distributed_locks WHERE rowid = ?`).run(existing.rowid);
      }
      const fencingToken = this.nextFencingToken();
      const now = new Date().toISOString();
      const ttlMs = this.normalizeTtlMs(existing?.ttl_ms ?? SqliteLockAdapter.DEFAULT_FORCE_STEAL_TTL_MS);
      const metadata = JSON.stringify({ forceStealReason: reason });
      this.db.prepare(
        `INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms, metadata)
         VALUES (?, ?, ?, 'held', ?, ?, ?)`,
      ).run(lockKey, newOwner, fencingToken, now, ttlMs, metadata);
      this.commitTransaction();
      return { lockKey, owner: newOwner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata };
    } catch (err) {
      try {
        this.rollbackTransaction();
      } catch {
        // Ignore rollback failures so the canonical lock error is preserved.
      }
      lockLogger.log({ level: "warn", message: "Lock forceSteal failed", data: { lockKey, newOwner, error: err instanceof Error ? err.message : String(err) } });
      throw new LockingError("lock.force_steal_failed", "Lock force steal operation failed", { details: { lockKey, newOwner } });
    }
  }

  inspect(lockKey: string | { lockName: string }): LockRecord | null {
    if (isLegacyInspectInput(lockKey)) {
      const legacyInput = lockKey;
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
