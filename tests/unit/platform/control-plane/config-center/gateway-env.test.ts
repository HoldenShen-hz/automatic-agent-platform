import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  readTrimmedEnv,
  readRequiredTrimmedEnv,
  parseStringRecordJson,
  loadGatewayEnv,
} from "../../../../../src/platform/five-plane-control-plane/config-center/gateway-env.js";

test("readTrimmedEnv returns null for missing key", () => {
  const env = {};
  assert.equal(readTrimmedEnv(env, "MISSING"), null);
});

test("readTrimmedEnv returns null for undefined value", () => {
  const env = { KEY: undefined as unknown as string };
  assert.equal(readTrimmedEnv(env, "KEY"), null);
});

test("readTrimmedEnv trims whitespace", () => {
  const env = { KEY: "  value  \n" };
  assert.equal(readTrimmedEnv(env, "KEY"), "value");
});

test("readTrimmedEnv returns null for empty string after trim", () => {
  const env = { KEY: "   " };
  assert.equal(readTrimmedEnv(env, "KEY"), null);
});

test("readTrimmedEnv returns value for valid string", () => {
  const env = { KEY: "myvalue" };
  assert.equal(readTrimmedEnv(env, "KEY"), "myvalue");
});

test("readRequiredTrimmedEnv returns value for valid string", () => {
  const env = { KEY: "myvalue" };
  assert.equal(readRequiredTrimmedEnv(env, "KEY"), "myvalue");
});

test("readRequiredTrimmedEnv throws ValidationError for missing key", () => {
  const env = {};
  assert.throws(
    () => readRequiredTrimmedEnv(env, "MISSING"),
    (err: unknown) => err instanceof ValidationError && err.code === "missing_env:MISSING",
  );
});

test("readRequiredTrimmedEnv throws ValidationError for empty string", () => {
  const env = { KEY: "   " };
  assert.throws(
    () => readRequiredTrimmedEnv(env, "KEY"),
    (err: unknown) => err instanceof ValidationError && err.code === "missing_env:KEY",
  );
});

test("parseStringRecordJson returns undefined for null", () => {
  assert.equal(parseStringRecordJson(null, "test"), undefined);
});

test("parseStringRecordJson throws for empty string (not null)", () => {
  assert.throws(
    () => parseStringRecordJson("", "test"),
    (err: unknown) => err instanceof SyntaxError,
  );
});

test("parseStringRecordJson parses valid JSON object", () => {
  const result = parseStringRecordJson('{"key":"value"}', "test");
  assert.deepEqual(result, { key: "value" });
});

test("parseStringRecordJson throws for non-object JSON", () => {
  assert.throws(
    () => parseStringRecordJson('"string"', "err_code"),
    (err: unknown) => err instanceof ValidationError && err.code === "err_code",
  );
});

test("parseStringRecordJson throws for array JSON", () => {
  assert.throws(
    () => parseStringRecordJson('["array"]', "err_code"),
    (err: unknown) => err instanceof ValidationError && err.code === "err_code",
  );
});

test("parseStringRecordJson throws SyntaxError for invalid JSON", () => {
  assert.throws(
    () => parseStringRecordJson("not-json", "err_code"),
    (err: unknown) => err instanceof SyntaxError,
  );
});

test("parseStringRecordJson throws when values are not strings", () => {
  assert.throws(
    () => parseStringRecordJson('{"key":123}', "err_code"),
    (err: unknown) => err instanceof ValidationError && err.code === "err_code",
  );
});

test("loadGatewayEnv returns empty object when no env vars set", () => {
  const result = loadGatewayEnv({});
  assert.deepEqual(result, {});
});

test("loadGatewayEnv parses Telegram token", () => {
  const result = loadGatewayEnv({
    AA_GATEWAY_TELEGRAM_BOT_TOKEN: "bot-token-123",
  });
  assert.deepEqual(result, {
    telegram: { botToken: "bot-token-123" },
  });
});

test("loadGatewayEnv parses Telegram with optional baseUrl", () => {
  const result = loadGatewayEnv({
    AA_GATEWAY_TELEGRAM_BOT_TOKEN: "bot-token-123",
    AA_GATEWAY_TELEGRAM_BASE_URL: "https://api.example.com",
  });
  assert.deepEqual(result, {
    telegram: { botToken: "bot-token-123", baseUrl: "https://api.example.com" },
  });
});

test("loadGatewayEnv parses Slack token", () => {
  const result = loadGatewayEnv({
    AA_GATEWAY_SLACK_BOT_TOKEN: "xoxb-slack-token",
  });
  assert.deepEqual(result, {
    slack: { botToken: "xoxb-slack-token" },
  });
});

test("loadGatewayEnv parses Slack with optional baseUrl", () => {
  const result = loadGatewayEnv({
    AA_GATEWAY_SLACK_BOT_TOKEN: "xoxb-slack-token",
    AA_GATEWAY_SLACK_BASE_URL: "https://slack.example.com",
  });
  assert.deepEqual(result, {
    slack: { botToken: "xoxb-slack-token", baseUrl: "https://slack.example.com" },
  });
});

test("loadGatewayEnv parses webhook headers", () => {
  const result = loadGatewayEnv({
    AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: '{"Content-Type":"application/json","Authorization":"Bearer token"}',
  });
  assert.deepEqual(result, {
    webhook: {
      defaultHeaders: { "Content-Type": "application/json", Authorization: "Bearer token" },
    },
  });
});

test("loadGatewayEnv parses multiple integrations", () => {
  const result = loadGatewayEnv({
    AA_GATEWAY_TELEGRAM_BOT_TOKEN: "bot-token",
    AA_GATEWAY_SLACK_BOT_TOKEN: "slack-token",
    AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: '{"X-Custom":"header"}',
  });
  assert.deepEqual(result, {
    telegram: { botToken: "bot-token" },
    slack: { botToken: "slack-token" },
    webhook: { defaultHeaders: { "X-Custom": "header" } },
  });
});

test("loadGatewayEnv uses custom error code for invalid webhook headers structure", () => {
  // Custom error code is used when JSON parses but result is not a valid object
  assert.throws(
    () =>
      loadGatewayEnv({
        AA_GATEWAY_WEBHOOK_DEFAULT_HEADERS_JSON: '"not-an-object"',
      }, { invalidWebhookHeadersCode: "custom_error" }),
    (err: unknown) => err instanceof ValidationError && err.code === "custom_error",
  );
});
