import { createHash } from "node:crypto";

import { loadPostgresPoolEnv } from "../../five-plane-control-plane/config-center/index.js";
import { LockingError } from "../../contracts/errors.js";
import { defaultPostgresFactory, inferPgSslFromDsn } from "./locking-support.js";
import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord, PgAdvisoryLockConfig, PostgresFactory, PostgresSqlDriver } from "./distributed-lock-types.js";

export class PgAdvisoryLockAdapter implements DistributedLockAdapter {
  readonly backendKind: LockBackendKind = "pg_advisory";
  private readonly heldLocks = new Map<string, LockRecord>();
  private sql: PostgresSqlDriver | null = null;
  private connected = false;
  private connectionError: Error | null = null;
  private readonly dsn: string;
  private readonly poolMin: number;
  private readonly poolMax: number;
  private readonly idleTimeoutSeconds: number;
  private readonly connectTimeoutSeconds: number;
  private readonly ssl: false | { rejectUnauthorized: true };
  private readonly postgresFactory: PostgresFactory;

  constructor(config?: PgAdvisoryLockConfig) {
    const envConfig = loadPostgresPoolEnv(config?.env);
    this.dsn = config?.dsn ?? envConfig.dsn ?? "";
    this.poolMin = config?.poolMin ?? envConfig.poolMin;
    this.poolMax = config?.poolMax ?? envConfig.poolMax;
    this.idleTimeoutSeconds = config?.idleTimeoutSeconds ?? envConfig.idleTimeoutSeconds;
    this.connectTimeoutSeconds = config?.connectTimeoutSeconds ?? envConfig.connectTimeoutSeconds;
    this.ssl = config?.ssl ?? inferPgSslFromDsn(this.dsn) ?? envConfig.ssl;
    this.postgresFactory = config?.postgresFactory ?? defaultPostgresFactory;
  }

  private lockKeyToAdvisoryKey(lockKey: string): bigint {
    const digest = createHash("sha256").update(lockKey, "utf8").digest();
    const advisoryKey = digest.readBigUInt64BE(0) & 0x7FFFFFFFFFFFFFFFn;
    return advisoryKey === 0n ? 1n : advisoryKey;
  }

