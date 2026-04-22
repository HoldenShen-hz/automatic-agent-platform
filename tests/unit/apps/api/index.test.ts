import assert from "node:assert/strict";
import test from "node:test";

import { API_APP_MANIFEST } from "../../../../src/apps/api/index.js";
import type { PlatformAppManifest } from "../../../../src/platform-architecture-types.js";

test("API app manifest exposes canonical API entry metadata", () => {
  const manifest: PlatformAppManifest = API_APP_MANIFEST;
  assert.equal(manifest.kind, "api");
  assert.equal(manifest.defaultPort, 8004);
  assert.ok(manifest.capabilities.includes("http_api"));
  assert.equal(manifest.startupCommand, "npm run api");
  assert.ok(manifest.requiredLayers.includes("platform"));
});
