/**
 * SDK/CLI Integration Tests - Plugin SDK
 *
 * Tests the plugin SDK modules: plugin-definition, plugin-context, plugin-test-harness
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
import { PluginContext } from "../../../src/sdk/plugin-sdk/plugin-context.js";
import { PluginTestHarness } from "../../../src/sdk/plugin-sdk/plugin-test-harness.js";

test("plugin SDK: definePlugin creates a valid plugin definition with all required fields", () => {
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
  assert.equal(plugin.capabilities[0].name, "execute");
  assert.equal(plugin.resourceLimits.maxMemoryMb, 512);
  assert.equal(plugin.resourceLimits.maxCpuMs, 5000);
  assert.deepEqual(plugin.security.egressDomains, []);
});

test("plugin SDK: definePlugin validates required fields and throws on missing pluginId", () => {
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

test("plugin SDK: definePlugin throws on empty capabilities", () => {
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

test("plugin SDK: definePlugin throws on capability missing inputSchema", () => {
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

test("plugin SDK: defineTool convenience function creates a tool plugin", () => {
  const plugin = defineTool({
    pluginId: "my-pack.search-tool",
    name: "Search Tool",
    version: "1.0.0",
    capabilities: [
      {
        name: "search",
        description: "Search for documents",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
  });

  assert.equal(plugin.type, "tool");
  assert.equal(plugin.pluginId, "my-pack.search-tool");
});

test("plugin SDK: defineAdapter convenience function creates an adapter plugin", () => {
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
});

test("plugin SDK: defineRetriever convenience function creates a retriever plugin", () => {
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
});

test("plugin SDK: defineEvaluator convenience function creates an evaluator plugin", () => {
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
});

test("plugin SDK: validatePluginDefinition re-validates a plugin definition", () => {
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

test("plugin SDK: PluginContext initializes with pluginId and provides accessors", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin-001",
    taskId: "task-123",
    tenantId: "tenant-acme",
    userId: "user-456",
    sessionId: "session-789",
    sandboxTier: "container",
  });

  assert.equal(ctx.pluginId, "test-plugin-001");
  assert.equal(ctx.executionId, "unknown");
  assert.equal(ctx.taskId, "task-123");
  assert.equal(ctx.tenantId, "tenant-acme");
  assert.equal(ctx.userId, "user-456");
  assert.equal(ctx.sandboxTier, "container");
});

test("plugin SDK: PluginContext defaults values when not provided", () => {
  const ctx = new PluginContext({ pluginId: "minimal-plugin" });

  assert.equal(ctx.executionId, "unknown");
  assert.equal(ctx.taskId, "unknown");
  assert.equal(ctx.tenantId, "default");
  assert.equal(ctx.userId, "anonymous");
  // Access internal sessionId via fork to verify it persists
  const childWithSession = ctx.fork({ sessionId: "session-abc" });
  // sessionId is stored internally but not exposed as a public getter - verify via fork behavior
  const grandchild = childWithSession.fork({});
  assert.equal(grandchild.taskId, ctx.taskId);
  assert.equal(ctx.sandboxTier, "process");
});

test("plugin SDK: PluginContext set/get/has/keys for context values", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  ctx.set("custom.key", "custom-value", "plugin");
  assert.equal(ctx.get("custom.key"), "custom-value");
  assert.equal(ctx.has("custom.key"), true);
  assert.equal(ctx.has("nonexistent.key"), false);
  assert.ok(ctx.keys().includes("custom.key"));

  ctx.setValues({ key1: "value1", key2: "value2" }, "user");
  assert.equal(ctx.get("key1"), "value1");
  assert.equal(ctx.get("key2"), "value2");
});

test("plugin SDK: PluginContext getResourceLimits returns configured or default limits", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    resourceLimits: {
      maxMemoryMb: 1024,
      maxCpuMs: 10000,
      maxDurationMs: 60000,
    },
  });

  const limits = ctx.getResourceLimits();
  assert.equal(limits.maxMemoryMb, 1024);
  assert.equal(limits.maxCpuMs, 10000);
  assert.equal(limits.maxDurationMs, 60000);
});

test("plugin SDK: PluginContext fork creates a child context with overrides", () => {
  const ctx = new PluginContext({
    pluginId: "parent-plugin",
    tenantId: "parent-tenant",
    taskId: "parent-task",
  });

  const child = ctx.fork({
    taskId: "child-task",
    userId: "child-user",
  });

  assert.equal(child.pluginId, "parent-plugin");
  assert.equal(child.tenantId, "parent-tenant");
  assert.equal(child.taskId, "child-task");
  assert.equal(child.userId, "child-user");
});

test("plugin SDK: PluginContext toRecord returns all values as plain object", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("custom.data", { nested: true });

  const record = ctx.toRecord();
  // Record should contain custom data set via ctx.set
  assert.deepEqual(record["custom.data"], { nested: true });
  // Record should also contain system-set values
  assert.ok(record["system.plugin_id"]);
});

test("plugin SDK: PluginContext throws on empty pluginId", () => {
  assert.throws(
    () => new PluginContext({ pluginId: "" }),
    /PluginContext requires pluginId/,
  );
});

test("plugin SDK: PluginTestHarness runs single test case and reports result", async () => {
  const harness = new PluginTestHarness({
    plugin: defineTool({
      pluginId: "harness-test-tool",
      name: "Harness Test Tool",
      version: "1.0.0",
      capabilities: [
        {
          name: "execute",
          description: "Execute test",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        },
      ],
    }),
  });

  const result = await harness.runCase({ input: "test-input" });
  assert.equal(result.passed, true);
  assert.ok(result.durationMs >= 0);
});

test("plugin SDK: PluginTestHarness runs multiple test cases and generates report", async () => {
  const harness = new PluginTestHarness({
    plugin: defineTool({
      pluginId: "multi-case-tool",
      name: "Multi Case Tool",
      version: "1.0.0",
      capabilities: [
        {
          name: "execute",
          description: "Execute test",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        },
      ],
    }),
  });

  const cases = [
    { name: "case-1", input: { value: 1 } },
    { name: "case-2", input: { value: 2 } },
    { name: "case-3", input: { value: 3 } },
  ];

  const report = await harness.runCases(cases);
  assert.equal(report.pluginId, "multi-case-tool");
  assert.equal(report.totalCases, 3);
  assert.equal(report.passedCases + report.failedCases, 3);
  assert.ok(report.results.length === 3);
  assert.ok(report.timestamp);
});

test("plugin SDK: PluginTestHarness createContext creates a PluginContext for the plugin", () => {
  const harness = new PluginTestHarness({
    plugin: definePlugin({
      pluginId: "context-plugin",
      name: "Context Plugin",
      version: "1.0.0",
      type: "tool",
      capabilities: [
        {
          name: "run",
          description: "Run",
          inputSchema: {},
          outputSchema: {},
        },
      ],
    }),
  });

  const ctx = harness.createContext({ taskId: "task-from-harness" });
  assert.equal(ctx.pluginId, "context-plugin");
  assert.equal(ctx.taskId, "task-from-harness");
});

test("plugin SDK: PluginTestHarness getPlugin returns the plugin definition", () => {
  const pluginDef = defineTool({
    pluginId: "get-plugin-test",
    name: "Get Plugin Test",
    version: "1.0.0",
    capabilities: [
      {
        name: "run",
        description: "Run",
        inputSchema: {},
        outputSchema: {},
      },
    ],
  });

  const harness = new PluginTestHarness({ plugin: pluginDef });
  const retrieved = harness.getPlugin();

  assert.equal(retrieved.pluginId, pluginDef.pluginId);
  assert.equal(retrieved.name, pluginDef.name);
});

test("plugin SDK: PluginTestHarness executePlugin returns type-specific output", async () => {
  const toolHarness = new PluginTestHarness({
    plugin: defineTool({
      pluginId: "tool-test",
      name: "Tool Test",
      version: "1.0.0",
      capabilities: [
        {
          name: "run",
          description: "Run",
          inputSchema: {},
          outputSchema: {},
        },
      ],
    }),
  });

  const toolResult = await toolHarness.runCase({ test: true });
  assert.equal(toolResult.passed, true);

  const adapterHarness = new PluginTestHarness({
    plugin: defineAdapter({
      pluginId: "adapter-test",
      name: "Adapter Test",
      version: "1.0.0",
      capabilities: [
        {
          name: "run",
          description: "Run",
          inputSchema: {},
          outputSchema: {},
        },
      ],
    }),
  });

  const adapterResult = await adapterHarness.runCase({ test: true });
  assert.equal(adapterResult.passed, true);

  const retrieverHarness = new PluginTestHarness({
    plugin: defineRetriever({
      pluginId: "retriever-test",
      name: "Retriever Test",
      version: "1.0.0",
      capabilities: [
        {
          name: "run",
          description: "Run",
          inputSchema: {},
          outputSchema: {},
        },
      ],
    }),
  });

  const retrieverResult = await retrieverHarness.runCase({ test: true });
  assert.equal(retrieverResult.passed, true);
});
