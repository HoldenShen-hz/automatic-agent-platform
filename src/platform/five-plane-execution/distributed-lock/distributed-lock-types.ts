import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { RedisConnectionConfig } from "../../shared/utils/redis-client-options.js";

export interface DistributedLockAdapter {
  readonly backendKind: string;
  acquire(input: { lockKey: string; owner: string; ttlMs?: number }): AcquireLockResult;
  release(lockKey: string, owner: string): boolean;
  extend(lockKey: string, owner: string, additionalMs: number): { lockKey: string; owner: string; fencingToken: number; status: LockStatus } | null;
  forceSteal(lockKey: string, newOwner: string, reason: string): { lockKey: string; owner: string; fencingToken: number; status: LockStatus };
  inspect(lockKey: string): { lockKey: string; owner: string; fencingToken: number; status: LockStatus; ttlMs: number; metadata: string | null } | null;
}

export interface PostgresSqlDriver {
  <T extends Record<string, unknown> = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): T[];
  unsafe(sql: string): (params: unknown[]) => unknown;
  end(): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export type PostgresFactory = (dsn: string, options: Record<string, unknown>) => PostgresSqlDriver;
export type LockBackendKind = "sqlite" | "pg_advisory" | "redis";
export type LockStatus = "pending" | "held" | "extended" | "released" | "expired" | "reclaimed" | "stolen";

export interface LockRecord {
  lockKey: string;
  owner: string;
  fencingToken: number;
  status: LockStatus;
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

export const DISTRIBUTED_LOCKS_DDL = `
CREATE TABLE IF NOT EXISTS distributed_locks (
  lock_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  fencing_token INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held',
  acquired_at TEXT NOT NULL,
  ttl_ms INTEGER,
  metadata TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
`;

export interface PgAdvisoryLockConfig {
  dsn?: string;
  poolMin?: number;
  poolMax?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
  ssl?:
    | false
    | {
        rejectUnauthorized: true;
      };
  env?: NodeJS.ProcessEnv;
  postgresFactory?: PostgresFactory;
}

export interface RedisLockConfig extends RedisConnectionConfig {
  cliPath?: string;
  connectTimeoutMs?: number;
}

/**
 * Zod schema for validating parsed LockData to prevent malicious payload injection.
 * All fields are strictly validated with appropriate type checks.
 */
export const LockDataSchema = z.object({
  id: z.string().min(1),
  owner: z.string(),
  fencingToken: z.number().int().nonnegative(),
  ttlMs: z.number().int().positive(),
  acquiredAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "acquiredAt must be a valid ISO timestamp",
  }),
  metadata: z.union([z.string(), z.null()]),
}).strict();

export interface LockData {
  id: string;
  owner: string;
  fencingToken: number;
  ttlMs: number;
  acquiredAt: string;
  metadata: string | null;
}

export type LockType = "execution_lease" | "approval_lock" | "file_lock" | "advisory_lock";

export interface LockTransitionCommand {
  lockId: string;
  lockType: LockType;
  resourceKey: string;
  fromStatus: LockStatus;
  toStatus: LockStatus;
  ownerId: string;
  reasonCode: string;
  traceId: string;
  occurredAt: string;
  fencingToken?: number;
}

export interface LockTransitionResult {
  accepted: boolean;
  command: LockTransitionCommand;
}

export function transitionLock(command: LockTransitionCommand): LockTransitionResult {
  if (command.lockId.trim().length === 0) {
    throw new Error("distributed_lock.lock_id_required");
  }
  if (command.resourceKey.trim().length === 0) {
    throw new Error("distributed_lock.resource_key_required");
  }
  if (command.ownerId.trim().length === 0) {
    throw new Error("distributed_lock.owner_id_required");
  }
  if (command.reasonCode.trim().length === 0) {
    throw new Error("distributed_lock.reason_code_required");
  }
  if (command.traceId.trim().length === 0) {
    throw new Error("distributed_lock.trace_id_required");
  }
  if (command.fromStatus === command.toStatus) {
    throw new Error("distributed_lock.transition_noop");
  }
  return {
    accepted: true,
    command,
  };
}

export type CreateLockAdapter = (kind: "sqlite" | "pg_advisory" | "redis", db?: DatabaseSync) => DistributedLockAdapter;
