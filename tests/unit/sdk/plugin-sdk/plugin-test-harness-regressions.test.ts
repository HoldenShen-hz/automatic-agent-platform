import assert from "node:assert/strict";
import test from "node:test";

import { PluginTestHarness } from "../../../../src/sdk/plugin-sdk/plugin-test-harness.js";

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

test("PluginTestHarness live mode still requires a plugin host runtime", async () => {
  const harness = new PluginTestHarness({
    plugin: toolPlugin,
    mode: "live",
    timeoutMs: 100,
  });
  const result = await harness.runCase({ query: "live" });

  assert.equal(result.passed, false);
  assert.match(result.errorMessage ?? "", /plugin host runtime/i);
});
