import assert from "node:assert/strict";
import test from "node:test";

import {
  isBlockedOutboundHostname,
  isSupportedOutboundProtocol,
  isInternalNetworkUrl,
  parseSafeOutboundUrl,
  sanitizeUrlForTelemetry,
} from "../../../../../src/platform/five-plane-control-plane/iam/outbound-url-policy.js";

test("isBlockedOutboundHostname blocks localhost", () => {
  assert.equal(isBlockedOutboundHostname("localhost"), true);
  assert.equal(isBlockedOutboundHostname("127.0.0.1"), true);
  assert.equal(isBlockedOutboundHostname("0.0.0.0"), true);
});

test("isBlockedOutboundHostname blocks AWS metadata endpoint", () => {
  assert.equal(isBlockedOutboundHostname("169.254.169.254"), true);
});

test("isBlockedOutboundHostname blocks GCP metadata endpoint", () => {
  assert.equal(isBlockedOutboundHostname("metadata.google.internal"), true);
});

test("isBlockedOutboundHostname blocks IPv4 private ranges", () => {
  assert.equal(isBlockedOutboundHostname("10.0.0.1"), true);
  assert.equal(isBlockedOutboundHostname("10.255.255.255"), true);
  assert.equal(isBlockedOutboundHostname("172.16.0.1"), true);
  assert.equal(isBlockedOutboundHostname("172.31.255.255"), true);
  assert.equal(isBlockedOutboundHostname("192.168.0.1"), true);
  assert.equal(isBlockedOutboundHostname("192.168.255.255"), true);
});

test("isBlockedOutboundHostname blocks link-local addresses", () => {
  assert.equal(isBlockedOutboundHostname("169.254.0.1"), true);
  assert.equal(isBlockedOutboundHostname("fe80::1"), true);
  assert.equal(isBlockedOutboundHostname("fc00::1"), true);
  assert.equal(isBlockedOutboundHostname("fd00::1"), true);
});

test("isBlockedOutboundHostname blocks IPv6 loopback", () => {
  assert.equal(isBlockedOutboundHostname("::1"), true);
  assert.equal(isBlockedOutboundHostname("[::1]"), true);
});

test("isBlockedOutboundHostname blocks suspicious TLDs", () => {
  assert.equal(isBlockedOutboundHostname("myhost.local"), true);
  assert.equal(isBlockedOutboundHostname("myhost.localhost"), true);
  assert.equal(isBlockedOutboundHostname("myhost.internal"), true);
  assert.equal(isBlockedOutboundHostname("myhost.private"), true);
});

test("isBlockedOutboundHostname allows public hostnames", () => {
  assert.equal(isBlockedOutboundHostname("example.com"), false);
  assert.equal(isBlockedOutboundHostname("api.github.com"), false);
  assert.equal(isBlockedOutboundHostname("cloud.google.com"), false);
});

test("isBlockedOutboundHostname handles case insensitivity", () => {
  assert.equal(isBlockedOutboundHostname("LOCALHOST"), true);
  assert.equal(isBlockedOutboundHostname("MyHost.Local"), true);
});

test("isSupportedOutboundProtocol allows http and https", () => {
  assert.equal(isSupportedOutboundProtocol("http:"), true);
  assert.equal(isSupportedOutboundProtocol("https:"), true);
});

test("isSupportedOutboundProtocol rejects other protocols", () => {
  assert.equal(isSupportedOutboundProtocol("ftp:"), false);
  assert.equal(isSupportedOutboundProtocol("file:"), false);
  assert.equal(isSupportedOutboundProtocol("data:"), false);
});

test("isInternalNetworkUrl detects internal URLs", () => {
  assert.equal(isInternalNetworkUrl(new URL("http://localhost/path")), true);
  assert.equal(isInternalNetworkUrl(new URL("http://127.0.0.1/path")), true);
  assert.equal(isInternalNetworkUrl(new URL("http://10.0.0.1/path")), true);
  assert.equal(isInternalNetworkUrl(new URL("http://169.254.169.254/path")), true);
});

test("isInternalNetworkUrl allows external URLs", () => {
  assert.equal(isInternalNetworkUrl(new URL("https://example.com/path")), false);
  assert.equal(isInternalNetworkUrl(new URL("https://api.github.com/path")), false);
});

test("isInternalNetworkUrl blocks non-http protocols", () => {
  assert.equal(isInternalNetworkUrl(new URL("ftp://example.com/path")), true);
});

test("parseSafeOutboundUrl returns parsed URL for valid external URL", () => {
  const url = parseSafeOutboundUrl("https://example.com/path", {
    invalid: "url.invalid",
    blocked: "url.blocked",
  });

  assert.equal(url.hostname, "example.com");
  assert.equal(url.pathname, "/path");
});

test("parseSafeOutboundUrl throws for invalid URL", () => {
  assert.throws(
    () => parseSafeOutboundUrl("not-a-url", { invalid: "url.invalid", blocked: "url.blocked" }),
    (error: any) => error.code === "url.invalid"
  );
});

test("parseSafeOutboundUrl throws for internal URL", () => {
  assert.throws(
    () => parseSafeOutboundUrl("http://localhost/path", { invalid: "url.invalid", blocked: "url.blocked" }),
    (error: any) => error.code === "url.blocked"
  );
});

test("sanitizeUrlForTelemetry removes sensitive query params", () => {
  const result = sanitizeUrlForTelemetry("https://example.com/api?api_key=secret123&name=test");

  assert.ok(result.includes("api_key=***"));
  assert.ok(result.includes("name=test"));
  assert.ok(!result.includes("secret123"));
});

test("sanitizeUrlForTelemetry removes authorization header", () => {
  const result = sanitizeUrlForTelemetry("https://example.com/api?authorization=Bearer%20token123");

  assert.ok(result.includes("authorization=***"));
  assert.ok(!result.includes("token123"));
});

test("sanitizeUrlForTelemetry removes password in URL", () => {
  const result = sanitizeUrlForTelemetry("https://user:password@example.com/path");

  assert.ok(result.includes("***:***@"));
  assert.ok(!result.includes("password"));
});

test("sanitizeUrlForTelemetry redacts bot tokens in path", () => {
  const result = sanitizeUrlForTelemetry("https://example.com/bot123/token/path");

  assert.ok(result.includes("/bot***/"));
  assert.ok(!result.includes("bot123"));
  // Only the bot ID is redacted, not subsequent path segments
  assert.ok(result.includes("token/path"));
});

test("sanitizeUrlForTelemetry handles URL objects", () => {
  const url = new URL("https://example.com/api?key=secret");
  const result = sanitizeUrlForTelemetry(url);

  assert.ok(result.includes("key=***"));
});

test("sanitizeUrlForTelemetry handles unparseable strings gracefully", () => {
  // Should not throw, returns original string when no patterns match
  const result = sanitizeUrlForTelemetry("not-a-url-with-key=secret");
  // The fallback regex doesn't match this format, so original is returned
  assert.equal(result, "not-a-url-with-key=secret");
});
