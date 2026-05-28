/**
 * Provider API Default URLs
 *
 * Purpose: Centralize provider API URLs for LLM providers and external services.
 * All URL constants should be defined here and imported where needed.
 * Environment variables can override these defaults via provider configuration.
 */

import { parseSafeOutboundUrl } from "../iam/outbound-url-policy.js";

export const DEFAULT_PROVIDER_RETRYABLE_STATUS_CODES = Object.freeze([402, 429, 500, 502, 503, 529] as const);
export const DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_PROVIDER_ERROR_BODY_BYTES = 8 * 1024;

type ProviderDefaultUrlKey =
  | "anthropic_api_url"
  | "openai_api_url"
  | "minimax_api_url_global"
  | "minimax_api_url_china"
  | "stripe_api_url"
  | "paddle_api_url"
  | "manual_billing_checkout_url"
  | "telegram_api_url"
  | "slack_api_url";

const PROVIDER_DEFAULT_URL_ENV_KEYS: Record<ProviderDefaultUrlKey, string> = {
  anthropic_api_url: "AA_ANTHROPIC_API_URL",
  openai_api_url: "AA_OPENAI_API_URL",
  minimax_api_url_global: "AA_MINIMAX_API_URL_GLOBAL",
  minimax_api_url_china: "AA_MINIMAX_API_URL_CHINA",
  stripe_api_url: "AA_STRIPE_API_URL",
  paddle_api_url: "AA_PADDLE_API_URL",
  manual_billing_checkout_url: "AA_MANUAL_BILLING_CHECKOUT_URL",
  telegram_api_url: "AA_TELEGRAM_API_URL",
  slack_api_url: "AA_SLACK_API_URL",
};

const PROVIDER_DEFAULT_URL_FALLBACKS: Record<ProviderDefaultUrlKey, string> = {
  anthropic_api_url: "https://api.anthropic.com",
  openai_api_url: "https://api.openai.com",
  minimax_api_url_global: "https://api.minimaxi.chat",
  minimax_api_url_china: "https://api.minimax.io",
  stripe_api_url: "https://api.stripe.com/v1",
  paddle_api_url: "https://api.paddle.com",
  manual_billing_checkout_url: "https://billing.manual.example/checkout",
  telegram_api_url: "https://api.telegram.org",
  slack_api_url: "https://slack.com/api",
};

function defineProviderDefaultUrl(url: string, key: ProviderDefaultUrlKey): string {
  return parseSafeOutboundUrl(url, {
    invalid: `provider_defaults.invalid_${key}`,
    blocked: `provider_defaults.blocked_${key}`,
  }).toString().replace(/\/$/, "");
}

export function resolveProviderDefaultUrl(
  key: ProviderDefaultUrlKey,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configured = environment[PROVIDER_DEFAULT_URL_ENV_KEYS[key]]?.trim();
  return defineProviderDefaultUrl(
    configured && configured.length > 0 ? configured : PROVIDER_DEFAULT_URL_FALLBACKS[key],
    key,
  );
}

export const PROVIDER_DEFAULT_URLS = Object.freeze({
  anthropic: resolveProviderDefaultUrl("anthropic_api_url"),
  openai: resolveProviderDefaultUrl("openai_api_url"),
  minimaxGlobal: resolveProviderDefaultUrl("minimax_api_url_global"),
  minimaxChina: resolveProviderDefaultUrl("minimax_api_url_china"),
  stripe: resolveProviderDefaultUrl("stripe_api_url"),
  paddle: resolveProviderDefaultUrl("paddle_api_url"),
  manualBillingCheckout: resolveProviderDefaultUrl("manual_billing_checkout_url"),
  telegram: resolveProviderDefaultUrl("telegram_api_url"),
  slack: resolveProviderDefaultUrl("slack_api_url"),
});

/** Anthropic API base URL */
export const ANTHROPIC_API_URL = PROVIDER_DEFAULT_URLS.anthropic;

/** OpenAI API base URL */
export const OPENAI_API_URL = PROVIDER_DEFAULT_URLS.openai;

/** MiniMax API base URL (Global) */
export const MINIMAX_API_URL_GLOBAL = PROVIDER_DEFAULT_URLS.minimaxGlobal;

/** MiniMax API base URL (China Mainland) */
export const MINIMAX_API_URL_CHINA = PROVIDER_DEFAULT_URLS.minimaxChina;

/** Stripe API base URL */
export const STRIPE_API_URL = PROVIDER_DEFAULT_URLS.stripe;

/** Paddle API base URL */
export const PADDLE_API_URL = PROVIDER_DEFAULT_URLS.paddle;

/** Manual billing checkout URL */
export const MANUAL_BILLING_CHECKOUT_URL = PROVIDER_DEFAULT_URLS.manualBillingCheckout;

/** Telegram Bot API base URL */
export const TELEGRAM_API_URL = PROVIDER_DEFAULT_URLS.telegram;

/** Slack API base URL */
export const SLACK_API_URL = PROVIDER_DEFAULT_URLS.slack;
