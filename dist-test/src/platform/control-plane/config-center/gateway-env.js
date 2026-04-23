import { ValidationError } from "../../contracts/errors.js";
/**
 * Reads an environment variable and trims whitespace.
 * Returns null if the variable is not set or empty after trimming.
 */
export function readTrimmedEnv(env, key) {
    const value = env[key];
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
/**
 * Reads a required environment variable, trims whitespace, and throws if missing or empty.
 */
export function readRequiredTrimmedEnv(env, key) {
    const value = readTrimmedEnv(env, key);
    if (value == null) {
        throw new ValidationError(`missing_env:${key}`, `missing_env:${key}`);
    }
    return value;
}
/**
 * Parses a JSON string into a record of string key-value pairs.
 * Returns undefined if the raw string is null or empty.
 * Throws ValidationError if the parsed value is not a valid object with string values.
 */
export function parseStringRecordJson(raw, errorCode) {
    if (raw == null) {
        return undefined;
    }
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new ValidationError(errorCode, errorCode);
    }
    const result = {};
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") {
            throw new ValidationError(errorCode, errorCode);
        }
        result[key] = value;
    }
    return result;
}
/**
 * Loads gateway environment configuration from process environment variables.
 * Supports Telegram bot tokens, Slack bot tokens, and webhook default headers.
 *
 * @param env - Process environment variables (defaults to process.env)
 * @param options - Custom error codes for invalid configuration
 * @returns Gateway configuration object with available integrations
 */
export function loadGatewayEnv(env = process.env, options = {}) {
    const invalidWebhookHeadersCode = options.invalidWebhookHeadersCode ?? "gateway.invalid_webhook_headers_json";
    const gateway = {};
    const telegramToken = readTrimmedEnv(env, "AA_GATEWAY_TELEGRAM_BOT_TOKEN");
    if (telegramToken != null) {
        const telegramBaseUrl = readTrimmedEnv(env, "AA_GATEWAY_TELEGRAM_BASE_URL");
        gateway.telegram = {
            botToken: telegramToken,
            ...(telegramBaseUrl != null ? { baseUrl: telegramBaseUrl } : {}),
        };
    }
    const slackToken = readTrimmedEnv(env, "AA_GATEWAY_SLACK_BOT_TOKEN");
    if (slackToken != null) {
        const slackBaseUrl = readTrimmedEnv(env, "AA_GATEWAY_SLACK_BASE_URL");
        gateway.slack = {
            botToken: slackToken,
            ...(slackBaseUrl != null ? { baseUrl: slackBaseUrl } : {}),
        };
    }
    const defaultHeaders = parseStringRecordJson(readTrimmedEnv(env, "AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON"), invalidWebhookHeadersCode);
    if (defaultHeaders != null) {
        gateway.webhook = { defaultHeaders };
    }
    return gateway;
}
//# sourceMappingURL=gateway-env.js.map