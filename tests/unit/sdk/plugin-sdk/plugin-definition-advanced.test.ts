/**
 * @fileoverview Advanced tests for plugin-definition.ts - SBOM, signing, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import path from "node:path";

import {
  definePlugin,
  registerPluginSigningVerificationKey,
  verifyPluginSignature,
  enforcePluginSignature,
  getSigningKeyRegistry,
  getSbomScanner,
  setSbomScanner,
  verifySbomRef,
  DefaultSbomScanner,
  type PluginDefinition,
  type SbomVerificationOptions,
} from "../../../../src/sdk/plugin-sdk/plugin-definition.js";

const TEMP_SBOM_FILE = path.join("/tmp", `test-sbom-${Date.now()}.json`);

test("nodeAlgorithm maps signing algorithms correctly", () => {
  // Test algorithm mapping via verifyPluginSignature
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "algo-test-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });

  const pluginDef = {
    pluginId: "algo-test.tool",
    name: "Algo Test",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
  };

  const payload = JSON.stringify({
    pluginId: pluginDef.pluginId,
    name: pluginDef.name,
    version: pluginDef.version,
    type: pluginDef.type,
    capabilities: pluginDef.capabilities,
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    spiTypes: ["tool"],
    domainIds: [],
  });

  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  const signature = sign.sign(privateKey, "base64url");

  const result = definePlugin({
    ...pluginDef,
    signing: { keyId: "algo-test-key", signature, algorithm: "RSA-SHA256" },
  });

  assert.equal(result.pluginId, "algo-test.tool");
  assert.equal(result.signing?.algorithm, "RSA-SHA256");
});

test("nodeAlgorithm handles ES256 algorithm", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "es256-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });

  const pluginDef = {
    pluginId: "es256-test.tool",
    name: "ES256 Test",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
  };

  const payload = JSON.stringify({
    pluginId: pluginDef.pluginId,
    name: pluginDef.name,
    version: pluginDef.version,
    type: pluginDef.type,
    capabilities: pluginDef.capabilities,
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    spiTypes: ["tool"],
    domainIds: [],
  });

  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  const signature = sign.sign(privateKey, "base64url");

  const result = definePlugin({
    ...pluginDef,
    signing: { keyId: "es256-key", signature, algorithm: "RSA-SHA256" },
  });

  assert.equal(result.signing?.algorithm, "RSA-SHA256");
});

test("decodeSignature handles base64url encoding", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "b64url-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });

  const pluginDef = {
    pluginId: "b64url-test.tool",
    name: "B64URL Test",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
  };

  const payload = JSON.stringify({
    pluginId: pluginDef.pluginId,
    name: pluginDef.name,
    version: pluginDef.version,
    type: pluginDef.type,
    capabilities: pluginDef.capabilities,
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    spiTypes: ["tool"],
    domainIds: [],
  });

  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  const signature = sign.sign(privateKey, "base64url");

  const result = definePlugin({
    ...pluginDef,
    signing: { keyId: "b64url-key", signature, algorithm: "RSA-SHA256" },
  });

  assert.equal(result.pluginId, "b64url-test.tool");
});

test("decodeSignature rejects invalid base64 characters", () => {
  const { publicKey } = generateKeyPairSync("rsa" as never, {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "invalid-sig-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });

  const plugin: PluginDefinition = {
    pluginId: "invalid-sig.tool",
    name: "Invalid Sig",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "read_only" as const, egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "invalid-sig-key",
      signature: "invalid!!!signature",
      algorithm: "RSA-SHA256",
    },
  };

  const result = verifyPluginSignature(plugin);
  assert.equal(result, false);
});

test("DefaultSbomScanner rejects empty sbomRef", async () => {
  const scanner = new DefaultSbomScanner();
  const result = await scanner.scan("");

  assert.equal(result.valid, false);
  assert.ok(result.scanErrors.includes("SBOM reference is required."));
});

test("DefaultSbomScanner rejects whitespace-only sbomRef", async () => {
  const scanner = new DefaultSbomScanner();
  const result = await scanner.scan("   ");

  assert.equal(result.valid, false);
  assert.ok(result.scanErrors.includes("SBOM reference is required."));
});

test("DefaultSbomScanner rejects invalid URL format", async () => {
  const scanner = new DefaultSbomScanner();
  const result = await scanner.scan("not-a-valid-url");

  assert.equal(result.valid, false);
  assert.ok(result.scanErrors.some((e) => e.includes("Invalid SBOM reference format")));
});

test("DefaultSbomScanner rejects unsupported protocols", async () => {
  const scanner = new DefaultSbomScanner();
  const result = await scanner.scan("ftp://example.com/sbom.json");

  assert.equal(result.valid, false);
  assert.ok(result.scanErrors.some((e) => e.includes("Unsupported SBOM protocol")));
});

test("DefaultSbomScanner rejects non-file protocols with message", async () => {
  const scanner = new DefaultSbomScanner();
  const result = await scanner.scan("https://example.com/sbom.json");

  assert.equal(result.valid, false);
  assert.ok(result.scanErrors.some((error) => error.includes("Remote SBOM scanning requires a supplied SBOM fetcher")));
});

test("DefaultSbomScanner scans valid CycloneDX SBOM", async () => {
  const sbom = JSON.stringify({
    components: [
      { name: "axios", version: "0.21.1" },
      { name: "lodash", version: "4.17.21" },
    ],
  });
  writeFileSync(TEMP_SBOM_FILE, sbom);

  try {
    const scanner = new DefaultSbomScanner();
    const result = await scanner.scan(`file://${TEMP_SBOM_FILE}`);

    assert.equal(result.valid, false); // Has vulnerabilities
    assert.ok(result.vulnerabilities.length > 0);
    assert.ok(result.scanErrors.length === 0);
  } finally {
    unlinkSync(TEMP_SBOM_FILE);
  }
});

test("DefaultSbomScanner scans valid SPDX SBOM", async () => {
  const sbom = JSON.stringify({
    packages: [
      { name: "axios", versionInfo: "0.21.1" },
      { name: "lodash", versionInfo: "4.17.21" },
    ],
  });
  writeFileSync(TEMP_SBOM_FILE, sbom);

  try {
    const scanner = new DefaultSbomScanner();
    const result = await scanner.scan(`file://${TEMP_SBOM_FILE}`);

    assert.equal(result.valid, false); // Has vulnerabilities
    assert.ok(result.vulnerabilities.length > 0);
  } finally {
    unlinkSync(TEMP_SBOM_FILE);
  }
});

test("DefaultSbomScanner handles SBOM with no vulnerable packages", async () => {
  const sbom = JSON.stringify({
    components: [
      { name: "safe-package", version: "1.0.0" },
    ],
  });
  writeFileSync(TEMP_SBOM_FILE, sbom);

  try {
    const scanner = new DefaultSbomScanner();
    const result = await scanner.scan(`file://${TEMP_SBOM_FILE}`);

    assert.equal(result.valid, true);
    assert.equal(result.vulnerabilities.length, 0);
  } finally {
    unlinkSync(TEMP_SBOM_FILE);
  }
});

test("DefaultSbomScanner handles malformed JSON", async () => {
  writeFileSync(TEMP_SBOM_FILE, "{ invalid json");

  try {
    const scanner = new DefaultSbomScanner();
    const result = await scanner.scan(`file://${TEMP_SBOM_FILE}`);

    assert.equal(result.valid, false);
    assert.ok(result.scanErrors.length > 0);
  } finally {
    unlinkSync(TEMP_SBOM_FILE);
  }
});

test("DefaultSbomScanner respects minSeverity option", async () => {
  const sbom = JSON.stringify({
    components: [
      { name: "axios", version: "0.21.1" }, // high severity
      { name: "safe-pkg", version: "1.0.0" },
    ],
  });
  writeFileSync(TEMP_SBOM_FILE, sbom);

  try {
    const scanner = new DefaultSbomScanner();
    const result = await scanner.scan(`file://${TEMP_SBOM_FILE}`, { minSeverity: "critical" });

    assert.equal(result.valid, true); // No critical vulnerabilities
    assert.equal(result.vulnerabilities.length, 0);
  } finally {
    unlinkSync(TEMP_SBOM_FILE);
  }
});

test("getSbomScanner returns current scanner", () => {
  const scanner = getSbomScanner();
  assert.ok(scanner !== undefined);
  assert.ok(typeof scanner.scan === "function");
});

test("setSbomScanner replaces default scanner", () => {
  const customScanner = {
    async scan(sbomRef: string) {
      return {
        valid: true,
        scannedAt: new Date().toISOString(),
        vulnerabilities: [],
        scanErrors: [],
      };
    },
  };

  setSbomScanner(customScanner as any);
  const scanner = getSbomScanner();
  assert.equal(scanner, customScanner);

  // Restore default
  setSbomScanner(new DefaultSbomScanner());
});

test("verifySbomRef returns valid for empty string", async () => {
  const result = await verifySbomRef("");
  assert.equal(result.valid, true);
  assert.equal(result.vulnerabilities.length, 0);
});

test("verifySbomRef returns valid for whitespace", async () => {
  const result = await verifySbomRef("   ");
  assert.equal(result.valid, true);
});

test("verifySbomRef returns valid for null", async () => {
  const result = await verifySbomRef(null);
  assert.equal(result.valid, true);
});

test("verifySbomRef returns valid for undefined", async () => {
  const result = await verifySbomRef(undefined);
  assert.equal(result.valid, true);
});

test("verifyPluginSignature returns detailed result with canonicalPayload", () => {
  const { publicKey } = generateKeyPairSync("rsa" as never, {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "detail-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });

  const plugin: PluginDefinition = {
    pluginId: "detail-test.tool",
    name: "Detail Test",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "read_only" as const, egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "detail-key",
      signature: "invalid",
      algorithm: "RSA-SHA256",
    },
  };

  const result = verifyPluginSignature(plugin, "canonical-payload");
  assert.equal(result.valid, false);
  assert.ok(result.keyId === "detail-key");
  assert.ok(result.verifiedAt !== undefined);
});

test("enforcePluginSignature throws for tampered signature", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registerPluginSigningVerificationKey({ keyId: "tamper-key", publicKeyPem: publicKey, algorithm: "RSA-SHA256" });

  const plugin: PluginDefinition = {
    pluginId: "tamper-test.tool",
    name: "Tamper Test",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "read_only" as const, egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "tamper-key",
      signature: "tampered-signature-data",
      algorithm: "RSA-SHA256",
    },
  };

  assert.throws(
    () => enforcePluginSignature(plugin),
    /signature verification failed/i,
  );
});

test("definePlugin with SBOM that has critical vulnerabilities rejects asynchronously", async () => {
  const sbom = JSON.stringify({
    components: [
      { name: "axios", version: "0.21.1" }, // high severity
    ],
  });
  writeFileSync(TEMP_SBOM_FILE, sbom);

  try {
    await assert.rejects(
      definePlugin({
        pluginId: "sbom-critical-test",
        name: "SBOM Critical Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [{ name: "execute", description: "Test", inputSchema: {}, outputSchema: {} }],
        sbomRef: `file://${TEMP_SBOM_FILE}`,
      }),
      (error: unknown) =>
        error instanceof Error
        && "code" in error
        && error.code === "plugin_sdk.sbom_critical_vulnerabilities",
    );
  } finally {
    unlinkSync(TEMP_SBOM_FILE);
  }
});

test("SigningKeyRegistry handles key operations", () => {
  const registry = getSigningKeyRegistry();

  // Clear any existing keys
  registry.clear();

  const { publicKey } = generateKeyPairSync("rsa" as never, {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  registry.registerKey("test-key-id", publicKey, "RSA-SHA256");

  assert.equal(registry.hasKey("test-key-id"), true);
  assert.ok(registry.getKey("test-key-id") !== null);

  const verificationKey = registry.getVerificationKey("test-key-id");
  assert.equal(verificationKey?.keyId, "test-key-id");

  // Remove key
  assert.equal(registry.removeKey("test-key-id"), true);
  assert.equal(registry.hasKey("test-key-id"), false);

  // Clear all
  registry.clear();
});

test("SigningKeyRegistry rejects empty keyId", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  assert.throws(() => {
    registry.registerKey("", "some-pem", "RSA-SHA256");
  }, /Key ID must be non-empty/);
});

test("SigningKeyRegistry rejects empty publicKey", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  assert.throws(() => {
    registry.registerKey("valid-key-id", "", "RSA-SHA256");
  }, /Public key must be non-empty/);
});

test("normalizeResourceLimits throws on non-finite values", () => {
  assert.throws(
    () =>
      definePlugin({
        pluginId: "nf-test",
        name: "NF Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
        resourceLimits: { maxMemoryMb: Infinity, maxCpuMs: 5000, maxDurationMs: 30000 },
      }),
    /positive finite number/i,
  );

  assert.throws(
    () =>
      definePlugin({
        pluginId: "nf-test2",
        name: "NF Test 2",
        version: "1.0.0",
        type: "tool",
        capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
        resourceLimits: { maxMemoryMb: NaN, maxCpuMs: 5000, maxDurationMs: 30000 },
      }),
    /positive finite number/i,
  );
});

test("normalizeResourceLimits throws on zero values", () => {
  assert.throws(
    () =>
      definePlugin({
        pluginId: "zero-test",
        name: "Zero Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
        resourceLimits: { maxMemoryMb: 0, maxCpuMs: 5000, maxDurationMs: 30000 },
      }),
    /positive finite number/i,
  );
});

test("normalizeResourceLimits throws on negative values", () => {
  assert.throws(
    () =>
      definePlugin({
        pluginId: "neg-test",
        name: "Neg Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [{ name: "cap", description: "d", inputSchema: {}, outputSchema: {} }],
        resourceLimits: { maxMemoryMb: -100, maxCpuMs: 5000, maxDurationMs: 30000 },
      }),
    /positive finite number/i,
  );
});
