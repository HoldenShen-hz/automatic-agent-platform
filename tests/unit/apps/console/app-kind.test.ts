import assert from "node:assert/strict";
import test from "node:test";

import { CONSOLE_APP_MANIFEST } from "../../../../src/apps/console/index.js";

test("CONSOLE_APP_MANIFEST has correct appId", () => {
  assert.equal(CONSOLE_APP_MANIFEST.appId, "automatic-agent-console");
});

test("CONSOLE_APP_MANIFEST kind is console", () => {
  assert.equal(CONSOLE_APP_MANIFEST.kind, "console");
});

test("CONSOLE_APP_MANIFEST defaultPort is a number", () => {
  assert.equal(typeof CONSOLE_APP_MANIFEST.defaultPort, "number");
  assert.equal(CONSOLE_APP_MANIFEST.defaultPort, 3000);
});

test("CONSOLE_APP_MANIFEST healthEndpoint is a non-empty string", () => {
  assert.equal(typeof CONSOLE_APP_MANIFEST.healthEndpoint, "string");
  assert.ok(CONSOLE_APP_MANIFEST.healthEndpoint.length > 0);
  assert.equal(CONSOLE_APP_MANIFEST.healthEndpoint, "/api/health");
});

test("CONSOLE_APP_MANIFEST capabilities is a non-empty array", () => {
  assert.ok(Array.isArray(CONSOLE_APP_MANIFEST.capabilities));
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.length > 0);
});

test("CONSOLE_APP_MANIFEST capabilities are all unique", () => {
  const capabilities = CONSOLE_APP_MANIFEST.capabilities;
  const uniqueCapabilities = new Set(capabilities);
  assert.equal(uniqueCapabilities.size, capabilities.length);
});

test("CONSOLE_APP_MANIFEST requiredLayers is a non-empty array", () => {
  assert.ok(Array.isArray(CONSOLE_APP_MANIFEST.requiredLayers));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.length > 0);
});

test("CONSOLE_APP_MANIFEST startupCommand is a non-empty string", () => {
  assert.equal(typeof CONSOLE_APP_MANIFEST.startupCommand, "string");
  assert.ok(CONSOLE_APP_MANIFEST.startupCommand.length > 0);
});

test("CONSOLE_APP_MANIFEST startupMode is daemon", () => {
  assert.equal(CONSOLE_APP_MANIFEST.startupMode, "daemon");
});

test("CONSOLE_APP_MANIFEST entryModule is a valid module path", () => {
  assert.equal(typeof CONSOLE_APP_MANIFEST.entryModule, "string");
  assert.ok(CONSOLE_APP_MANIFEST.entryModule.startsWith("src/"));
  assert.ok(CONSOLE_APP_MANIFEST.entryModule.endsWith(".ts"));
});

test("CONSOLE_APP_MANIFEST capabilities include operator_console", () => {
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("operator_console"));
});

test("CONSOLE_APP_MANIFEST capabilities include takeover_planning", () => {
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("takeover_planning"));
});

test("CONSOLE_APP_MANIFEST capabilities include tenant_dashboard", () => {
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("tenant_dashboard"));
});

test("CONSOLE_APP_MANIFEST requiredLayers includes platform", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("platform"));
});

test("CONSOLE_APP_MANIFEST requiredLayers includes interaction", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("interaction"));
});

test("CONSOLE_APP_MANIFEST requiredLayers includes org-governance", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("org-governance"));
});

test("CONSOLE_APP_MANIFEST requiredLayers includes scale-ecosystem", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("scale-ecosystem"));
});

test("CONSOLE_APP_MANIFEST requiredLayers includes ops-maturity", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("ops-maturity"));
});

test("CONSOLE_APP_MANIFEST requiredLayers includes apps", () => {
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("apps"));
});

test("CONSOLE_APP_MANIFEST requiredLayers count is 6", () => {
  assert.equal(CONSOLE_APP_MANIFEST.requiredLayers.length, 6);
});

test("CONSOLE_APP_MANIFEST capabilities count is 3", () => {
  assert.equal(CONSOLE_APP_MANIFEST.capabilities.length, 3);
});
