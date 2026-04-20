/**
 * Security Integration Test: SSRF Prevention
 *
 * Verifies Server-Side Request Forgery attack prevention:
 * - AWS metadata endpoint blocking
 * - Localhost/private network blocking
 * - IPv6 loopback blocking
 * - DNS rebinding protection
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  NetworkEgressPolicyService,
  NetworkEgressPolicyConfig,
  NetworkEgressDecision,
} from "../../../../src/platform/control-plane/iam/network-egress-policy.js";

test("security: AWS metadata endpoint (169.254.169.254) is blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  // AWS metadata endpoint - should be blocked
  const result = policy.evaluate("http://169.254.169.254/latest/meta-data/");

  assert.strictEqual(result.allowed, false, "AWS metadata endpoint should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
  assert.ok(
    result.reasonCode?.toLowerCase().includes("internal") || result.reasonCode?.toLowerCase().includes("blocked"),
    `Reason code should indicate internal network block: ${result.reasonCode}`,
  );
});

test("security: localhost (127.0.0.1) is blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://127.0.0.1:8080/admin");

  assert.strictEqual(result.allowed, false, "Localhost should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: localhost with alternative port is blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://127.0.0.1:3000/api/v1/users");

  assert.strictEqual(result.allowed, false, "Localhost with port should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: IPv6 loopback (::1) is blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://[::1]:8080/admin");

  assert.strictEqual(result.allowed, false, "IPv6 loopback should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: private network ranges (10.x) are blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  // 10.x private network
  const result = policy.evaluate("http://10.0.0.5:8080/internal/api");

  assert.strictEqual(result.allowed, false, "10.x private network should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: private network ranges (172.16-31.x) are blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  // 172.16-31.x private network range
  const result = policy.evaluate("http://172.20.0.1:8080/admin");

  assert.strictEqual(result.allowed, false, "172.16-31.x private network should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: private network ranges (192.168.x) are blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://192.168.1.100:8080/router");

  assert.strictEqual(result.allowed, false, "192.168.x private network should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: 0.0.0.0 (all interfaces) is blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://0.0.0.0:8080/admin");

  assert.strictEqual(result.allowed, false, "0.0.0.0 should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});

test("security: legitimate external URLs are allowed", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
    allowedDomains: ["api.github.com", "*.anthropic.com"],
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("https://api.github.com/users");

  assert.strictEqual(result.allowed, true, "Legitimate external URL should be allowed");
  assert.strictEqual(result.reasonCode, null, "No reason code for allowed URL");
});

test("security: allowed internal hosts can be permitted when configured", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: true, // Allow internal hosts for this policy
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://127.0.0.1:8080/admin");

  // With allowInternalHosts: true, localhost should be allowed
  assert.strictEqual(result.allowed, true, "Localhost should be allowed when allowInternalHosts is true");
});

test("security: audit_only mode logs but does not block", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "audit_only",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  const result = policy.evaluate("http://169.254.169.254/latest/meta-data/");

  // In audit_only mode, should still return allowed=true but with reason code
  assert.strictEqual(result.allowed, true, "Audit mode should not block");
  assert.ok(result.reasonCode !== null, "Should still have reason code in audit mode");
});

test("security: DNS-based internal host resolution is blocked", () => {
  const config: NetworkEgressPolicyConfig = {
    enabled: true,
    mode: "enforce",
    allowInternalHosts: false,
  };

  const policy = new NetworkEgressPolicyService(config);

  // Some internal DNS names resolve to private IPs
  const result = policy.evaluate("http://metadata.internal/latest/meta-data/");

  // Should be blocked based on the hostname pattern or resolved IP
  assert.strictEqual(result.allowed, false, "Internal hostname should be blocked");
  assert.ok(result.reasonCode !== null, "Should have a reason code");
});
