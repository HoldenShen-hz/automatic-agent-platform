/**
 * Startup Environment Zod Schema — GAP-V2-06
 *
 * Provides Zod schemas for all startup-critical environment variables.
 * Validation runs at process startup — invalid config causes process.exit(1).
 *
 * §9 Configuration and deployment architecture requires 8-layer config validation, this file provides layer 1:
 * Startup entry point validation (P0 fields).
 */

import { z } from "zod";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

// ---------------------------------------------------------------------------
// Primitive parsers matching the existing manual parsing in runtime-env.ts
// ---------------------------------------------------------------------------

function normalizeStringInput(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

const NonEmptyString = z.preprocess(normalizeStringInput, z.string().min(1, "must be non-empty"));
const UrlString = z.preprocess(normalizeStringInput, z.string().url());
const PositiveInteger = z.preprocess(normalizeStringInput, z.string()).refine(
  (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0;
  },
  { message: "must be a positive integer" },
);
const NonNegativeInteger = z.preprocess(normalizeStringInput, z.string()).refine(
  (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0;
  },
  { message: "must be a non-negative integer" },
);
const PositivePort = z.preprocess(normalizeStringInput, z.string()).refine(
  (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n >= 1 && n <= 65535;
  },
  { message: "must be a port number between 1 and 65535" },
);
const EnvironmentName = z.preprocess(normalizeStringInput, z.enum(["dev", "test", "staging", "pre-prod", "prod", "development", "production"]));
const BooleanString = z.preprocess(
  (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
  z.enum(["1", "true", "yes", "on", "0", "false", "no", "off"]),
);
const StorageDriver = z.enum(["sqlite", "postgres"]);
const LogLevel = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);

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
export const LogLevelSchema = LogLevel.optional();

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

/**
 * Schema for AA_LOG_FILE_PATH — file path for structured JSON logging.
 * Optional: required when AA_LOG_FILE_MAX_BYTES is set.
 */
export const LogFilePathSchema = NonEmptyString.optional();

/**
 * Schema for AA_LOG_FLUENTD_HOST — Fluentd server hostname.
 * Optional: all fluentd settings must be present together.
 */
export const LogFluentdHostSchema = NonEmptyString.optional();

/**
 * Schema for AA_LOG_FLUENTD_PORT — Fluentd server port.
 * Optional: all fluentd settings must be present together.
 */
export const LogFluentdPortSchema = PositivePort.optional();

/**
 * Schema for AA_LOG_FLUENTD_TAG — Fluentd tag for log routing.
 * Optional: all fluentd settings must be present together.
 */
export const LogFluentdTagSchema = NonEmptyString.optional();

/**
 * Schema for AA_LOG_DATADOG_API_KEY — Datadog API key.
 * Optional: all datadog settings must be present together.
 */
export const LogDatadogApiKeySchema = NonEmptyString.optional();

/**
 * Schema for AA_LOG_DATADOG_SITE — Datadog site (e.g., datadoghq.com, datadoghq.eu).
 * Optional: all datadog settings must be present together.
 */
export const LogDatadogSiteSchema = NonEmptyString.optional();

/**
 * Schema for AA_LOG_DATADOG_SERVICE — Datadog service name.
 * Optional: all datadog settings must be present together.
 */
export const LogDatadogServiceSchema = NonEmptyString.optional();

/**
 * Schema for AA_API_KEYS_JSON — JSON array of API key records.
 * Optional: must parse as a JSON array.
 */
export const ApiKeysJsonSchema = z.string().refine((value) => {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}, { message: "must be a JSON array" }).optional();

/**
 * Schema for AA_WEBHOOK_SECRET — secret for webhook signature verification.
 * Optional: used when webhook endpoints are configured.
 */
export const WebhookSecretSchema = NonEmptyString.optional();

/**
 * Schema for AA_API_ENABLE_WEBSOCKET — enable WebSocket bridge on API server.
 * Optional: defaults to true.
 */
export const ApiEnableWebSocketSchema = BooleanString.optional();

/**
 * Schema for AA_METRICS_PORT — dedicated metrics server port.
 * Optional: must be in range 1-65535 if provided.
 */
export const MetricsPortSchema = PositivePort.optional();

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
// OpenTelemetry schemas (P1 — system starts with OTEL enabled by default)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_OTEL_ENABLED — whether to bootstrap OpenTelemetry.
 * Optional: defaults to true.
 */
export const OtelEnabledSchema = BooleanString.optional();

/**
 * Schema for AA_OTEL_ENDPOINT — OTLP exporter endpoint URL.
 * Required when AA_OTEL_ENABLED is true.
 */
export const OtelEndpointSchema = UrlString.optional();

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
// Plugin & sandbox schemas (P1 — system starts without plugins but functionality is reduced)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_PLUGIN_REGISTRY_URL — plugin registry endpoint.
 * Optional: defaults to built-in plugin catalog.
 */
export const PluginRegistryUrlSchema = UrlString.optional();

/**
 * Schema for AA_PLUGIN_ALLOW_UNVERIFIED — allow loading plugins without signature verification.
 * Optional: defaults to false in production.
 */
export const PluginAllowUnverifiedSchema = BooleanString.optional();
export const PluginSandboxRootSchema = NonEmptyString.optional();
export const PluginAllowNetworkEgressSchema = BooleanString.optional();
export const PluginRuntimeIsolationSchema = z.enum([
  "shared_process",
  "serialized_in_process",
  "forked_process",
  "sandboxed_process",
  "containerized_process",
]).optional();

/**
 * Schema for AA_SANDBOX_MAX_MEMORY_MB — maximum memory per sandboxed execution.
 * Optional: null means use platform default.
 */
export const SandboxMaxMemoryMbSchema = PositiveInteger.nullable();

/**
 * Schema for AA_SANDBOX_TIMEOUT_MS — maximum time for sandboxed execution.
 * Optional: null means use platform default.
 */
export const SandboxTimeoutMsSchema = PositiveInteger.nullable();

// ---------------------------------------------------------------------------
// Security schemas (P0 — tamper detection & access control)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_API_JWT_SECRET — JWT signing secret for API authentication.
 * Optional: null means use shared secret from config center.
 */
export const ApiJwtSecretSchema = NonEmptyString.nullable();

/**
 * Schema for AA_SECURITY_ENFORCE_SANDBOX — enforce sandbox isolation for all executions.
 * Optional: defaults to true in prod, false in dev.
 */
export const SecurityEnforceSandboxSchema = BooleanString.optional();

/**
 * Schema for AA_SECURITY_ALLOWED_HOSTS — comma-separated list of allowed request origins.
 * Optional: defaults to all origins in dev, specific hosts in prod.
 */
export const SecurityAllowedHostsSchema = NonEmptyString.optional();
export const StorageDriverSchema = StorageDriver.optional();
export const PostgresDsnSchema = NonEmptyString.optional();
export const BuildCommitSchema = NonEmptyString.optional();
export const BuildTimestampSchema = NonEmptyString.optional();
export const BuildProfileSchema = NonEmptyString.optional();
export const BuildVersionSchema = NonEmptyString.optional();
export const FeatureFlagsSchema = NonEmptyString.optional();
export const EnabledExtensionsSchema = NonEmptyString.optional();

// ---------------------------------------------------------------------------
// Redis connection schemas (P1 — system may start without Redis but caching is disabled)
// ---------------------------------------------------------------------------

/**
 * Schema for AA_REDIS_HOST — Redis server hostname.
 * Optional: defaults to localhost.
 */
export const RedisHostSchema = NonEmptyString.optional();

/**
 * Schema for AA_REDIS_PORT — Redis server port.
 * Optional: defaults to 6379.
 */
export const RedisPortSchema = PositivePort.optional();

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
  AA_LOG_LEVEL: LogLevelSchema,
  AA_LOG_FILE_PATH: LogFilePathSchema,
  AA_LOG_FILE_MAX_BYTES: LogFileMaxBytesSchema,
  AA_LOG_FILE_MAX_FILES: LogFileMaxFilesSchema,
  AA_LOG_FLUENTD_HOST: LogFluentdHostSchema,
  AA_LOG_FLUENTD_PORT: LogFluentdPortSchema,
  AA_LOG_FLUENTD_TAG: LogFluentdTagSchema,
  AA_LOG_DATADOG_API_KEY: LogDatadogApiKeySchema,
  AA_LOG_DATADOG_SITE: LogDatadogSiteSchema,
  AA_LOG_DATADOG_SERVICE: LogDatadogServiceSchema,
  AA_API_KEYS_JSON: ApiKeysJsonSchema,
  AA_WEBHOOK_SECRET: WebhookSecretSchema,
  AA_API_ENABLE_WEBSOCKET: ApiEnableWebSocketSchema,
  AA_METRICS_PORT: MetricsPortSchema,
  AA_STORAGE_DRIVER: StorageDriverSchema,
  AA_STORAGE_POSTGRES_DSN: PostgresDsnSchema,
  AA_PG_DSN: PostgresDsnSchema,
  AA_MAX_AGENT_TOOL_CALLS: MaxAgentToolCallsSchema,
  AA_MAX_AGENT_MEMORY_MB: MaxAgentMemoryMbSchema,
  AA_MAX_AGENT_ELAPSED_MS: MaxAgentElapsedMsSchema,
  AA_OTEL_ENABLED: OtelEnabledSchema,
  AA_OTEL_ENDPOINT: OtelEndpointSchema,
  AA_OTEL_SERVICE_NAME: OtelServiceNameSchema,
  AA_OTEL_SERVICE_VERSION: OtelServiceVersionSchema,
  AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: ExpectedGovernanceVersionSchema,
  AA_PLUGIN_REGISTRY_URL: PluginRegistryUrlSchema,
  AA_PLUGIN_ALLOW_UNVERIFIED: PluginAllowUnverifiedSchema,
  AA_PLUGIN_SANDBOX_ROOT: PluginSandboxRootSchema,
  AA_PLUGIN_ALLOW_NETWORK_EGRESS: PluginAllowNetworkEgressSchema,
  AA_PLUGIN_RUNTIME_ISOLATION: PluginRuntimeIsolationSchema,
  AA_SANDBOX_MAX_MEMORY_MB: SandboxMaxMemoryMbSchema,
  AA_SANDBOX_TIMEOUT_MS: SandboxTimeoutMsSchema,
  AA_API_JWT_SECRET: ApiJwtSecretSchema,
  AA_SECURITY_ENFORCE_SANDBOX: SecurityEnforceSandboxSchema,
  AA_SECURITY_ALLOWED_HOSTS: SecurityAllowedHostsSchema,
  AA_REDIS_HOST: RedisHostSchema,
  AA_REDIS_PORT: RedisPortSchema,
  AA_BUILD_COMMIT: BuildCommitSchema,
  AA_BUILD_TIMESTAMP: BuildTimestampSchema,
  AA_BUILD_PROFILE: BuildProfileSchema,
  AA_BUILD_VERSION: BuildVersionSchema,
  AA_FEATURE_FLAGS: FeatureFlagsSchema,
  AA_ENABLED_EXTENSIONS: EnabledExtensionsSchema,
}).superRefine((value, ctx) => {
  if (value.AA_LOG_FILE_MAX_BYTES != null && !value.AA_LOG_FILE_PATH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AA_LOG_FILE_PATH"],
      message: "must be set when AA_LOG_FILE_MAX_BYTES is configured",
    });
  }
  if (value.AA_STORAGE_DRIVER === "postgres" && !value.AA_STORAGE_POSTGRES_DSN && !value.AA_PG_DSN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AA_STORAGE_POSTGRES_DSN"],
      message: "must be set when AA_STORAGE_DRIVER=postgres",
    });
  }
  if (value.AA_STORAGE_DRIVER === "postgres" && value.AA_STORAGE_POSTGRES_DSN && value.AA_PG_DSN && value.AA_STORAGE_POSTGRES_DSN !== value.AA_PG_DSN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AA_STORAGE_POSTGRES_DSN"],
      message: "must match AA_PG_DSN when both variables are configured",
    });
  }
  const pluginEgressEnabled =
    value.AA_PLUGIN_ALLOW_NETWORK_EGRESS === "1"
    || value.AA_PLUGIN_ALLOW_NETWORK_EGRESS === "true"
    || value.AA_PLUGIN_ALLOW_NETWORK_EGRESS === "yes"
    || value.AA_PLUGIN_ALLOW_NETWORK_EGRESS === "on";
  if (pluginEgressEnabled && !value.AA_PLUGIN_SANDBOX_ROOT) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AA_PLUGIN_SANDBOX_ROOT"],
      message: "must be set when plugin sandbox runtime is enabled",
    });
  }
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
    AA_LOG_LEVEL: env["AA_LOG_LEVEL"] ?? undefined,
    AA_LOG_FILE_PATH: env["AA_LOG_FILE_PATH"] ?? undefined,
    AA_LOG_FILE_MAX_BYTES: env["AA_LOG_FILE_MAX_BYTES"] ?? null,
    AA_LOG_FILE_MAX_FILES: env["AA_LOG_FILE_MAX_FILES"] ?? undefined,
    AA_LOG_FLUENTD_HOST: env["AA_LOG_FLUENTD_HOST"] ?? undefined,
    AA_LOG_FLUENTD_PORT: env["AA_LOG_FLUENTD_PORT"] ?? undefined,
    AA_LOG_FLUENTD_TAG: env["AA_LOG_FLUENTD_TAG"] ?? undefined,
    AA_LOG_DATADOG_API_KEY: env["AA_LOG_DATADOG_API_KEY"] ?? undefined,
    AA_LOG_DATADOG_SITE: env["AA_LOG_DATADOG_SITE"] ?? undefined,
    AA_LOG_DATADOG_SERVICE: env["AA_LOG_DATADOG_SERVICE"] ?? undefined,
    AA_API_KEYS_JSON: env["AA_API_KEYS_JSON"] ?? undefined,
    AA_WEBHOOK_SECRET: env["AA_WEBHOOK_SECRET"] ?? undefined,
    AA_API_ENABLE_WEBSOCKET: env["AA_API_ENABLE_WEBSOCKET"] ?? undefined,
    AA_METRICS_PORT: env["AA_METRICS_PORT"] ?? undefined,
    AA_STORAGE_DRIVER: env["AA_STORAGE_DRIVER"] ?? undefined,
    AA_STORAGE_POSTGRES_DSN: env["AA_STORAGE_POSTGRES_DSN"] ?? undefined,
    AA_PG_DSN: env["AA_PG_DSN"] ?? undefined,
    AA_MAX_AGENT_TOOL_CALLS: env["AA_MAX_AGENT_TOOL_CALLS"] ?? null,
    AA_MAX_AGENT_MEMORY_MB: env["AA_MAX_AGENT_MEMORY_MB"] ?? null,
    AA_MAX_AGENT_ELAPSED_MS: env["AA_MAX_AGENT_ELAPSED_MS"] ?? null,
    AA_OTEL_ENABLED: env["AA_OTEL_ENABLED"] ?? undefined,
    AA_OTEL_ENDPOINT: env["AA_OTEL_ENDPOINT"] ?? undefined,
    AA_OTEL_SERVICE_NAME: env["AA_OTEL_SERVICE_NAME"] ?? undefined,
    AA_OTEL_SERVICE_VERSION: env["AA_OTEL_SERVICE_VERSION"] ?? undefined,
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: env["AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION"] ?? null,
    AA_PLUGIN_REGISTRY_URL: env["AA_PLUGIN_REGISTRY_URL"] ?? undefined,
    AA_PLUGIN_ALLOW_UNVERIFIED: env["AA_PLUGIN_ALLOW_UNVERIFIED"] ?? undefined,
    AA_PLUGIN_SANDBOX_ROOT: env["AA_PLUGIN_SANDBOX_ROOT"] ?? undefined,
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: env["AA_PLUGIN_ALLOW_NETWORK_EGRESS"] ?? undefined,
    AA_PLUGIN_RUNTIME_ISOLATION: env["AA_PLUGIN_RUNTIME_ISOLATION"] ?? undefined,
    AA_SANDBOX_MAX_MEMORY_MB: env["AA_SANDBOX_MAX_MEMORY_MB"] ?? null,
    AA_SANDBOX_TIMEOUT_MS: env["AA_SANDBOX_TIMEOUT_MS"] ?? null,
    AA_API_JWT_SECRET: env["AA_API_JWT_SECRET"] ?? null,
    AA_SECURITY_ENFORCE_SANDBOX: env["AA_SECURITY_ENFORCE_SANDBOX"] ?? undefined,
    AA_SECURITY_ALLOWED_HOSTS: env["AA_SECURITY_ALLOWED_HOSTS"] ?? undefined,
    AA_REDIS_HOST: env["AA_REDIS_HOST"] ?? undefined,
    AA_REDIS_PORT: env["AA_REDIS_PORT"] ?? undefined,
    AA_BUILD_COMMIT: env["AA_BUILD_COMMIT"] ?? undefined,
    AA_BUILD_TIMESTAMP: env["AA_BUILD_TIMESTAMP"] ?? undefined,
    AA_BUILD_PROFILE: env["AA_BUILD_PROFILE"] ?? undefined,
    AA_BUILD_VERSION: env["AA_BUILD_VERSION"] ?? undefined,
    AA_FEATURE_FLAGS: env["AA_FEATURE_FLAGS"] ?? undefined,
    AA_ENABLED_EXTENSIONS: env["AA_ENABLED_EXTENSIONS"] ?? undefined,
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
    ...result.errors.map((e) => `  ${e.key}: invalid`),
    "",
    "Fix the environment variables above and restart the process.",
    "See: docs_zh/operations/environment-variables.md",
  ];

  logger.error("startup_env.validation_failed", {
    errors: result.errors,
    messageLines: lines,
    docsPath: "docs_zh/operations/environment-variables.md",
  });
  process.exit(1);
}
