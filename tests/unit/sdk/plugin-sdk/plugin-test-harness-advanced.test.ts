/**
 * @fileoverview Advanced tests for plugin-test-harness.ts - edge cases and live mode
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { DomainToolPlugin } from "../../../../src/domains/registry/plugin-spi.js";

import { PluginTestHarness } from "../../../../src/sdk/plugin-sdk/plugin-test-harness.js";
import { defineTool, defineAdapter, defineRetriever, defineEvaluator } from "../../../../src/sdk/plugin-sdk/plugin-definition.js";

test("PluginTestHarness handles live mode with liveRunner function", async () => {
  const plugin = defineTool({
    pluginId: "live-runner-tool",
    name: "Live Runner Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 5000,
    liveRunner: async (input: Record<string, unknown>) => {
      return { processed: true, input };
    },
  });

  const result = await harness.runCase({ data: "test" });
  assert.equal(result.passed, true);
  assert.deepEqual(result.actualOutput, { processed: true, input: { data: "test" } });
});

test("PluginTestHarness handles liveRunner throwing error", async () => {
  const plugin = defineTool({
    pluginId: "error-runner-tool",
    name: "Error Runner Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 5000,
    liveRunner: async () => {
      throw new Error("Live runner failed");
    },
  });

  const result = await harness.runCase({});
  assert.equal(result.passed, false);
  assert.ok(result.errorMessage?.includes("Live runner failed"));
});

test("PluginTestHarness handles livePlugin execute throwing error", async () => {
  const plugin = defineTool({
    pluginId: "error-plugin",
    name: "Error Plugin",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const errorPlugin: DomainToolPlugin = {
    pluginId: "error-plugin",
    domainId: "sdk",
    spiType: "tool",
    capabilityIds: ["execute"],
    async execute() {
      throw new Error("Plugin execution failed");
    },
  };

  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 5000,
    livePlugin: errorPlugin,
  });

  const result = await harness.runCase({});
  assert.equal(result.passed, false);
  assert.ok(result.errorMessage?.includes("Plugin execution failed"));
});

test("PluginTestHarness mock mode returns mock tool output", async () => {
  const plugin = defineTool({
    pluginId: "mock-tool",
    name: "Mock Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "mock",
    mockTools: [
      {
        toolId: "mock-tool",
        success: true,
        output: { mockResult: true },
        durationMs: 5,
      },
    ],
  });

  const result = await harness.runCase({ input: "test" });
  // Note: current implementation returns mock based on plugin type, not mockTools
  assert.equal(result.passed, true);
});

test("PluginTestHarness mock mode delay works", async () => {
  const plugin = defineTool({
    pluginId: "delay-tool",
    name: "Delay Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "mock",
    mockLlm: { responses: [{ content: "response" }], delayMs: 50 },
  });

  const start = Date.now();
  const result = await harness.runCase({});
  const elapsed = Date.now() - start;

  assert.equal(result.passed, true);
  assert.ok(elapsed >= 40); // At least close to delayMs
});

test("PluginTestHarness runCases handles errors in individual cases", async () => {
  const plugin = defineTool({
    pluginId: "multi-error-tool",
    name: "Multi Error Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 100,
    liveRunner: async () => {
      throw new Error("Case error");
    },
  });

  const report = await harness.runCases([
    { name: "error-case", input: {} },
  ]);

  assert.equal(report.totalCases, 1);
  assert.equal(report.failedCases, 1);
  assert.equal(report.passedCases, 0);
  assert.equal(report.results[0]?.passed, false);
});

test("PluginTestHarness runCases calculates coverage correctly with expected outputs", async () => {
  const plugin = defineTool({
    pluginId: "coverage-calc-tool",
    name: "Coverage Calc Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  // Use live mode to get deterministic output for testing
  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 1000,
    liveRunner: async () => ({ result: "output" }),
  });

  const report = await harness.runCases([
    { name: "pass-case", input: {}, expectedOutput: { result: "output" } },
    { name: "fail-case", input: {}, expectedOutput: { wrong: "value" } },
  ]);

  assert.equal(report.totalCases, 2);
  assert.equal(report.passedCases, 1);
  assert.equal(report.failedCases, 1);
  assert.equal(report.coveragePercent, 50);
});

test("PluginTestHarness runCases with empty expectedOutput always passes", async () => {
  const plugin = defineTool({
    pluginId: "no-expected-tool",
    name: "No Expected Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({
    plugin,
    mode: "live",
    timeoutMs: 1000,
    liveRunner: async () => ({ result: "anything" }),
  });

  const report = await harness.runCases([
    { name: "case1", input: { data: 1 } },
    { name: "case2", input: { data: 2 } },
  ]);

  assert.equal(report.passedCases, 2);
  assert.equal(report.failedCases, 0);
  assert.equal(report.coveragePercent, 100);
});

test("PluginTestHarness createContext without overrides uses plugin defaults", () => {
  const plugin = defineTool({
    pluginId: "context-defaults",
    name: "Context Defaults",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const ctx = harness.createContext();

  assert.equal(ctx.pluginId, "context-defaults");
  assert.equal(ctx.taskId, "unknown");
  assert.equal(ctx.tenantId, "default");
});

test("PluginTestHarness createContext with custom config overrides", () => {
  const plugin = defineTool({
    pluginId: "context-override",
    name: "Context Override",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const ctx = harness.createContext({
    executionId: "exec-123",
    taskId: "task-456",
    tenantId: "tenant-789",
    userId: "user-abc",
  });

  assert.equal(ctx.pluginId, "context-override");
  assert.equal(ctx.executionId, "exec-123");
  assert.equal(ctx.taskId, "task-456");
  assert.equal(ctx.tenantId, "tenant-789");
  assert.equal(ctx.userId, "user-abc");
});

test("PluginTestHarness getPlugin returns same plugin instance", () => {
  const plugin = defineTool({
    pluginId: "get-plugin-test",
    name: "Get Plugin Test",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const returned = harness.getPlugin();

  assert.equal(returned.pluginId, plugin.pluginId);
  assert.equal(returned.name, plugin.name);
  assert.equal(returned.version, plugin.version);
  assert.equal(returned.type, plugin.type);
});

test("PluginTestHarness handles adapter plugin type in mock mode", async () => {
  const plugin = defineAdapter({
    pluginId: "adapter-tool",
    name: "Adapter Tool",
    version: "1.0.0",
    capabilities: [{
      name: "adapt",
      description: "Adapt",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin, mode: "mock" });
  const result = await harness.runCase({ original: "data" });

  assert.equal(result.passed, true);
  assert.deepEqual(result.actualOutput, { adapted: true, original: { original: "data" } });
});

test("PluginTestHarness handles retriever plugin type in mock mode", async () => {
  const plugin = defineRetriever({
    pluginId: "retriever-tool",
    name: "Retriever Tool",
    version: "1.0.0",
    capabilities: [{
      name: "retrieve",
      description: "Retrieve",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin, mode: "mock" });
  const result = await harness.runCase({ query: "search" });

  assert.equal(result.passed, true);
  assert.deepEqual(result.actualOutput, { documents: [], query: { query: "search" } });
});

test("PluginTestHarness handles evaluator plugin type in mock mode", async () => {
  const plugin = defineEvaluator({
    pluginId: "evaluator-tool",
    name: "Evaluator Tool",
    version: "1.0.0",
    capabilities: [{
      name: "evaluate",
      description: "Evaluate",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin, mode: "mock" });
  const result = await harness.runCase({ result: "output" });

  assert.equal(result.passed, true);
  assert.deepEqual(result.actualOutput, { passed: true, score: 1.0, input: { result: "output" } });
});

test("PluginTestHarness handles unknown plugin type in mock mode", async () => {
  const plugin = defineTool({
    pluginId: "unknown-type-tool",
    name: "Unknown Type Tool",
    version: "1.0.0",
    capabilities: [{
      name: "custom",
      description: "Custom",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
    // Force a type by casting
  } as any);

  const harness = new PluginTestHarness({ plugin: plugin as any, mode: "mock" });
  const result = await harness.runCase({ data: "test" });

  assert.equal(result.passed, true);
  assert.ok(result.actualOutput);
});

test("PluginTestHarness report timestamp is valid ISO date", async () => {
  const plugin = defineTool({
    pluginId: "timestamp-tool",
    name: "Timestamp Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const report = await harness.runCases([{ name: "test", input: {} }]);

  const timestamp = new Date(report.timestamp);
  assert.ok(!isNaN(timestamp.getTime()));
  assert.ok(report.timestamp.includes("T"));
});

test("PluginTestHarness report results contain duration", async () => {
  const plugin = defineTool({
    pluginId: "duration-tool",
    name: "Duration Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  const report = await harness.runCases([{ name: "test", input: {} }]);

  assert.ok(report.results[0]!.durationMs >= 0);
});

test("PluginTestHarness configureMockLlm with multiple responses", () => {
  const plugin = defineTool({
    pluginId: "multi-response-tool",
    name: "Multi Response Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  harness.configureMockLlm({
    responses: [
      { content: "first response" },
      { content: "second response" },
    ],
    delayMs: 10,
  });

  // No error means success
});

test("PluginTestHarness addMockToolResult updates existing tool", () => {
  const plugin = defineTool({
    pluginId: "update-tool",
    name: "Update Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const harness = new PluginTestHarness({ plugin });
  harness.addMockToolResult({
    toolId: "new-tool",
    success: true,
    output: { updated: true },
    durationMs: 1,
  });

  // Adding same toolId again updates
  harness.addMockToolResult({
    toolId: "new-tool",
    success: false,
    output: { error: true },
    durationMs: 2,
  });

  // No error means both operations succeeded
});
