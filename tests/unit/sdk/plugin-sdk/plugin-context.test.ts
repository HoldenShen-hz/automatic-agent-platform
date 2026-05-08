import test from "node:test";
import assert from "node:assert/strict";

import { PluginContext } from "../../../../src/sdk/plugin-sdk/plugin-context.js";

test("PluginContext throws when pluginId is missing", () => {
  assert.throws(
    () => new PluginContext({ pluginId: "" }),
    /PluginContext requires pluginId/,
  );
});

test("PluginContext throws when pluginId is whitespace only", () => {
  assert.throws(
    () => new PluginContext({ pluginId: "   " }),
    /PluginContext requires pluginId/,
  );
});

test("PluginContext creates with minimal config", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  assert.equal(ctx.pluginId, "test-plugin");
  assert.equal(ctx.executionId, "unknown");
  assert.equal(ctx.taskId, "unknown");
  assert.equal(ctx.tenantId, "default");
  assert.equal(ctx.userId, "anonymous");
  assert.equal(ctx.sandboxTier, "read_only");
});

test("PluginContext creates with full config", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    packId: "pack_1",
    executionId: "exec_1",
    taskId: "task_1",
    tenantId: "tenant_1",
    userId: "user_1",
    sessionId: "session_1",
    sandboxTier: "container",
    resourceLimits: {
      maxMemoryMb: 1024,
      maxCpuMs: 10000,
      maxDurationMs: 60000,
    },
  });

  assert.equal(ctx.pluginId, "test-plugin");
  assert.equal(ctx.executionId, "exec_1");
  assert.equal(ctx.taskId, "task_1");
  assert.equal(ctx.tenantId, "tenant_1");
  assert.equal(ctx.userId, "user_1");
  assert.equal(ctx.sandboxTier, "workspace_write");
});

test("PluginContext.get returns undefined for missing key", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  assert.equal(ctx.get("nonexistent"), undefined);
});

test("PluginContext.set and get work correctly", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("custom.key", "custom-value", "plugin");

  assert.equal(ctx.get("custom.key"), "custom-value");
});

test("PluginContext rejects plugin override of reserved system namespace", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  assert.throws(
    () => ctx.set("system.plugin_id", "spoofed", "plugin"),
    /reserved key namespace/,
  );
});

test("PluginContext.setValues sets multiple values", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.setValues({ key1: "value1", key2: "value2" }, "user");

  assert.equal(ctx.get("key1"), "value1");
  assert.equal(ctx.get("key2"), "value2");
});

test("PluginContext.setValues rejects reserved system namespace entries", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  assert.throws(
    () => ctx.setValues({ "system.timestamp": "spoofed" }, "user"),
    /reserved key namespace/,
  );
});

test("PluginContext.has returns true for existing key", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("test.key", "test-value");

  assert.equal(ctx.has("test.key"), true);
});

test("PluginContext.has returns false for missing key", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  assert.equal(ctx.has("nonexistent"), false);
});

test("PluginContext.keys returns all keys including system keys", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("custom.key", "value");

  const keys = ctx.keys();

  assert.ok(keys.includes("system.plugin_id"));
  assert.ok(keys.includes("system.timestamp"));
  assert.ok(keys.includes("custom.key"));
});

test("PluginContext.toRecord returns all values as object", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });
  ctx.set("custom.key", "custom-value");

  const record = ctx.toRecord();

  assert.equal(record["system.plugin_id"], "test-plugin");
  assert.equal(record["custom.key"], "custom-value");
});

test("PluginContext.getResourceLimits returns default limits when not set", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin" });

  const limits = ctx.getResourceLimits();

  assert.equal(limits.maxMemoryMb, 512);
  assert.equal(limits.maxCpuMs, 5000);
  assert.equal(limits.maxDurationMs, 30000);
});

test("PluginContext.getResourceLimits returns custom limits when set", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    resourceLimits: {
      maxMemoryMb: 2048,
      maxCpuMs: 20000,
      maxDurationMs: 120000,
    },
  });

  const limits = ctx.getResourceLimits();

  assert.equal(limits.maxMemoryMb, 2048);
  assert.equal(limits.maxCpuMs, 20000);
  assert.equal(limits.maxDurationMs, 120000);
});

test("PluginContext.fork creates new context with overrides", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    taskId: "task_1",
    tenantId: "tenant_1",
  });
  const child = ctx.fork({ taskId: "task_2" });

  assert.equal(child.pluginId, "test-plugin");
  assert.equal(child.taskId, "task_2");
  assert.equal(child.tenantId, "tenant_1");
});

test("PluginContext.fork preserves config values via getters", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    executionId: "exec_1",
    taskId: "task_1",
    tenantId: "tenant_1",
    userId: "user_1",
  });
  const child = ctx.fork({});

  // fork copies config values, but values Map is not copied
  assert.equal(child.pluginId, "test-plugin");
  assert.equal(child.executionId, "exec_1");
  assert.equal(child.taskId, "task_1");
  assert.equal(child.tenantId, "tenant_1");
  assert.equal(child.userId, "user_1");
});
