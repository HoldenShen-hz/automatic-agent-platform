import type { ApiKeyRecord } from "../../five-plane-interface/api/api-auth-service.js";
import { ValidationError } from "../../contracts/errors.js";
import { loadGatewayEnv, readTrimmedEnv, type GatewayEnvConfig } from "./gateway-env.js";
import type { DatadogTransportConfig } from "../../shared/observability/transports/datadog-transport.js";
import type { FluentdTransportConfig } from "../../shared/observability/transports/fluentd-transport.js";

/**
 * Environment configuration for the API server.
 * Loaded from environment variables at startup to configure database access,
 * authentication, logging, and webhook integrations.
 */
export interface ApiServerEnvConfig {
  /** Path to the SQLite database file (optional, falls back to default) */
  dbPath?: string;
  /** API keys for authenticating clients, each with associated actor and roles */
  apiKeys: ApiKeyRecord[];
  /** Secret key for signing JWT tokens (required when API keys are configured) */
  jwtSecret: string | null;
  /** Host address to bind the API server (optional) */
  apiHost?: string;
  /** Port number to listen on (optional) */
  apiPort?: number;
  /** Gateway configuration for external integrations (webhooks, notifications) */
  gateway: GatewayEnvConfig;
  /** Shared secret for verifying incoming webhooks */
  webhookSecret: string | null;
  /** File path for structured JSON logging (optional) */
  logFilePath: string | null;
  /** Maximum size in bytes before log file rotation */
  logFileMaxBytes: number | null;
  /** Number of rotated log files to retain */
  logFileMaxFiles: number;
  /** Enable stdout structured logs for container collection */
  logStdout: boolean;
  /** Optional Fluentd transport configuration */
  logFluentd: FluentdTransportConfig | null;
  /** Optional Datadog transport configuration */
  logDatadog: DatadogTransportConfig | null;
  /** Whether to enable the WebSocket bridge on the API server */
  enableWebSocket: boolean;
  /** Optional dedicated metrics server port */
  metricsPort?: number;
  /** Optional dedicated metrics server host. Defaults to loopback. */
  metricsHost?: string;
  /** Whether to bootstrap OpenTelemetry */
  otelEnabled: boolean;
  /** OTLP endpoint for traces */
  otelEndpoint: string | null;
  /** Logical service name reported to OpenTelemetry */
  otelServiceName: string;
  /** Logical service version reported to OpenTelemetry */
  otelServiceVersion: string;
}

/**
 * Parses and validates a port number from environment variables.
 * Port must be a positive integer between 1 and 65535.
 */
function parsePositivePort(raw: string | null): number | undefined {
  if (raw == null) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new ValidationError("api.invalid_port", "api.invalid_port");
  }
  return parsed;
}

/**
 * Parses a positive integer from environment variables with error code on failure.
 * Used for size limits like max bytes and max files.
 */
function parsePositiveInteger(raw: string | null, errorCode: string): number | null {
  if (raw == null) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(errorCode, errorCode);
  }
  return parsed;
}

function parseBoolean(raw: string | null, errorCode: string): boolean | undefined {
  if (raw == null) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new ValidationError(errorCode, errorCode);
}

/**
 * Parses the API keys JSON environment variable into structured records.
 * Each key must have apiKey, actorId, and roles properties.
 */
function parseApiKeys(raw: string | null): ApiKeyRecord[] {
  if (raw == null) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new ValidationError("api.invalid_api_keys_json", "api.invalid_api_keys_json");
  }
  return parsed.map((item) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError("api.invalid_api_key_record", "api.invalid_api_key_record");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.apiKey !== "string" || typeof record.actorId !== "string" || !Array.isArray(record.roles)) {
      throw new ValidationError("api.invalid_api_key_record", "api.invalid_api_key_record");
    }
    if (record.tenantId != null && typeof record.tenantId !== "string") {
      throw new ValidationError("api.invalid_api_key_tenant_id", "api.invalid_api_key_tenant_id");
    }
    return {
      apiKey: record.apiKey,
      actorId: record.actorId,
      roles: record.roles,
      ...(typeof record.tenantId === "string" ? { tenantId: record.tenantId } : {}),
    } as ApiKeyRecord;
  });
}

/**
 * Validates the JWT secret configuration.
 * Requires the secret when API keys are present, and enforces minimum length
 * and character diversity (lowercase, uppercase, digits, special characters).
 */
function validateJwtSecret(secret: string | null, apiKeys: ApiKeyRecord[]): string | null {
  if (apiKeys.length > 0 && secret == null) {
    throw new ValidationError("api.jwt_secret_required", "api.jwt_secret_required");
  }
  if (secret == null) {
    return null;
  }
  if (secret.length < 32) {
    throw new ValidationError("api.jwt_secret_too_short", "api.jwt_secret_too_short");
  }
  let categoryCount = 0;
  if (/[a-z]/.test(secret)) {
    categoryCount++;
  }
  if (/[A-Z]/.test(secret)) {
    categoryCount++;
  }
  if (/[0-9]/.test(secret)) {
    categoryCount++;
  }
  if (/[^a-zA-Z0-9]/.test(secret)) {
    categoryCount++;
  }
  if (categoryCount < 3) {
    throw new ValidationError("api.jwt_secret_low_entropy", "api.jwt_secret_low_entropy");
  }
  return secret;
}

/**
 * Loads and validates the complete API server environment configuration.
 * Reads from standard environment variables and validates all settings
 * before returning a typed configuration object.
 */
