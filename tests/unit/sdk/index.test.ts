import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_ENTRYPOINTS,
  SdkWorkbenchService,
  buildApiUrl,
  summarizeCapabilityMatrix,
  validatePluginManifest,
} from "../../../src/sdk/index.js";

test("sdk barrel exports cli, client, pack, and plugin surfaces", () => {
  assert.ok(CLI_ENTRYPOINTS.includes("doctor"));
  assert.equal(typeof SdkWorkbenchService, "function");
  assert.match(buildApiUrl({ baseUrl: "https://api.example.com", apiVersion: "v1" }, { path: "health" }), /\/v1\/health$/);
  assert.equal(validatePluginManifest({
    pluginId: "plugin-a",
    version: "1.0.0",
    owner: "owner",
    runtime: "local",
    entrypoint: "dist/index.js",
    capabilities: [{ name: "read", description: "Read", scopes: ["read"] }],
  }).pluginId, "plugin-a");
  assert.deepEqual(summarizeCapabilityMatrix({
    packId: "pack-a",
    version: "1.0.0",
    domain: "ops",
    owner: "owner",
    capabilities: [{ capabilityKey: "triage", maturity: "ga", requiredContracts: ["runtime_execution_contract"] }],
  }), { experimental: 0, beta: 0, ga: 1 });
});
