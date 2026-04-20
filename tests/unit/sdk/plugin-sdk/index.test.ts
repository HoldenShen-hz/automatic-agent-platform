import assert from "node:assert/strict";
import test from "node:test";

import { validatePluginManifest } from "../../../../src/sdk/plugin-sdk/index.js";

test("plugin-sdk validates and normalizes plugin manifests", () => {
  const manifest = validatePluginManifest({
    pluginId: " ops-plugin ",
    version: "1.0.0",
    owner: "ops@example.com",
    runtime: "sandboxed",
    entrypoint: " ./dist/index.js ",
    capabilities: [
      { name: "query", description: "Run query", scopes: ["read", "read", "events"] },
    ],
  });

  assert.equal(manifest.pluginId, "ops-plugin");
  assert.deepEqual(manifest.capabilities[0]?.scopes, ["read", "events"]);
});
