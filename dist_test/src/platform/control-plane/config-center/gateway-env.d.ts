/**
 * Configuration for gateway integrations (Telegram, Slack, webhooks).
 * Each integration is optional and only loaded if credentials are provided.
 */
export interface GatewayEnvConfig {
    telegram?: {
        botToken: string;
        baseUrl?: string;
    };
    slack?: {
        botToken: string;
        baseUrl?: string;
    };
    webhook?: {
        defaultHeaders: Record<string, string>;
    };
}
/**
 * Reads an environment variable and trims whitespace.
 * Returns null if the variable is not set or empty after trimming.
 */
export declare function readTrimmedEnv(env: NodeJS.ProcessEnv, key: string): string | null;
/**
 * Reads a required environment variable, trims whitespace, and throws if missing or empty.
 */
export declare function readRequiredTrimmedEnv(env: NodeJS.ProcessEnv, key: string): string;
/**
 * Parses a JSON string into a record of string key-value pairs.
 * Returns undefined if the raw string is null or empty.
 * Throws ValidationError if the parsed value is not a valid object with string values.
 */
export declare function parseStringRecordJson(raw: string | null, errorCode: string): Record<string, string> | undefined;
/**
 * Loads gateway environment configuration from process environment variables.
 * Supports Telegram bot tokens, Slack bot tokens, and webhook default headers.
 *
 * @param env - Process environment variables (defaults to process.env)
 * @param options - Custom error codes for invalid configuration
 * @returns Gateway configuration object with available integrations
 */
export declare function loadGatewayEnv(env?: NodeJS.ProcessEnv, options?: {
    invalidWebhookHeadersCode?: string;
}): GatewayEnvConfig;
