import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";

import { publishPack } from "../../../../src/sdk/cli/pack-publish.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("publishPack retries transient failures with backoff and succeeds on a later attempt", async () => {
  const workspace = createTempWorkspace("aa-pack-publish-retry-");
  const manifestPath = `${workspace}/pack.json`;
  const originalFetch = globalThis.fetch;
  const originalRegistry = process.env.AA_REGISTRY_URL;
  const originalToken = process.env.AA_BEARER_TOKEN;
  let attempts = 0;

  writeFileSync(manifestPath, JSON.stringify({
    packId: "retry-pack",
    version: "1.0.0",
    domainId: "ops",
    owner: "ops@example.com",
    capabilities: [{ capabilityKey: "ops.run", requiredContracts: ["runtime_execution_contract"] }],
  }));

  globalThis.fetch = async () => {
    attempts += 1;
    return {
      ok: attempts >= 3,
      status: attempts >= 3 ? 201 : 503,
      headers: new Headers(),
      json: async () => ({ artifactId: "artifact-retry" }),
      text: async () => "",
    } as Response;
  };
  process.env.AA_REGISTRY_URL = "https://registry.example.com";
  process.env.AA_BEARER_TOKEN = "token";

  try {
    const result = await publishPack(["--manifest", manifestPath]);
    assert.equal(result.published, true);
    assert.equal(result.artifactId, "artifact-retry");
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
    cleanupPath(workspace);
    if (originalRegistry == null) {
      delete process.env.AA_REGISTRY_URL;
    } else {
      process.env.AA_REGISTRY_URL = originalRegistry;
    }
    if (originalToken == null) {
      delete process.env.AA_BEARER_TOKEN;
    } else {
      process.env.AA_BEARER_TOKEN = originalToken;
    }
  }
});
