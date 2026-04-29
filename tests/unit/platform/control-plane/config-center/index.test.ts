import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  ANTHROPIC_API_URL,
  ConfigDriftReconciler,
  ConfigImpactAnalyzer,
  ConfigLifecycleManager,
  ConfigLoader,
  ConfigStore,
  HierarchicalConfigLoader,
  OPENAI_API_URL,
  MINIMAX_API_URL_GLOBAL,
  MINIMAX_API_URL_CHINA,
  STRIPE_API_URL,
  PADDLE_API_URL,
} from "../../../../../src/platform/control-plane/config-center/index.js";

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

test("config-center barrel exports core config-center services", () => {
  assert.equal(typeof ConfigImpactAnalyzer, "function");
  assert.equal(typeof ConfigDriftReconciler, "function");
  assert.equal(typeof ConfigLifecycleManager, "function");
  assert.equal(typeof ConfigLoader, "function");
  assert.equal(typeof ConfigStore, "function");
  assert.equal(typeof HierarchicalConfigLoader, "function");
});
