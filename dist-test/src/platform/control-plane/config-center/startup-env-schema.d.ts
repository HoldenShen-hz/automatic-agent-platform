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
/**
 * Schema for AA_DB_PATH — SQLite database file path.
 * Required: the process cannot start without a valid database path.
 */
export declare const DbPathSchema: z.ZodString;
/**
 * Schema for AA_CONFIG_ENV — deployment environment name.
 * Required: defaults to "prod" (fail-closed) per CFG-01.
 * Invalid values are rejected — no silent fallback.
 */
export declare const ConfigEnvSchema: z.ZodEnum<["dev", "test", "staging", "pre-prod", "prod", "development", "production"]>;
/**
 * Schema for AA_CONFIG_ROOT — configuration directory root.
 * Optional: falls back to {cwd}/config if not set.
 */
export declare const ConfigRootSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_API_PORT — HTTP API server port.
 * Optional: falls back to dynamic port selection if not set.
 * Must be in range 1-65535 if provided.
 */
export declare const ApiPortSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_API_HOST — HTTP API server bind address.
 * Optional: defaults to all interfaces if not set.
 */
export declare const ApiHostSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_LOG_STDOUT — enable structured JSON logging to stdout.
 * Optional: defaults to false.
 */
export declare const LogStdoutSchema: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
export declare const LogLevelSchema: z.ZodOptional<z.ZodEnum<["trace", "debug", "info", "warn", "error", "fatal"]>>;
/**
 * Schema for AA_LOG_FILE_MAX_BYTES — log file max size before rotation.
 * Optional: requires AA_LOG_FILE_PATH to also be set.
 */
export declare const LogFileMaxBytesSchema: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_LOG_FILE_MAX_FILES — number of rotated log files to retain.
 * Optional: defaults to 5.
 */
export declare const LogFileMaxFilesSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_LOG_FILE_PATH — file path for structured JSON logging.
 * Optional: required when AA_LOG_FILE_MAX_BYTES is set.
 */
export declare const LogFilePathSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_LOG_FLUENTD_HOST — Fluentd server hostname.
 * Optional: all fluentd settings must be present together.
 */
export declare const LogFluentdHostSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_LOG_FLUENTD_PORT — Fluentd server port.
 * Optional: all fluentd settings must be present together.
 */
export declare const LogFluentdPortSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_LOG_FLUENTD_TAG — Fluentd tag for log routing.
 * Optional: all fluentd settings must be present together.
 */
export declare const LogFluentdTagSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_LOG_DATADOG_API_KEY — Datadog API key.
 * Optional: all datadog settings must be present together.
 */
export declare const LogDatadogApiKeySchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_LOG_DATADOG_SITE — Datadog site (e.g., datadoghq.com, datadoghq.eu).
 * Optional: all datadog settings must be present together.
 */
export declare const LogDatadogSiteSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_LOG_DATADOG_SERVICE — Datadog service name.
 * Optional: all datadog settings must be present together.
 */
export declare const LogDatadogServiceSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_API_KEYS_JSON — JSON array of API key records.
 * Optional: must parse as a JSON array.
 */
export declare const ApiKeysJsonSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_WEBHOOK_SECRET — secret for webhook signature verification.
 * Optional: used when webhook endpoints are configured.
 */
export declare const WebhookSecretSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_API_ENABLE_WEBSOCKET — enable WebSocket bridge on API server.
 * Optional: defaults to true.
 */
export declare const ApiEnableWebSocketSchema: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
/**
 * Schema for AA_METRICS_PORT — dedicated metrics server port.
 * Optional: must be in range 1-65535 if provided.
 */
export declare const MetricsPortSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_MAX_AGENT_TOOL_CALLS — maximum tool calls per agent task.
 * Optional: null means unlimited.
 */
export declare const MaxAgentToolCallsSchema: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_MAX_AGENT_MEMORY_MB — maximum memory (MB) per agent task.
 * Optional: null means unlimited.
 */
export declare const MaxAgentMemoryMbSchema: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_MAX_AGENT_ELAPSED_MS — maximum wall-clock time per agent task.
 * Optional: null means unlimited.
 */
