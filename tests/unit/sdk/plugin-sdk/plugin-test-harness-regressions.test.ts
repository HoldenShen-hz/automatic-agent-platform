import assert from "node:assert/strict";
import test from "node:test";

import { PluginTestHarness } from "../../../../src/sdk/plugin-sdk/plugin-test-harness.js";
import type { DomainToolPlugin } from "../../../../src/domains/registry/plugin-spi.js";

const toolPlugin = {
  pluginId: "test.tool",
  type: "tool",
  name: "Test Tool",
  version: "1.0.0",
  capabilities: [{
    name: "execute",
    description: "Execute",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  }],
} as never;

test("PluginTestHarness enforces timeout in mock mode", async () => {
  const harness = new PluginTestHarness({
    plugin: toolPlugin,
    mode: "mock",
    timeoutMs: 1,
  });
  const result = await harness.runCase({ query: "timeout" });

  assert.equal(result.passed, false);
  assert.match(result.errorMessage ?? "", /execution timed out/i);
});

test("PluginTestHarness live mode requires an explicit runtime binding", async () => {
  const harness = new PluginTestHarness({
    plugin: toolPlugin,
    mode: "live",
    timeoutMs: 100,
  });
  const result = await harness.runCase({ query: "live" });

  assert.equal(result.passed, false);
  assert.match(result.errorMessage ?? "", /live mode requires a bound liveRunner or livePlugin runtime/i);
});

test("PluginTestHarness live mode executes a bound tool runtime", async () => {
  const livePlugin: DomainToolPlugin = {
    pluginId: "test.tool",
    domainId: "sdk",
    spiType: "tool",
    capabilityIds: ["execute"],
    async execute(params) {
      return {
        success: true,
        output: {
          echoedArguments: params.arguments,
          toolName: params.toolName,
          taskId: params.taskId,
        },
      };
    },
  };

  const harness = new PluginTestHarness({
    plugin: toolPlugin,
    mode: "live",
    timeoutMs: 100,
    livePlugin,
  });
  const result = await harness.runCase({
    taskId: "task-live-1",
    toolName: "Test Tool",
    arguments: { query: "live" },
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.actualOutput, {
    success: true,
    output: {
      echoedArguments: { query: "live" },
      toolName: "Test Tool",
      taskId: "task-live-1",
    },
  });
});
