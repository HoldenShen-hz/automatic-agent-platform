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
export declare const ConfigEnvSchema: z.ZodEnum<["dev", "test", "staging", "pre-prod", "prod"]>;
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
 * Optional: defaults to false.
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
export declare const StartupEnvSchema: z.ZodObject<{
    AA_DB_PATH: z.ZodString;
    AA_CONFIG_ENV: z.ZodDefault<z.ZodEnum<["dev", "test", "staging", "pre-prod", "prod"]>>;
    AA_CONFIG_ROOT: z.ZodOptional<z.ZodString>;
    AA_API_PORT: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_API_HOST: z.ZodOptional<z.ZodString>;
    AA_LOG_STDOUT: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_LOG_FILE_MAX_BYTES: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_LOG_FILE_MAX_FILES: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    AA_MAX_AGENT_TOOL_CALLS: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_MAX_AGENT_MEMORY_MB: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_MAX_AGENT_ELAPSED_MS: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    AA_OTEL_ENABLED: z.ZodOptional<z.ZodEnum<["1", "true", "yes", "on", "0", "false", "no", "off"]>>;
    AA_OTEL_ENDPOINT: z.ZodOptional<z.ZodString>;
    AA_OTEL_SERVICE_NAME: z.ZodOptional<z.ZodString>;
    AA_OTEL_SERVICE_VERSION: z.ZodOptional<z.ZodString>;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    AA_DB_PATH: string;
    AA_CONFIG_ENV: "dev" | "test" | "staging" | "pre-prod" | "prod";
    AA_LOG_FILE_MAX_BYTES: string | null;
    AA_MAX_AGENT_TOOL_CALLS: string | null;
    AA_MAX_AGENT_MEMORY_MB: string | null;
    AA_MAX_AGENT_ELAPSED_MS: string | null;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: string | null;
    AA_CONFIG_ROOT?: string | undefined;
    AA_API_PORT?: string | undefined;
    AA_API_HOST?: string | undefined;
    AA_LOG_STDOUT?: "0" | "1" | "true" | "yes" | "on" | "false" | "no" | "off" | undefined;
    AA_LOG_FILE_MAX_FILES?: string | undefined;
    AA_OTEL_ENABLED?: "0" | "1" | "true" | "yes" | "on" | "false" | "no" | "off" | undefined;
    AA_OTEL_ENDPOINT?: string | undefined;
    AA_OTEL_SERVICE_NAME?: string | undefined;
    AA_OTEL_SERVICE_VERSION?: string | undefined;
}, {
    AA_DB_PATH: string;
    AA_LOG_FILE_MAX_BYTES: string | null;
    AA_MAX_AGENT_TOOL_CALLS: string | null;
    AA_MAX_AGENT_MEMORY_MB: string | null;
    AA_MAX_AGENT_ELAPSED_MS: string | null;
    AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION: string | null;
    AA_CONFIG_ENV?: "dev" | "test" | "staging" | "pre-prod" | "prod" | undefined;
    AA_CONFIG_ROOT?: string | undefined;
    AA_API_PORT?: string | undefined;
    AA_API_HOST?: string | undefined;
    AA_LOG_STDOUT?: "0" | "1" | "true" | "yes" | "on" | "false" | "no" | "off" | undefined;
    AA_LOG_FILE_MAX_FILES?: string | undefined;
    AA_OTEL_ENABLED?: "0" | "1" | "true" | "yes" | "on" | "false" | "no" | "off" | undefined;
    AA_OTEL_ENDPOINT?: string | undefined;
    AA_OTEL_SERVICE_NAME?: string | undefined;
    AA_OTEL_SERVICE_VERSION?: string | undefined;
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
