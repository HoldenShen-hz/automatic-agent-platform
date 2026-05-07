import test from "node:test";
import assert from "node:assert/strict";
import { createSign } from "node:crypto";

import { definePlugin, defineTool, defineAdapter, defineRetriever, defineEvaluator, validatePluginDefinition, getSigningKeyRegistry, setSbomScanner, verifySbomRef, type SbomScanner } from "../../../../src/sdk/plugin-sdk/plugin-definition.js";

test("definePlugin throws when pluginId is missing", async () => {
  await assert.rejects(
    async () => definePlugin({ pluginId: "", name: "Test", version: "1.0.0", type: "tool", capabilities: [] }),
    /Plugin ID is required/,
  );
});

test("definePlugin throws when name is missing", async () => {
  await assert.rejects(
    async () => definePlugin({ pluginId: "test", name: "", version: "1.0.0", type: "tool", capabilities: [] }),
    /Plugin name is required/,
  );
});

test("definePlugin throws when version is missing", async () => {
  await assert.rejects(
    async () => definePlugin({ pluginId: "test", name: "Test", version: "", type: "tool", capabilities: [] }),
    /Plugin version is required/,
  );
});

test("definePlugin throws when type is missing", async () => {
  await assert.rejects(
    async () => definePlugin({ pluginId: "test", name: "Test", version: "1.0.0", type: undefined as unknown as "tool", capabilities: [] }),
    /Plugin type is required/,
  );
});

test("definePlugin throws when capabilities are empty", async () => {
  await assert.rejects(
    async () => definePlugin({ pluginId: "test", name: "Test", version: "1.0.0", type: "tool", capabilities: [] }),
    /at least one capability/,
  );
});

test("definePlugin throws when capability name is empty", async () => {
  await assert.rejects(
    async () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "", description: "test", inputSchema: {}, outputSchema: {} }],
    }),
    /Capability name is required/,
  );
});

test("definePlugin throws when capability inputSchema is missing", async () => {
  await assert.rejects(
    async () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "cap", description: "test", inputSchema: undefined as unknown as {}, outputSchema: {} }],
    }),
    /requires inputSchema/,
  );
});

test("definePlugin throws when capability outputSchema is missing", async () => {
  await assert.rejects(
    async () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "cap", description: "test", inputSchema: {}, outputSchema: undefined as unknown as {} }],
    }),
    /requires outputSchema/,
  );
});

test("definePlugin creates valid plugin definition", async () => {
  const result = await definePlugin({
    pluginId: "my-pack.query-tool",
    name: "Query Tool",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "execute",
      description: "Execute a query",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
    }],
  });

  assert.equal(result.pluginId, "my-pack.query-tool");
  assert.equal(result.name, "Query Tool");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.type, "tool");
  assert.equal(result.capabilities.length, 1);
  assert.equal(result.resourceLimits.maxMemoryMb, 512);
});

test("definePlugin applies custom resource limits", async () => {
  const result = await definePlugin({
    pluginId: "test",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "cap",
      description: "test",
      inputSchema: {},
      outputSchema: {},
    }],
    resourceLimits: {
      maxMemoryMb: 1024,
      maxCpuMs: 10000,
      maxDurationMs: 60000,
    },
  });

  assert.equal(result.resourceLimits.maxMemoryMb, 1024);
  assert.equal(result.resourceLimits.maxCpuMs, 10000);
  assert.equal(result.resourceLimits.maxDurationMs, 60000);
});

test("definePlugin applies custom security config", async () => {
  const result = await definePlugin({
    pluginId: "test",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "cap",
      description: "test",
      inputSchema: {},
      outputSchema: {},
    }],
    security: {
      sandboxTier: "container",
      egressDomains: ["api.example.com"],
    },
  });

  assert.equal(result.security.sandboxTier, "workspace_write");
  assert.deepEqual(result.security.egressDomains, ["api.example.com"]);
});

