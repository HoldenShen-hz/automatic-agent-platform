import { loadPostgresPoolEnv } from "../../control-plane/config-center/postgres-pool-env.js";
import { LockingError } from "../../contracts/errors.js";
import { defaultPostgresFactory, inferPgSslFromDsn } from "./locking-support.js";
export class PgAdvisoryLockAdapter {
    backendKind = "pg_advisory";
    sql = null;
    connected = false;
    connectionError = null;
    dsn;
    poolMin;
    poolMax;
    idleTimeoutSeconds;
    connectTimeoutSeconds;
    ssl;
    postgresFactory;
    fencingCounter = 0;
    constructor(config) {
        const envConfig = loadPostgresPoolEnv(config?.env);
        this.dsn = config?.dsn ?? envConfig.dsn ?? "";
        this.poolMin = config?.poolMin ?? envConfig.poolMin;
        this.poolMax = config?.poolMax ?? envConfig.poolMax;
        this.idleTimeoutSeconds = config?.idleTimeoutSeconds ?? envConfig.idleTimeoutSeconds;
        this.connectTimeoutSeconds = config?.connectTimeoutSeconds ?? envConfig.connectTimeoutSeconds;
        this.ssl = config?.ssl ?? inferPgSslFromDsn(this.dsn) ?? envConfig.ssl;
        this.postgresFactory = config?.postgresFactory ?? defaultPostgresFactory;
    }
    lockKeyToAdvisoryKey(lockKey) {
        let hash = 0;
        for (let i = 0; i < lockKey.length; i += 1) {
            const char = lockKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash;
        }
        return (BigInt(Math.abs(hash)) + BigInt(2 ** 31)) % BigInt(2 ** 63);
    }
    ensureConnected() {
        if (this.connected)
            return;
        if (this.connectionError)
            throw this.connectionError;
        try {
            const sqlOptions = {
                max: this.poolMax,
                min: this.poolMin,
                idle_timeout: this.idleTimeoutSeconds,
                connect_timeout: this.connectTimeoutSeconds,
                ssl: this.ssl,
            };
            this.sql = this.postgresFactory(this.dsn, sqlOptions);
            this.connected = true;
        }
        catch (error) {
            this.connectionError = error instanceof Error ? error : new Error(String(error));
            throw this.connectionError;
        }
    }
    acquire(_input) {
        throw new LockingError("lock.pg_async_required", "lock.pg_async_required: PostgreSQL advisory lock acquire() requires async acquireAsync() method");
    }
    release(_lockKey, _owner) {
        throw new LockingError("lock.pg_async_required", "lock.pg_async_required: PostgreSQL advisory lock release() requires async releaseAsync() method");
    }
    extend(lockKey, _owner, _additionalMs) { return this.inspect(lockKey); }
    forceSteal(_lockKey, _newOwner, _reason) {
        throw new LockingError("lock.advisory_cannot_force_steal", "PostgreSQL advisory locks must be released by the owning session; forceSteal is not supported");
    }
    inspect(_lockKey) { return null; }
    async acquireAsync(input) {
        const { lockKey, owner } = input;
        const now = new Date().toISOString();
        const ttlMs = input.ttlMs ?? 30000;
        const fencingToken = ++this.fencingCounter;
        try {
            this.ensureConnected();
            const driver = this.sql;
            const advisoryKey = this.lockKeyToAdvisoryKey(lockKey);
            const [result] = await driver `SELECT pg_try_advisory_lock(${advisoryKey}) as acquired`;
            if (result?.acquired) {
                return { acquired: true, lock: { lockKey, owner, fencingToken, status: "held", acquiredAt: now, ttlMs, metadata: null } };
            }
            return { acquired: false };
        }
        catch (error) {
            const isModuleError = error instanceof ReferenceError ||
                (error instanceof Error && (error.message.includes("postgres") || error.message.includes("Cannot find module")));
            const isConnectionError = error instanceof Error && error.code === "ECONNREFUSED";
            if (isModuleError || isConnectionError) {
                throw new LockingError("lock.pg_advisory_not_implemented", "lock.pg_advisory_not_implemented: PostgreSQL advisory lock backend requires pg driver");
            }
            return { acquired: false };
        }
    }
    async releaseAsync(lockKey, _owner) {
        try {
            this.ensureConnected();
            await this.sql `SELECT pg_advisory_unlock(${this.lockKeyToAdvisoryKey(lockKey)})`;
            return true;
        }
        catch (error) {
            if (error instanceof ReferenceError || (error instanceof Error && (error.message.includes("postgres") || error.message.includes("Cannot find module")))) {
                throw new LockingError("lock.pg_advisory_not_implemented", "lock.pg_advisory_not_implemented: PostgreSQL advisory lock backend requires pg driver");
            }
            return false;
        }
    }
    async close() {
        if (this.sql) {
            await this.sql.end();
            this.connected = false;
        }
    }
}
//# sourceMappingURL=pg-advisory-lock-adapter.js.map