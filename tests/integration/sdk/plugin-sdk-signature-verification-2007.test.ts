/**
 * @fileoverview Integration Tests for Plugin SDK - Plugin Definition (2007)
 *
 * Tests the plugin definition functionality:
 * - Plugin creation with definePlugin, defineTool, defineAdapter, defineRetriever, defineEvaluator
 * - Plugin validation with validatePluginDefinition
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
  type PluginDefinition,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";

// ============================================================================
// Tests for Plugin Definition
// ============================================================================

test("2007: defineTool creates a valid tool plugin", () => {
  const plugin = defineTool({
    pluginId: "my-pack.query-tool",
    name: "Query Tool",
    version: "1.0.0",
    capabilities: [
      {
        name: "execute",
        description: "Execute a query against the data source",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            rows: { type: "array" },
            count: { type: "number" },
          },
        },
      },
    ],
  });

  assert.equal(plugin.pluginId, "my-pack.query-tool");
  assert.equal(plugin.name, "Query Tool");
  assert.equal(plugin.version, "1.0.0");
  assert.equal(plugin.type, "tool");
  assert.equal(plugin.capabilities.length, 1);
  assert.equal(plugin.capabilities[0]!.name, "execute");
});

test("2007: defineAdapter creates a valid adapter plugin", () => {
  const plugin = defineAdapter({
    pluginId: "my-pack.db-adapter",
    name: "Database Adapter",
    version: "1.0.0",
    capabilities: [
      {
        name: "connect",
        description: "Connect to database",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
  });

  assert.equal(plugin.type, "adapter");
  assert.equal(plugin.pluginId, "my-pack.db-adapter");
});

test("2007: defineRetriever creates a valid retriever plugin", () => {
  const plugin = defineRetriever({
    pluginId: "my-pack.knowledge-retriever",
    name: "Knowledge Retriever",
    version: "1.0.0",
    capabilities: [
      {
        name: "retrieve",
        description: "Retrieve knowledge",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
  });

  assert.equal(plugin.type, "retriever");
  assert.equal(plugin.pluginId, "my-pack.knowledge-retriever");
});

test("2007: defineEvaluator creates a valid evaluator plugin", () => {
  const plugin = defineEvaluator({
    pluginId: "my-pack.quality-evaluator",
    name: "Quality Evaluator",
    version: "1.0.0",
    capabilities: [
      {
        name: "evaluate",
        description: "Evaluate quality",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
  });

  assert.equal(plugin.type, "evaluator");
  assert.equal(plugin.pluginId, "my-pack.quality-evaluator");
});

test("2007: definePlugin creates a valid plugin definition with all required fields", () => {
  const plugin = definePlugin({
    pluginId: "my-pack.query-tool",
    name: "Query Tool",
    version: "1.0.0",
    type: "tool",
    capabilities: [
      {
        name: "execute",
        description: "Execute a query against the data source",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            rows: { type: "array" },
            count: { type: "number" },
          },
        },
      },
    ],
  });

  assert.equal(plugin.pluginId, "my-pack.query-tool");
  assert.equal(plugin.name, "Query Tool");
  assert.equal(plugin.version, "1.0.0");
  assert.equal(plugin.type, "tool");
  assert.equal(plugin.capabilities.length, 1);
  assert.equal(plugin.capabilities[0]!.name, "execute");
  assert.equal(plugin.resourceLimits.maxMemoryMb, 512);
  assert.equal(plugin.resourceLimits.maxCpuMs, 5000);
  assert.deepEqual(plugin.security.egressDomains, []);
});

test("2007: definePlugin validates required fields and throws on missing pluginId", () => {
  assert.throws(
    () =>
      definePlugin({
        pluginId: "",
        name: "Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [
          {
            name: "execute",
            description: "Test",
            inputSchema: {},
            outputSchema: {},
          },
        ],
      }),
    /plugin_sdk\.missing_plugin_id/,
  );
});

test("2007: definePlugin throws on empty capabilities", () => {
  assert.throws(
    () =>
      definePlugin({
        pluginId: "test-plugin",
        name: "Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [],
      }),
    /Plugin must declare at least one capability/,
  );
});

test("2007: definePlugin throws on capability missing inputSchema", () => {
  assert.throws(
    () =>
      definePlugin({
        pluginId: "test-plugin",
        name: "Test",
        version: "1.0.0",
        type: "tool",
        capabilities: [
          {
            name: "execute",
            description: "Test",
            inputSchema: undefined as unknown as Record<string, unknown>,
            outputSchema: { type: "object" },
          },
        ],
      }),
    /requires inputSchema/,
  );
});

test("2007: validatePluginDefinition re-validates a plugin definition", () => {
  const plugin = definePlugin({
    pluginId: "my-pack.validated",
    name: "Validated Plugin",
    version: "2.0.0",
    type: "tool",
    capabilities: [
      {
        name: "run",
        description: "Run the plugin",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
  });

  const revalidated = validatePluginDefinition(plugin);
  assert.equal(revalidated.pluginId, plugin.pluginId);
  assert.equal(revalidated.version, plugin.version);
});

test("2007: definePlugin accepts signing information when provided", async () => {
  const plugin = await definePlugin({
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
    signing: {
      keyId: "test-key",
      signature: "test-signature",
      algorithm: "ed25519",
    },
  });

  assert.equal(plugin.pluginId, "test.signed-plugin");
  assert.ok(plugin.signing);
  assert.equal(plugin.signing?.keyId, "test-key");
});

test("2007: definePlugin supports plugins with dependencies", async () => {
  const plugin = await definePlugin({
    pluginId: "test.deps-plugin",
    name: "Plugin with Dependencies",
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
    dependencies: ["other-plugin@>=1.0.0"],
  });

  assert.equal(plugin.dependencies.length, 1);
  assert.equal(plugin.dependencies[0], "other-plugin@>=1.0.0");
});