export declare const MaxAgentElapsedMsSchema: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_OTEL_ENABLED — whether to bootstrap OpenTelemetry.
 * Optional: defaults to true.
 */
export declare const OtelEnabledSchema: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
/**
 * Schema for AA_OTEL_ENDPOINT — OTLP exporter endpoint URL.
 * Required when AA_OTEL_ENABLED is true.
 */
export declare const OtelEndpointSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_OTEL_SERVICE_NAME — logical service name for OTEL.
 * Optional: defaults to "automatic-agent".
 */
export declare const OtelServiceNameSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_OTEL_SERVICE_VERSION — service version for OTEL.
 * Optional: defaults to AA_BUILD_VERSION or "0.1.0".
 */
export declare const OtelServiceVersionSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION — expected governance version.
 * Optional: null means skip tamper detection.
 */
export declare const ExpectedGovernanceVersionSchema: z.ZodNullable<z.ZodString>;
/**
 * Schema for AA_PLUGIN_REGISTRY_URL — plugin registry endpoint.
 * Optional: defaults to built-in plugin catalog.
 */
export declare const PluginRegistryUrlSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_PLUGIN_ALLOW_UNVERIFIED — allow loading plugins without signature verification.
 * Optional: defaults to false in production.
 */
export declare const PluginAllowUnverifiedSchema: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
export declare const PluginSandboxRootSchema: z.ZodOptional<z.ZodString>;
export declare const PluginAllowNetworkEgressSchema: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
export declare const PluginRuntimeIsolationSchema: z.ZodOptional<z.ZodEnum<["shared_process", "serialized_in_process", "forked_process", "sandboxed_process", "containerized_process"]>>;
/**
 * Schema for AA_SANDBOX_MAX_MEMORY_MB — maximum memory per sandboxed execution.
 * Optional: null means use platform default.
 */
export declare const SandboxMaxMemoryMbSchema: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_SANDBOX_TIMEOUT_MS — maximum time for sandboxed execution.
 * Optional: null means use platform default.
 */
export declare const SandboxTimeoutMsSchema: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
/**
 * Schema for AA_API_JWT_SECRET — JWT signing secret for API authentication.
 * Optional: null means use shared secret from config center.
 */
export declare const ApiJwtSecretSchema: z.ZodNullable<z.ZodString>;
/**
 * Schema for AA_SECURITY_ENFORCE_SANDBOX — enforce sandbox isolation for all executions.
 * Optional: defaults to true in prod, false in dev.
 */
export declare const SecurityEnforceSandboxSchema: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
/**
 * Schema for AA_SECURITY_ALLOWED_HOSTS — comma-separated list of allowed request origins.
 * Optional: defaults to all origins in dev, specific hosts in prod.
 */
export declare const SecurityAllowedHostsSchema: z.ZodOptional<z.ZodString>;
export declare const StorageDriverSchema: z.ZodOptional<z.ZodEnum<["sqlite", "postgres"]>>;
export declare const PostgresDsnSchema: z.ZodOptional<z.ZodString>;
export declare const BuildCommitSchema: z.ZodOptional<z.ZodString>;
export declare const BuildTimestampSchema: z.ZodOptional<z.ZodString>;
export declare const BuildProfileSchema: z.ZodOptional<z.ZodString>;
export declare const BuildVersionSchema: z.ZodOptional<z.ZodString>;
export declare const FeatureFlagsSchema: z.ZodOptional<z.ZodString>;
export declare const EnabledExtensionsSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_REDIS_HOST — Redis server hostname.
 * Optional: defaults to localhost.
 */
export declare const RedisHostSchema: z.ZodOptional<z.ZodString>;
/**
 * Schema for AA_REDIS_PORT — Redis server port.
 * Optional: defaults to 6379.
 */
