/**
 * Provider API Default URLs
 *
 * Purpose: Centralize provider API URLs for LLM providers and external services.
 * All URL constants should be defined here and imported where needed.
 * Environment variables can override these defaults via provider configuration.
 */

import { parseSafeOutboundUrl } from "../iam/outbound-url-policy.js";

function defineProviderDefaultUrl(url: string, key: string): string {
  return parseSafeOutboundUrl(url, {
    invalid: `provider_defaults.invalid_${key}`,
    blocked: `provider_defaults.blocked_${key}`,
  }).toString().replace(/\/$/, "");
}

 /** Anthropic API base URL */
export const ANTHROPIC_API_URL = defineProviderDefaultUrl("https://api.anthropic.com", "anthropic_api_url");

/** OpenAI API base URL */
export const OPENAI_API_URL = defineProviderDefaultUrl("https://api.openai.com", "openai_api_url");

/** MiniMax API base URL (Global) */
export const MINIMAX_API_URL_GLOBAL = defineProviderDefaultUrl("https://api.minimaxi.chat", "minimax_api_url_global");

/** MiniMax API base URL (China Mainland) */
export const MINIMAX_API_URL_CHINA = defineProviderDefaultUrl("https://api.minimax.io", "minimax_api_url_china");

/** Stripe API base URL */
export const STRIPE_API_URL = defineProviderDefaultUrl("https://api.stripe.com/v1", "stripe_api_url");

/** Paddle API base URL */
export const PADDLE_API_URL = defineProviderDefaultUrl("https://api.paddle.com", "paddle_api_url");

/** Manual billing checkout URL */
export const MANUAL_BILLING_CHECKOUT_URL = "https://billing.manual.local/checkout";

/** Telegram Bot API base URL */
export const TELEGRAM_API_URL = defineProviderDefaultUrl("https://api.telegram.org", "telegram_api_url");

/** Slack API base URL */
export const SLACK_API_URL = defineProviderDefaultUrl("https://slack.com/api", "slack_api_url");
