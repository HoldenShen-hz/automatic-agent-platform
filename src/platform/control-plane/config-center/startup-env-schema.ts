/**
 * Startup Environment Zod Schema — GAP-V2-06
 *
 * Provides Zod schemas for all startup-critical environment variables.
 * Validation runs at process startup — invalid config causes process.exit(1).
 *
 * §9 配置与部署架构要求 8 层配置校验，此文件提供第 1 层：
 * 启动时入口点校验（P0 级字段）。
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive parsers matching the existing manual parsing in runtime-env.ts
// ---------------------------------------------------------------------------

const NonEmptyString = z.string().min(1, "must be non-empty");
const PositiveInteger = z.string().refine(
  (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0;
  },
  { message: "must be a positive integer" },
);
const NonNegativeInteger = z.string().refine(
  (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0;
  },
  { message: "must be a non-negative integer" },
);
const PositivePort = z.string().refine(
  (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n >= 1 && n <= 65535;
  },
  { message: "must be a port number between 1 and 65535" },
);
const EnvironmentName = z.enum(["dev", "test", "staging", "pre-prod", "prod"]);
const BooleanString = z.enum(["1", "true", "yes", "on", "0", "false", "no", "off"]);

// ---------------------------------------------------------------------------
// Startup-critical schemas (P0 — process MUST NOT start if these are invalid)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_DB_PATH — SQLite database file path.
 * Required: the process cannot start without a valid database path.
 */
export const DbPathSchema = NonEmptyString;

/**
 * Schema for AA_CONFIG_ENV — deployment environment name.
 * Required: defaults to "prod" (fail-closed) per CFG-01.
 * Invalid values are rejected — no silent fallback.
 */
export const ConfigEnvSchema = EnvironmentName;

/**
 * Schema for AA_CONFIG_ROOT — configuration directory root.
 * Optional: falls back to {cwd}/config if not set.
 */
export const ConfigRootSchema = NonEmptyString.optional();

/**
 * Schema for AA_API_PORT — HTTP API server port.
 * Optional: falls back to dynamic port selection if not set.
 * Must be in range 1-65535 if provided.
 */
export const ApiPortSchema = PositivePort.optional();

/**
 * Schema for AA_API_HOST — HTTP API server bind address.
 * Optional: defaults to all interfaces if not set.
 */
export const ApiHostSchema = NonEmptyString.optional();

/**
 * Schema for AA_LOG_STDOUT — enable structured JSON logging to stdout.
 * Optional: defaults to false.
 */
export const LogStdoutSchema = BooleanString.optional();

/**
 * Schema for AA_LOG_FILE_MAX_BYTES — log file max size before rotation.
 * Optional: requires AA_LOG_FILE_PATH to also be set.
 */
export const LogFileMaxBytesSchema = PositiveInteger.nullable();

/**
 * Schema for AA_LOG_FILE_MAX_FILES — number of rotated log files to retain.
 * Optional: defaults to 5.
 */
export const LogFileMaxFilesSchema = PositiveInteger.optional();

// ---------------------------------------------------------------------------
// Execution resource ceiling schemas (P0 — misconfig can cause resource exhaustion)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_MAX_AGENT_TOOL_CALLS — maximum tool calls per agent task.
 * Optional: null means unlimited.
 */
export const MaxAgentToolCallsSchema = PositiveInteger.nullable();

/**
 * Schema for AA_MAX_AGENT_MEMORY_MB — maximum memory (MB) per agent task.
 * Optional: null means unlimited.
 */
export const MaxAgentMemoryMbSchema = PositiveInteger.nullable();

/**
 * Schema for AA_MAX_AGENT_ELAPSED_MS — maximum wall-clock time per agent task.
 * Optional: null means unlimited.
 */
export const MaxAgentElapsedMsSchema = PositiveInteger.nullable();

// ---------------------------------------------------------------------------
// OpenTelemetry schemas (P1 — system starts without OTEL but observability is degraded)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_OTEL_ENABLED — whether to bootstrap OpenTelemetry.
 * Optional: defaults to false.
 */
export const OtelEnabledSchema = BooleanString.optional();

/**
 * Schema for AA_OTEL_ENDPOINT — OTLP exporter endpoint URL.
 * Required when AA_OTEL_ENABLED is true.
 */
export const OtelEndpointSchema = NonEmptyString.url().optional();

/**
 * Schema for AA_OTEL_SERVICE_NAME — logical service name for OTEL.
 * Optional: defaults to "automatic-agent".
 */
export const OtelServiceNameSchema = NonEmptyString.optional();

/**
 * Schema for AA_OTEL_SERVICE_VERSION — service version for OTEL.
 * Optional: defaults to AA_BUILD_VERSION or "0.1.0".
 */
export const OtelServiceVersionSchema = NonEmptyString.optional();

