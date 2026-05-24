import assert from "node:assert/strict";
import test from "node:test";

import {
  defineAdapter,
  defineEvaluator,
  definePlugin,
  defineRetriever,
  defineTool,
  validatePluginDefinition,
} from "../../../src/sdk/plugin-sdk/plugin-definition.js";
import { PluginContext } from "../../../src/sdk/plugin-sdk/plugin-context.js";

type BasePluginOptions = {
  pluginId: string;
  name: string;
  version: string;
  capabilities: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  }>;
  domainIds: string[];
  spiTypes: Array<"tool" | "adapter" | "retriever" | "evaluator">;
  sbomRef: null;
  signing: null;
};

function createPluginOptions(): BasePluginOptions {
  return {
    pluginId: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute test logic",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
    domainIds: ["test"],
    spiTypes: ["tool"],
    sbomRef: null,
    signing: null,
  };
}

test("definePlugin validates required fields and normalizes defaults", () => {
  assert.throws(
    () => definePlugin({ ...createPluginOptions(), pluginId: "" }),
    /Plugin ID is required/,
  );

  const plugin = definePlugin({
    ...createPluginOptions(),
    pluginId: "  my-plugin  ",
    name: "  My Plugin  ",
    version: "  1.0.0  ",
    type: "tool",
    description: "  A test plugin  ",
  });

  assert.equal(plugin.pluginId, "my-plugin");
  assert.equal(plugin.name, "My Plugin");
  assert.equal(plugin.version, "1.0.0");
  assert.equal(plugin.type, "tool");
  assert.deepEqual(plugin.resourceLimits, {
    maxMemoryMb: 512,
    maxCpuMs: 5000,
    maxDurationMs: 30000,
  });
  assert.deepEqual(plugin.security, { sandboxTier: "read_only", egressDomains: [] });
  assert.deepEqual(plugin.domainIds, ["test"]);
  assert.deepEqual(plugin.spiTypes, ["tool"]);
});

test("defineTool, defineAdapter, defineRetriever, and defineEvaluator set the correct plugin types", () => {
  const base = createPluginOptions();
  assert.equal(defineTool(base).type, "tool");
  assert.equal(defineAdapter({ ...base, spiTypes: ["adapter"] }).type, "adapter");
  assert.equal(defineRetriever({ ...base, spiTypes: ["retriever"] }).type, "retriever");
  assert.equal(defineEvaluator({ ...base, spiTypes: ["evaluator"] }).type, "evaluator");
});

test("validatePluginDefinition preserves the current PluginDefinition structure", () => {
  const plugin = definePlugin({
    ...createPluginOptions(),
    type: "tool",
  });
  const validated = validatePluginDefinition(plugin);

  assert.equal(validated.pluginId, plugin.pluginId);
  assert.equal(validated.sbomRef, null);
  assert.equal(validated.signing, null);
});

test("PluginContext initializes defaults and supports key-value state", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  assert.equal(context.pluginId, "test-plugin");
  assert.equal(context.executionId, "unknown");
  assert.equal(context.taskId, "unknown");
  assert.equal(context.tenantId, "default");
  assert.equal(context.userId, "anonymous");
  assert.equal(context.sandboxTier, "read_only");

  context.set("foo", "bar");
  context.setValues({ count: 1, active: true });
  assert.equal(context.get("foo"), "bar");
  assert.equal(context.get("count"), 1);
  assert.equal(context.has("active"), true);
});
