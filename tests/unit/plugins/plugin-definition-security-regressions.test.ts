import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  definePlugin,
  getSigningKeyRegistry,
  setSbomScanner,
  verifySbomRef,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";

test("definePlugin verifies Ed25519 signatures cryptographically", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  registry.registerKey("ed25519-test-key", publicKey.export({ type: "spki", format: "pem" }).toString());

  const canonicalPayload = {
    pluginId: "signed-plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "run",
      description: "Run signed plugin",
      inputSchema: {},
      outputSchema: {},
    }],
    spiTypes: ["tool"],
    domainIds: [],
  };
  const signature = sign(null, Buffer.from(JSON.stringify(canonicalPayload)), privateKey).toString("base64url");

  const plugin = await definePlugin({
    ...canonicalPayload,
    signing: {
      keyId: "ed25519-test-key",
      signature,
      algorithm: "ed25519",
    },
  });

  assert.equal(plugin.pluginId, "signed-plugin");
  assert.equal(plugin.signing?.keyId, "ed25519-test-key");
});

test("setSbomScanner replaces the active SBOM scanner used by verifySbomRef", async () => {
  const originalScanner = {
    scan: async (_sbomRef: string) => ({
      valid: true,
      scannedAt: new Date().toISOString(),
      vulnerabilities: [],
      scanErrors: [],
    }),
  };
  setSbomScanner(originalScanner);

  let invoked = false;
  setSbomScanner({
    scan: async (sbomRef: string) => {
      invoked = true;
      return {
        valid: sbomRef === "https://example.com/sbom.json",
        scannedAt: new Date().toISOString(),
        vulnerabilities: [],
        scanErrors: [],
      };
    },
  });

  const result = await verifySbomRef("https://example.com/sbom.json");
  assert.equal(invoked, true);
  assert.equal(result.valid, true);

  setSbomScanner(originalScanner);
});
