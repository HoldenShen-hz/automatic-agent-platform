import assert from "node:assert/strict";
import test from "node:test";

import * as apps from "../../src/apps/index.js";
import * as domains from "../../src/domains/index.js";
import type { PlatformAppKind } from "../../src/platform-architecture-types.js";

// ============================================================================
// Apps barrel exports
// ============================================================================

test("apps barrel exports listPlatformApps function", () => {
  assert.ok(typeof apps.listPlatformApps === "function", "listPlatformApps should be exported");
});

test("apps barrel exports listPlatformAppKinds function", () => {
  assert.ok(typeof apps.listPlatformAppKinds === "function", "listPlatformAppKinds should be exported");
});

test("apps barrel exports getPlatformAppManifestByKind function", () => {
  assert.ok(typeof apps.getPlatformAppManifestByKind === "function", "getPlatformAppManifestByKind should be exported");
});

test("apps barrel exports resolvePlatformAppManifest function", () => {
  assert.ok(typeof apps.resolvePlatformAppManifest === "function", "resolvePlatformAppManifest should be exported");
});

test("apps barrel exports buildPlatformStartupTargets function", () => {
  assert.ok(typeof apps.buildPlatformStartupTargets === "function", "buildPlatformStartupTargets should be exported");
});

test("apps barrel exports resolvePlatformStartupTarget function", () => {
  assert.ok(typeof apps.resolvePlatformStartupTarget === "function", "resolvePlatformStartupTarget should be exported");
});

test("apps buildPlatformStartupTargets returns array with summary and demo targets", () => {
  const platformApps = apps.listPlatformApps();
  assert.ok(Array.isArray(platformApps), "should return an array");
  assert.ok(platformApps.length > 0, "should have at least one app");

  const kinds = platformApps.map((app) => app.kind);
  assert.ok(kinds.includes("api"), "should include api app");
  assert.ok(kinds.includes("console"), "should include console app");
  assert.ok(kinds.includes("worker"), "should include worker app");
});

test("apps listPlatformAppKinds returns array of platform app kinds", () => {
  const kinds = apps.listPlatformAppKinds();
  assert.ok(Array.isArray(kinds), "should return an array");
  assert.equal(kinds.length, apps.listPlatformApps().length, "should match listPlatformApps length");
});

test("apps buildPlatformStartupTargets returns array with summary and demo targets", () => {
  const targets = apps.buildPlatformStartupTargets();
  assert.ok(Array.isArray(targets), "should return an array");
  assert.ok(targets.some((t) => t.targetKind === "summary"), "should include summary target");
  assert.ok(targets.some((t) => t.targetKind === "demo"), "should include demo target");
});

test("apps getPlatformAppManifestByKind throws for unknown kind", () => {
  assert.throws(
    () => apps.getPlatformAppManifestByKind("unknown" as PlatformAppKind),
    /Unknown platform app kind/,
  );
});

test("apps resolvePlatformAppManifest returns null for unknown selector", () => {
  const result = apps.resolvePlatformAppManifest("nonexistent");
  assert.equal(result, null, "should return null for unknown selector");
});

// ============================================================================
// Domains barrel exports
// ============================================================================

test("domains barrel exports exist", () => {
  assert.ok(domains != null, "domains namespace should exist");
  assert.ok(typeof domains === "object", "domains should be an object");
});

test("domains barrel exports architectureRemediation namespace", () => {
  assert.ok(domains.architectureRemediation != null, "architectureRemediation should be exported");
});
