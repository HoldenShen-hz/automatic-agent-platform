import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  ANTHROPIC_API_URL,
  MANUAL_BILLING_CHECKOUT_URL,
  OPENAI_API_URL,
  MINIMAX_API_URL_GLOBAL,
  MINIMAX_API_URL_CHINA,
  STRIPE_API_URL,
  PADDLE_API_URL,
} from "../../../../../src/platform/five-plane-control-plane/config-center/provider-defaults.js";

test("ANTHROPIC_API_URL is a valid URL", () => {
  assert.equal(ANTHROPIC_API_URL, "https://api.anthropic.com");
  assert.ok(ANTHROPIC_API_URL.startsWith("https://"));
});

test("OPENAI_API_URL is a valid URL", () => {
  assert.equal(OPENAI_API_URL, "https://api.openai.com");
  assert.ok(OPENAI_API_URL.startsWith("https://"));
});

test("MINIMAX_API_URL_GLOBAL is a valid URL", () => {
  assert.equal(MINIMAX_API_URL_GLOBAL, "https://api.minimaxi.chat");
  assert.ok(String(MINIMAX_API_URL_GLOBAL).startsWith("https://"));
});

test("MINIMAX_API_URL_CHINA is a valid URL", () => {
  assert.equal(MINIMAX_API_URL_CHINA, "https://api.minimax.io");
  assert.ok(String(MINIMAX_API_URL_CHINA).startsWith("https://"));
});

test("STRIPE_API_URL is a valid URL", () => {
  assert.equal(STRIPE_API_URL, "https://api.stripe.com/v1");
  assert.ok(STRIPE_API_URL.startsWith("https://"));
});

test("PADDLE_API_URL is a valid URL", () => {
  assert.equal(PADDLE_API_URL, "https://api.paddle.com");
  assert.ok(PADDLE_API_URL.startsWith("https://"));
});

test("MANUAL_BILLING_CHECKOUT_URL is a valid URL", () => {
  assert.equal(MANUAL_BILLING_CHECKOUT_URL, "https://billing.manual.example/checkout");
  assert.ok(MANUAL_BILLING_CHECKOUT_URL.startsWith("https://"));
});