  private normalizeTtlMs(inputTtlMs: number | undefined): number {
    const ttlMs = inputTtlMs ?? 30000;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new LockingError("lock.invalid_ttl", "lock.invalid_ttl: advisory lock ttl must be a positive finite number");
    }
    return Math.trunc(ttlMs);
  }

  private parseFencingToken(value: unknown): number {
    const bigintValue = typeof value === "bigint"
      ? value
      : typeof value === "number"
        ? BigInt(value)
        : BigInt(String(value ?? "0"));
    if (bigintValue > BigInt(Number.MAX_SAFE_INTEGER) || bigintValue < 0n) {
      throw new LockingError("lock.invalid_fencing_token", "lock.invalid_fencing_token: fencing token exceeded safe integer range");
    }
    return Number(bigintValue);
  }

  private normalizeDriverError(error: unknown): LockingError {
    if (error instanceof LockingError) {
      return error;
    }
    if (error instanceof ReferenceError || (error instanceof Error && (error.message.includes("postgres") || error.message.includes("Cannot find module")))) {
      return new LockingError("lock.pg_advisory_not_implemented", "lock.pg_advisory_not_implemented: PostgreSQL advisory lock backend requires pg driver");
    }
    const code = error != null && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    const message = error instanceof Error ? error.message : String(error);
    return new LockingError("lock.pg_advisory_unavailable", `lock.pg_advisory_unavailable: ${code || message}`, {
      retryable: true,
      ...(error instanceof Error ? { cause: error } : {}),
    });
  }

  private ensureConnected(): void {
    if (this.connected) return;
    if (this.connectionError) throw this.connectionError;
    try {
      const sqlOptions: Record<string, unknown> = {
        max: this.poolMax,
        min: this.poolMin,
        idle_timeout: this.idleTimeoutSeconds,
        connect_timeout: this.connectTimeoutSeconds,
        ssl: this.ssl,
      };
      this.sql = this.postgresFactory(this.dsn, sqlOptions);
      this.connected = true;
    } catch (error) {
      this.connectionError = error instanceof Error ? error : new Error(String(error));
      throw this.connectionError;
    }
  }

  acquire(_input: AcquireLockInput): AcquireLockResult {
    throw new LockingError("lock.pg_async_required", "lock.pg_async_required: PostgreSQL advisory lock acquire() requires async acquireAsync() method");
  }
  release(_lockKey: string, _owner: string): boolean {
    throw new LockingError("lock.pg_async_required", "lock.pg_async_required: PostgreSQL advisory lock release() requires async releaseAsync() method");
  }
  extend(lockKey: string, owner: string, additionalMs: number): LockRecord | null {
    const current = this.heldLocks.get(lockKey);
    if (current == null || current.owner !== owner) {
      return null;
    }
    if (!Number.isFinite(additionalMs) || additionalMs <= 0) {
      throw new LockingError("lock.invalid_ttl_extension", "lock.invalid_ttl_extension: advisory lock extension must be a positive finite number");
    }
    // PostgreSQL advisory locks are session-scoped without a server-side TTL. `extend`
    // only refreshes the client-visible lease metadata used by higher-level recovery logic.
    const next: LockRecord = {
      ...current,
      ttlMs: Math.trunc(current.ttlMs + additionalMs),
      acquiredAt: new Date().toISOString(),
    };
    this.heldLocks.set(lockKey, next);
    return next;
  }
  forceSteal(_lockKey: string, _newOwner: string, _reason: string): LockRecord {
    throw new LockingError("lock.advisory_cannot_force_steal", "PostgreSQL advisory locks must be released by the owning session; forceSteal is not supported");
  }
  inspect(lockKey: string): LockRecord | null { return this.heldLocks.get(lockKey) ?? null; }

  async acquireAsync(input: AcquireLockInput): Promise<AcquireLockResult> {
    const { lockKey, owner } = input;
    const now = new Date().toISOString();
    const ttlMs = this.normalizeTtlMs(input.ttlMs);
    let advisoryKey: bigint | null = null;
    let sessionLockHeld = false;
    try {
      this.ensureConnected();
      const driver = this.sql!;
      advisoryKey = this.lockKeyToAdvisoryKey(lockKey);
      interface AcquireRow extends Record<string, unknown> { acquired: boolean; fencing_token?: string | number | bigint }
      const rows = await driver<AcquireRow>`SELECT pg_try_advisory_lock(${advisoryKey}) as acquired, txid_current()::bigint as fencing_token`;
      const result = rows[0];
      if (result?.acquired) {
        sessionLockHeld = true;
        const fencingToken = this.parseFencingToken(result.fencing_token ?? 0);
        const lock = { lockKey, owner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata: null } satisfies LockRecord;
        this.heldLocks.set(lockKey, lock);
        return { acquired: true, lock };
      }
      return { acquired: false };
    } catch (error) {
      throw this.normalizeDriverError(error);
    } finally {
      if (sessionLockHeld && advisoryKey != null && this.sql != null && !this.heldLocks.has(lockKey)) {
        try {
          await this.sql`SELECT pg_advisory_unlock(${advisoryKey}) as released`;
        } catch {
          // Best-effort unlock for throw paths after advisory lock acquisition.
        }
      }
    }
  }

  async releaseAsync(lockKey: string, _owner: string): Promise<boolean> {
    try {
      const held = this.heldLocks.get(lockKey);
      if (held == null || held.owner !== _owner) {
        return false;
      }
      this.ensureConnected();
      const rows = await this.sql!<{ released?: boolean }>`SELECT pg_advisory_unlock(${this.lockKeyToAdvisoryKey(lockKey)}) as released`;
      const released = rows[0]?.released === true;
      if (released) {
        this.heldLocks.delete(lockKey);
      }
      return released;
    } catch (error) {
      throw this.normalizeDriverError(error);
    }
  }

  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
      this.connected = false;
      this.heldLocks.clear();
    }
  }
}
