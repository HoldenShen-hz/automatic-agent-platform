import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRetryAfterMs,
  parseResetAt,
  shouldRetryWithinPool,
  BaseAPIError,
} from "../../../../../src/platform/model-gateway/provider-registry/base-chat-provider.js";

test("parseRetryAfterMs returns null for missing header", () => {
  const headers = new Headers();
  assert.equal(parseRetryAfterMs(headers), null);
});

test("parseRetryAfterMs parses retry-after-ms header", () => {
  const headers = new Headers([["retry-after-ms", "5000"]]);
  assert.equal(parseRetryAfterMs(headers), 5000);
});

test("parseRetryAfterMs parses retry-after-ms with zero", () => {
  const headers = new Headers([["retry-after-ms", "0"]]);
  assert.equal(parseRetryAfterMs(headers), 0);
});

test("parseRetryAfterMs ignores negative retry-after-ms", () => {
  const headers = new Headers([["retry-after-ms", "-100"]]);
  assert.equal(parseRetryAfterMs(headers), null);
});

test("parseRetryAfterMs ignores non-numeric retry-after-ms", () => {
  const headers = new Headers([["retry-after-ms", "abc"]]);
  assert.equal(parseRetryAfterMs(headers), null);
});

test("parseRetryAfterMs parses retry-after in seconds", () => {
  const headers = new Headers([["retry-after", "10"]]);
  assert.equal(parseRetryAfterMs(headers), 10000);
});

test("parseRetryAfterMs parses retry-after with zero seconds", () => {
  const headers = new Headers([["retry-after", "0"]]);
  assert.equal(parseRetryAfterMs(headers), 0);
});

test("parseRetryAfterMs ignores negative retry-after seconds", () => {
  const headers = new Headers([["retry-after", "-5"]]);
  // Negative seconds fall through to Date parsing, which returns 0 for past dates
  assert.equal(parseRetryAfterMs(headers), 0);
});

test("parseRetryAfterMs parses retry-after as ISO date", () => {
  const futureDate = new Date(Date.now() + 60000).toISOString();
  const headers = new Headers([["retry-after", futureDate]]);
  const result = parseRetryAfterMs(headers);
  assert.ok(result !== null);
  assert.ok(result >= 59000 && result <= 61000);
});

test("parseRetryAfterMs returns 0 for past date", () => {
  const pastDate = new Date(Date.now() - 10000).toISOString();
  const headers = new Headers([["retry-after", pastDate]]);
  assert.equal(parseRetryAfterMs(headers), 0);
});

test("parseRetryAfterMs prefers retry-after-ms over retry-after", () => {
  const headers = new Headers([
    ["retry-after-ms", "3000"],
    ["retry-after", "100"],
  ]);
  assert.equal(parseRetryAfterMs(headers), 3000);
});

test("parseRetryAfterMs ignores non-numeric retry-after", () => {
  const headers = new Headers([["retry-after", "invalid"]]);
  assert.equal(parseRetryAfterMs(headers), null);
});

test("parseResetAt returns null for missing headers", () => {
  const headers = new Headers();
  assert.equal(parseResetAt(headers, ["reset-at"]), null);
});

test("parseResetAt returns null for empty header value", () => {
  const headers = new Headers([["reset-at", "  "]]);
  assert.equal(parseResetAt(headers, ["reset-at"]), null);
});

test("parseResetAt parses ISO date string", () => {
  const isoDate = "2026-04-14T12:00:00.000Z";
  const headers = new Headers([["reset-at", isoDate]]);
  assert.equal(parseResetAt(headers, ["reset-at"]), isoDate);
});

test("parseResetAt parses Unix timestamp in seconds", () => {
  const unixSeconds = Math.floor(Date.now() / 1000) + 60;
  const headers = new Headers([["reset-at", String(unixSeconds)]]);
  const result = parseResetAt(headers, ["reset-at"]);
  assert.ok(result !== null);
  const parsed = new Date(result!).getTime();
  assert.ok(Math.abs(parsed - unixSeconds * 1000) < 5000);
});

test("parseResetAt parses Unix timestamp in milliseconds", () => {
  const unixMs = Date.now() + 60000;
  const headers = new Headers([["reset-at", String(unixMs)]]);
  const result = parseResetAt(headers, ["reset-at"]);
  assert.ok(result !== null);
  const parsed = new Date(result!).getTime();
  assert.ok(Math.abs(parsed - unixMs) < 5000);
});

test("parseResetAt checks headers in order", () => {
  const isoDate = "2026-04-14T12:00:00.000Z";
  const headers = new Headers([
    ["x-ratelimit-reset", "other-value"],
    ["reset-at", isoDate],
  ]);
  assert.equal(parseResetAt(headers, ["reset-at", "x-ratelimit-reset"]), isoDate);
});

test("parseResetAt skips invalid date string", () => {
  const headers = new Headers([
    ["reset-at", "invalid-date"],
    ["x-ratelimit-reset", "2026-04-14T12:00:00.000Z"],
  ]);
  assert.equal(parseResetAt(headers, ["reset-at", "x-ratelimit-reset"]), "2026-04-14T12:00:00.000Z");
});

test("shouldRetryWithinPool returns true for code in list", () => {
  const codes = [402, 429, 500, 502, 503, 529];
  assert.equal(shouldRetryWithinPool(429, codes), true);
  assert.equal(shouldRetryWithinPool(500, codes), true);
  assert.equal(shouldRetryWithinPool(503, codes), true);
});

test("shouldRetryWithinPool returns false for code not in list", () => {
  const codes = [402, 429, 500, 502, 503, 529];
  assert.equal(shouldRetryWithinPool(400, codes), false);
  assert.equal(shouldRetryWithinPool(401, codes), false);
  assert.equal(shouldRetryWithinPool(404, codes), false);
});

test("BaseAPIError has correct properties", () => {
  const error = new BaseAPIError({
    statusCode: 500,
    statusText: "Internal Server Error",
    message: "Something went wrong",
    type: "server_error",
    code: "E500",
    credentialId: "cred-123",
    retryAfterMs: 5000,
    resetAt: "2026-04-14T12:00:00.000Z",
  });

  assert.equal(error.statusCode, 500);
  assert.equal(error.statusText, "Internal Server Error");
  assert.equal(error.message, "Something went wrong");
  assert.equal(error.type, "server_error");
  assert.equal(error.code, "E500");
  assert.equal(error.credentialId, "cred-123");
  assert.equal(error.retryAfterMs, 5000);
  assert.equal(error.resetAt, "2026-04-14T12:00:00.000Z");
  assert.equal(error.name, "BaseAPIError");
});

test("BaseAPIError defaults null optional fields", () => {
  const error = new BaseAPIError({
    statusCode: 400,
    statusText: "Bad Request",
    message: "Invalid request",
  });

  assert.equal(error.type, null);
  assert.equal(error.code, null);
  assert.equal(error.credentialId, null);
  assert.equal(error.retryAfterMs, null);
  assert.equal(error.resetAt, null);
});

test("BaseAPIError extends Error", () => {
  const error = new BaseAPIError({
    statusCode: 500,
    statusText: "Error",
    message: "Test error",
  });
  assert.ok(error instanceof Error);
  assert.ok(error instanceof BaseAPIError);
});
