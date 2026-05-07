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
  type PluginType,
  type PluginSpiType,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";
import { PluginContext } from "../../../src/sdk/plugin-sdk/plugin-context.js";
import {
  PluginTestHarness,
  type MockLlmConfig,
  type MockToolResult,
  type TestCase,
} from "../../../src/sdk/plugin-sdk/plugin-test-harness.js";

function createMinimalPlugin(overrides = {}): PluginDefinition {
  return {
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    type: "tool" as PluginType,
    capabilities: [
      {
        name: "execute",
        description: "Test capability",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    ],
    spiTypes: ["tool"] as PluginSpiType[],
    domainIds: [] as string[],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    resourceLimits: {
      maxMemoryMb: 512,
      maxCpuMs: 5000,
      maxDurationMs: 30000,
    },
    dependencies: [] as string[],
    security: {
      sandboxTier: "read_only" as const,
      egressDomains: [] as string[],
    },
    ...overrides,
  };
}

test("definePlugin validates required fields", async () => {
  await assert.rejects(
    async () => definePlugin({ pluginId: "", name: "Test", version: "1.0.0", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin ID is required/
  );
  await assert.rejects(
    async () => definePlugin({ pluginId: "  ", name: "Test", version: "1.0.0", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin ID is required/
  );
  await assert.rejects(
    async () => definePlugin({ pluginId: "p", name: "", version: "1.0.0", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin name is required/
  );
  await assert.rejects(
    async () => definePlugin({ pluginId: "p", name: "Test", version: "", type: "tool", capabilities: [{ name: "exec", description: "", inputSchema: {}, outputSchema: {} }] }),
    /Plugin version is required/
  );
  await assert.rejects(
    async () => definePlugin({ pluginId: "p", name: "Test", version: "1.0.0", type: "tool", capabilities: [] }),
    /at least one capability/
  );
});

test("definePlugin validates capability fields", async () => {
  await assert.rejects(
    async () => definePlugin({
      pluginId: "p",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      spiTypes: ["tool"],
      domainIds: [],
      sbomRef: null,
      signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
      capabilities: [{ name: "", description: "desc", inputSchema: {}, outputSchema: {} }],
    }),
    /Capability name is required/
  );
  await assert.rejects(
    async () => definePlugin({
      pluginId: "p",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      spiTypes: ["tool"],
      domainIds: [],
      sbomRef: null,
      signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
      capabilities: [{ name: "exec", description: "desc", inputSchema: undefined as any, outputSchema: {} }],
    }),
    /inputSchema/
  );
  await assert.rejects(
    async () => definePlugin({
      pluginId: "p",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      spiTypes: ["tool"],
      domainIds: [],
      sbomRef: null,
      signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
      capabilities: [{ name: "exec", description: "desc", inputSchema: {}, outputSchema: undefined as any }],
    }),
    /outputSchema/
  );
});

test("definePlugin creates valid plugin definition", async () => {
  const plugin = await definePlugin({
    pluginId: "  my-plugin  ",
    name: "  My Plugin  ",
    version: "  1.0.0  ",
    type: "tool",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
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

test("definePlugin applies custom resource limits and security", async () => {
  const plugin = await definePlugin({
    pluginId: "custom-plugin",
    name: "Custom Plugin",
    version: "1.0.0",
    type: "adapter",
    spiTypes: ["adapter"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "adapt", description: "", inputSchema: {}, outputSchema: {} }],
    resourceLimits: { maxMemoryMb: 1024, maxCpuMs: 10000, maxDurationMs: 60000 },
    security: { sandboxTier: "container", egressDomains: ["api.example.com"] },
  });

  assert.deepEqual(plugin.resourceLimits, { maxMemoryMb: 1024, maxCpuMs: 10000, maxDurationMs: 60000 });
  assert.deepEqual(plugin.security, { sandboxTier: "workspace_write", egressDomains: ["api.example.com"] });
});

test("defineTool creates tool plugin", async () => {
  const tool = await defineTool({
    pluginId: "my-tool",
    name: "My Tool",
    version: "2.0.0",
    spiTypes: ["tool"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "run", description: "Run tool", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(tool.type, "tool");
  assert.equal(tool.pluginId, "my-tool");
});

test("defineAdapter creates adapter plugin", async () => {
  const adapter = await defineAdapter({
    pluginId: "my-adapter",
    name: "My Adapter",
    version: "1.0.0",
    spiTypes: ["adapter"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "convert", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(adapter.type, "adapter");
});

test("defineRetriever creates retriever plugin", async () => {
  const retriever = await defineRetriever({
    pluginId: "my-retriever",
    name: "My Retriever",
    version: "1.0.0",
    spiTypes: ["retriever"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "search", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(retriever.type, "retriever");
});

test("defineEvaluator creates evaluator plugin", async () => {
  const evaluator = await defineEvaluator({
    pluginId: "my-evaluator",
    name: "My Evaluator",
    version: "1.0.0",
    spiTypes: ["evaluator"],
    domainIds: [],
    sbomRef: null,
    signing: { keyId: "test-key", signature: "test-signature", algorithm: "ed25519" },
    capabilities: [{ name: "evaluate", description: "", inputSchema: {}, outputSchema: {} }],
  });

  assert.equal(evaluator.type, "evaluator");
});

test("validatePluginDefinition re-validates and preserves structure", async () => {
  const original = createMinimalPlugin();
  const validated = await validatePluginDefinition(original);

  assert.equal(validated.pluginId, original.pluginId);
  assert.equal(validated.name, original.name);
  assert.equal(validated.type, original.type);
});

test("validatePluginDefinition throws on invalid definition", async () => {
  const invalid = { ...createMinimalPlugin(), pluginId: "" };
  await assert.rejects(
    async () => validatePluginDefinition(invalid as any),
    /plugin_sdk\.missing_plugin_id/
  );
});

test("PluginContext requires pluginId", () => {
  assert.throws(() => new PluginContext({ pluginId: "" }), /PluginContext requires pluginId/);
  assert.throws(() => new PluginContext({ pluginId: "   " }), /PluginContext requires pluginId/);
});

test("PluginContext initializes with defaults", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  assert.equal(context.pluginId, "test-plugin");
  assert.equal(context.executionId, "unknown");
  assert.equal(context.taskId, "unknown");
  assert.equal(context.tenantId, "default");
  assert.equal(context.userId, "anonymous");
  assert.equal(context.sandboxTier, "read_only");
});

test("PluginContext accepts custom config", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    executionId: "exec-123",
    taskId: "task-456",
    tenantId: "tenant-abc",
    userId: "user-789",
    sessionId: "session-xyz",
    sandboxTier: "container",
    resourceLimits: { maxMemoryMb: 1024 },
  });

  assert.equal(context.executionId, "exec-123");
  assert.equal(context.taskId, "task-456");
  assert.equal(context.tenantId, "tenant-abc");
  assert.equal(context.userId, "user-789");
  assert.equal(context.sandboxTier, "workspace_write");
});

test("PluginContext get and set values", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  context.set("foo", "bar");
  assert.equal(context.get("foo"), "bar");

  context.set("number", 42);
  assert.equal(context.get("number"), 42);

  assert.equal(context.has("foo"), true);
  assert.equal(context.has("nonexistent"), false);
});

test("PluginContext setValues bulk sets", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  context.setValues({ a: 1, b: "two", c: true });
  assert.equal(context.get("a"), 1);
  assert.equal(context.get("b"), "two");
  assert.equal(context.get("c"), true);
});

test("PluginContext keys returns all keys", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  context.set("key1", "value1");
  context.set("key2", "value2");

  const keys = context.keys();
  assert.ok(keys.includes("key1"));
  assert.ok(keys.includes("key2"));
  assert.ok(keys.includes("system.plugin_id"));
});

test("PluginContext set with different sources", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  context.set("user-key", "user-value", "user");
  context.set("system-key", "system-value", "system");
  context.set("plugin-key", "plugin-value", "plugin");

  assert.equal(context.get("user-key"), "user-value");
  assert.equal(context.get("system-key"), "system-value");
  assert.equal(context.get("plugin-key"), "plugin-value");
});

test("PluginContext getResourceLimits returns defaults", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  const limits = context.getResourceLimits();

  assert.equal(limits.maxMemoryMb, 512);
  assert.equal(limits.maxCpuMs, 5000);
  assert.equal(limits.maxDurationMs, 30000);
});

test("PluginContext getResourceLimits uses custom values", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    resourceLimits: { maxMemoryMb: 2048, maxCpuMs: 10000, maxDurationMs: 60000 },
  });
  const limits = context.getResourceLimits();

  assert.equal(limits.maxMemoryMb, 2048);
  assert.equal(limits.maxCpuMs, 10000);
  assert.equal(limits.maxDurationMs, 60000);
});

test("PluginContext fork creates child context", () => {
  const parent = new PluginContext({
    pluginId: "test-plugin",
    executionId: "parent-exec",
    taskId: "parent-task",
    tenantId: "parent-tenant",
  });

  const child = parent.fork({
    executionId: "child-exec",
    taskId: "child-task",
  });

  assert.equal(child.pluginId, "test-plugin");
  assert.equal(child.executionId, "child-exec");
  assert.equal(child.taskId, "child-task");
  assert.equal(child.tenantId, "parent-tenant");
});

test("PluginContext toRecord returns plain object", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  context.set("custom-key", "custom-value");

  const record = context.toRecord();
  assert.ok(record["custom-key"]);
  assert.ok(record["system.plugin_id"]);
});

test("PluginTestHarness constructor configures plugin", () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  assert.equal(harness.getPlugin().pluginId, plugin.pluginId);
});

test("PluginTestHarness configureMockLlm", () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  const mockLlm: MockLlmConfig = {
    responses: [{ content: "test response" }],
    delayMs: 100,
  };
  harness.configureMockLlm(mockLlm);
});

test("PluginTestHarness addMockToolResult", () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  const toolResult: MockToolResult = {
    toolId: "tool-1",
    success: true,
    output: { result: "ok" },
    durationMs: 50,
  };
  harness.addMockToolResult(toolResult);
});

test("PluginTestHarness runCase returns result", async () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  const result = await harness.runCase({ input: "test" });

  assert.equal(result.passed, true);
  assert.equal(result.caseName, "single-case");
  assert.equal(result.durationMs >= 0, true);
});

test("PluginTestHarness runCases processes multiple cases", async () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  const cases: TestCase[] = [
    { name: "case-1", input: { query: "test1" }, expectedOutput: { result: "Tool Test Plugin executed", input: { query: "test1" } } },
    { name: "case-2", input: { query: "test2" } },
    { name: "case-3", input: { query: "test3" }, expectedError: "NonExistent" },
  ];

  const report = await harness.runCases(cases);

  assert.equal(report.pluginId, plugin.pluginId);
  assert.equal(report.totalCases, 3);
  assert.ok(report.timestamp);
  assert.equal(report.results.length, 3);
});

test("PluginTestHarness runCases calculates coverage", async () => {
  const plugin = createMinimalPlugin({ type: "evaluator" });
  const harness = new PluginTestHarness({ plugin });

  const cases: TestCase[] = [
    { name: "pass-case", input: {}, expectedOutput: { passed: true, score: 1, input: {} } },
    { name: "fail-case", input: {}, expectedOutput: { passed: false } },
  ];

  const report = await harness.runCases(cases);

  assert.equal(report.totalCases, 2);
  assert.ok(typeof report.coveragePercent === "number");
});

test("PluginTestHarness createContext creates PluginContext", () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  const context = harness.createContext({ taskId: "task-123" });

  assert.equal(context.pluginId, plugin.pluginId);
  assert.equal(context.taskId, "task-123");
});

