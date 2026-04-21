import type { ApiKeyRecord } from "../../interface/api/api-auth-service.js";
import { type GatewayEnvConfig } from "./gateway-env.js";
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
 * Loads and validates the complete API server environment configuration.
 * Reads from standard environment variables and validates all settings
 * before returning a typed configuration object.
 */
export declare function loadApiServerEnv(env?: NodeJS.ProcessEnv): ApiServerEnvConfig;
