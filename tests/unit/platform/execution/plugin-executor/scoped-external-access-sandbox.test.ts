/**
 * ScopedExternalAccessSandbox Unit Tests
 *
 * Tests for the fourth sandbox tier: scoped_external_access
 * - Domain whitelist validation
 * - Rate limiting
 * - Response header filtering
 * - Response size validation
 * - Scoped request execution
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ScopedExternalAccessSandbox,
  createScopedExternalAccessSandbox,
  type ExternalAccessRequest,
} from "../../../../../../src/platform/execution/plugin-executor/scoped-external-access-sandbox.js";

// ─────────────────────────────────────────────────────────────────────────────
// Domain Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox allows whitelisted domains", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com", "cdn.example.org"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const result1 = await sandbox.validateOutboundRequest("https://api.example.com/endpoint");
  assert.equal(result1, true);

  const result2 = await sandbox.validateOutboundRequest("https://cdn.example.org/resource");
  assert.equal(result2, true);
});

test("ScopedExternalAccessSandbox blocks non-whitelisted domains", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const result = await sandbox.validateOutboundRequest("https://evil.com/malware");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox handles invalid URLs gracefully", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const result = await sandbox.validateOutboundRequest("not-a-valid-url");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox supports subdomain matching", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  // Subdomain of allowed domain
  const result1 = await sandbox.validateOutboundRequest("https://api.example.com");
  assert.equal(result1, true);

  // Different domain entirely
  const result2 = await sandbox.validateOutboundRequest("https://example.org");
  assert.equal(result2, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox enforces per-domain rate limits", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 2,
  });

  const allowed1 = await sandbox.checkRateLimit("api.example.com");
  assert.equal(allowed1, true);

  const allowed2 = await sandbox.checkRateLimit("api.example.com");
  assert.equal(allowed2, true);

  const blocked = await sandbox.checkRateLimit("api.example.com");
  assert.equal(blocked, false);
});

test("ScopedExternalAccessSandbox maintains separate rate limits per domain", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com", "other.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 2,
  });

  // Hit limit on api.example.com
  await sandbox.checkRateLimit("api.example.com");
  await sandbox.checkRateLimit("api.example.com");

  // other.example.com should still have capacity
  const allowed = await sandbox.checkRateLimit("other.example.com");
  assert.equal(allowed, true);
});

test("ScopedExternalAccessSandbox reports correct rate limit status", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com", "other.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 100,
  });

  await sandbox.checkRateLimit("api.example.com");
  await sandbox.checkRateLimit("api.example.com");
  await sandbox.checkRateLimit("other.example.com");

  const status = sandbox.getRateLimitStatus();

  assert.equal(status["api.example.com"].count, 2);
  assert.equal(status["other.example.com"].count, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Header Filtering Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox filters authorization headers", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const headers = {
    "content-type": "application/json",
    "authorization": "Bearer secret123",
    "x-custom": "value",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["content-type"], "application/json");
  assert.equal(filtered["x-custom"], "value");
  assert.equal(filtered["authorization"], undefined);
});

test("ScopedExternalAccessSandbox filters API key headers", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const headers = {
    "x-api-key": "my-secret-key",
    "x-auth-token": "session-token",
    "content-type": "text/plain",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["x-api-key"], undefined);
  assert.equal(filtered["x-auth-token"], undefined);
  assert.equal(filtered["content-type"], "text/plain");
});

test("ScopedExternalAccessSandbox filters set-cookie headers", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const headers = {
    "set-cookie": "session=abc123; HttpOnly",
    "content-type": "text/html",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["set-cookie"], undefined);
  assert.equal(filtered["content-type"], "text/html");
});

test("ScopedExternalAccessSandbox handles case-insensitive header names", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const headers = {
    "AUTHORIZATION": "Bearer token",
    "Content-Type": "application/json",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["AUTHORIZATION"], undefined);
  assert.equal(filtered["Content-Type"], "application/json");
});

// ─────────────────────────────────────────────────────────────────────────────
// Response Size Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox allows small responses", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 1024,
    rateLimitPerMinute: 60,
  });

  const result = sandbox.validateResponseSize({ data: "small" });
  assert.equal(result, true);
});

test("ScopedExternalAccessSandbox blocks oversized responses", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 100,
    rateLimitPerMinute: 60,
  });

  const largeData = { data: "x".repeat(200) };
  const result = sandbox.validateResponseSize(largeData);
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox handles null body", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 100,
    rateLimitPerMinute: 60,
  });

  assert.equal(sandbox.validateResponseSize(null), true);
  assert.equal(sandbox.validateResponseSize(undefined), true);
});

test("ScopedExternalAccessSandbox handles string bodies", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 100,
    rateLimitPerMinute: 60,
  });

  assert.equal(sandbox.validateResponseSize("short string"), true);
  assert.equal(sandbox.validateResponseSize("a".repeat(200)), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped Request Execution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox.executeScopedRequest blocks non-whitelisted domains", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const request: ExternalAccessRequest = {
    url: "https://evil.com/data",
    method: "GET",
  };

  const response = await sandbox.executeScopedRequest(request);

  assert.equal(response.blocked, true);
  assert.equal(response.blockedReason, "domain_not_allowed");
  assert.equal(response.status, 403);
});

test("ScopedExternalAccessSandbox blocks when rate limit exceeded", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 1,
  });

  // First request to establish rate limit
  await sandbox.checkRateLimit("api.example.com");

  // Second request should be blocked
  const blocked = await sandbox.checkRateLimit("api.example.com");
  assert.equal(blocked, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createScopedExternalAccessSandbox creates sandbox with default config", () => {
  const sandbox = createScopedExternalAccessSandbox(["api.example.com"]);

  assert.ok(sandbox instanceof ScopedExternalAccessSandbox);
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com/test"), true);
  assert.equal(sandbox.validateOutboundRequest("https://other.com/test"), false);
});

test("createScopedExternalAccessSandbox merges options correctly", () => {
  const sandbox = createScopedExternalAccessSandbox(
    ["api.example.com"],
    {
      rateLimitPerMinute: 5,
      maxResponseSizeBytes: 500,
    },
  );

  assert.ok(sandbox instanceof ScopedExternalAccessSandbox);

  // Check rate limit enforcement with custom setting
  for (let i = 0; i < 5; i++) {
    assert.equal(sandbox.checkRateLimit("api.example.com"), true);
  }
  assert.equal(sandbox.checkRateLimit("api.example.com"), false);
});

test("createScopedExternalAccessSandbox allows empty domain list", () => {
  const sandbox = createScopedExternalAccessSandbox([]);

  assert.ok(sandbox instanceof ScopedExternalAccessSandbox);
  assert.equal(sandbox.validateOutboundRequest("https://any.com/test"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox handles empty allowedDomains array", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: [],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const result = await sandbox.validateOutboundRequest("https://any.com/test");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox handles special characters in URLs", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const result = await sandbox.validateOutboundRequest(
    "https://api.example.com/path?param=value&another=test",
  );
  assert.equal(result, true);
});

test("ScopedExternalAccessSandbox handles port numbers in URLs", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const result = await sandbox.validateOutboundRequest(
    "https://api.example.com:8080/endpoint",
  );
  assert.equal(result, true);
});

test("ScopedExternalAccessSandbox handles IP addresses as domains", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["192.168.1.1"],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  assert.equal(
    sandbox.validateOutboundRequest("https://192.168.1.1/api"),
    true,
  );
  assert.equal(
    sandbox.validateOutboundRequest("https://192.168.1.2/api"),
    false,
  );
});
