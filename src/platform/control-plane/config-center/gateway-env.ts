import { ValidationError } from "../../contracts/errors.js";

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
export function readTrimmedEnv(env: NodeJS.ProcessEnv, key: string): string | null {
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
export function readRequiredTrimmedEnv(env: NodeJS.ProcessEnv, key: string): string {
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
export function parseStringRecordJson(raw: string | null, errorCode: string): Record<string, string> | undefined {
  if (raw == null) {
    return undefined;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError(errorCode, errorCode);
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
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
export function loadGatewayEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    invalidWebhookHeadersCode?: string;
  } = {},
): GatewayEnvConfig {
  const invalidWebhookHeadersCode = options.invalidWebhookHeadersCode ?? "gateway.invalid_webhook_headers_json";
  const gateway: GatewayEnvConfig = {};

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

  const defaultHeaders = parseStringRecordJson(
    readTrimmedEnv(env, "AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON"),
    invalidWebhookHeadersCode,
  );
  if (defaultHeaders != null) {
    gateway.webhook = { defaultHeaders };
  }

  return gateway;
}
