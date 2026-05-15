import assert from "node:assert/strict";
import test from "node:test";

import { CONSOLE_APP_MANIFEST } from "../../../../src/apps/console/index.js";

test("CONSOLE_APP_MANIFEST entryModule points to console-backend", () => {
  assert.equal(
    CONSOLE_APP_MANIFEST.entryModule,
    "src/platform/five-plane-interface/console-backend/index.ts"
  );
});

test("CONSOLE_APP_MANIFEST defaultPort is 3000", () => {
  assert.equal(CONSOLE_APP_MANIFEST.defaultPort, 3000);
});

test("CONSOLE_APP_MANIFEST healthEndpoint is /api/health", () => {
  assert.equal(CONSOLE_APP_MANIFEST.healthEndpoint, "/api/health");
});

test("CONSOLE_APP_MANIFEST capabilities include all expected values", () => {
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("operator_console"));
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("takeover_planning"));
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("tenant_dashboard"));
});

test("CONSOLE_APP_MANIFEST startupMode is daemon", () => {
  assert.equal(CONSOLE_APP_MANIFEST.startupMode, "daemon");
});

test("CONSOLE_APP_MANIFEST requiredLayers includes platform and interaction", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("platform"));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("interaction"));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("org-governance"));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("scale-ecosystem"));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("ops-maturity"));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("apps"));
});

test("CONSOLE_APP_MANIFEST has all required properties per PlatformAppManifest", () => {
  assert.ok(typeof CONSOLE_APP_MANIFEST.appId === "string");
  assert.ok(typeof CONSOLE_APP_MANIFEST.kind === "string");
  assert.ok(typeof CONSOLE_APP_MANIFEST.entryModule === "string");
  assert.ok(typeof CONSOLE_APP_MANIFEST.defaultPort === "number");
  assert.ok(typeof CONSOLE_APP_MANIFEST.healthEndpoint === "string");
  assert.ok(Array.isArray(CONSOLE_APP_MANIFEST.capabilities));
  assert.ok(Array.isArray(CONSOLE_APP_MANIFEST.requiredLayers));
  assert.ok(typeof CONSOLE_APP_MANIFEST.startupCommand === "string");
  assert.ok(CONSOLE_APP_MANIFEST.startupMode === "daemon" || CONSOLE_APP_MANIFEST.startupMode === "job");
});