// ---------------------------------------------------------------------------
// Governance schemas (P0 — tamper detection)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION — expected governance version.
 * Optional: null means skip tamper detection.
 */
export const ExpectedGovernanceVersionSchema = NonEmptyString.nullable();

// ---------------------------------------------------------------------------
// Composite startup config
// ---------------------------------------------------------------------------

export const StartupEnvSchema = z.object({
  AA_DB_PATH: DbPathSchema,
  AA_CONFIG_ENV: ConfigEnvSchema.default("prod"),
  AA_CONFIG_ROOT: ConfigRootSchema,
  AA_API_PORT: ApiPortSchema,
  AA_API_HOST: ApiHostSchema,
  AA_LOG_STDOUT: LogStdoutSchema,
  AA_LOG_FILE_MAX_BYTES: LogFileMaxBytesSchema,
  AA_LOG_FILE_MAX_FILES: LogFileMaxFilesSchema,
  AA_MAX_AGENT_TOOL_CALLS: MaxAgentToolCallsSchema,
  AA_MAX_AGENT_MEMORY_MB: MaxAgentMemoryMbSchema,
  AA_MAX_AGENT_ELAPSED_MS: MaxAgentElapsedMsSchema,
  AA_OTEL_ENABLED: OtelEnabledSchema,
  AA_OTEL_ENDPOINT: OtelEndpointSchema,
  AA_OTEL_SERVICE_NAME: OtelServiceNameSchema,
  AA_OTEL_SERVICE_VERSION: OtelServiceVersionSchema,
  AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: ExpectedGovernanceVersionSchema,
});

export type StartupEnv = z.infer<typeof StartupEnvSchema>;

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface StartupEnvValidationResult {
  success: boolean;
  errors: StartupEnvValidationError[];
  parsed?: StartupEnv;
}

export interface StartupEnvValidationError {
  key: string;
  message: string;
}

/**
 * Validates startup environment variables using Zod schemas.
 * Returns a structured result — does NOT throw.
 *
 * Callers should check result.success and report all errors before
 * deciding whether to call process.exit(1).
 */
export function validateStartupEnv(env: NodeJS.ProcessEnv = process.env): StartupEnvValidationResult {
  const raw = {
    AA_DB_PATH: env["AA_DB_PATH"] ?? null,
    AA_CONFIG_ENV: env["AA_CONFIG_ENV"] ?? undefined,
    AA_CONFIG_ROOT: env["AA_CONFIG_ROOT"] ?? undefined,
    AA_API_PORT: env["AA_API_PORT"] ?? undefined,
    AA_API_HOST: env["AA_API_HOST"] ?? undefined,
    AA_LOG_STDOUT: env["AA_LOG_STDOUT"] ?? undefined,
    AA_LOG_FILE_MAX_BYTES: env["AA_LOG_FILE_MAX_BYTES"] ?? null,
    AA_LOG_FILE_MAX_FILES: env["AA_LOG_FILE_MAX_FILES"] ?? undefined,
    AA_MAX_AGENT_TOOL_CALLS: env["AA_MAX_AGENT_TOOL_CALLS"] ?? null,
    AA_MAX_AGENT_MEMORY_MB: env["AA_MAX_AGENT_MEMORY_MB"] ?? null,
    AA_MAX_AGENT_ELAPSED_MS: env["AA_MAX_AGENT_ELAPSED_MS"] ?? null,
    AA_OTEL_ENABLED: env["AA_OTEL_ENABLED"] ?? undefined,
    AA_OTEL_ENDPOINT: env["AA_OTEL_ENDPOINT"] ?? undefined,
    AA_OTEL_SERVICE_NAME: env["AA_OTEL_SERVICE_NAME"] ?? undefined,
    AA_OTEL_SERVICE_VERSION: env["AA_OTEL_SERVICE_VERSION"] ?? undefined,
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: env["AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION"] ?? null,
  };

  const result = StartupEnvSchema.safeParse(raw);

  if (result.success) {
    return { success: true, errors: [], parsed: result.data };
  }

  const errors: StartupEnvValidationError[] = result.error.issues.map((issue) => ({
    key: issue.path.join("."),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Validates startup env vars and exits process if validation fails.
 * Designed to be called at the top of main() in CLI entry points.
 */
export function requireValidStartupEnv(env: NodeJS.ProcessEnv = process.env): void {
  const result = validateStartupEnv(env);
  if (result.success) {
    return;
  }

  const lines = [
    "FATAL: Startup environment validation failed.",
    "",
    ...result.errors.map((e) => `  ${e.key}: ${e.message}`),
    "",
    "Fix the environment variables above and restart the process.",
    "See: docs_zh/operations/environment-variables.md",
  ];

  console.error(lines.join("\n"));
  process.exit(1);
}
