/**
 * Provider API Default URLs
 *
 * Purpose: Centralize hardcoded API URLs for LLM providers and external services.
 * All URL constants should be defined here and imported where needed.
 * Environment variables can override these defaults via provider configuration.
 */
/** Anthropic API base URL */
export const ANTHROPIC_API_URL = "https://api.anthropic.com";
/** OpenAI API base URL */
export const OPENAI_API_URL = "https://api.openai.com";
/** MiniMax API base URL (Global) */
export const MINIMAX_API_URL_GLOBAL = "https://api.minimaxi.chat";
/** MiniMax API base URL (China Mainland) */
export const MINIMAX_API_URL_CHINA = "https://api.minimax.io";
/** Stripe API base URL */
export const STRIPE_API_URL = "https://api.stripe.com/v1";
/** Paddle API base URL */
export const PADDLE_API_URL = "https://api.paddle.com";
/** Manual billing checkout URL */
export const MANUAL_BILLING_CHECKOUT_URL = "https://billing.manual.local/checkout";
/** Telegram Bot API base URL */
export const TELEGRAM_API_URL = "https://api.telegram.org";
/** Slack API base URL */
export const SLACK_API_URL = "https://slack.com/api";
//# sourceMappingURL=provider-defaults.js.map