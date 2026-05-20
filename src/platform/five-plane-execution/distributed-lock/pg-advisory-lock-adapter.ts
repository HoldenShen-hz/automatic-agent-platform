import { loadPostgresPoolEnv } from "../../five-plane-control-plane/config-center/postgres-pool-env.js";
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
    const encoder = new TextEncoder();
    const bytes = encoder.encode(lockKey);
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    const maxSigned63Bit = 0x7FFFFFFFFFFFFFFFn;

    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = (hash * prime) & maxSigned63Bit;
    }

    return hash === 0n ? 1n : hash;
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
    const next: LockRecord = {
      ...current,
      ttlMs: current.ttlMs + additionalMs,
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
    const ttlMs = input.ttlMs ?? 30000;
    try {
      this.ensureConnected();
      const driver = this.sql!;
      const advisoryKey = this.lockKeyToAdvisoryKey(lockKey);
      interface AcquireRow extends Record<string, unknown> { acquired: boolean; fencing_token?: number }
      const rows = await driver<AcquireRow>`SELECT pg_try_advisory_lock(${advisoryKey}) as acquired, txid_current()::bigint as fencing_token`;
      const result = rows[0];
      if (result?.acquired) {
        const fencingToken = Number(result.fencing_token);
        const lock = { lockKey, owner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata: null } satisfies LockRecord;
        this.heldLocks.set(lockKey, lock);
        return { acquired: true, lock };
      }
      return { acquired: false };
    } catch (error) {
      const isModuleError = error instanceof ReferenceError ||
        (error instanceof Error && (error.message.includes("postgres") || error.message.includes("Cannot find module")));
      const isConnectionError = error instanceof Error && (error as { code?: string }).code === "ECONNREFUSED";
      if (isModuleError || isConnectionError) {
        throw new LockingError("lock.pg_advisory_not_implemented", "lock.pg_advisory_not_implemented: PostgreSQL advisory lock backend requires pg driver");
      }
      return { acquired: false };
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
      if (error instanceof ReferenceError || (error instanceof Error && (error.message.includes("postgres") || error.message.includes("Cannot find module")))) {
        throw new LockingError("lock.pg_advisory_not_implemented", "lock.pg_advisory_not_implemented: PostgreSQL advisory lock backend requires pg driver");
      }
      return false;
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
