/**
 * @fileoverview Integration Tests for Plugin SDK - Signature Verification (2007)
 *
 * Tests the plugin signature verification functionality:
 * - 2007: Plugin SDK signature verification
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createSign, createPublicKey, generateKeyPairSync } from "node:crypto";

import {
  definePlugin,
  defineTool,
  validatePluginDefinition,
  getSigningKeyRegistry,
  verifyPluginSignature,
  type PluginDefinition,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";

// ============================================================================
// Tests for 2007: Plugin SDK signature verification
// ============================================================================

test("2007: getSigningKeyRegistry returns singleton registry", () => {
  const registry1 = getSigningKeyRegistry();
  const registry2 = getSigningKeyRegistry();
  assert.equal(registry1, registry2);
});

test("2007: signingKeyRegistry.registerKey registers a valid key", () => {
  const registry = getSigningKeyRegistry();
  const keyId = "test-key-001";
  const publicKeyPem = generateTestPublicKey();

  registry.registerKey(keyId, publicKeyPem);
  assert.equal(registry.hasKey(keyId), true);
  assert.ok(registry.getKey(keyId));
});

test("2007: signingKeyRegistry.registerKey rejects empty keyId", () => {
  const registry = getSigningKeyRegistry();
  const publicKeyPem = generateTestPublicKey();

  assert.throws(
    () => registry.registerKey("  ", publicKeyPem),
    /Key ID must be non-empty/i
  );
});

test("2007: signingKeyRegistry.registerKey rejects empty publicKey", () => {
  const registry = getSigningKeyRegistry();

  assert.throws(
    () => registry.registerKey("test-key", ""),
    /Public key must be non-empty/i
  );
});

test("2007: signingKeyRegistry.removeKey removes a registered key", () => {
  const registry = getSigningKeyRegistry();
  const keyId = "key-to-remove";
  const publicKeyPem = generateTestPublicKey();

  registry.registerKey(keyId, publicKeyPem);
  assert.equal(registry.hasKey(keyId), true);

  const removed = registry.removeKey(keyId);
  assert.equal(removed, true);
  assert.equal(registry.hasKey(keyId), false);
});

test("2007: signingKeyRegistry.clear removes all keys", () => {
  const registry = getSigningKeyRegistry();
  registry.registerKey("key1", generateTestPublicKey());
  registry.registerKey("key2", generateTestPublicKey());

  assert.equal(registry.hasKey("key1"), true);
  assert.equal(registry.hasKey("key2"), true);

  registry.clear();

  assert.equal(registry.hasKey("key1"), false);
  assert.equal(registry.hasKey("key2"), false);
});

test("2007: verifyPluginSignature returns invalid for unsigned plugin", async () => {
  const plugin = await defineTool({
    pluginId: "test.unsigned-plugin",
    name: "Unsigned Plugin",
    version: "1.0.0",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
  });

  // Plugin has no signing info
  assert.equal(plugin.signing, null);

  const result = verifyPluginSignature(plugin, "test-canonical-string");
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("not_signed"));
});

test("2007: verifyPluginSignature returns invalid for unknown keyId", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear(); // Clear any existing keys

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  // Register the key
  registry.registerKey("registered-key", publicKeyPem);

  const plugin: PluginDefinition = {
    pluginId: "test.signed-plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "read_only", egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "unregistered-key", // This key is not registered
      signature: "dGVzdC1zaWduYXR1cmU=",
      algorithm: "ed25519",
    },
  };

  const canonicalString = JSON.stringify({
    pluginId: plugin.pluginId,
    name: plugin.name,
    version: plugin.version,
    type: plugin.type,
    capabilities: plugin.capabilities,
    spiTypes: plugin.spiTypes,
    domainIds: plugin.domainIds,
  });

  const result = verifyPluginSignature(plugin, canonicalString);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("unknown_key_id"));
});

test("2007: verifyPluginSignature validates a correctly signed plugin", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  registry.registerKey("valid-key", publicKeyPem);

  const canonicalJson = JSON.stringify({
    pluginId: "test.signed-plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    spiTypes: ["tool"] as ("tool" | "adapter" | "retriever" | "evaluator" | "planner" | "presenter" | "validator")[],
    domainIds: [] as string[],
  });

  // Sign the canonical JSON using Ed25519
  const sign = createSign("ed25519");
  sign.update(canonicalJson);
  const signatureBytes = sign.sign(privateKey);
  const signatureBase64 = Buffer.from(signatureBytes).toString("base64url");

  const plugin: PluginDefinition = {
    pluginId: "test.signed-plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "read_only", egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "valid-key",
      signature: signatureBase64,
      algorithm: "ed25519",
    },
  };

  const result = verifyPluginSignature(plugin, canonicalJson);
  assert.equal(result.valid, true);
  assert.equal(result.error, undefined);
});

test("2007: verifyPluginSignature returns invalid for tampered content", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  registry.registerKey("tamper-test-key", publicKeyPem);

  const originalCanonical = JSON.stringify({
    pluginId: "test.signed-plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    spiTypes: ["tool"] as ("tool" | "adapter" | "retriever" | "evaluator" | "planner" | "presenter" | "validator")[],
    domainIds: [] as string[],
  });

  // Sign the original canonical JSON
  const sign = createSign("ed25519");
  sign.update(originalCanonical);
  const signatureBytes = sign.sign(privateKey);
  const signatureBase64 = Buffer.from(signatureBytes).toString("base64url");

  const plugin: PluginDefinition = {
    pluginId: "test.signed-plugin",
    name: "Signed Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "read_only", egressDomains: [] },
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: {
      keyId: "tamper-test-key",
      signature: signatureBase64,
      algorithm: "ed25519",
    },
  };

  // Try to verify with tampered canonical string
  const tamperedCanonical = JSON.stringify({
    pluginId: "test.signed-plugin",
    name: "Signed Plugin - TAMPERED",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    spiTypes: ["tool"] as ("tool" | "adapter" | "retriever" | "evaluator" | "planner" | "presenter" | "validator")[],
    domainIds: [] as string[],
  });

  const result = verifyPluginSignature(plugin, tamperedCanonical);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("signature_invalid") || result.error?.includes("verification_failed"));
});

test("2007: definePlugin with signing validates signature", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  registry.registerKey("define-plugin-key", publicKeyPem);

  const canonicalJson = JSON.stringify({
    pluginId: "test.define-signed-plugin",
    name: "Define Signed Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    spiTypes: ["tool"],
    domainIds: [],
  });

  // Sign the canonical JSON
  const sign = createSign("ed25519");
  sign.update(canonicalJson);
  const signatureBytes = sign.sign(privateKey);
  const signatureBase64 = Buffer.from(signatureBytes).toString("base64url");

  // definePlugin should validate the signature
  const plugin = await definePlugin({
    pluginId: "test.define-signed-plugin",
    name: "Define Signed Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    signing: {
      keyId: "define-plugin-key",
      signature: signatureBase64,
      algorithm: "ed25519",
    },
  });

  assert.equal(plugin.pluginId, "test.define-signed-plugin");
  assert.ok(plugin.signing);
});

test("2007: definePlugin rejects plugin with invalid signature", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  registry.registerKey("invalid-sig-key", publicKeyPem);

  // Use an invalid/tampered signature
  assert.throws(
    async () => await definePlugin({
      pluginId: "test.invalid-sig-plugin",
      name: "Invalid Signature Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [
        {
          name: "run",
          description: "Run the plugin",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        },
      ],
      signing: {
        keyId: "invalid-sig-key",
        signature: "aW52YWxpZC1zaWduYXR1cmUtYnl0ZXM=", // base64url encoded invalid signature
        algorithm: "ed25519",
      },
    }),
    /signature_verification_failed/
  );
});

test("2007: validatePluginDefinition re-validates a signed plugin", async () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });

  registry.registerKey("revalidate-key", publicKeyPem);

  const canonicalJson = JSON.stringify({
    pluginId: "test.revalidate-plugin",
    name: "Revalidate Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    spiTypes: ["tool"],
    domainIds: [],
  });

  const sign = createSign("ed25519");
  sign.update(canonicalJson);
  const signatureBytes = sign.sign(privateKey);
  const signatureBase64 = Buffer.from(signatureBytes).toString("base64url");

  const plugin = await definePlugin({
    pluginId: "test.revalidate-plugin",
    name: "Revalidate Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    signing: {
      keyId: "revalidate-key",
      signature: signatureBase64,
      algorithm: "ed25519",
    },
  });

  const revalidated = await validatePluginDefinition(plugin);
  assert.equal(revalidated.pluginId, plugin.pluginId);
  assert.equal(revalidated.version, plugin.version);
});

// ============================================================================
// Helper function to generate test Ed25519 public key
// ============================================================================

function generateTestPublicKey(): string {
  const { publicKey } = generateKeyPairSync("ed25519");
  return publicKey.export({ type: "spki", format: "pem" });
}