test("PluginTestHarness with timeout config", () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin, timeoutMs: 5000 });

  assert.equal(harness.getPlugin().pluginId, plugin.pluginId);
});

test("PluginTestHarness with mockTools in constructor", () => {
  const plugin = createMinimalPlugin();
  const toolResult: MockToolResult = {
    toolId: "read",
    success: true,
    output: "file content",
    durationMs: 30,
  };
  const harness = new PluginTestHarness({
    plugin,
    mockTools: [toolResult],
  });

  assert.equal(harness.getPlugin().pluginId, plugin.pluginId);
});

test("PluginTestHarness executePlugin returns correct output for tool type", async () => {
  const plugin = createMinimalPlugin({ type: "tool", name: "QueryTool" });
  const harness = new PluginTestHarness({ plugin });

  const result = await harness.runCase({ query: "hello" });

  assert.equal(result.passed, true);
  assert.ok(result.actualOutput);
});

test("PluginTestHarness executePlugin returns correct output for adapter type", async () => {
  const plugin = createMinimalPlugin({ type: "adapter" });
  const harness = new PluginTestHarness({ plugin });

  const result = await harness.runCase({ data: "test" });

  assert.equal(result.passed, true);
  assert.ok(result.actualOutput);
});

test("PluginTestHarness executePlugin returns correct output for retriever type", async () => {
  const plugin = createMinimalPlugin({ type: "retriever" });
  const harness = new PluginTestHarness({ plugin });

  const result = await harness.runCase({ query: "search" });

  assert.equal(result.passed, true);
  assert.ok(result.actualOutput);
});

test("PluginTestHarness executePlugin returns correct output for evaluator type", async () => {
  const plugin = createMinimalPlugin({ type: "evaluator" });
  const harness = new PluginTestHarness({ plugin });

  const result = await harness.runCase({ input: "test" });

  assert.equal(result.passed, true);
  assert.ok(result.actualOutput);
});

test("PluginTestHarness executePlugin returns correct output for presenter type", async () => {
  const plugin = createMinimalPlugin({ type: "presenter" });
  const harness = new PluginTestHarness({ plugin });

  const result = await harness.runCase({ content: "data" });

  assert.equal(result.passed, true);
  assert.ok(result.actualOutput);
});

test("PluginTestHarness report contains timestamp", async () => {
  const plugin = createMinimalPlugin();
  const harness = new PluginTestHarness({ plugin });

  const report = await harness.runCases([{ name: "test", input: {} }]);

  assert.ok(report.timestamp);
  assert.ok(new Date(report.timestamp).getTime() > 0);
});
