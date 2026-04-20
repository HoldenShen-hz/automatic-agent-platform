import assert from "node:assert/strict";
import test from "node:test";

import { API_APP_MANIFEST, type PlatformAppManifest } from "../../../../src/apps/api/index.js";

test("API app manifest exposes canonical API entry metadata", () => {
  const manifest: PlatformAppManifest = API_APP_MANIFEST;
  assert.equal(manifest.kind, "api");
  assert.equal(manifest.defaultPort, 8004);
  assert.ok(manifest.capabilities.includes("http_api"));
});
