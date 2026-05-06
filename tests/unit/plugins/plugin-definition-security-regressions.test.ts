import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  DefaultSbomScanner,
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

  setSbomScanner(new DefaultSbomScanner());
});

test("verifySbomRef scans file-backed SBOM content and detects high vulnerabilities", async () => {
  setSbomScanner(new DefaultSbomScanner());
  const tempDir = await mkdtemp(join(tmpdir(), "sbom-scan-"));
  const sbomPath = join(tempDir, "cyclonedx.json");

  try {
    await writeFile(sbomPath, JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      components: [
        {
          type: "library",
          name: "lodash",
          version: "4.17.21",
        },
      ],
    }), "utf8");

    const result = await verifySbomRef(pathToFileURL(sbomPath).toString());
    assert.equal(result.valid, false);
    assert.equal(result.vulnerabilities.length, 1);
    assert.equal(result.vulnerabilities[0]?.id, "CVE-2021-23337");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("definePlugin rejects plugins whose SBOM contains high vulnerabilities", async () => {
  setSbomScanner(new DefaultSbomScanner());
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  registry.registerKey("sbom-signing-key", publicKey.export({ type: "spki", format: "pem" }).toString());

  const tempDir = await mkdtemp(join(tmpdir(), "sbom-plugin-"));
  const sbomPath = join(tempDir, "spdx.json");
  const canonicalPayload = {
    pluginId: "vulnerable-plugin",
    name: "Vulnerable Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "run",
      description: "Run vulnerable plugin",
      inputSchema: {},
      outputSchema: {},
    }],
    spiTypes: ["tool"],
    domainIds: [],
  };

  try {
    await writeFile(sbomPath, JSON.stringify({
      spdxVersion: "SPDX-2.3",
      packages: [
        {
          name: "axios",
          versionInfo: "0.21.1",
        },
      ],
    }), "utf8");

    const signature = sign(null, Buffer.from(JSON.stringify(canonicalPayload)), privateKey).toString("base64url");

    await assert.rejects(
      definePlugin({
        ...canonicalPayload,
        sbomRef: pathToFileURL(sbomPath).toString(),
        signing: {
          keyId: "sbom-signing-key",
          signature,
          algorithm: "ed25519",
        },
      }),
      (error: unknown) =>
        error instanceof Error
        && "code" in error
        && error.code === "plugin_sdk.sbom_critical_vulnerabilities",
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
