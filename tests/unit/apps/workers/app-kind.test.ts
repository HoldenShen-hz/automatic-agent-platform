import assert from "node:assert/strict";
import test from "node:test";

import { WORKER_APP_MANIFEST } from "../../../../src/apps/workers/index.js";

test("WORKER_APP_MANIFEST has correct appId", () => {
  assert.equal(WORKER_APP_MANIFEST.appId, "automatic-agent-worker");
});

test("WORKER_APP_MANIFEST kind is worker", () => {
  assert.equal(WORKER_APP_MANIFEST.kind, "worker");
});

test("WORKER_APP_MANIFEST defaultPort is null for job mode", () => {
  assert.equal(WORKER_APP_MANIFEST.defaultPort, null);
});

test("WORKER_APP_MANIFEST healthEndpoint is null for job mode", () => {
  assert.equal(WORKER_APP_MANIFEST.healthEndpoint, null);
});

test("WORKER_APP_MANIFEST capabilities is a non-empty array", () => {
  assert.ok(Array.isArray(WORKER_APP_MANIFEST.capabilities));
  assert.ok(WORKER_APP_MANIFEST.capabilities.length > 0);
});

test("WORKER_APP_MANIFEST capabilities are all unique", () => {
  const capabilities = WORKER_APP_MANIFEST.capabilities;
  const uniqueCapabilities = new Set(capabilities);
  assert.equal(uniqueCapabilities.size, capabilities.length);
});

test("WORKER_APP_MANIFEST requiredLayers is a non-empty array", () => {
  assert.ok(Array.isArray(WORKER_APP_MANIFEST.requiredLayers));
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.length > 0);
});

test("WORKER_APP_MANIFEST startupCommand is a non-empty string", () => {
  assert.equal(typeof WORKER_APP_MANIFEST.startupCommand, "string");
  assert.ok(WORKER_APP_MANIFEST.startupCommand.length > 0);
});

test("WORKER_APP_MANIFEST startupMode is job", () => {
  assert.equal(WORKER_APP_MANIFEST.startupMode, "job");
});

test("WORKER_APP_MANIFEST entryModule is a valid module path", () => {
  assert.equal(typeof WORKER_APP_MANIFEST.entryModule, "string");
  assert.ok(WORKER_APP_MANIFEST.entryModule.startsWith("src/"));
  assert.ok(WORKER_APP_MANIFEST.entryModule.endsWith(".ts"));
});

test("WORKER_APP_MANIFEST capabilities include dispatch_execution", () => {
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("dispatch_execution"));
});

test("WORKER_APP_MANIFEST capabilities include writeback", () => {
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("writeback"));
});

test("WORKER_APP_MANIFEST capabilities include lease_heartbeat", () => {
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("lease_heartbeat"));
});

test("WORKER_APP_MANIFEST requiredLayers includes platform", () => {
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("platform"));
});

test("WORKER_APP_MANIFEST requiredLayers includes domains", () => {
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("domains"));
});

test("WORKER_APP_MANIFEST requiredLayers includes scale-ecosystem", () => {
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("scale-ecosystem"));
});

test("WORKER_APP_MANIFEST requiredLayers includes ops-maturity", () => {
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("ops-maturity"));
});

test("WORKER_APP_MANIFEST requiredLayers includes apps", () => {
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("apps"));
});

test("WORKER_APP_MANIFEST requiredLayers count is 7", () => {
  assert.equal(WORKER_APP_MANIFEST.requiredLayers.length, 7);
});

test("WORKER_APP_MANIFEST capabilities count is 3", () => {
  assert.equal(WORKER_APP_MANIFEST.capabilities.length, 3);
});
