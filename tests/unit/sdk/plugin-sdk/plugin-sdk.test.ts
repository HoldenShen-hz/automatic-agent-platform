/**
 * @fileoverview Tests for Plugin SDK
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
import {
  PluginContext,
  type PluginContextConfig,
} from "../../../src/sdk/plugin-sdk/plugin-context.js";
import {
  PluginTestHarness,
  type TestCase,
} from "../../../src/sdk/plugin-sdk/plugin-test-harness.js";

test("definePlugin creates valid plugin definition", () => {
  const plugin = definePlugin({
    pluginId: "my-pack.query-tool",
    name: "Query Tool",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "execute",
      description: "Execute a query",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
    }],
  });

  assert.equal(plugin.pluginId, "my-pack.query-tool");
  assert.equal(plugin.name, "Query Tool");
  assert.equal(plugin.version, "1.0.0");
  assert.equal(plugin.type, "tool");
  assert.equal(plugin.capabilities.length, 1);
});

test("definePlugin trims whitespace from inputs", () => {
  const plugin = definePlugin({
    pluginId: "  trimmed-id  ",
    name: "  Trimmed Name  ",
    version: "  1.0.0  ",
    type: "tool",
    capabilities: [{
      name: "execute",
      description: "Test",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(plugin.pluginId, "trimmed-id");
  assert.equal(plugin.name, "Trimmed Name");
  assert.equal(plugin.version, "1.0.0");
});

test("definePlugin throws on missing pluginId", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "test", inputSchema: {}, outputSchema: {} }],
    }),
    /plugin_id/i,
  );
});

test("definePlugin throws on missing type", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test-plugin",
      name: "Test",
      version: "1.0.0",
      type: undefined as any,
      capabilities: [{ name: "test", inputSchema: {}, outputSchema: {} }],
    }),
    /type/i,
  );
});

test("definePlugin throws on empty capabilities", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test-plugin",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [],
    }),
    /capabilities/i,
  );
});

test("defineTool creates tool plugin with type=tool", () => {
  const tool = defineTool({
    pluginId: "my-pack.my-tool",
    name: "My Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(tool.type, "tool");
});

test("defineAdapter creates adapter plugin with type=adapter", () => {
  const adapter = defineAdapter({
    pluginId: "my-pack.my-adapter",
    name: "My Adapter",
    version: "1.0.0",
    capabilities: [{
      name: "adapt",
      description: "Adapt",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(adapter.type, "adapter");
});

test("defineRetriever creates retriever plugin with type=retriever", () => {
  const retriever = defineRetriever({
    pluginId: "my-pack.my-retriever",
    name: "My Retriever",
    version: "1.0.0",
    capabilities: [{
      name: "retrieve",
      description: "Retrieve",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(retriever.type, "retriever");
});

test("defineEvaluator creates evaluator plugin with type=evaluator", () => {
  const evaluator = defineEvaluator({
    pluginId: "my-pack.my-evaluator",
    name: "My Evaluator",
    version: "1.0.0",
    capabilities: [{
      name: "evaluate",
      description: "Evaluate",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(evaluator.type, "evaluator");
});

test("PluginContext creates with required pluginId", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  assert.equal(ctx.pluginId, "test-plugin");
  assert.equal(ctx.tenantId, "default");
});

test("PluginContext.get returns context values", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("test.key", "test-value");
  assert.equal(ctx.get("test.key"), "test-value");
});

test("PluginContext.setValues sets multiple values", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.setValues({ "key1": "value1", "key2": "value2" });
  assert.equal(ctx.get("key1"), "value1");
  assert.equal(ctx.get("key2"), "value2");
});

test("PluginContext.has checks for key existence", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("existing-key", "value");
  assert.ok(ctx.has("existing-key"));
  assert.ok(!ctx.has("non-existing-key"));
});

test("PluginContext.fork creates child context", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", taskId: "task-1" });
  const child = ctx.fork({ taskId: "task-2" });
  assert.equal(child.pluginId, "test-plugin");
  assert.equal(child.taskId, "task-2");
});

test("PluginContext.toRecord returns plain object", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("key1", "value1");
  const record = ctx.toRecord();
  assert.ok(record.key1);
  assert.ok(record["system.plugin_id"]);
});

test("PluginTestHarness.runCases executes test cases", async () => {
  const plugin = defineTool({
    pluginId: "test-tool",
    name: "Test Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const cases: TestCase[] = [
    { name: "test-1", input: { query: "test" } },
    { name: "test-2", input: { query: "test2" } },
  ];

  const report = await harness.runCases(cases);
  assert.equal(report.pluginId, "test-tool");
  assert.equal(report.totalCases, 2);
});

test("PluginTestHarness.runCases calculates coverage", async () => {
  const plugin = defineTool({
    pluginId: "coverage-test-tool",
    name: "Coverage Test Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const cases: TestCase[] = [
    { name: "pass-1", input: {}, expectedOutput: {} },
    { name: "pass-2", input: {}, expectedOutput: {} },
  ];

  const report = await harness.runCases(cases);
  assert.ok(report.coveragePercent >= 0);
});

test("PluginTestHarness.createContext creates plugin context", () => {
  const plugin = defineTool({
    pluginId: "context-test-tool",
    name: "Context Test Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const ctx = harness.createContext({ taskId: "task-123" });
  assert.equal(ctx.pluginId, "context-test-tool");
  assert.equal(ctx.taskId, "task-123");
});

test("validatePluginDefinition validates and returns plugin", () => {
  const plugin = definePlugin({
    pluginId: "validation-test",
    name: "Validation Test",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  const validated = validatePluginDefinition(plugin);
  assert.equal(validated.pluginId, plugin.pluginId);
});