export declare const RedisPortSchema: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
export declare const StartupEnvSchema: z.ZodEffects<z.ZodObject<{
    AA_DB_PATH: z.ZodString;
    AA_CONFIG_ENV: z.ZodDefault<z.ZodEnum<["dev", "test", "staging", "pre-prod", "prod", "development", "production"]>>;
    AA_CONFIG_ROOT: z.ZodOptional<z.ZodString>;
    AA_API_PORT: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_API_HOST: z.ZodOptional<z.ZodString>;
    AA_LOG_STDOUT: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_LOG_LEVEL: z.ZodOptional<z.ZodEnum<["trace", "debug", "info", "warn", "error", "fatal"]>>;
    AA_LOG_FILE_PATH: z.ZodOptional<z.ZodString>;
    AA_LOG_FILE_MAX_BYTES: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_LOG_FILE_MAX_FILES: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_LOG_FLUENTD_HOST: z.ZodOptional<z.ZodString>;
    AA_LOG_FLUENTD_PORT: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_LOG_FLUENTD_TAG: z.ZodOptional<z.ZodString>;
    AA_LOG_DATADOG_API_KEY: z.ZodOptional<z.ZodString>;
    AA_LOG_DATADOG_SITE: z.ZodOptional<z.ZodString>;
    AA_LOG_DATADOG_SERVICE: z.ZodOptional<z.ZodString>;
    AA_API_KEYS_JSON: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_WEBHOOK_SECRET: z.ZodOptional<z.ZodString>;
    AA_API_ENABLE_WEBSOCKET: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_METRICS_PORT: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_STORAGE_DRIVER: z.ZodOptional<z.ZodEnum<["sqlite", "postgres"]>>;
    AA_STORAGE_POSTGRES_DSN: z.ZodOptional<z.ZodString>;
    AA_PG_DSN: z.ZodOptional<z.ZodString>;
    AA_MAX_AGENT_TOOL_CALLS: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_MAX_AGENT_MEMORY_MB: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_MAX_AGENT_ELAPSED_MS: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_OTEL_ENABLED: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_OTEL_ENDPOINT: z.ZodOptional<z.ZodString>;
    AA_OTEL_SERVICE_NAME: z.ZodOptional<z.ZodString>;
    AA_OTEL_SERVICE_VERSION: z.ZodOptional<z.ZodString>;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: z.ZodNullable<z.ZodString>;
    AA_PLUGIN_REGISTRY_URL: z.ZodOptional<z.ZodString>;
    AA_PLUGIN_ALLOW_UNVERIFIED: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_PLUGIN_SANDBOX_ROOT: z.ZodOptional<z.ZodString>;
    AA_PLUGIN_ALLOW_NETWORK_EGRESS: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_PLUGIN_RUNTIME_ISOLATION: z.ZodOptional<z.ZodEnum<["shared_process", "serialized_in_process", "forked_process", "sandboxed_process", "containerized_process"]>>;
    AA_SANDBOX_MAX_MEMORY_MB: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_SANDBOX_TIMEOUT_MS: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_API_JWT_SECRET: z.ZodNullable<z.ZodString>;
    AA_SECURITY_ENFORCE_SANDBOX: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_SECURITY_ALLOWED_HOSTS: z.ZodOptional<z.ZodString>;
    AA_REDIS_HOST: z.ZodOptional<z.ZodString>;
    AA_REDIS_PORT: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_BUILD_COMMIT: z.ZodOptional<z.ZodString>;
    AA_BUILD_TIMESTAMP: z.ZodOptional<z.ZodString>;
    AA_BUILD_PROFILE: z.ZodOptional<z.ZodString>;
    AA_BUILD_VERSION: z.ZodOptional<z.ZodString>;
    AA_FEATURE_FLAGS: z.ZodOptional<z.ZodString>;
    AA_ENABLED_EXTENSIONS: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    AA_DB_PATH: string;
    AA_CONFIG_ENV: "dev" | "test" | "staging" | "pre-prod" | "prod" | "development" | "production";
    AA_LOG_FILE_MAX_BYTES: string | null;
    AA_MAX_AGENT_TOOL_CALLS: string | null;
    AA_MAX_AGENT_MEMORY_MB: string | null;
    AA_MAX_AGENT_ELAPSED_MS: string | null;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: string | null;
    AA_SANDBOX_MAX_MEMORY_MB: string | null;
    AA_SANDBOX_TIMEOUT_MS: string | null;
    AA_API_JWT_SECRET: string | null;
    AA_PLUGIN_RUNTIME_ISOLATION?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
    AA_PLUGIN_ALLOW_NETWORK_EGRESS?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_PLUGIN_SANDBOX_ROOT?: string | undefined;
    AA_CONFIG_ROOT?: string | undefined;
    AA_API_PORT?: string | undefined;
    AA_API_HOST?: string | undefined;
    AA_LOG_STDOUT?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_LOG_LEVEL?: "debug" | "info" | "warn" | "error" | "trace" | "fatal" | undefined;
    AA_LOG_FILE_PATH?: string | undefined;
    AA_LOG_FILE_MAX_FILES?: string | undefined;
    AA_LOG_FLUENTD_HOST?: string | undefined;
    AA_LOG_FLUENTD_PORT?: string | undefined;
    AA_LOG_FLUENTD_TAG?: string | undefined;
    AA_LOG_DATADOG_API_KEY?: string | undefined;
    AA_LOG_DATADOG_SITE?: string | undefined;
    AA_LOG_DATADOG_SERVICE?: string | undefined;
    AA_API_KEYS_JSON?: string | undefined;
    AA_WEBHOOK_SECRET?: string | undefined;
    AA_API_ENABLE_WEBSOCKET?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_METRICS_PORT?: string | undefined;
    AA_STORAGE_DRIVER?: "sqlite" | "postgres" | undefined;
    AA_STORAGE_POSTGRES_DSN?: string | undefined;
    AA_PG_DSN?: string | undefined;
    AA_OTEL_ENABLED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_OTEL_ENDPOINT?: string | undefined;
    AA_OTEL_SERVICE_NAME?: string | undefined;
    AA_OTEL_SERVICE_VERSION?: string | undefined;
    AA_PLUGIN_REGISTRY_URL?: string | undefined;
    AA_PLUGIN_ALLOW_UNVERIFIED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ENFORCE_SANDBOX?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ALLOWED_HOSTS?: string | undefined;
    AA_REDIS_HOST?: string | undefined;
    AA_REDIS_PORT?: string | undefined;
    AA_BUILD_COMMIT?: string | undefined;
    AA_BUILD_TIMESTAMP?: string | undefined;
    AA_BUILD_PROFILE?: string | undefined;
    AA_BUILD_VERSION?: string | undefined;
    AA_FEATURE_FLAGS?: string | undefined;
    AA_ENABLED_EXTENSIONS?: string | undefined;
}, {
    AA_DB_PATH: string;
    AA_LOG_FILE_MAX_BYTES: string | null;
    AA_MAX_AGENT_TOOL_CALLS: string | null;
    AA_MAX_AGENT_MEMORY_MB: string | null;
    AA_MAX_AGENT_ELAPSED_MS: string | null;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: string | null;
    AA_SANDBOX_MAX_MEMORY_MB: string | null;
    AA_SANDBOX_TIMEOUT_MS: string | null;
    AA_API_JWT_SECRET: string | null;
    AA_PLUGIN_RUNTIME_ISOLATION?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
    AA_PLUGIN_ALLOW_NETWORK_EGRESS?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_PLUGIN_SANDBOX_ROOT?: string | undefined;
    AA_CONFIG_ENV?: "dev" | "test" | "staging" | "pre-prod" | "prod" | "development" | "production" | undefined;
    AA_CONFIG_ROOT?: string | undefined;
    AA_API_PORT?: string | undefined;
    AA_API_HOST?: string | undefined;
    AA_LOG_STDOUT?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_LOG_LEVEL?: "debug" | "info" | "warn" | "error" | "trace" | "fatal" | undefined;
    AA_LOG_FILE_PATH?: string | undefined;
    AA_LOG_FILE_MAX_FILES?: string | undefined;
    AA_LOG_FLUENTD_HOST?: string | undefined;
    AA_LOG_FLUENTD_PORT?: string | undefined;
    AA_LOG_FLUENTD_TAG?: string | undefined;
    AA_LOG_DATADOG_API_KEY?: string | undefined;
    AA_LOG_DATADOG_SITE?: string | undefined;
    AA_LOG_DATADOG_SERVICE?: string | undefined;
    AA_API_KEYS_JSON?: string | undefined;
    AA_WEBHOOK_SECRET?: string | undefined;
    AA_API_ENABLE_WEBSOCKET?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_METRICS_PORT?: string | undefined;
    AA_STORAGE_DRIVER?: "sqlite" | "postgres" | undefined;
    AA_STORAGE_POSTGRES_DSN?: string | undefined;
    AA_PG_DSN?: string | undefined;
    AA_OTEL_ENABLED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_OTEL_ENDPOINT?: string | undefined;
    AA_OTEL_SERVICE_NAME?: string | undefined;
    AA_OTEL_SERVICE_VERSION?: string | undefined;
    AA_PLUGIN_REGISTRY_URL?: string | undefined;
    AA_PLUGIN_ALLOW_UNVERIFIED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ENFORCE_SANDBOX?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ALLOWED_HOSTS?: string | undefined;
    AA_REDIS_HOST?: string | undefined;
    AA_REDIS_PORT?: string | undefined;
    AA_BUILD_COMMIT?: string | undefined;
    AA_BUILD_TIMESTAMP?: string | undefined;
    AA_BUILD_PROFILE?: string | undefined;
    AA_BUILD_VERSION?: string | undefined;
    AA_FEATURE_FLAGS?: string | undefined;
    AA_ENABLED_EXTENSIONS?: string | undefined;
}>, {
    AA_DB_PATH: string;
    AA_CONFIG_ENV: "dev" | "test" | "staging" | "pre-prod" | "prod" | "development" | "production";
    AA_LOG_FILE_MAX_BYTES: string | null;
    AA_MAX_AGENT_TOOL_CALLS: string | null;
    AA_MAX_AGENT_MEMORY_MB: string | null;
    AA_MAX_AGENT_ELAPSED_MS: string | null;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: string | null;
    AA_SANDBOX_MAX_MEMORY_MB: string | null;
    AA_SANDBOX_TIMEOUT_MS: string | null;
    AA_API_JWT_SECRET: string | null;
    AA_PLUGIN_RUNTIME_ISOLATION?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
    AA_PLUGIN_ALLOW_NETWORK_EGRESS?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_PLUGIN_SANDBOX_ROOT?: string | undefined;
    AA_CONFIG_ROOT?: string | undefined;
    AA_API_PORT?: string | undefined;
    AA_API_HOST?: string | undefined;
    AA_LOG_STDOUT?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_LOG_LEVEL?: "debug" | "info" | "warn" | "error" | "trace" | "fatal" | undefined;
    AA_LOG_FILE_PATH?: string | undefined;
    AA_LOG_FILE_MAX_FILES?: string | undefined;
    AA_LOG_FLUENTD_HOST?: string | undefined;
    AA_LOG_FLUENTD_PORT?: string | undefined;
    AA_LOG_FLUENTD_TAG?: string | undefined;
    AA_LOG_DATADOG_API_KEY?: string | undefined;
    AA_LOG_DATADOG_SITE?: string | undefined;
    AA_LOG_DATADOG_SERVICE?: string | undefined;
    AA_API_KEYS_JSON?: string | undefined;
    AA_WEBHOOK_SECRET?: string | undefined;
    AA_API_ENABLE_WEBSOCKET?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_METRICS_PORT?: string | undefined;
    AA_STORAGE_DRIVER?: "sqlite" | "postgres" | undefined;
    AA_STORAGE_POSTGRES_DSN?: string | undefined;
    AA_PG_DSN?: string | undefined;
    AA_OTEL_ENABLED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_OTEL_ENDPOINT?: string | undefined;
    AA_OTEL_SERVICE_NAME?: string | undefined;
    AA_OTEL_SERVICE_VERSION?: string | undefined;
    AA_PLUGIN_REGISTRY_URL?: string | undefined;
    AA_PLUGIN_ALLOW_UNVERIFIED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ENFORCE_SANDBOX?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ALLOWED_HOSTS?: string | undefined;
    AA_REDIS_HOST?: string | undefined;
    AA_REDIS_PORT?: string | undefined;
    AA_BUILD_COMMIT?: string | undefined;
    AA_BUILD_TIMESTAMP?: string | undefined;
    AA_BUILD_PROFILE?: string | undefined;
    AA_BUILD_VERSION?: string | undefined;
    AA_FEATURE_FLAGS?: string | undefined;
    AA_ENABLED_EXTENSIONS?: string | undefined;
}, {
    AA_DB_PATH: string;
    AA_LOG_FILE_MAX_BYTES: string | null;
    AA_MAX_AGENT_TOOL_CALLS: string | null;
    AA_MAX_AGENT_MEMORY_MB: string | null;
    AA_MAX_AGENT_ELAPSED_MS: string | null;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: string | null;
    AA_SANDBOX_MAX_MEMORY_MB: string | null;
    AA_SANDBOX_TIMEOUT_MS: string | null;
    AA_API_JWT_SECRET: string | null;
    AA_PLUGIN_RUNTIME_ISOLATION?: "shared_process" | "serialized_in_process" | "forked_process" | "sandboxed_process" | "containerized_process" | undefined;
    AA_PLUGIN_ALLOW_NETWORK_EGRESS?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_PLUGIN_SANDBOX_ROOT?: string | undefined;
    AA_CONFIG_ENV?: "dev" | "test" | "staging" | "pre-prod" | "prod" | "development" | "production" | undefined;
    AA_CONFIG_ROOT?: string | undefined;
    AA_API_PORT?: string | undefined;
    AA_API_HOST?: string | undefined;
    AA_LOG_STDOUT?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_LOG_LEVEL?: "debug" | "info" | "warn" | "error" | "trace" | "fatal" | undefined;
    AA_LOG_FILE_PATH?: string | undefined;
    AA_LOG_FILE_MAX_FILES?: string | undefined;
    AA_LOG_FLUENTD_HOST?: string | undefined;
    AA_LOG_FLUENTD_PORT?: string | undefined;
    AA_LOG_FLUENTD_TAG?: string | undefined;
    AA_LOG_DATADOG_API_KEY?: string | undefined;
    AA_LOG_DATADOG_SITE?: string | undefined;
    AA_LOG_DATADOG_SERVICE?: string | undefined;
    AA_API_KEYS_JSON?: string | undefined;
    AA_WEBHOOK_SECRET?: string | undefined;
    AA_API_ENABLE_WEBSOCKET?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_METRICS_PORT?: string | undefined;
    AA_STORAGE_DRIVER?: "sqlite" | "postgres" | undefined;
    AA_STORAGE_POSTGRES_DSN?: string | undefined;
    AA_PG_DSN?: string | undefined;
    AA_OTEL_ENABLED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_OTEL_ENDPOINT?: string | undefined;
    AA_OTEL_SERVICE_NAME?: string | undefined;
    AA_OTEL_SERVICE_VERSION?: string | undefined;
    AA_PLUGIN_REGISTRY_URL?: string | undefined;
    AA_PLUGIN_ALLOW_UNVERIFIED?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ENFORCE_SANDBOX?: "0" | "1" | "off" | "true" | "yes" | "on" | "false" | "no" | undefined;
    AA_SECURITY_ALLOWED_HOSTS?: string | undefined;
    AA_REDIS_HOST?: string | undefined;
    AA_REDIS_PORT?: string | undefined;
    AA_BUILD_COMMIT?: string | undefined;
    AA_BUILD_TIMESTAMP?: string | undefined;
    AA_BUILD_PROFILE?: string | undefined;
    AA_BUILD_VERSION?: string | undefined;
    AA_FEATURE_FLAGS?: string | undefined;
    AA_ENABLED_EXTENSIONS?: string | undefined;
}>;
export type StartupEnv = z.infer<typeof StartupEnvSchema>;
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
export declare function validateStartupEnv(env?: NodeJS.ProcessEnv): StartupEnvValidationResult;
/**
 * Validates startup env vars and exits process if validation fails.
 * Designed to be called at the top of main() in CLI entry points.
 */
export declare function requireValidStartupEnv(env?: NodeJS.ProcessEnv): void;
