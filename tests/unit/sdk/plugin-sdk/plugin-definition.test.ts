import test from "node:test";
import assert from "node:assert/strict";

import { definePlugin, defineTool, defineAdapter, defineRetriever, defineEvaluator, validatePluginDefinition } from "../../../../src/sdk/plugin-sdk/plugin-definition.js";

test("definePlugin throws when pluginId is missing", () => {
  assert.throws(
    () => definePlugin({ pluginId: "", name: "Test", version: "1.0.0", type: "tool", capabilities: [] }),
    /Plugin ID is required/,
  );
});

test("definePlugin throws when name is missing", () => {
  assert.throws(
    () => definePlugin({ pluginId: "test", name: "", version: "1.0.0", type: "tool", capabilities: [] }),
    /Plugin name is required/,
  );
});

test("definePlugin throws when version is missing", () => {
  assert.throws(
    () => definePlugin({ pluginId: "test", name: "Test", version: "", type: "tool", capabilities: [] }),
    /Plugin version is required/,
  );
});

test("definePlugin throws when type is missing", () => {
  assert.throws(
    () => definePlugin({ pluginId: "test", name: "Test", version: "1.0.0", type: undefined as unknown as "tool", capabilities: [] }),
    /Plugin type is required/,
  );
});

test("definePlugin throws when capabilities are empty", () => {
  assert.throws(
    () => definePlugin({ pluginId: "test", name: "Test", version: "1.0.0", type: "tool", capabilities: [] }),
    /at least one capability/,
  );
});

test("definePlugin throws when capability name is empty", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "", description: "test", inputSchema: {}, outputSchema: {} }],
    }),
    /Capability name is required/,
  );
});

test("definePlugin throws when capability inputSchema is missing", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "cap", description: "test", inputSchema: undefined as unknown as {}, outputSchema: {} }],
    }),
    /requires inputSchema/,
  );
});

test("definePlugin throws when capability outputSchema is missing", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{ name: "cap", description: "test", inputSchema: {}, outputSchema: undefined as unknown as {} }],
    }),
    /requires outputSchema/,
  );
});

test("definePlugin creates valid plugin definition", () => {
  const result = definePlugin({
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

  assert.equal(result.pluginId, "my-pack.query-tool");
  assert.equal(result.name, "Query Tool");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.type, "tool");
  assert.equal(result.capabilities.length, 1);
  assert.equal(result.resourceLimits.maxMemoryMb, 512);
});

test("definePlugin applies custom resource limits", () => {
  const result = definePlugin({
    pluginId: "test",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "cap",
      description: "test",
      inputSchema: {},
      outputSchema: {},
    }],
    resourceLimits: {
      maxMemoryMb: 1024,
      maxCpuMs: 10000,
      maxDurationMs: 60000,
    },
  });

  assert.equal(result.resourceLimits.maxMemoryMb, 1024);
  assert.equal(result.resourceLimits.maxCpuMs, 10000);
  assert.equal(result.resourceLimits.maxDurationMs, 60000);
});

test("definePlugin applies custom security config", () => {
  const result = definePlugin({
    pluginId: "test",
    name: "Test",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "cap",
      description: "test",
      inputSchema: {},
      outputSchema: {},
    }],
    security: {
      sandboxTier: "container",
      egressDomains: ["api.example.com"],
    },
  });

  assert.equal(result.security.sandboxTier, "workspace_write");
  assert.deepEqual(result.security.egressDomains, ["api.example.com"]);
});

test("definePlugin rejects insecure sandbox tier none", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{
        name: "cap",
        description: "test",
        inputSchema: {},
        outputSchema: {},
      }],
      security: {
        sandboxTier: "none",
      },
    }),
    /sandboxTier 'none'/,
  );
});

test("definePlugin rejects non-positive resource limits", () => {
  assert.throws(
    () => definePlugin({
      pluginId: "test",
      name: "Test",
      version: "1.0.0",
      type: "tool",
      capabilities: [{
        name: "cap",
        description: "test",
        inputSchema: {},
        outputSchema: {},
      }],
      resourceLimits: {
        maxMemoryMb: 0,
        maxCpuMs: 100,
        maxDurationMs: 1000,
      },
    }),
    /positive finite number/,
  );
});

test("definePlugin trims pluginId, name, version, and description", () => {
  const result = definePlugin({
    pluginId: "  test  ",
    name: "  Test  ",
    version: "  1.0.0  ",
    type: "tool",
    description: "  desc  ",
    capabilities: [{
      name: "  cap  ",
      description: "test",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.pluginId, "test");
  assert.equal(result.name, "Test");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.description, "desc");
  // Note: capability names are NOT trimmed
  assert.equal(result.capabilities[0]!.name, "  cap  ");
});

test("defineTool creates tool plugin", () => {
  const result = defineTool({
    pluginId: "my-pack.tool",
    name: "My Tool",
    version: "1.0.0",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "tool");
});

test("defineAdapter creates adapter plugin", () => {
  const result = defineAdapter({
    pluginId: "my-pack.adapter",
    name: "My Adapter",
    version: "1.0.0",
    capabilities: [{
      name: "adapt",
      description: "Adapt",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "adapter");
});

test("defineRetriever creates retriever plugin", () => {
  const result = defineRetriever({
    pluginId: "my-pack.retriever",
    name: "My Retriever",
    version: "1.0.0",
    capabilities: [{
      name: "retrieve",
      description: "Retrieve",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "retriever");
});

test("defineEvaluator creates evaluator plugin", () => {
  const result = defineEvaluator({
    pluginId: "my-pack.evaluator",
    name: "My Evaluator",
    version: "1.0.0",
    capabilities: [{
      name: "evaluate",
      description: "Evaluate",
      inputSchema: {},
      outputSchema: {},
    }],
  });

  assert.equal(result.type, "evaluator");
});

test("validatePluginDefinition validates and returns same definition", () => {
  const original = definePlugin({
    pluginId: "my-pack.tool",
    name: "My Tool",
    version: "1.0.0",
    type: "tool",
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const validated = validatePluginDefinition(original);

  assert.equal(validated.pluginId, original.pluginId);
  assert.equal(validated.name, original.name);
  assert.equal(validated.version, original.version);
});

test("validatePluginDefinition uses default description when missing", () => {
  const original = {
    pluginId: "my-pack.tool",
    name: "My Tool",
    version: "1.0.0",
    type: "tool" as const,
    capabilities: [{
      name: "execute",
      description: "Execute",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
    resourceLimits: { maxMemoryMb: 512, maxCpuMs: 5000, maxDurationMs: 30000 },
    dependencies: [],
    security: { sandboxTier: "process" as const, egressDomains: [] },
  };

  const validated = validatePluginDefinition(original);

  assert.equal(validated.description, "Plugin description");
});

test("validatePluginDefinition preserves extended spiTypes such as planner/presenter/validator", () => {
  const original = definePlugin({
    pluginId: "my-pack.presenter",
    name: "My Presenter",
    version: "1.0.0",
    type: "presenter",
    spiTypes: ["presenter", "planner", "validator"],
    capabilities: [{
      name: "render",
      description: "Render output",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    }],
  });

  const validated = validatePluginDefinition(original);

  assert.ok(validated.spiTypes.includes("presenter"));
  assert.ok(validated.spiTypes.includes("planner"));
  assert.ok(validated.spiTypes.includes("validator"));
});
