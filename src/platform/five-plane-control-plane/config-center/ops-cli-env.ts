import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { ValidationError } from "../../contracts/errors.js";
import { parseBoolean } from "./remaining-cli-env-support.js";
import { readTrimmedEnv } from "./runtime-env.js";

export interface DispatchReconcileCliEnvConfig {
  action: "scan" | "repair";
  occurredAt: string | null;
}

export interface LeaseHandoverCliEnvConfig {
  leaseId: string;
  workerId: string;
  newWorkerId: string;
  ttlMs: number;
  reasonCode: string | null;
  occurredAt: string | null;
}

export interface EventOpsCliEnvConfig {
  dbPath: string;
  consumerId: string | null;
}

export interface OrphanCleanupCliEnvConfig {
  action: "scan" | "repair";
  occurredAt: string | null;
  confirmRepair: boolean;
}

export interface ReplayRecoveryCliEnvConfig {
  dbPath: string;
  kind: "task" | "execution";
  taskId: string | null;
  executionId: string | null;
}

export interface ProfileHomeCliEnvConfig {
  create: boolean;
}

export interface AuthoritativeStorageAdminCliEnvConfig {
  dbPath: string;
  action: "summary" | "migrate" | "plan" | "status" | "up" | "down";
}

const AUTHORITATIVE_STORAGE_ACTIONS = new Set([
  "summary",
  "migrate",
  "plan",
  "status",
  "up",
  "down",
] as const);

function resolveDbPath(env: NodeJS.ProcessEnv): string {
  const fromEnv = readTrimmedEnv(env, "AA_DB_PATH");
  if (fromEnv != null) {
    return fromEnv;
  }
  const sqliteDir = join(process.cwd(), "data", "sqlite");
  mkdirSync(sqliteDir, { recursive: true });
  return join(sqliteDir, "authoritative-demo.db");
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = readTrimmedEnv(env, name);
  if (value == null) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
  }
  return value;
}

function optionalPositiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = readTrimmedEnv(env, name);
  if (raw == null) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`invalid_integer_env:${name}`, `invalid_integer_env:${name}`);
  }
  return parsed;
}

export function loadDispatchReconcileCliEnv(
  env: NodeJS.ProcessEnv = process.env,
): DispatchReconcileCliEnvConfig {
  const action = readTrimmedEnv(env, "AA_DISPATCH_RECONCILE_ACTION") ?? "scan";
  if (action !== "scan" && action !== "repair") {
    throw new ValidationError("dispatch_reconcile.invalid_action", "dispatch_reconcile.invalid_action");
  }
  return {
    action,
    occurredAt: readTrimmedEnv(env, "AA_OCCURRED_AT"),
  };
}

export function loadLeaseHandoverCliEnv(env: NodeJS.ProcessEnv = process.env): LeaseHandoverCliEnvConfig {
  return {
    leaseId: requiredEnv(env, "AA_LEASE_ID"),
    workerId: requiredEnv(env, "AA_WORKER_ID"),
    newWorkerId: requiredEnv(env, "AA_NEW_WORKER_ID"),
    ttlMs: optionalPositiveInteger(env, "AA_LEASE_TTL_MS", 30_000),
    reasonCode: readTrimmedEnv(env, "AA_REASON_CODE"),
    occurredAt: readTrimmedEnv(env, "AA_OCCURRED_AT"),
  };
}

export function loadEventOpsCliEnv(env: NodeJS.ProcessEnv = process.env): EventOpsCliEnvConfig {
  return {
    dbPath: resolveDbPath(env),
    consumerId: readTrimmedEnv(env, "AA_EVENT_CONSUMER_ID"),
  };
}

export function loadOrphanCleanupCliEnv(env: NodeJS.ProcessEnv = process.env): OrphanCleanupCliEnvConfig {
  const action = readTrimmedEnv(env, "AA_ORPHAN_CLEANUP_ACTION") ?? "scan";
  if (action !== "scan" && action !== "repair") {
    throw new ValidationError("orphan_cleanup.invalid_action", "orphan_cleanup.invalid_action");
  }
  return {
    action,
    occurredAt: readTrimmedEnv(env, "AA_OCCURRED_AT"),
    confirmRepair: readTrimmedEnv(env, "AA_ORPHAN_CLEANUP_CONFIRM") === "yes",
  };
}

export function loadReplayRecoveryCliEnv(env: NodeJS.ProcessEnv = process.env): ReplayRecoveryCliEnvConfig {
  const kind = requiredEnv(env, "AA_RECOVERY_REPLAY_KIND");
  if (kind !== "task" && kind !== "execution") {
    throw new ValidationError("replay_recovery.invalid_kind", "replay_recovery.invalid_kind");
  }
  return {
    dbPath: resolveDbPath(env),
    kind,
    taskId: readTrimmedEnv(env, "AA_TASK_ID"),
    executionId: readTrimmedEnv(env, "AA_EXECUTION_ID"),
  };
}

export function loadProfileHomeCliEnv(env: NodeJS.ProcessEnv = process.env): ProfileHomeCliEnvConfig {
  return {
    create: parseBoolean(env, "AA_PROFILE_HOME_CREATE") ?? false,
  };
}

export function loadAuthoritativeStorageAdminCliEnv(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv.slice(2),
): AuthoritativeStorageAdminCliEnvConfig {
  const actionFromArgv = argv[0]?.trim();
  const action = readTrimmedEnv(env, "AA_AUTHORITATIVE_STORAGE_ACTION") ?? actionFromArgv ?? "summary";
  if (!AUTHORITATIVE_STORAGE_ACTIONS.has(action as never)) {
    throw new ValidationError(`unknown_authoritative_storage_action:${action}`, `unknown_authoritative_storage_action:${action}`);
  }
  return {
    dbPath: resolveDbPath(env),
    action: action as AuthoritativeStorageAdminCliEnvConfig["action"],
  };
}
