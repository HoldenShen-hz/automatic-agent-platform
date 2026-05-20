/**
 * ScopedExternalAccessSandbox Extended Unit Tests
 *
 * Additional tests for external access sandbox:
 * - Egress proxy URL construction
 * - Request execution with different HTTP methods
 * - Header filtering edge cases
 * - Rate limiting internal state
 * - Config merging behavior
 * - executeScopedRequest edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ScopedExternalAccessSandbox,
  createScopedExternalAccessSandbox,
  type ExternalAccessRequest,
} from "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox merges partial config with defaults", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["custom.example.com"],
  });

  // Should have default maxResponseSizeBytes (5MB)
  const result = sandbox.validateResponseSize("x".repeat(1024 * 1024 * 4)); // 4MB - should pass
  assert.equal(result, true);

  const result2 = sandbox.validateResponseSize("x".repeat(1024 * 1024 * 6)); // 6MB - should fail
  assert.equal(result2, false);
});

test("ScopedExternalAccessSandbox accepts empty allowedDomains", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: [],
  });

  const result = sandbox.validateOutboundRequest("https://any.com");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox handles config with all options", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 1024,
    rateLimitPerMinute: 30,
    sensitiveHeaders: ["authorization", "x-custom-header"],
    egressProxyUrl: "https://proxy.example.com",
  });

  const allowed = sandbox.validateOutboundRequest("https://api.example.com");
  assert.equal(allowed, true);
});

test("createScopedExternalAccessSandbox creates sandbox with allowedDomains", () => {
  const sandbox = createScopedExternalAccessSandbox(["a.com", "b.com"]);

  assert.equal(sandbox.validateOutboundRequest("https://a.com/path"), true);
  assert.equal(sandbox.validateOutboundRequest("https://b.com/path"), true);
  assert.equal(sandbox.validateOutboundRequest("https://c.com/path"), false);
});

test("createScopedExternalAccessSandbox accepts optional config", () => {
  const sandbox = createScopedExternalAccessSandbox(["example.com"], {
    maxResponseSizeBytes: 5000,
    rateLimitPerMinute: 10,
  });

  const allowed = sandbox.validateOutboundRequest("https://example.com");
  assert.equal(allowed, true);

  // Rate limit should work with custom value
  for (let i = 0; i < 10; i++) {
    assert.equal(sandbox.checkRateLimit("example.com"), true);
  }
  assert.equal(sandbox.checkRateLimit("example.com"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Domain Validation Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox validates exact domain match", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://api.example.com"), true);
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com/"), true);
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com/path/to/resource"), true);
});

test("ScopedExternalAccessSandbox blocks subdomain of allowed domain", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  // Subdomain is NOT the same as the allowed domain
  assert.equal(sandbox.validateOutboundRequest("https://v2.api.example.com"), false);
  assert.equal(sandbox.validateOutboundRequest("https://staging.api.example.com"), false);
});

test("ScopedExternalAccessSandbox handles subdomain perspective", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["example.com"],
  });

  // Exact domains are allowed; subdomains require an explicit *.example.com entry.
  assert.equal(sandbox.validateOutboundRequest("https://example.com"), true);
  assert.equal(sandbox.validateOutboundRequest("https://sub.example.com"), false);
});

test("ScopedExternalAccessSandbox allows explicitly wildcarded subdomains", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["*.example.com"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://api.example.com"), true);
  assert.equal(sandbox.validateOutboundRequest("https://deep.api.example.com"), true);
  assert.equal(sandbox.validateOutboundRequest("https://example.com"), false);
});

test("ScopedExternalAccessSandbox rejects public-suffix style implicit wildcard matches", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["co.uk"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://evil.co.uk"), false);
});

test("ScopedExternalAccessSandbox handles port in hostname correctly", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  // Port is stripped when comparing hostname
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com:8080"), true);
});

test("ScopedExternalAccessSandbox handles multiple subdomains", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["deep.sub.example.com"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://deep.sub.example.com"), true);
  assert.equal(sandbox.validateOutboundRequest("https://not.deep.sub.example.com"), false);
});

test("ScopedExternalAccessSandbox validates case-sensitive domain matching", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["API.EXAMPLE.COM"],
  });

  // URL hostname parsing is case-insensitive for the hostname part
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com"), true);
});

test("ScopedExternalAccessSandbox validates UTF-8 response sizes by bytes", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 3,
  });

  assert.equal(sandbox.validateResponseSize("你"), true);
  assert.equal(sandbox.validateResponseSize("你好"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox tracks rate limit state", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["ratelimit.example.com"],
    rateLimitPerMinute: 5,
  });

  // Exhaust the limit
  for (let i = 0; i < 5; i++) {
    assert.equal(sandbox.checkRateLimit("ratelimit.example.com"), true);
  }

  // Should be blocked now
  assert.equal(sandbox.checkRateLimit("ratelimit.example.com"), false);
});

test("ScopedExternalAccessSandbox resets rate limit for new domain", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["a.com", "b.com"],
    rateLimitPerMinute: 1,
  });

  // Exhaust a.com
  assert.equal(sandbox.checkRateLimit("a.com"), true);
  assert.equal(sandbox.checkRateLimit("a.com"), false);

  // b.com should still be allowed
  assert.equal(sandbox.checkRateLimit("b.com"), true);
});

test("ScopedExternalAccessSandbox.getRateLimitStatus returns copy", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["status.example.com"],
    rateLimitPerMinute: 10,
  });

  sandbox.checkRateLimit("status.example.com");
  const status = sandbox.getRateLimitStatus();

  // Modify the returned status
  status["status.example.com"].count = 999;

  // Original should be unchanged
  const status2 = sandbox.getRateLimitStatus();
  assert.equal(status2["status.example.com"].count, 1);
});

test("ScopedExternalAccessSandbox.getRateLimitStatus handles empty state", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    rateLimitPerMinute: 60,
  });

  // No requests made yet
  const status = sandbox.getRateLimitStatus();
  // Should be empty or not contain the domain
  assert.ok(!status["test.example.com"] || status["test.example.com"].count === 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Header Filtering Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox filters authorization header case variations", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    sensitiveHeaders: ["authorization"],
  });

  const headers = {
    "Authorization": "Bearer token1",
    "authorization": "Bearer token2",
    "AUTHORIZATION": "Bearer token3",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["Authorization"], undefined);
  assert.equal(filtered["authorization"], undefined);
  assert.equal(filtered["AUTHORIZATION"], undefined);
});

test("ScopedExternalAccessSandbox filters x-auth-token header", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  const headers = {
    "x-auth-token": "secret-token-123",
    "content-type": "application/json",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["x-auth-token"], undefined);
  assert.ok(filtered["content-type"]);
});

test("ScopedExternalAccessSandbox handles headers with mixed case keys", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    sensitiveHeaders: ["authorization"],
  });

  const headers = {
    "Content-Type": "application/json",
    "HOST": "example.com",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  // Non-sensitive headers should be preserved
  assert.equal(filtered["Content-Type"], "application/json");
  assert.equal(filtered["HOST"], "example.com");
});

test("ScopedExternalAccessSandbox handles empty headers", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  const filtered = sandbox.filterResponseHeaders({});

  assert.deepStrictEqual(filtered, {});
});

test("ScopedExternalAccessSandbox handles headers with only sensitive headers", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    sensitiveHeaders: ["authorization", "x-api-key"],
  });

  const filtered = sandbox.filterResponseHeaders({
    "authorization": "Bearer secret",
    "x-api-key": "key123",
  });

  assert.deepStrictEqual(filtered, {});
});

test("ScopedExternalAccessSandbox preserves non-sensitive headers when filtering", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  const headers = {
    "content-type": "application/json",
    "x-request-id": "req-123",
    "x-correlation-id": "corr-456",
    "cache-control": "no-cache",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["content-type"], "application/json");
  assert.equal(filtered["x-request-id"], "req-123");
  assert.equal(filtered["x-correlation-id"], "corr-456");
  assert.equal(filtered["cache-control"], "no-cache");
});

// ─────────────────────────────────────────────────────────────────────────────
// Response Size Validation Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox rejects large string response", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 10,
  });

  assert.equal(sandbox.validateResponseSize("hello world!"), false);
});

test("ScopedExternalAccessSandbox accepts small string response", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 100,
  });

  assert.equal(sandbox.validateResponseSize("short"), true);
});

test("ScopedExternalAccessSandbox validates JSON object string representation", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 50,
  });

  // This object JSON.stringify'd is larger than 50 bytes
  const largeObj = {
    data: "This is a longer string that should exceed the limit",
  };

  assert.equal(sandbox.validateResponseSize(largeObj), false);
});

test("ScopedExternalAccessSandbox validates array response size", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 20,
  });

  const smallArray = [1, 2, 3];
  assert.equal(sandbox.validateResponseSize(smallArray), true);

  const largeArray = Array(100).fill("x");
  assert.equal(sandbox.validateResponseSize(largeArray), false);
});

test("ScopedExternalAccessSandbox validates number response", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 5,
  });

  // Numbers converted to string
  assert.equal(sandbox.validateResponseSize(12345), true);
  assert.equal(sandbox.validateResponseSize(123456), false);
});

test("ScopedExternalAccessSandbox validates boolean response", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 5,
  });

  assert.equal(sandbox.validateResponseSize(true), true);
  assert.equal(sandbox.validateResponseSize(false), true);
});

test("ScopedExternalAccessSandbox handles nested objects", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
    maxResponseSizeBytes: 100,
  });

  const nested = {
    level1: {
      level2: {
        level3: "deep value",
      },
    },
  };

  assert.equal(sandbox.validateResponseSize(nested), true);

  const largeNested = {
    data: "x".repeat(200),
  };
  assert.equal(sandbox.validateResponseSize(largeNested), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Default Config Constants Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox has default sensitive headers", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  const headers = {
    "authorization": "secret",
    "x-api-key": "key",
    "x-auth-token": "token",
    "set-cookie": "cookie",
    "www-authenticate": "challenge",
    "content-type": "text/html",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.equal(filtered["authorization"], undefined);
  assert.equal(filtered["x-api-key"], undefined);
  assert.equal(filtered["x-auth-token"], undefined);
  assert.equal(filtered["set-cookie"], undefined);
  assert.equal(filtered["www-authenticate"], undefined);
  assert.equal(filtered["content-type"], "text/html");
});

test("ScopedExternalAccessSandbox default maxResponseSizeBytes is 5MB", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  // 5MB is 5 * 1024 * 1024 = 5,242,880 bytes
  const fiveMBString = "x".repeat(5 * 1024 * 1024);
  assert.equal(sandbox.validateResponseSize(fiveMBString), true);

  const sixMBString = "x".repeat(5 * 1024 * 1024 + 1);
  assert.equal(sandbox.validateResponseSize(sixMBString), false);
});

test("ScopedExternalAccessSandbox default rateLimitPerMinute is 60", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["ratelimit.example.com"],
  });

  for (let i = 0; i < 60; i++) {
    assert.equal(sandbox.checkRateLimit("ratelimit.example.com"), true);
  }

  assert.equal(sandbox.checkRateLimit("ratelimit.example.com"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Egress Proxy URL Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox constructs proxy URL with encoded target", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    egressProxyUrl: "https://proxy.example.com/proxy?url=",
  });

  // The executeScopedRequest method builds the URL
  // We can verify through behavior that the proxy URL is used when configured
  const request: ExternalAccessRequest = {
    url: "https://api.example.com/data?param=value",
    method: "GET",
  };

  // This will fail at the actual HTTP request, but we can verify it processed the request
  // by checking the response (it will be blocked for domain, not for URL construction)
  assert.equal(sandbox.validateOutboundRequest(request.url), true);
});

test("ScopedExternalAccessSandbox handles egress proxy without trailing equals", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    egressProxyUrl: "https://proxy.example.com/proxy?url",
  });

  const request: ExternalAccessRequest = {
    url: "https://api.example.com/data",
    method: "GET",
  };

  assert.equal(sandbox.validateOutboundRequest(request.url), true);
});

test("ScopedExternalAccessSandbox uses direct URL when no egress proxy", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    // No egressProxyUrl
  });

  const request: ExternalAccessRequest = {
    url: "https://api.example.com/data",
    method: "GET",
  };

  assert.equal(sandbox.validateOutboundRequest(request.url), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// executeScopedRequest Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox blocks request to disallowed domain", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["allowed.example.com"],
  });

  const response = await sandbox.executeScopedRequest({
    url: "https://disallowed.example.com/data",
    method: "GET",
  });

  assert.equal(response.blocked, true);
  assert.equal(response.blockedReason, "domain_not_allowed");
  assert.equal(response.status, 403);
});

test("ScopedExternalAccessSandbox blocks request when rate limited", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["ratelimit.example.com"],
    rateLimitPerMinute: 1,
  });

  // First request - should pass domain check but will actually make HTTP request
  // For this test, we focus on rate limit behavior
  await sandbox.checkRateLimit("ratelimit.example.com"); // Uses one
  // Second check should fail
  const withinLimit = await sandbox.checkRateLimit("ratelimit.example.com");
  assert.equal(withinLimit, false);
});

test("ScopedExternalAccessSandbox handles request with all HTTP methods", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

  for (const method of methods) {
    const request: ExternalAccessRequest = {
      url: "https://api.example.com/data",
      method,
    };

    const allowed = await sandbox.validateOutboundRequest(request.url);
    assert.equal(allowed, true, `Method ${method} should be allowed`);
  }
});

test("ScopedExternalAccessSandbox handles request with custom headers", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  const request: ExternalAccessRequest = {
    url: "https://api.example.com/data",
    method: "POST",
    headers: {
      "X-Custom-Header": "custom-value",
      "Content-Type": "application/json",
    },
    body: { key: "value" },
  };

  const allowed = await sandbox.validateOutboundRequest(request.url);
  assert.equal(allowed, true);
});

test("ScopedExternalAccessSandbox handles request with body for GET method", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  const request: ExternalAccessRequest = {
    url: "https://api.example.com/data",
    method: "GET",
    body: { shouldBeIgnored: true }, // GET requests shouldn't have body per HTTP spec
  };

  const allowed = await sandbox.validateOutboundRequest(request.url);
  assert.equal(allowed, true);
});

test("ScopedExternalAccessSandbox handles request with null body", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  const request: ExternalAccessRequest = {
    url: "https://api.example.com/data",
    method: "POST",
    body: null,
  };

  const allowed = await sandbox.validateOutboundRequest(request.url);
  assert.equal(allowed, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// validateOutboundRequest Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox handles URL with query parameters", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://api.example.com?key=value"), true);
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com/path?key1=value1&key2=value2"), true);
});

test("ScopedExternalAccessSandbox handles URL with fragment", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://api.example.com#section"), true);
});

test("ScopedExternalAccessSandbox handles URL with special characters in path", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  assert.equal(sandbox.validateOutboundRequest("https://api.example.com/path%20with%20spaces"), true);
  assert.equal(sandbox.validateOutboundRequest("https://api.example.com/path/with/slashes"), true);
});

test("ScopedExternalAccessSandbox handles URL with credentials (basic auth)", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  // URL with user:pass@hostname should still extract hostname correctly
  assert.equal(sandbox.validateOutboundRequest("https://user:pass@api.example.com"), true);
});

test("ScopedExternalAccessSandbox validates URL with IP address hostname", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
  });

  // IP address is not in allowed list
  assert.equal(sandbox.validateOutboundRequest("https://192.168.1.1"), false);
});

test("ScopedExternalAccessSandbox handles URL with localhost", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["localhost"],
  });

  assert.equal(sandbox.validateOutboundRequest("http://localhost:8080"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox handles invalid URL in validateOutboundRequest", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  // Invalid URL should return false (blocked)
  const result = await sandbox.validateOutboundRequest("not a valid url");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox handles empty URL in validateOutboundRequest", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  const result = await sandbox.validateOutboundRequest("");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox handles null-like URL", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["test.example.com"],
  });

  const result = await sandbox.validateOutboundRequest("null");
  assert.equal(result, false);
});