test("definePlugin trims pluginId, name, version, and description", async () => {
  const result = await definePlugin({
    pluginId: "  test  ",
    name: "  Test  ",
    version: "  1.0.0  ",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    description: "  desc  ",
    capabilities: [{
      name: "  cap  ",
      description: "test",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.pluginId, "test");
  assert.equal(result.name, "Test");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.description, "desc");
  // Note: capability names are NOT trimmed
  assert.equal(result.capabilities[0]!.name, "  cap  ");
});

test("defineTool creates tool plugin", async () => {
  const result = await defineTool({
    pluginId: "my-pack.tool",
    name: "My Tool",
    version: "1.0.0",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "tool");
});

test("defineAdapter creates adapter plugin", async () => {
  const result = await defineAdapter({
    pluginId: "my-pack.adapter",
    name: "My Adapter",
    version: "1.0.0",
    spiTypes: ["adapter"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "adapt",
      description: "Adapt",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "adapter");
});

test("defineRetriever creates retriever plugin", async () => {
  const result = await defineRetriever({
    pluginId: "my-pack.retriever",
    name: "My Retriever",
    version: "1.0.0",
    spiTypes: ["retriever"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "retrieve",
      description: "Retrieve",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "retriever");
});

test("defineEvaluator creates evaluator plugin", async () => {
  const result = await defineEvaluator({
    pluginId: "my-pack.evaluator",
    name: "My Evaluator",
    version: "1.0.0",
    spiTypes: ["evaluator"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "evaluate",
      description: "Evaluate",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "evaluator");
});

test("validatePluginDefinition validates and returns same definition", async () => {
  const original = await definePlugin({
    pluginId: "my-pack.tool",
    name: "My Tool",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const validated = await validatePluginDefinition(original);

  assert.equal(validated.pluginId, original.pluginId);
  assert.equal(validated.name, original.name);
  assert.equal(validated.version, original.version);
});

test("validatePluginDefinition uses default description when missing", async () => {
  const original = {
    pluginId: "my-pack.tool",
    name: "My Tool",
    version: "1.0.0",
    type: "tool" as const,
    spiTypes: ["tool"] as string[],
    domainIds: [] as string[],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "process" as const, egressDomains: [] },
  };

  const validated = await validatePluginDefinition(original);

  assert.equal(validated.description, "Plugin description");
});

// ============================================================================
// Plugin Signing Key Registry Tests
// ============================================================================

test("getSigningKeyRegistry returns same instance", () => {
  const registry1 = getSigningKeyRegistry();
  const registry2 = getSigningKeyRegistry();
  assert.strictEqual(registry1, registry2, "Should return same registry instance");
});

test("SigningKeyRegistry.registerKey stores key", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  registry.registerKey("key_1", "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----");
  assert.ok(registry.hasKey("key_1"), "Registry should have key_1");
  assert.ok(registry.getKey("key_1"), "Registry should return key");
});

test("SigningKeyRegistry.registerKey throws on empty keyId", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  assert.throws(
    () => registry.registerKey("", "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----"),
    /Key ID must be non-empty/i,
  );
});

test("SigningKeyRegistry.registerKey throws on whitespace keyId", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  assert.throws(
    () => registry.registerKey("   ", "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----"),
    /Key ID must be non-empty/i,
  );
});

test("SigningKeyRegistry.registerKey throws on empty publicKeyPem", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  assert.throws(
    () => registry.registerKey("key_1", ""),
    /Public key must be non-empty/i,
  );
});

test("SigningKeyRegistry.registerKey trims whitespace", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  registry.registerKey("  key_1  ", "  -----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----  ");
  assert.ok(registry.hasKey("key_1"), "Key ID should be trimmed");
});

test("SigningKeyRegistry.getKey returns null for unknown key", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  assert.equal(registry.getKey("unknown_key"), null);
});

test("SigningKeyRegistry.removeKey deletes key", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  registry.registerKey("key_1", "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----");
  assert.ok(registry.hasKey("key_1"));

  const removed = registry.removeKey("key_1");
  assert.equal(removed, true);
  assert.ok(!registry.hasKey("key_1"));
});

test("SigningKeyRegistry.removeKey returns false for unknown key", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  const removed = registry.removeKey("unknown_key");
  assert.equal(removed, false);
});

test("SigningKeyRegistry.clear removes all keys", () => {
  const registry = getSigningKeyRegistry();
  registry.clear();

  registry.registerKey("key_1", "-----BEGIN PUBLIC KEY-----\ntest1\n-----END PUBLIC KEY-----");
  registry.registerKey("key_2", "-----BEGIN PUBLIC KEY-----\ntest2\n-----END PUBLIC KEY-----");

  registry.clear();
  assert.ok(!registry.hasKey("key_1"));
  assert.ok(!registry.hasKey("key_2"));
});

// ============================================================================
// SBOM Verification Tests
// ============================================================================

test("verifySbomRef returns valid for null sbomRef", async () => {
  const result = await verifySbomRef(null);
  assert.equal(result.valid, true);
  assert.deepEqual(result.vulnerabilities, []);
  assert.deepEqual(result.scanErrors, []);
});

test("verifySbomRef returns valid for empty string", async () => {
  const result = await verifySbomRef("");
  assert.equal(result.valid, true, "Empty string is treated as no sbom");
});

test("setSbomScanner replaces default scanner", async () => {
  let scanCalled = false;
  const customScanner: SbomScanner = {
    async scan(sbomRef: string) {
      scanCalled = true;
      return {
        valid: true,
        scannedAt: new Date().toISOString(),
        vulnerabilities: [],
        scanErrors: [],
      };
    },
  };

  setSbomScanner(customScanner);
  await verifySbomRef("https://example.com/sbom.json");
  assert.equal(scanCalled, true, "Custom scanner should be called");
});

test("verifySbomRef uses custom scanner when set", async () => {
  const customScanner: SbomScanner = {
    async scan(sbomRef: string) {
      return {
        valid: true,
        scannedAt: new Date().toISOString(),
        vulnerabilities: [],
        scanErrors: [],
      };
    },
  };

  setSbomScanner(customScanner);
  const result = await verifySbomRef("https://example.com/sbom.json");
  assert.equal(result.valid, true);
});

test("definePlugin deduplicates spiTypes", async () => {
  const plugin = await definePlugin({
    pluginId: "test.plugin",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool", "tool", "validator", "tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "test", description: "Test", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(plugin.spiTypes.length, 2, "Should deduplicate to unique types");
  assert.ok(plugin.spiTypes.includes("tool"));
  assert.ok(plugin.spiTypes.includes("validator"));
});

test("definePlugin handles sbomRef with whitespace", async () => {
  const plugin = await definePlugin({
    pluginId: "test.plugin",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: "  https://example.com/sbom.json  ",
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "test", description: "Test", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(plugin.sbomRef, "https://example.com/sbom.json");
});

test("definePlugin converts empty string sbomRef to null", async () => {
  const plugin = await definePlugin({
    pluginId: "test.plugin",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: "",
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "test", description: "Test", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(plugin.sbomRef, null);
});

test("definePlugin signing with invalid keyId throws", async () => {
  // This test verifies that definePlugin validates signing info
  // The signing verification fails because the keyId is not registered
  await assert.rejects(
    async () => definePlugin({
      pluginId: "test.plugin",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      spiTypes: ["tool"],
      domainIds: [],
      sbomRef: null,
      signing: {
        keyId: "nonexistent_key",
        signature: "invalid_signature",
        algorithm: "ed25519",
      },
      capabilities: [{ name: "test", description: "Test", inputSchema: {}, outputSchema: {} }],
    }),
    /signature_verification_failed|unknown_key_id/i,
  );
});
