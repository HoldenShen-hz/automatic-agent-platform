import assert from "node:assert/strict";
import test from "node:test";

import { WORKER_APP_MANIFEST } from "../../../../src/apps/workers/index.js";

test("WORKER_APP_MANIFEST entryModule points to execution-worker-writeback-service", () => {
  assert.equal(
    WORKER_APP_MANIFEST.entryModule,
    "src/platform/execution/worker-pool/execution-worker-writeback-service.ts"
  );
});

test("WORKER_APP_MANIFEST defaultPort is null (job mode)", () => {
  assert.equal(WORKER_APP_MANIFEST.defaultPort, null);
});

test("WORKER_APP_MANIFEST healthEndpoint is null (job mode)", () => {
  assert.equal(WORKER_APP_MANIFEST.healthEndpoint, null);
});

test("WORKER_APP_MANIFEST capabilities include all expected values", () => {
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("dispatch_execution"));
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("writeback"));
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("lease_heartbeat"));
});

test("WORKER_APP_MANIFEST startupMode is job", () => {
  assert.equal(WORKER_APP_MANIFEST.startupMode, "job");
});

test("WORKER_APP_MANIFEST startupCommand is correct", () => {
  assert.equal(WORKER_APP_MANIFEST.startupCommand, "npm run worker-writeback");
});

test("WORKER_APP_MANIFEST requiredLayers includes platform and domains", () => {
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("platform"));
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("domains"));
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("scale-ecosystem"));
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("ops-maturity"));
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("apps"));
});

test("WORKER_APP_MANIFEST has all required properties per PlatformAppManifest", () => {
  assert.ok(typeof WORKER_APP_MANIFEST.appId === "string");
  assert.ok(typeof WORKER_APP_MANIFEST.kind === "string");
  assert.ok(typeof WORKER_APP_MANIFEST.entryModule === "string");
  assert.ok(WORKER_APP_MANIFEST.defaultPort === null || typeof WORKER_APP_MANIFEST.defaultPort === "number");
  assert.ok(WORKER_APP_MANIFEST.healthEndpoint === null || typeof WORKER_APP_MANIFEST.healthEndpoint === "string");
  assert.ok(Array.isArray(WORKER_APP_MANIFEST.capabilities));
  assert.ok(Array.isArray(WORKER_APP_MANIFEST.requiredLayers));
  assert.ok(typeof WORKER_APP_MANIFEST.startupCommand === "string");
  assert.ok(WORKER_APP_MANIFEST.startupMode === "daemon" || WORKER_APP_MANIFEST.startupMode === "job");
});
