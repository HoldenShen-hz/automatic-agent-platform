import assert from "node:assert/strict";
import test from "node:test";

import type {
  PluginRuntimeChildMessage,
  PluginRuntimeMessage,
  PluginRuntimeRequest,
} from "../../../../src/domains/registry/plugin-runtime-protocol.js";

test("plugin runtime request messages survive JSON round-trip", () => {
  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "plugin_runtime_1",
    pluginId: "plugin.demo",
    action: "retrieve",
    context: {
      pluginId: "plugin.demo",
      domainId: "coding",
      capabilityIds: ["knowledge.retrieve"],
      bindingId: null,
      config: {},
    },
    input: {
      taskId: "task_1",
      intent: "find implementation",
      context: { language: "ts" },
      tokenBudget: 1_000,
    },
  };

  const parsed = JSON.parse(JSON.stringify(request)) as PluginRuntimeChildMessage;
  assert.deepEqual(parsed, request);
});

test("plugin runtime ready and response messages remain protocol-safe after serialization", () => {
  const messages: PluginRuntimeMessage[] = [
    {
      type: "ready",
      pid: 1234,
    },
    {
      type: "response",
      requestId: "plugin_runtime_1",
      ok: false,
      pid: 1234,
      error: {
        name: "ValidationError",
        message: "plugin failed validation",
      },
    },
  ];

  const roundTripped = JSON.parse(JSON.stringify(messages)) as PluginRuntimeMessage[];
  assert.deepEqual(roundTripped, messages);
});