export function loadApiServerEnv(env: NodeJS.ProcessEnv = process.env): ApiServerEnvConfig {
  const apiKeys = parseApiKeys(readTrimmedEnv(env, "AA_API_KEYS_JSON"));
  const jwtSecret = validateJwtSecret(readTrimmedEnv(env, "AA_API_JWT_SECRET"), apiKeys);
  const dbPath = readTrimmedEnv(env, "AA_DB_PATH");
  const apiHost = readTrimmedEnv(env, "AA_API_HOST");
  const apiPort = parsePositivePort(readTrimmedEnv(env, "AA_API_PORT"));
  const logFilePath = readTrimmedEnv(env, "AA_LOG_FILE_PATH");
  const logFileMaxBytes = parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_FILE_MAX_BYTES"), "api.invalid_log_file_max_bytes");
  const logFileMaxFiles = parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_FILE_MAX_FILES"), "api.invalid_log_file_max_files") ?? 5;
  const logStdout = parseBoolean(readTrimmedEnv(env, "AA_LOG_STDOUT"), "api.invalid_log_stdout") ?? false;
  const fluentdHost = readTrimmedEnv(env, "AA_LOG_FLUENTD_HOST");
  const fluentdPort = parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_FLUENTD_PORT"), "api.invalid_log_fluentd_port");
  const fluentdTag = readTrimmedEnv(env, "AA_LOG_FLUENTD_TAG");
  const fluentdReconnectIntervalMs =
    parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_FLUENTD_RECONNECT_INTERVAL_MS"), "api.invalid_log_fluentd_reconnect_interval_ms") ?? undefined;
  const fluentdBufferLimit =
    parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_FLUENTD_BUFFER_LIMIT"), "api.invalid_log_fluentd_buffer_limit") ?? undefined;
  const datadogApiKey = readTrimmedEnv(env, "AA_LOG_DATADOG_API_KEY");
  const datadogSite = readTrimmedEnv(env, "AA_LOG_DATADOG_SITE") ?? undefined;
  const datadogService = readTrimmedEnv(env, "AA_LOG_DATADOG_SERVICE");
  const datadogSource = readTrimmedEnv(env, "AA_LOG_DATADOG_SOURCE") ?? undefined;
  const datadogBatchSize =
    parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_DATADOG_BATCH_SIZE"), "api.invalid_log_datadog_batch_size") ?? undefined;
  const datadogFlushIntervalMs =
    parsePositiveInteger(readTrimmedEnv(env, "AA_LOG_DATADOG_FLUSH_INTERVAL_MS"), "api.invalid_log_datadog_flush_interval_ms") ?? undefined;
  const enableWebSocket = parseBoolean(readTrimmedEnv(env, "AA_API_ENABLE_WEBSOCKET"), "api.invalid_enable_websocket") ?? true;
  const metricsPort = parsePositivePort(readTrimmedEnv(env, "AA_METRICS_PORT"));
  const metricsHost = readTrimmedEnv(env, "AA_METRICS_HOST");
  const otelEnabled = parseBoolean(readTrimmedEnv(env, "AA_OTEL_ENABLED"), "api.invalid_otel_enabled") ?? true;
  const otelEndpoint = readTrimmedEnv(env, "AA_OTEL_ENDPOINT");
  const otelServiceName = readTrimmedEnv(env, "AA_OTEL_SERVICE_NAME") ?? "automatic-agent";
  const otelServiceVersion = readTrimmedEnv(env, "AA_OTEL_SERVICE_VERSION") ?? (env["AA_BUILD_VERSION"]?.trim() || "0.1.0");

  if ([fluentdHost, fluentdPort, fluentdTag].some((value) => value != null) && [fluentdHost, fluentdPort, fluentdTag].some((value) => value == null)) {
    throw new ValidationError("api.incomplete_log_fluentd_config", "api.incomplete_log_fluentd_config");
  }
  if ([datadogApiKey, datadogService].some((value) => value != null) && [datadogApiKey, datadogService].some((value) => value == null)) {
    throw new ValidationError("api.incomplete_log_datadog_config", "api.incomplete_log_datadog_config");
  }

  return {
    ...(dbPath ? { dbPath } : {}),
    apiKeys,
    jwtSecret,
    ...(apiHost ? { apiHost } : {}),
    ...(apiPort !== undefined ? { apiPort } : {}),
    gateway: loadGatewayEnv(env, {
      invalidWebhookHeadersCode: "api.invalid_gateway_webhook_headers_json",
    }),
    webhookSecret: readTrimmedEnv(env, "AA_WEBHOOK_SECRET"),
    logFilePath,
    logFileMaxBytes: logFilePath == null ? null : logFileMaxBytes,
    logFileMaxFiles,
    logStdout,
    logFluentd:
      fluentdHost == null || fluentdPort == null || fluentdTag == null
        ? null
        : {
          host: fluentdHost,
          port: fluentdPort,
          tag: fluentdTag,
          ...(fluentdReconnectIntervalMs != null ? { reconnectIntervalMs: fluentdReconnectIntervalMs } : {}),
          ...(fluentdBufferLimit != null ? { bufferLimit: fluentdBufferLimit } : {}),
        },
    logDatadog:
      datadogApiKey == null || datadogService == null
        ? null
        : {
          apiKey: datadogApiKey,
          service: datadogService,
          ...(datadogSite != null ? { site: datadogSite } : {}),
          ...(datadogSource != null ? { source: datadogSource } : {}),
          ...(datadogBatchSize != null ? { batchSize: datadogBatchSize } : {}),
          ...(datadogFlushIntervalMs != null ? { flushIntervalMs: datadogFlushIntervalMs } : {}),
        },
    enableWebSocket,
    ...(metricsPort !== undefined ? { metricsPort } : {}),
    ...(metricsHost ? { metricsHost } : {}),
    otelEnabled,
    otelEndpoint,
    otelServiceName,
    otelServiceVersion,
  };
}
