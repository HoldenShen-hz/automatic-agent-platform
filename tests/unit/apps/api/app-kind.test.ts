import assert from "node:assert/strict";
import test from "node:test";

import { API_APP_MANIFEST } from "../../../../src/apps/api/index.js";

test("API_APP_MANIFEST has correct appId", () => {
  assert.equal(API_APP_MANIFEST.appId, "automatic-agent-api");
});

test("API_APP_MANIFEST kind is api", () => {
  assert.equal(API_APP_MANIFEST.kind, "api");
});

test("API_APP_MANIFEST defaultPort is a number", () => {
  assert.equal(typeof API_APP_MANIFEST.defaultPort, "number");
  assert.equal(API_APP_MANIFEST.defaultPort, 8004);
});

test("API_APP_MANIFEST healthEndpoint is a non-empty string", () => {
  assert.equal(typeof API_APP_MANIFEST.healthEndpoint, "string");
  assert.ok(API_APP_MANIFEST.healthEndpoint.length > 0);
  assert.equal(API_APP_MANIFEST.healthEndpoint, "/health");
});

test("API_APP_MANIFEST capabilities is a non-empty array", () => {
  assert.ok(Array.isArray(API_APP_MANIFEST.capabilities));
  assert.ok(API_APP_MANIFEST.capabilities.length > 0);
});

test("API_APP_MANIFEST capabilities are all unique", () => {
  const capabilities = API_APP_MANIFEST.capabilities;
  const uniqueCapabilities = new Set(capabilities);
  assert.equal(uniqueCapabilities.size, capabilities.length);
});

test("API_APP_MANIFEST requiredLayers is a non-empty array", () => {
  assert.ok(Array.isArray(API_APP_MANIFEST.requiredLayers));
  assert.ok(API_APP_MANIFEST.requiredLayers.length > 0);
});

test("API_APP_MANIFEST startupCommand is a non-empty string", () => {
  assert.equal(typeof API_APP_MANIFEST.startupCommand, "string");
  assert.ok(API_APP_MANIFEST.startupCommand.length > 0);
});

test("API_APP_MANIFEST startupMode is daemon", () => {
  assert.equal(API_APP_MANIFEST.startupMode, "daemon");
});

test("API_APP_MANIFEST entryModule is a valid module path", () => {
  assert.equal(typeof API_APP_MANIFEST.entryModule, "string");
  assert.ok(API_APP_MANIFEST.entryModule.startsWith("src/"));
  assert.ok(API_APP_MANIFEST.entryModule.endsWith(".ts"));
});

test("API_APP_MANIFEST capabilities include http_api", () => {
  assert.ok(API_APP_MANIFEST.capabilities.includes("http_api"));
});

test("API_APP_MANIFEST requiredLayers includes all required platform layers", () => {
  const layers = API_APP_MANIFEST.requiredLayers;
  const requiredLayers = [
    "platform",
    "domains",
    "interaction",
    "org-governance",
    "scale-ecosystem",
    "ops-maturity",
    "plugins",
    "sdk",
    "apps",
  ];

  for (const layer of requiredLayers) {
    assert.ok(layers.includes(layer), `Missing layer: ${layer}`);
  }
});

test("API_APP_MANIFEST requiredLayers count matches expected", () => {
  assert.equal(API_APP_MANIFEST.requiredLayers.length, 9);
});

test("API_APP_MANIFEST capabilities count is 4", () => {
  assert.equal(API_APP_MANIFEST.capabilities.length, 4);
});
