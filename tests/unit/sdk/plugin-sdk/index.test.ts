import assert from "node:assert/strict";
import test from "node:test";

import { definePlugin } from "../../../../src/sdk/plugin-sdk/index.js";

test("plugin-sdk defines and validates plugin definitions", () => {
  const plugin = definePlugin({
    pluginId: "ops-plugin",
    name: "Ops Plugin",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "query",
      description: "Run query",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  assert.equal(plugin.pluginId, "ops-plugin");
  assert.equal(plugin.name, "Ops Plugin");
  assert.equal(plugin.type, "tool");
});
