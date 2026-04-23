import assert from "node:assert/strict";
import test from "node:test";

import { CONSOLE_APP_MANIFEST } from "../../../../src/apps/console/index.js";
import type { PlatformAppManifest } from "../../../../src/platform-architecture-types.js";

test("CONSOLE_APP_MANIFEST has correct structure and defaults", () => {
  const manifest: PlatformAppManifest = CONSOLE_APP_MANIFEST;
  assert.equal(manifest.appId, "automatic-agent-console");
  assert.equal(manifest.kind, "console");
  assert.equal(manifest.defaultPort, 3000);
  assert.equal(manifest.healthEndpoint, "/api/health");
  assert.ok(Array.isArray(manifest.capabilities));
  assert.ok(manifest.capabilities.includes("operator_console"));
  assert.ok(manifest.capabilities.includes("takeover_planning"));
  assert.equal(manifest.startupMode, "daemon");
});

test("CONSOLE_APP_MANIFEST startup command uses npm run api", () => {
  assert.equal(CONSOLE_APP_MANIFEST.startupCommand, "npm run api");
});

test("CONSOLE_APP_MANIFEST requires interaction and org-governance layers", () => {
  const requiredLayers = CONSOLE_APP_MANIFEST.requiredLayers;
  assert.ok(requiredLayers.includes("interaction"));
  assert.ok(requiredLayers.includes("org-governance"));
  assert.ok(requiredLayers.includes("scale-ecosystem"));
});