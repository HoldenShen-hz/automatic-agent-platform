import assert from "node:assert/strict";
import test from "node:test";

import type {
  PluginRuntimeAction,
  PluginRuntimeRequest,
  PluginRuntimeShutdownRequest,
  PluginRuntimeReadyMessage,
  PluginRuntimeResponse,
  PluginRuntimeMessage,
  PluginRuntimeChildMessage,
} from "../../../../src/domains/registry/plugin-runtime-protocol.js";
import type { PluginLifecycleContext } from "../../../../src/domains/registry/plugin-spi.js";

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeAction
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeAction includes all expected action types", () => {
  const actions: PluginRuntimeAction[] = [
    "load",
    "activate",
    "health_check",
    "deactivate",
    "unload",
    "retrieve",
    "present",
    "authenticate",
    "execute",
  ];

  for (const action of actions) {
    const request: PluginRuntimeRequest = {
      type: "request",
      requestId: "req_1",
      pluginId: "plugin.test",
      action,
      context: null,
    };
    assert.equal(request.action, action);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeRequest
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeRequest has correct structure for request", () => {
  const context: PluginLifecycleContext = {
    pluginId: "plugin.test",
    domainId: "coding",
    capabilityIds: ["test.capability"],
    bindingId: "binding_1",
    config: { key: "value" },
  };

  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_abc123",
    pluginId: "plugin.test",
    action: "load",
    context,
    input: { data: "test" },
  };

  assert.equal(request.type, "request");
  assert.equal(request.requestId, "req_abc123");
  assert.equal(request.pluginId, "plugin.test");
  assert.equal(request.action, "load");
  assert.deepEqual(request.context, context);
  assert.deepEqual(request.input, { data: "test" });
});

test("PluginRuntimeRequest can have null context for system actions", () => {
  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_system",
    pluginId: "plugin.test",
    action: "health_check",
    context: null,
  };

  assert.equal(request.context, null);
});

test("PluginRuntimeRequest can omit input when not needed", () => {
  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_no_input",
    pluginId: "plugin.test",
    action: "deactivate",
    context: null,
  };

  assert.equal(("input" in request), false);
});

test("PluginRuntimeRequest input is polymorphic for different actions", () => {
  const retrieveRequest: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_retrieve",
    pluginId: "plugin.retriever",
    action: "retrieve",
    context: null,
    input: { taskId: "task_1", intent: "find info", context: {}, tokenBudget: 1000 },
  };
  assert.ok(retrieveRequest.input);

  const presentRequest: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_present",
    pluginId: "plugin.presenter",
    action: "present",
    context: null,
    input: { machineOutputs: [], artifacts: [], audience: "developer" as const },
  };
  assert.ok(presentRequest.input);
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeShutdownRequest
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeShutdownRequest has correct structure", () => {
  const shutdown: PluginRuntimeShutdownRequest = {
    type: "shutdown",
  };

  assert.equal(shutdown.type, "shutdown");
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeReadyMessage
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeReadyMessage has correct structure", () => {
  const ready: PluginRuntimeReadyMessage = {
    type: "ready",
    pid: 12345,
  };

  assert.equal(ready.type, "ready");
  assert.equal(ready.pid, 12345);
});

