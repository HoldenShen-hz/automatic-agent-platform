import type { DatabaseSync } from "node:sqlite";
import type { RedisConnectionConfig } from "../../shared/utils/redis-client-options.js";
export interface DistributedLockAdapter {
    readonly backendKind: string;
    acquire(input: {
        lockKey: string;
        owner: string;
        ttlMs?: number;
    }): AcquireLockResult;
    release(lockKey: string, owner: string): boolean;
    extend(lockKey: string, owner: string, additionalMs: number): {
        lockKey: string;
        owner: string;
        fencingToken: number;
        status: string;
    } | null;
    forceSteal(lockKey: string, newOwner: string, reason: string): {
        lockKey: string;
        owner: string;
        fencingToken: number;
        status: string;
    };
    inspect(lockKey: string): {
        lockKey: string;
        owner: string;
        fencingToken: number;
        status: string;
        ttlMs: number;
        metadata: string | null;
    } | null;
}
export interface PostgresSqlDriver {
    <T = any>(strings: TemplateStringsArray, ...values: any[]): Array<{
        [key: string]: any;
    }>;
    unsafe(sql: string): (params: unknown[]) => unknown;
    end(): Promise<void>;
    transaction<T>(work: () => Promise<T>): Promise<T>;
}
export type PostgresFactory = (dsn: string, options: Record<string, unknown>) => PostgresSqlDriver;
export type LockBackendKind = "sqlite" | "pg_advisory" | "redis";
export interface LockRecord {
    lockKey: string;
    owner: string;
    fencingToken: number;
    status: string;
    acquiredAt: string;
    ttlMs: number;
    metadata: string | null;
}
export interface AcquireLockInput {
    lockKey: string;
    owner: string;
    ttlMs?: number;
}
export interface AcquireLockResult {
    acquired: boolean;
    lock?: LockRecord;
}
export declare const DISTRIBUTED_LOCKS_DDL = "\nCREATE TABLE IF NOT EXISTS distributed_locks (\n  lock_key TEXT PRIMARY KEY,\n  owner TEXT NOT NULL,\n  fencing_token INTEGER NOT NULL DEFAULT 0,\n  status TEXT NOT NULL DEFAULT 'held',\n  acquired_at TEXT NOT NULL,\n  ttl_ms INTEGER,\n  metadata TEXT,\n  version INTEGER NOT NULL DEFAULT 1\n);\n";
export interface PgAdvisoryLockConfig {
    dsn?: string;
    poolMin?: number;
    poolMax?: number;
    idleTimeoutSeconds?: number;
    connectTimeoutSeconds?: number;
    ssl?: false | {
        rejectUnauthorized: true;
    };
    env?: NodeJS.ProcessEnv;
    postgresFactory?: PostgresFactory;
}
export interface RedisLockConfig extends RedisConnectionConfig {
    cliPath?: string;
    connectTimeoutMs?: number;
}
export interface LockData {
    id: string;
    owner: string;
    fencingToken: number;
    ttlMs: number;
    acquiredAt: string;
    metadata: string | null;
}
export type CreateLockAdapter = (kind: "sqlite" | "pg_advisory" | "redis", db?: DatabaseSync) => DistributedLockAdapter;
