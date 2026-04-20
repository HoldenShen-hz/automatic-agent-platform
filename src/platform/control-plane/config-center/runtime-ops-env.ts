import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";

/** Log levels for remote worker logging */
type RemoteLogLevel = "debug" | "info" | "warn" | "error";

/**
 * Payload structure for remote log entries sent from workers.
 */
export interface RemoteLogPayload {
  level: RemoteLogLevel;
  message: string;
  context?: Record<string, unknown> | null;
  occurredAt?: string;
}

/**
 * Configuration for dispatch execution CLI operations.
 * Used by coordinators to dispatch execution requests to workers.
 */
export interface DispatchExecutionCliEnvConfig {
  dbPath: string | undefined;
  executionId: string;
  priority: "low" | "normal" | "high" | "urgent" | undefined;
  queueName: string | null;
  dispatchTarget: "any" | "local_only" | "prefer_remote" | "require_remote" | undefined;
  requiredIsolationLevel: "standard" | "hardened" | "strict" | undefined;
  requiredRepoVersion: string | null;
  requiredCapabilities: string[];
  dispatchAfter: string | null;
  createOnly: boolean;
  preferredWorkerId: string | null;
  leaseTtlMs: number;
  includeDegraded: boolean;
}

/**
 * Configuration for worker handshake CLI operations.
 * Used during worker claim and heartbeat interactions with coordinator.
 */
export interface WorkerHandshakeCliEnvConfig {
  dbPath: string | undefined;
  action: "claim" | "heartbeat";
  ticketId: string | undefined;
  executionId: string | undefined;
  workerId: string;
  leaseId: string;
  fencingToken: number;
  leaseTtlMs: number;
  occurredAt: string | undefined;
  cpuPct: number | undefined;
  memoryMb: number | undefined;
  remoteSessionStatus: "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only" | undefined;
  lastAcknowledgedStreamOffset: string | undefined;
  streamResumeSuccessRate: number | undefined;
  credentialRefreshSuccessRate: number | undefined;
  sessionConsistencyCheckStatus: "unknown" | "passed" | "mismatch" | undefined;
  sessionConsistencyCheckedAt: string | undefined;
  workspaceSyncStatus: "unknown" | "aligned" | "conflict" | undefined;
  workspaceSyncCheckedAt: string | undefined;
  saturation: number | undefined;
  activeLeaseCount: number | undefined;
  meanStartupLatencyMs: number | undefined;
  sandboxSuccessRate: number | undefined;
  repoCacheHitRate: number | undefined;
  toolBacklogCount: number | undefined;
  toolCallCount: number | undefined;
  currentStepId: string | undefined;
  lastProgressAt: string | undefined;
  lastToolName: string | undefined;
  runtimeInstanceId: string | undefined;
  restartedFromRuntimeInstanceId: string | undefined;
  progressMessage: string | null;
  remoteLogs: RemoteLogPayload[] | undefined;
}

/**
 * Configuration for worker writeback CLI operations.
 * Used when workers report execution completion back to coordinator.
 */
export interface WorkerWritebackCliEnvConfig {
  dbPath: string | undefined;
  executionId: string;
  workerId: string;
  leaseId: string;
  fencingToken: number;
  terminalStatus: "done" | "failed" | "cancelled";
  occurredAt: string | undefined;
  cpuPct: number | undefined;
  memoryMb: number | undefined;
  toolBacklogCount: number | undefined;
  toolCallCount: number | undefined;
  currentStepId: string | undefined;
  lastProgressAt: string | undefined;
  workspaceSyncStatus: "unknown" | "aligned" | "conflict" | undefined;
  workspaceSyncCheckedAt: string | undefined;
  lastToolName: string | undefined;
  runtimeInstanceId: string | undefined;
  restartedFromRuntimeInstanceId: string | undefined;
  remoteLogs: RemoteLogPayload[] | undefined;
  taskOutputJson: string | null;
  outputsJson: string | null;
  reasonCode: string | null;
  progressMessage: string | null;
}

/**
 * Throws a missing environment variable error.
 */
function missingEnv(name: string): never {
  throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
}

/**
 * Throws an invalid environment variable error.
 */
function invalidEnv(name: string): never {
  throw new ValidationError(`invalid_env:${name}`, `invalid_env:${name}`);
}

/**
 * Reads a required environment variable, throwing if missing or empty.
 */
function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  return readTrimmedEnv(env, name) ?? missingEnv(name);
}

/**
 * Reads an optional environment variable, returning undefined if missing or empty.
 */
function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  return readTrimmedEnv(env, name) ?? undefined;
}

function optionalRawEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  if (!(name in env)) {
    return undefined;
  }
  return env[name];
}

/**
 * Reads an optional environment variable, returning null if missing or empty.
 */
function optionalNullableEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  return readTrimmedEnv(env, name) ?? null;
}

/**
 * Parses an optional number from environment, returning undefined if missing.
 * Throws if value exists but is not a valid finite number.
 */
function optionalNumberEnv(env: NodeJS.ProcessEnv, name: string): number | undefined {
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
function requiredNumberEnv(env: NodeJS.ProcessEnv, name: string): number {
  const value = requiredEnv(env, name);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return invalidEnv(name);
  }
  return parsed;
}

/**
 * Parses a positive number from environment, returning fallback if missing.
 * Throws if value exists but is not a positive number.
 */
function positiveNumberOrDefault(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const parsed = optionalNumberEnv(env, name);
  if (parsed == null) {
    return fallback;
  }
  if (parsed <= 0) {
    return invalidEnv(name);
  }
  return parsed;
}

/**
 * Reads an optional enum value from environment, returning undefined if missing.
 * Throws if value exists but is not in the allowed list.
 */
function optionalEnumValue<T extends string>(
  env: NodeJS.ProcessEnv,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const value = optionalEnv(env, name);
  if (value == null) {
    return undefined;
  }
  if (!allowed.includes(value as T)) {
    return invalidEnv(name);
  }
  return value as T;
}

/**
 * Reads a required enum value from environment, throwing if missing or invalid.
 */
function requiredEnumValue<T extends string>(
  env: NodeJS.ProcessEnv,
  name: string,
  allowed: readonly T[],
): T {
  const value = requiredEnv(env, name);
  if (!allowed.includes(value as T)) {
    return invalidEnv(name);
  }
  return value as T;
}

/**
 * Parses a JSON array of strings from environment variable.
 * Returns empty array if missing or invalid.
 */
function parseStringArrayEnv(env: NodeJS.ProcessEnv, name: string): string[] {
  const raw = optionalEnv(env, name);
  if (raw == null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
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
function parseRemoteLogsEnv(env: NodeJS.ProcessEnv): RemoteLogPayload[] | undefined {
  const raw = optionalEnv(env, "AA_REMOTE_LOGS_JSON");
  if (raw == null) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return invalidEnv("AA_REMOTE_LOGS_JSON");
  }
  if (!Array.isArray(parsed)) {
    return invalidEnv("AA_REMOTE_LOGS_JSON");
  }

  return parsed.map((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      return invalidEnv("AA_REMOTE_LOGS_JSON");
    }
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.level !== "debug" && candidate.level !== "info" && candidate.level !== "warn" && candidate.level !== "error")
      || typeof candidate.message !== "string"
    ) {
      return invalidEnv("AA_REMOTE_LOGS_JSON");
    }
    return {
      level: candidate.level,
      message: candidate.message,
      ...(candidate.context != null && typeof candidate.context === "object" && !Array.isArray(candidate.context)
        ? { context: candidate.context as Record<string, unknown> }
        : {}),
      ...(typeof candidate.occurredAt === "string" ? { occurredAt: candidate.occurredAt } : {}),
    };
  });
}

/**
 * Loads dispatch execution CLI configuration from environment variables.
 * Used by coordinators to dispatch execution requests to workers.
 */
export function loadDispatchExecutionCliEnv(
  env: NodeJS.ProcessEnv = process.env,
): DispatchExecutionCliEnvConfig {
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
    leaseTtlMs: positiveNumberOrDefault(env, "AA_LEASE_TTL_MS", 30_000),
    includeDegraded: readTrimmedEnv(env, "AA_INCLUDE_DEGRADED") === "1",
  };
}

/**
 * Loads worker handshake CLI configuration from environment variables.
 * Used during worker claim and heartbeat interactions with coordinator.
 */
export function loadWorkerHandshakeCliEnv(
  env: NodeJS.ProcessEnv = process.env,
): WorkerHandshakeCliEnvConfig {
  return {
    dbPath: optionalEnv(env, "AA_DB_PATH"),
    action: requiredEnumValue(env, "AA_WORKER_HANDSHAKE_ACTION", ["claim", "heartbeat"]),
    ticketId: optionalEnv(env, "AA_TICKET_ID"),
    executionId: optionalEnv(env, "AA_EXECUTION_ID"),
    workerId: requiredEnv(env, "AA_WORKER_ID"),
    leaseId: requiredEnv(env, "AA_LEASE_ID"),
    fencingToken: requiredNumberEnv(env, "AA_FENCING_TOKEN"),
    leaseTtlMs: positiveNumberOrDefault(env, "AA_LEASE_TTL_MS", 30_000),
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
export function loadWorkerWritebackCliEnv(
  env: NodeJS.ProcessEnv = process.env,
): WorkerWritebackCliEnvConfig {
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
