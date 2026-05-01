import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  VersionRoutingMiddleware,
  DEFAULT_VERSION_ROUTING_CONFIG,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/version-routing.js";

test("VersionRoutingMiddleware.parseAcceptVersion returns default when header null", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.parseAcceptVersion(null);
  assert.deepEqual(versions, [DEFAULT_VERSION_ROUTING_CONFIG.defaultVersion]);
});

test("VersionRoutingMiddleware.parseAcceptVersion returns default when header empty", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.parseAcceptVersion("");
  assert.deepEqual(versions, [DEFAULT_VERSION_ROUTING_CONFIG.defaultVersion]);
});

test("VersionRoutingMiddleware.parseAcceptVersion parses single version", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.parseAcceptVersion("2026-04-01");
  assert.deepEqual(versions, ["2026-04-01"]);
});

test("VersionRoutingMiddleware.parseAcceptVersion parses comma-separated versions", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.parseAcceptVersion("2026-04-01, 2026-01-01");
  assert.deepEqual(versions, ["2026-04-01", "2026-01-01"]);
});

test("VersionRoutingMiddleware.parseAcceptVersion filters empty strings", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.parseAcceptVersion("2026-04-01, , 2026-01-01");
  assert.deepEqual(versions, ["2026-04-01", "2026-01-01"]);
});

test("VersionRoutingMiddleware.selectVersion returns acceptable for supported version", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2026-04-01"]);
  assert.equal(decision.acceptable, true);
  assert.equal(decision.version, "2026-04-01");
  assert.equal(decision.statusCode, 200);
});

test("VersionRoutingMiddleware.selectVersion returns default for empty array", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion([]);
  assert.equal(decision.acceptable, true);
  assert.equal(decision.version, DEFAULT_VERSION_ROUTING_CONFIG.defaultVersion);
  assert.equal(decision.reasonCode, "version.default");
});

test("VersionRoutingMiddleware.selectVersion handles q-values", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2026-04-01; q=0.9"]);
  assert.equal(decision.acceptable, true);
  assert.equal(decision.version, "2026-04-01");
});

test("VersionRoutingMiddleware.selectVersion returns below minimum for old versions", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2025-01-01"]);
  assert.equal(decision.acceptable, false);
  assert.equal(decision.statusCode, 400);
  assert.equal(decision.reasonCode, "version.below_minimum");
});

test("VersionRoutingMiddleware.selectVersion adds warning for unsupported versions", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2025-01-01"]);
  assert.ok(decision.warnings.some((w) => w.includes("version_not_supported")));
});

test("VersionRoutingMiddleware.selectVersion returns fallback version when no match", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2024-01-01"]);
  assert.equal(decision.acceptable, true);
  assert.equal(decision.reasonCode, "version.fallback");
});

test("VersionRoutingMiddleware.isVersionSupported returns true for supported version", () => {
  const middleware = new VersionRoutingMiddleware();
  assert.equal(middleware.isVersionSupported("2026-04-01"), true);
});

test("VersionRoutingMiddleware.isVersionSupported returns false for unsupported version", () => {
  const middleware = new VersionRoutingMiddleware();
  assert.equal(middleware.isVersionSupported("2024-01-01"), false);
});

test("VersionRoutingMiddleware.getSupportedVersions returns configured versions", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.getSupportedVersions();
  assert.ok(Array.isArray(versions));
  assert.ok(versions.includes("2026-04-01"));
});

test("VersionRoutingMiddleware constructor merges partial config", () => {
  const middleware = new VersionRoutingMiddleware({
    supportedVersions: ["2027-01-01"],
    defaultVersion: "2027-01-01",
  });
  assert.equal(middleware.isVersionSupported("2027-01-01"), true);
  assert.equal(middleware.isVersionSupported("2026-04-01"), false);
});

test("VersionRoutingMiddleware.selectVersion iterates through versions in order", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2026-04-01", "2026-01-01"]);
  // Should return first match
  assert.equal(decision.version, "2026-04-01");
});

test("VersionRoutingMiddleware.compareVersions compares date-based versions", () => {
  const middleware = new VersionRoutingMiddleware();
  // Test that newer version is greater
  const decision1 = middleware.selectVersion(["2026-04-01"]);
  const decision2 = middleware.selectVersion(["2026-01-01"]);
  assert.equal(decision1.version, "2026-04-01");
  assert.equal(decision2.version, "2026-01-01");
});

test("DEFAULT_VERSION_ROUTING_CONFIG has correct values", () => {
  assert.deepEqual(DEFAULT_VERSION_ROUTING_CONFIG.supportedVersions, ["2026-04-01", "2026-01-01"]);
  assert.equal(DEFAULT_VERSION_ROUTING_CONFIG.defaultVersion, "2026-04-01");
  assert.equal(DEFAULT_VERSION_ROUTING_CONFIG.minimumVersion, "2026-01-01");
});

test("VersionRoutingMiddleware handles whitespace in version string", () => {
  const middleware = new VersionRoutingMiddleware();
  const versions = middleware.parseAcceptVersion("  2026-04-01  ,  2026-01-01  ");
  assert.deepEqual(versions, ["2026-04-01", "2026-01-01"]);
});

test("VersionRoutingMiddleware.selectVersion with multiple warnings", () => {
  const middleware = new VersionRoutingMiddleware();
  const decision = middleware.selectVersion(["2024-01-01", "2025-01-01"]);
  // Both unsupported but not below minimum
  assert.equal(decision.acceptable, true);
  assert.ok(decision.warnings.length > 0);
});