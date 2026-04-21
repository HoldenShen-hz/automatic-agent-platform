import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
import { DEFAULT_LEASE_TTL_MS } from "../../execution/lease/types.js";
/**
 * Throws a missing environment variable error.
 */
function missingEnv(name) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}
/**
 * Throws an invalid environment variable error.
 */
function invalidEnv(name) {
    throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}
/**
 * Reads a required environment variable, throwing if missing or empty.
 */
function requiredEnv(env, name) {
    return readTrimmedEnv(env, name) ?? missingEnv(name);
}
/**
 * Reads an optional environment variable, returning undefined if missing or empty.
 */
function optionalEnv(env, name) {
    return readTrimmedEnv(env, name) ?? undefined;
}
function optionalRawEnv(env, name) {
    if (!(name in env)) {
        return undefined;
    }
    return env[name];
}
/**
 * Reads an optional environment variable, returning null if missing or empty.
 */
function optionalNullableEnv(env, name) {
    return readTrimmedEnv(env, name) ?? null;
}
/**
 * Parses an optional number from environment, returning undefined if missing.
 * Throws if value exists but is not a valid finite number.
 */
function optionalNumberEnv(env, name) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Parses a required number from environment, throwing if missing or invalid.
 */
function requiredNumberEnv(env, name) {
    const value = requiredEnv(env, name);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Reads a positive number from environment, returning fallback if missing.
 * Throws if value exists but is not a positive number.
 */
function positiveNumberOrDefault(env, name, fallback) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Reads an optional enum value from environment, returning undefined if missing.
 * Throws if value exists but is not in the allowed list.
 */
function optionalEnumValue(env, name, allowed) {
    const value = optionalEnv(env, name);
    if (value == null) {
        return undefined;
    }
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
/**
 * Reads a required enum value from environment, throwing if missing or invalid.
 */
function requiredEnumValue(env, name, allowed) {
    const value = requiredEnv(env, name);
    if (!allowed.includes(value)) {
        return invalidEnv(name);
    }
    return value;
}
/**
 * Parses a JSON array of strings from environment variable.
 * Returns empty array if missing or invalid.
 */
function parseStringArrayEnv(env, name) {
    const raw = optionalEnv(env, name);
    if (raw == null) {
        return [];
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return invalidEnv(name);
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
        return invalidEnv(name);
    }
    return parsed;
}
/**
 * Parses remote logs JSON array from environment variable.
 * Returns undefined if missing. Validates structure of each log entry.
 */
function parseRemoteLogsEnv(env) {
    const raw = optionalEnv(env, "AA_REMOTE_LOGS_JSON");
    if (raw == null) {
        return undefined;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return invalidEnv("AA_REMOTE_LOGS_JSON");
    }
    if (!Array.isArray(parsed)) {
        return invalidEnv("AA_REMOTE_LOGS_JSON");
    }
    return parsed.map((item) => {
        if (item == null || typeof item !== "object" || Array.isArray(item)) {
            return invalidEnv("AA_REMOTE_LOGS_JSON");
        }
        const candidate = item;
        if ((candidate.level !== "debug" && candidate.level !== "info" && candidate.level !== "warn" && candidate.level !== "error")
            || typeof candidate.message !== "string") {
            return invalidEnv("AA_REMOTE_LOGS_JSON");
        }
        return {
            level: candidate.level,
            message: candidate.message,
            ...(candidate.context != null && typeof candidate.context === "object" && !Array.isArray(candidate.context)
                ? { context: candidate.context }
                : {}),
            ...(typeof candidate.occurredAt === "string" ? { occurredAt: candidate.occurredAt } : {}),
        };
    });
}
/**
 * Loads dispatch execution CLI configuration from environment variables.
 * Used by coordinators to dispatch execution requests to workers.
 */
export function loadDispatchExecutionCliEnv(env = process.env) {
    return {
        dbPath: optionalEnv(env, "AA_DB_PATH"),
        executionId: requiredEnv(env, "AA_EXECUTION_ID"),
        priority: optionalEnumValue(env, "AA_PRIORITY", ["low", "normal", "high", "urgent"]),
        queueName: optionalNullableEnv(env, "AA_QUEUE_NAME"),
        dispatchTarget: optionalEnumValue(env, "AA_DISPATCH_TARGET", ["any", "local_only", "prefer_remote", "require_remote"]),
        requiredIsolationLevel: optionalEnumValue(env, "AA_REQUIRED_ISOLATION_LEVEL", ["standard", "hardened", "strict"]),
        requiredRepoVersion: optionalNullableEnv(env, "AA_REQUIRED_REPO_VERSION"),
        requiredCapabilities: parseStringArrayEnv(env, "AA_REQUIRED_CAPABILITIES_JSON"),
        dispatchAfter: optionalNullableEnv(env, "AA_DISPATCH_AFTER"),
        createOnly: readTrimmedEnv(env, "AA_DISPATCH_CREATE_ONLY") === "1",
        preferredWorkerId: optionalNullableEnv(env, "AA_PREFERRED_WORKER_ID"),
        leaseTtlMs: positiveNumberOrDefault(env, "AA_LEASE_TTL_MS", DEFAULT_LEASE_TTL_MS),
        includeDegraded: readTrimmedEnv(env, "AA_INCLUDE_DEGRADED") === "1",
    };
}
/**
 * Loads worker handshake CLI configuration from environment variables.
 * Used during worker claim and heartbeat interactions with coordinator.
 */
export function loadWorkerHandshakeCliEnv(env = process.env) {
    return {
        dbPath: optionalEnv(env, "AA_DB_PATH"),
        action: requiredEnumValue(env, "AA_WORKER_HANDSHAKE_ACTION", ["claim", "heartbeat"]),
        ticketId: optionalEnv(env, "AA_TICKET_ID"),
        executionId: optionalEnv(env, "AA_EXECUTION_ID"),
        workerId: requiredEnv(env, "AA_WORKER_ID"),
        leaseId: requiredEnv(env, "AA_LEASE_ID"),
        fencingToken: requiredNumberEnv(env, "AA_FENCING_TOKEN"),
        leaseTtlMs: positiveNumberOrDefault(env, "AA_LEASE_TTL_MS", DEFAULT_LEASE_TTL_MS),
        occurredAt: optionalEnv(env, "AA_OCCURRED_AT"),
        cpuPct: optionalNumberEnv(env, "AA_CPU_PCT"),
        memoryMb: optionalNumberEnv(env, "AA_MEMORY_MB"),
        remoteSessionStatus: optionalEnumValue(env, "AA_REMOTE_SESSION_STATUS", [
            "connecting",
            "connected",
            "reconnecting",
            "degraded",
            "failed",
            "viewer_only",
        ]),
        lastAcknowledgedStreamOffset: optionalRawEnv(env, "AA_LAST_ACKNOWLEDGED_STREAM_OFFSET"),
        streamResumeSuccessRate: optionalNumberEnv(env, "AA_STREAM_RESUME_SUCCESS_RATE"),
        credentialRefreshSuccessRate: optionalNumberEnv(env, "AA_CREDENTIAL_REFRESH_SUCCESS_RATE"),
        sessionConsistencyCheckStatus: optionalEnumValue(env, "AA_SESSION_CONSISTENCY_CHECK_STATUS", [
            "unknown",
            "passed",
            "mismatch",
        ]),
        sessionConsistencyCheckedAt: optionalEnv(env, "AA_SESSION_CONSISTENCY_CHECKED_AT"),
        workspaceSyncStatus: optionalEnumValue(env, "AA_WORKSPACE_SYNC_STATUS", ["unknown", "aligned", "conflict"]),
        workspaceSyncCheckedAt: optionalEnv(env, "AA_WORKSPACE_SYNC_CHECKED_AT"),
        saturation: optionalNumberEnv(env, "AA_SATURATION"),
        activeLeaseCount: optionalNumberEnv(env, "AA_ACTIVE_LEASE_COUNT"),
        meanStartupLatencyMs: optionalNumberEnv(env, "AA_MEAN_STARTUP_LATENCY_MS"),
        sandboxSuccessRate: optionalNumberEnv(env, "AA_SANDBOX_SUCCESS_RATE"),
        repoCacheHitRate: optionalNumberEnv(env, "AA_REPO_CACHE_HIT_RATE"),
        toolBacklogCount: optionalNumberEnv(env, "AA_TOOL_BACKLOG_COUNT"),
        toolCallCount: optionalNumberEnv(env, "AA_TOOL_CALL_COUNT"),
        currentStepId: optionalEnv(env, "AA_CURRENT_STEP_ID"),
        lastProgressAt: optionalEnv(env, "AA_LAST_PROGRESS_AT"),
        lastToolName: optionalEnv(env, "AA_LAST_TOOL_NAME"),
        runtimeInstanceId: optionalEnv(env, "AA_RUNTIME_INSTANCE_ID"),
        restartedFromRuntimeInstanceId: optionalEnv(env, "AA_RESTARTED_FROM_RUNTIME_INSTANCE_ID"),
        progressMessage: optionalNullableEnv(env, "AA_PROGRESS_MESSAGE"),
        remoteLogs: parseRemoteLogsEnv(env),
    };
}
/**
 * Loads worker writeback CLI configuration from environment variables.
 * Used when workers report execution completion back to coordinator.
 */
export function loadWorkerWritebackCliEnv(env = process.env) {
    return {
        dbPath: optionalEnv(env, "AA_DB_PATH"),
        executionId: requiredEnv(env, "AA_EXECUTION_ID"),
        workerId: requiredEnv(env, "AA_WORKER_ID"),
        leaseId: requiredEnv(env, "AA_LEASE_ID"),
        fencingToken: requiredNumberEnv(env, "AA_FENCING_TOKEN"),
        terminalStatus: requiredEnumValue(env, "AA_TERMINAL_STATUS", ["done", "failed", "cancelled"]),
        occurredAt: optionalEnv(env, "AA_OCCURRED_AT"),
        cpuPct: optionalNumberEnv(env, "AA_CPU_PCT"),
        memoryMb: optionalNumberEnv(env, "AA_MEMORY_MB"),
        toolBacklogCount: optionalNumberEnv(env, "AA_TOOL_BACKLOG_COUNT"),
        toolCallCount: optionalNumberEnv(env, "AA_TOOL_CALL_COUNT"),
        currentStepId: optionalEnv(env, "AA_CURRENT_STEP_ID"),
        lastProgressAt: optionalEnv(env, "AA_LAST_PROGRESS_AT"),
        workspaceSyncStatus: optionalEnumValue(env, "AA_WORKSPACE_SYNC_STATUS", ["unknown", "aligned", "conflict"]),
        workspaceSyncCheckedAt: optionalEnv(env, "AA_WORKSPACE_SYNC_CHECKED_AT"),
        lastToolName: optionalEnv(env, "AA_LAST_TOOL_NAME"),
        runtimeInstanceId: optionalEnv(env, "AA_RUNTIME_INSTANCE_ID"),
        restartedFromRuntimeInstanceId: optionalEnv(env, "AA_RESTARTED_FROM_RUNTIME_INSTANCE_ID"),
        remoteLogs: parseRemoteLogsEnv(env),
        taskOutputJson: optionalNullableEnv(env, "AA_TASK_OUTPUT_JSON"),
        outputsJson: optionalNullableEnv(env, "AA_WORKFLOW_OUTPUTS_JSON"),
        reasonCode: optionalNullableEnv(env, "AA_REASON_CODE"),
        progressMessage: optionalNullableEnv(env, "AA_PROGRESS_MESSAGE"),
    };
}
//# sourceMappingURL=runtime-ops-env.js.map