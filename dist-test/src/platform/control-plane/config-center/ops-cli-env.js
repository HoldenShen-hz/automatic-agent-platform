import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
function resolveDbPath(env) {
    const fromEnv = readTrimmedEnv(env, "AA_DB_PATH");
    if (fromEnv != null) {
        return fromEnv;
    }
    const sqliteDir = join(process.cwd(), "data", "sqlite");
    mkdirSync(sqliteDir, { recursive: true });
    return join(sqliteDir, "authoritative-demo.db");
}
function requiredEnv(env, name) {
    const value = readTrimmedEnv(env, name);
    if (value == null) {
        throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
    }
    return value;
}
function optionalPositiveInteger(env, name, fallback) {
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
export function loadDispatchReconcileCliEnv(env = process.env) {
    const action = readTrimmedEnv(env, "AA_DISPATCH_RECONCILE_ACTION") ?? "scan";
    if (action !== "scan" && action !== "repair") {
        throw new ValidationError("dispatch_reconcile.invalid_action", "dispatch_reconcile.invalid_action");
    }
    return {
        action,
        occurredAt: readTrimmedEnv(env, "AA_OCCURRED_AT"),
    };
}
export function loadLeaseHandoverCliEnv(env = process.env) {
    return {
        leaseId: requiredEnv(env, "AA_LEASE_ID"),
        workerId: requiredEnv(env, "AA_WORKER_ID"),
        newWorkerId: requiredEnv(env, "AA_NEW_WORKER_ID"),
        ttlMs: optionalPositiveInteger(env, "AA_LEASE_TTL_MS", 30_000),
        reasonCode: readTrimmedEnv(env, "AA_REASON_CODE"),
        occurredAt: readTrimmedEnv(env, "AA_OCCURRED_AT"),
    };
}
export function loadEventOpsCliEnv(env = process.env) {
    return {
        dbPath: resolveDbPath(env),
        consumerId: readTrimmedEnv(env, "AA_EVENT_CONSUMER_ID"),
    };
}
export function loadOrphanCleanupCliEnv(env = process.env) {
    const action = readTrimmedEnv(env, "AA_ORPHAN_CLEANUP_ACTION") ?? "scan";
    if (action !== "scan" && action !== "repair") {
        throw new ValidationError("orphan_cleanup.invalid_action", "orphan_cleanup.invalid_action");
    }
    return {
        action,
        occurredAt: readTrimmedEnv(env, "AA_OCCURRED_AT"),
    };
}
export function loadReplayRecoveryCliEnv(env = process.env) {
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
export function loadProfileHomeCliEnv(env = process.env) {
    return {
        create: readTrimmedEnv(env, "AA_PROFILE_HOME_CREATE") === "1",
    };
}
export function loadAuthoritativeStorageAdminCliEnv(env = process.env) {
    const action = readTrimmedEnv(env, "AA_AUTHORITATIVE_STORAGE_ACTION") ?? "summary";
    if (action !== "summary"
        && action !== "migrate"
        && action !== "plan"
        && action !== "status"
        && action !== "up"
        && action !== "down") {
        throw new ValidationError(`unknown_authoritative_storage_action:${action}`, `unknown_authoritative_storage_action:${action}`);
    }
    return {
        dbPath: resolveDbPath(env),
        action,
    };
}
//# sourceMappingURL=ops-cli-env.js.map