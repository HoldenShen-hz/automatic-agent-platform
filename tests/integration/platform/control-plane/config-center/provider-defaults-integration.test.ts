import assert from "node:assert/strict";
import test from "node:test";

import {
  ANTHROPIC_API_URL,
  MANUAL_BILLING_CHECKOUT_URL,
  OPENAI_API_URL,
  MINIMAX_API_URL_GLOBAL,
  MINIMAX_API_URL_CHINA,
  STRIPE_API_URL,
  PADDLE_API_URL,
  TELEGRAM_API_URL,
  SLACK_API_URL,
} from "../../../../../src/platform/five-plane-control-plane/config-center/provider-defaults.js";

test("Provider API URLs are properly formatted", () => {
  assert.equal(ANTHROPIC_API_URL.startsWith("https://"), true);
  assert.equal(OPENAI_API_URL.startsWith("https://"), true);
  assert.equal(MINIMAX_API_URL_GLOBAL.startsWith("https://"), true);
  assert.equal(MINIMAX_API_URL_CHINA.startsWith("https://"), true);
});

test("Anthropic API URL is correct", () => {
  assert.equal(ANTHROPIC_API_URL, "https://api.anthropic.com");
});

test("OpenAI API URL is correct", () => {
  assert.equal(OPENAI_API_URL, "https://api.openai.com");
});

test("MiniMax URLs are different for global and China", () => {
  assert.notEqual(MINIMAX_API_URL_GLOBAL, MINIMAX_API_URL_CHINA);
});

test("MiniMax global URL format", () => {
  assert.equal(MINIMAX_API_URL_GLOBAL, "https://api.minimaxi.chat");
});

test("MiniMax China URL format", () => {
  assert.equal(MINIMAX_API_URL_CHINA, "https://api.minimax.io");
});

test("Stripe API URL format", () => {
  assert.equal(STRIPE_API_URL, "https://api.stripe.com/v1");
});

test("Paddle API URL format", () => {
  assert.equal(PADDLE_API_URL, "https://api.paddle.com");
});

test("Manual billing checkout URL format", () => {
  assert.equal(MANUAL_BILLING_CHECKOUT_URL, "https://billing.manual.example/checkout");
});

test("Telegram API URL format", () => {
  assert.equal(TELEGRAM_API_URL, "https://api.telegram.org");
});

test("Slack API URL format", () => {
  assert.equal(SLACK_API_URL, "https://slack.com/api");
});

test("All URLs use HTTPS", () => {
  const urls = [
    ANTHROPIC_API_URL,
    OPENAI_API_URL,
    MINIMAX_API_URL_GLOBAL,
    MINIMAX_API_URL_CHINA,
    STRIPE_API_URL,
    PADDLE_API_URL,
    TELEGRAM_API_URL,
    SLACK_API_URL,
  ];

  for (const url of urls) {
    assert.equal(url.startsWith("https://"), true, `${url} should use HTTPS`);
  }
});
