import { loadPostgresPoolEnv } from "../../control-plane/config-center/postgres-pool-env.js";
import { LockingError } from "../../contracts/errors.js";
import { defaultPostgresFactory, inferPgSslFromDsn } from "./locking-support.js";
import type { AcquireLockInput, AcquireLockResult, DistributedLockAdapter, LockBackendKind, LockRecord, PgAdvisoryLockConfig, PostgresFactory, PostgresSqlDriver } from "./distributed-lock-types.js";

export class PgAdvisoryLockAdapter implements DistributedLockAdapter {
  readonly backendKind: LockBackendKind = "pg_advisory";
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
  private fencingCounter = 0;

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
    // R16-16 FIX: 32-bit hash has high collision probability for large key spaces
    // Use proper hash function: compute 64-bit hash via FNV-1a algorithm
    // FNV-1a is simpler and has better distribution than djb2
    const FNV_OFFSET_BASIS = BigInt(14695981039346656037);
    const FNV_PRIME = BigInt(1099511628211);
    let hash = FNV_OFFSET_BASIS;
    for (let i = 0; i < lockKey.length; i += 1) {
      const char = BigInt(lockKey.charCodeAt(i));
      hash = hash ^ char;
      hash = hash * FNV_PRIME;
    }
    // Map to positive 63-bit range (avoid negative advisory lock keys)
    return (hash & BigInt("0x7FFFFFFFFFFFFFFF")) % BigInt(2 ** 63);
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
  extend(_lockKey: string, _owner: string, _additionalMs: number): LockRecord | null {
    // R16-16 FIX: extend() was returning null (via inspect()) which silently failed.
    // For PostgreSQL advisory locks, sync methods are not supported - use extendAsync() instead.
    throw new LockingError("lock.pg_async_required", "lock.pg_async_required: PostgreSQL advisory lock extend() requires async extendAsync() method");
  }
  forceSteal(_lockKey: string, _newOwner: string, _reason: string): LockRecord {
    throw new LockingError("lock.advisory_cannot_force_steal", "PostgreSQL advisory locks must be released by the owning session; forceSteal is not supported");
  }
  inspect(_lockKey: string): LockRecord | null { return null; }

  async acquireAsync(input: AcquireLockInput): Promise<AcquireLockResult> {
    const { lockKey, owner } = input;
    const now = new Date().toISOString();
    const ttlMs = input.ttlMs ?? 30000;
    const fencingToken = ++this.fencingCounter;
    try {
      this.ensureConnected();
      const driver = this.sql!;
      const advisoryKey = this.lockKeyToAdvisoryKey(lockKey);
      interface AcquireRow { acquired: boolean }
      const [result] = await driver<AcquireRow[]>`SELECT pg_try_advisory_lock(${advisoryKey}) as acquired`;
      if (result?.acquired) {
        return { acquired: true, lock: { lockKey, owner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata: null } };
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
      this.ensureConnected();
      await this.sql!`SELECT pg_advisory_unlock(${this.lockKeyToAdvisoryKey(lockKey)})`;
      return true;
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
    }
  }
}
