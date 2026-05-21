/**
 * @fileoverview Advanced tests for plugin-context.ts - fork, delegation, and depth tracking
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginContext } from "../../../../src/sdk/plugin-sdk/plugin-context.js";

test("PluginContext.callDepth returns correct initial value", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 5 });
  assert.equal(ctx.callDepth, 5);
});

test("PluginContext.delegationDepth returns correct initial value", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", delegationDepth: 3 });
  assert.equal(ctx.delegationDepth, 3);
});

test("PluginContext.fork increments callDepth by default", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 0 });
  const child = ctx.fork({});

  assert.equal(child.callDepth, 1);
  assert.equal(ctx.callDepth, 0); // Original unchanged
});

test("PluginContext.fork increments callDepth via override", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 2 });
  const child = ctx.fork({ callDepth: 10 });

  assert.equal(child.callDepth, 10);
});

test("PluginContext.fork preserves delegationDepth", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 0, delegationDepth: 2 });
  const child = ctx.fork({});

  assert.equal(child.delegationDepth, 2);
});

test("PluginContext.forkForDelegation increments delegationDepth by default", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", delegationDepth: 0 });
  const child = ctx.forkForDelegation();

  assert.equal(child.delegationDepth, 1);
  assert.equal(ctx.delegationDepth, 0); // Original unchanged
});

test("PluginContext.forkForDelegation preserves callDepth", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 5, delegationDepth: 0 });
  const child = ctx.forkForDelegation({});

  assert.equal(child.callDepth, 5);
});

test("PluginContext.forkForDelegation allows explicit callDepth override", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 3, delegationDepth: 0 });
  const child = ctx.forkForDelegation({ callDepth: 7 });

  assert.equal(child.callDepth, 7);
  assert.equal(child.delegationDepth, 1);
});

test("PluginContext.forkForDelegation with explicit delegationDepth", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", delegationDepth: 2 });
  const child = ctx.forkForDelegation({ delegationDepth: 5 });

  assert.equal(child.delegationDepth, 5);
});

test("PluginContext.isCallDepthExceeded returns false when under limit", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 3 });
  assert.equal(ctx.isCallDepthExceeded(5), false);
});

test("PluginContext.isCallDepthExceeded returns true when at limit", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 5 });
  assert.equal(ctx.isCallDepthExceeded(5), true);
});

test("PluginContext.isCallDepthExceeded returns true when over limit", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", callDepth: 10 });
  assert.equal(ctx.isCallDepthExceeded(5), true);
});

test("PluginContext.isDelegationDepthExceeded returns false when under limit", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", delegationDepth: 2 });
  assert.equal(ctx.isDelegationDepthExceeded(5), false);
});

test("PluginContext.isDelegationDepthExceeded returns true when at limit", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", delegationDepth: 5 });
  assert.equal(ctx.isDelegationDepthExceeded(5), true);
});

test("PluginContext.isDelegationDepthExceeded returns true when over limit", () => {
  const ctx = new PluginContext({ pluginId: "test-plugin", delegationDepth: 10 });
  assert.equal(ctx.isDelegationDepthExceeded(5), true);
});

test("PluginContext.getResourceLimits returns all limits", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    resourceLimits: {
      maxMemoryMb: 2048,
      maxCpuMs: 15000,
      maxDurationMs: 90000,
    },
  });

  const limits = ctx.getResourceLimits();
  assert.equal(limits.maxMemoryMb, 2048);
  assert.equal(limits.maxCpuMs, 15000);
  assert.equal(limits.maxDurationMs, 90000);
});

test("PluginContext.getResourceLimits applies defaults for missing limits", () => {
  const ctx = new PluginContext({
    pluginId: "test-plugin",
    resourceLimits: {
      maxMemoryMb: 1024,
    },
  });

  const limits = ctx.getResourceLimits();
  assert.equal(limits.maxMemoryMb, 1024);
  assert.equal(limits.maxCpuMs, 5000); // default
  assert.equal(limits.maxDurationMs, 30000); // default
});

test("PluginContext.toRecord includes system values", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  const record = ctx.toRecord();

  assert.ok("system.plugin_id" in record);
  assert.ok("system.timestamp" in record);
  assert.ok("system.call_depth" in record);
  assert.ok("system.delegation_depth" in record);
});

test("PluginContext.toRecord includes user-set values", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  ctx.set("custom.key", "custom-value");
  ctx.set("another.key", 123);

  const record = ctx.toRecord();
  assert.equal(record["custom.key"], "custom-value");
  assert.equal(record["another.key"], 123);
});

test("PluginContext.keys includes system and user keys", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  ctx.set("user.key", "value");

  const keys = ctx.keys();
  assert.ok(keys.includes("system.plugin_id"));
  assert.ok(keys.includes("system.timestamp"));
  assert.ok(keys.includes("user.key"));
});

test("PluginContext has returns true for system keys", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  assert.equal(ctx.has("system.plugin_id"), true);
  assert.equal(ctx.has("system.timestamp"), true);
});

test("PluginContext setValues works with mixed sources", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  ctx.setValues(
    { key1: "value1", key2: "value2" },
    "user",
  );

  assert.equal(ctx.get("key1"), "value1");
  assert.equal(ctx.get("key2"), "value2");
});

test("PluginContext set rejects setting protected system keys", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });

  // Cannot override system keys via set
  assert.throws(
    () => ctx.set("system.plugin_id", "hacked", "plugin"),
    /reserved key namespace/i,
  );
});

test("PluginContext set rejects system.call_depth override", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });

  assert.throws(
    () => ctx.set("system.call_depth", 999, "plugin"),
    /reserved key namespace/i,
  );
});

test("PluginContext set rejects system.delegation_depth override", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });

  assert.throws(
    () => ctx.set("system.delegation_depth", 999, "plugin"),
    /reserved key namespace/i,
  );
});

test("PluginContext fork preserves all config values", () => {
  const ctx = new PluginContext({
    pluginId: "my-plugin",
    packId: "pack_1",
    executionId: "exec_1",
    taskId: "task_1",
    tenantId: "tenant_1",
    userId: "user_1",
    sessionId: "session_1",
    sandboxTier: "container",
    callDepth: 3,
    delegationDepth: 2,
  });

  const child = ctx.fork({});

  assert.equal(child.pluginId, "my-plugin");
  assert.equal(child.packId, "pack_1");
  assert.equal(child.executionId, "exec_1");
  assert.equal(child.taskId, "task_1");
  assert.equal(child.tenantId, "tenant_1");
  assert.equal(child.userId, "user_1");
  assert.equal(child.sessionId, "session_1");
  assert.equal(child.callDepth, 4); // Incremented
  assert.equal(child.delegationDepth, 2); // Preserved
});

test("PluginContext forkForDelegation creates correct chain", () => {
  const parent = new PluginContext({
    pluginId: "my-plugin",
    callDepth: 1,
    delegationDepth: 0,
  });

  const child = parent.forkForDelegation();
  const grandchild = child.forkForDelegation();

  assert.equal(parent.callDepth, 1);
  assert.equal(parent.delegationDepth, 0);

  assert.equal(child.callDepth, 1); // callDepth preserved
  assert.equal(child.delegationDepth, 1); // Delegation incremented

  assert.equal(grandchild.callDepth, 1);
  assert.equal(grandchild.delegationDepth, 2);
});

test("PluginContext sandboxTier gets normalized to workspace_write for container", () => {
  const ctx = new PluginContext({
    pluginId: "my-plugin",
    sandboxTier: "container",
  });

  assert.equal(ctx.sandboxTier, "workspace_write");
});

test("PluginContext with none sandboxTier throws", () => {
  // sandboxTier 'none' is not allowed
  assert.throws(
    () => new PluginContext({ pluginId: "my-plugin", sandboxTier: "none" }),
    /sandboxTier 'none'/i,
  );
});

test("PluginContext default sandboxTier is read_only", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  assert.equal(ctx.sandboxTier, "read_only");
});

test("PluginContext ContextValue structure is correct", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  ctx.set("test.key", "test-value", "user");

  // Access internal values map to verify ContextValue structure
  const entry = (ctx as any).values.get("test.key");

  assert.equal(entry.key, "test.key");
  assert.equal(entry.value, "test-value");
  assert.equal(entry.source, "user");
  assert.ok(typeof entry.timestamp === "string");
});

test("PluginContext source defaults to plugin", () => {
  const ctx = new PluginContext({ pluginId: "my-plugin" });
  ctx.set("test.key", "test-value");

  const entry = (ctx as any).values.get("test.key");
  assert.equal(entry.source, "plugin");
});