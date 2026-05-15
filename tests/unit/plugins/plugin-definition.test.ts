/**
 * @fileoverview Unit tests for plugin-definition.ts (SDK)
 *
 * Tests R8-42: PluginSecurityConfig "none" sandbox violation
 * Tests PluginDefinition structure, validation, and convenience functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  definePlugin,
  defineTool,
  defineAdapter,
  defineRetriever,
  defineEvaluator,
  validatePluginDefinition,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";

test("definePlugin validates required pluginId", () => {
  assert.throws(
    () => definePlugin({ pluginId: "", name: "Test", version: "1.0.0", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin ID is required/
  );
  assert.throws(
    () => definePlugin({ pluginId: "  ", name: "Test", version: "1.0.0", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin ID is required/
  );
});

test("definePlugin validates required name", () => {
  assert.throws(
    () => definePlugin({ pluginId: "p", name: "", version: "1.0.0", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin name is required/
  );
});

test("definePlugin validates required version", () => {
  assert.throws(
    () => definePlugin({ pluginId: "p", name: "Test", version: "", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin version is required/
  );
});

test("definePlugin validates required type", () => {
  assert.throws(
    () => definePlugin({ pluginId: "p", name: "Test", version: "1.0.0", type: undefined as any, capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin type is required/
  );
});

test("definePlugin validates at least one capability", () => {
  assert.throws(
    () => definePlugin({ pluginId: "p", name: "Test", version: "1.0.0", type: "tool", capabilities: [] }),
    /at least one capability/
  );
});

test("definePlugin validates capability name is required", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "p",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "", description: "desc", inputSchema: {}, outputSchema: {} }],
    }),
    /Capability name is required/
  );
});

test("definePlugin validates capability inputSchema is required", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "p",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "exec", description: "desc", inputSchema: undefined as any, outputSchema: {} }],
    }),
    /inputSchema/
  );
});

test("definePlugin validates capability outputSchema is required", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "p",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "exec", description: "desc", inputSchema: {}, outputSchema: undefined as any }],
    }),
    /outputSchema/
  );
});

test("definePlugin creates valid plugin definition with defaults", () => {
  const plugin = definePlugin({
    pluginId: "  my-plugin  ",
    name: "  My Plugin  ",
    version: "  1.0.0  ",
    type: "tool",
    description: "  A test plugin  ",
    capabilities: [{
      name: "execute",
      description: "Executes something",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
    }],
  });

  assert.equal(plugin.pluginId, "my-plugin");
  assert.equal(plugin.name, "My Plugin");
  assert.equal(plugin.version, "1.0.0");
  assert.equal(plugin.type, "tool");
  assert.equal(plugin.description, "A test plugin");
  assert.equal(plugin.capabilities.length, 1);
  assert.deepEqual(plugin.resourceLimits, {
    maxMemoryMb: 512,
    maxCpuMs: 5000,
    maxDurationMs: 30000,
  });
  assert.deepEqual(plugin.dependencies, []);
  assert.deepEqual(plugin.security, { sandboxTier: "read_only", egressDomains: [] });
});

test("definePlugin applies custom resource limits", () => {
  const plugin = definePlugin({
    pluginId: "custom-plugin",
    name: "Custom Plugin",
    version: "1.0.0",
    type: "adapter",
    capabilities: [{ name: "adapt", description: "", inputSchema: {}, outputSchema: {} }],
    resourceLimits: { maxMemoryMb: 1024, maxCpuMs: 10000, maxDurationMs: 60000 },
  });

  assert.deepEqual(plugin.resourceLimits, { maxMemoryMb: 1024, maxCpuMs: 10000, maxDurationMs: 60000 });
});

test("definePlugin applies custom security config", () => {
  const plugin = definePlugin({
    pluginId: "custom-plugin",
    name: "Custom Plugin",
    version: "1.0.0",
    type: "adapter",
    capabilities: [{ name: "adapt", description: "", inputSchema: {}, outputSchema: {} }],
    security: { sandboxTier: "container", egressDomains: ["api.example.com"] },
  });

  // container maps to workspace_write
  assert.deepEqual(plugin.security, { sandboxTier: "workspace_write", egressDomains: ["api.example.com"] });
});

test("definePlugin rejects 'none' sandbox tier (S4/R8-42)", () => {
  // R8-42/S4: "none" sandbox tier violates INV-POLICY-001 - it throws an error
  assert.throws(
    () => definePlugin({
      pluginId: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
      security: { sandboxTier: "none" as any },
    }),
    (err: unknown) => err instanceof Error && err.message.includes("sandboxTier 'none'"),
  );
});

test("definePlugin accepts valid sandbox tiers", () => {
  const validTiers = ["read_only", "workspace_write", "scoped_external_access", "restricted_exec"];

  for (const tier of validTiers) {
    const plugin = definePlugin({
      pluginId: `plugin-${tier}`,
      name: `Plugin ${tier}`,
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
      security: { sandboxTier: tier },
    });
    assert.equal(plugin.security.sandboxTier, tier, `Tier ${tier} should be accepted`);
  }
});

test("defineTool creates tool plugin", () => {
  const tool = defineTool({
    pluginId: "my-tool",
    name: "My Tool",
    version: "2.0.0",
    capabilities: [{ name: "run", description: "Run tool", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(tool.type, "tool");
  assert.equal(tool.pluginId, "my-tool");
});

test("defineAdapter creates adapter plugin", () => {
  const adapter = defineAdapter({
    pluginId: "my-adapter",
    name: "My Adapter",
    version: "1.0.0",
    capabilities: [{ name: "convert", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(adapter.type, "adapter");
});

test("defineRetriever creates retriever plugin", () => {
  const retriever = defineRetriever({
    pluginId: "my-retriever",
    name: "My Retriever",
    version: "1.0.0",
    capabilities: [{ name: "search", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(retriever.type, "retriever");
});

test("defineEvaluator creates evaluator plugin", () => {
  const evaluator = defineEvaluator({
    pluginId: "my-evaluator",
    name: "My Evaluator",
    version: "1.0.0",
    capabilities: [{ name: "evaluate", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(evaluator.type, "evaluator");
});

test("definePlugin sets spiTypes based on type when not provided", () => {
  const plugin = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "retriever",
    capabilities: [{ name: "search", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.deepEqual(plugin.spiTypes, ["retriever"]);
});

test("definePlugin deduplicates spiTypes", () => {
  const plugin = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
    spiTypes: ["tool", "adapter", "tool"],
  });

  assert.deepEqual(plugin.spiTypes, ["tool", "adapter"]);
});

test("definePlugin trims domainIds and filters empty", () => {
  const plugin = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "retriever",
    capabilities: [{ name: "search", description: "", inputSchema: {}, outputSchema: {} }],
    domainIds: ["  coding  ", "operations", ""],
  });

  assert.deepEqual(plugin.domainIds, ["coding", "operations"]);
});

test("definePlugin handles sbomRef trimming", async () => {
  const plugin = await definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
    sbomRef: "  sha256:abc123  ",
  });

  assert.equal(plugin.sbomRef, "sha256:abc123");
});

test("definePlugin sets sbomRef to null when empty", () => {
  const plugin = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
    sbomRef: "   ",
  });

  assert.equal(plugin.sbomRef, null);
});

test("definePlugin rejects signing config with unregistered key", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
      signing: {
        keyId: "  key-123  ",
        signature: "  sig-abc  ",
        algorithm: "  ed25519  ",
      },
    }),
    /not registered/,
  );
});

test("definePlugin sets signing to null when not provided", () => {
  const plugin = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(plugin.signing, null);
});

test("validatePluginDefinition re-validates and preserves structure", () => {
  const original = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
  });

  const validated = validatePluginDefinition(original);

  assert.equal(validated.pluginId, original.pluginId);
  assert.equal(validated.name, original.name);
  assert.equal(validated.version, original.version);
  assert.equal(validated.type, original.type);
});

test("validatePluginDefinition throws on invalid definition", () => {
  const invalid = definePlugin({
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{ name: "run", description: "", inputSchema: {}, outputSchema: {} }],
  });

  // Manually corrupt the definition to trigger validation failure
  assert.throws(
    () => validatePluginDefinition({ ...invalid, pluginId: "" } as any),
    /Plugin ID is required/
  );
});