test("PluginRuntimeReadyMessage pid can be any valid number", () => {
  const pids = [0, 1, 100, 65535, 999999];

  for (const pid of pids) {
    const ready: PluginRuntimeReadyMessage = { type: "ready", pid };
    assert.equal(ready.pid, pid);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeResponse
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeResponse has correct structure for success", () => {
  const response: PluginRuntimeResponse = {
    type: "response",
    requestId: "req_123",
    ok: true,
    pid: 54321,
    result: { data: "success" },
  };

  assert.equal(response.type, "response");
  assert.equal(response.requestId, "req_123");
  assert.equal(response.ok, true);
  assert.equal(response.pid, 54321);
  assert.deepEqual(response.result, { data: "success" });
});

test("PluginRuntimeResponse has correct structure for error", () => {
  const response: PluginRuntimeResponse = {
    type: "response",
    requestId: "req_456",
    ok: false,
    pid: 54321,
    error: {
      name: "ValidationError",
      message: "Plugin validation failed",
    },
  };

  assert.equal(response.ok, false);
  assert.ok(response.error);
  assert.equal(response.error.name, "ValidationError");
  assert.equal(response.error.message, "Plugin validation failed");
});

test("PluginRuntimeResponse result is optional for success with null result", () => {
  const response: PluginRuntimeResponse = {
    type: "response",
    requestId: "req_null",
    ok: true,
    pid: 11111,
    result: null,
  };

  assert.equal(response.ok, true);
  assert.equal(response.result, null);
});

test("PluginRuntimeResponse error is optional for success case", () => {
  const response: PluginRuntimeResponse = {
    type: "response",
    requestId: "req_ok",
    ok: true,
    pid: 22222,
  };

  assert.equal(response.ok, true);
  assert.equal(response.error, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeMessage union
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeMessage accepts ready variant", () => {
  const msg: PluginRuntimeMessage = { type: "ready", pid: 33333 };
  assert.equal(msg.type, "ready");
});

test("PluginRuntimeMessage accepts response variant", () => {
  const msg: PluginRuntimeMessage = { type: "response", requestId: "req_x", ok: true, pid: 33333 };
  assert.equal(msg.type, "response");
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeChildMessage union
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeChildMessage accepts request variant", () => {
  const msg: PluginRuntimeChildMessage = {
    type: "request",
    requestId: "req_child",
    pluginId: "plugin.child",
    action: "load",
    context: null,
  };
  assert.equal(msg.type, "request");
});

test("PluginRuntimeChildMessage accepts shutdown variant", () => {
  const msg: PluginRuntimeChildMessage = { type: "shutdown" };
  assert.equal(msg.type, "shutdown");
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeResponse error handling
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeResponse error contains error name and message", () => {
  const response: PluginRuntimeResponse = {
    type: "response",
    requestId: "req_err",
    ok: false,
    pid: 12345,
    error: {
      name: "PluginLoadError",
      message: "Failed to load plugin due to missing dependency",
    },
  };

  assert.equal(response.error?.name, "PluginLoadError");
  assert.ok(response.error?.message.length > 0);
});

test("PluginRuntimeResponse error can have generic Error name", () => {
  const response: PluginRuntimeResponse = {
    type: "response",
    requestId: "req_err2",
    ok: false,
    pid: 12345,
    error: {
      name: "Error",
      message: "Unknown error occurred",
    },
  };

  assert.equal(response.error?.name, "Error");
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginRuntimeRequest action-specific tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginRuntimeRequest for retrieve action includes query input", () => {
  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_query",
    pluginId: "plugin.coding.retriever",
    action: "retrieve",
    context: {
      pluginId: "plugin.coding.retriever",
      domainId: "coding",
      capabilityIds: ["retrieve.knowledge"],
      bindingId: "binding_retriever",
      config: {},
    },
    input: {
      taskId: "task_find_code",
      intent: "Find code related to auth",
      context: { filePath: "/src/auth" },
      tokenBudget: 5000,
    },
  };

  assert.equal(request.action, "retrieve");
  assert.ok(request.input);
});

test("PluginRuntimeRequest for present action includes format input", () => {
  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_format",
    pluginId: "plugin.coding.presenter",
    action: "present",
    context: {
      pluginId: "plugin.coding.presenter",
      domainId: "coding",
      capabilityIds: ["present.output"],
      bindingId: "binding_presenter",
      config: {},
    },
    input: {
      machineOutputs: [
        { stepId: "step_1", outputRef: "ref_1", payload: { status: "ok" } },
      ],
      artifacts: [],
      audience: "developer" as const,
    },
  };

  assert.equal(request.action, "present");
  assert.ok(request.input);
});

test("PluginRuntimeRequest for execute action includes adapter params", () => {
  const request: PluginRuntimeRequest = {
    type: "request",
    requestId: "req_exec",
    pluginId: "plugin.external.adapter",
    action: "execute",
    context: null,
    input: { action: "create_issue", params: { title: "Bug report", body: "Details" } },
  };

  assert.equal(request.action, "execute");
  assert.ok(request.input);
});
