/**
 * @fileoverview Unit tests for plugin-context.ts (SDK)
 *
 * Tests R2-5/R4-39: DataTaintPropagation tracking in PluginContext
 * Tests R8-24: PluginManifest owner/trustLevel/sbomRef/publicSdkSurface
 * Tests §23.2: call/deputation depth tracking for recursion prevention
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginContext } from "../../../src/sdk/plugin-sdk/plugin-context.js";

test("PluginContext requires pluginId", () => {
  assert.throws(() => new PluginContext({ pluginId: "" }), /PluginContext requires pluginId/);
  assert.throws(() => new PluginContext({ pluginId: "   " }), /PluginContext requires pluginId/);
});

test("PluginContext initializes with defaults", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  assert.equal(context.pluginId, "test-plugin");
  assert.equal(context.executionId, "unknown");
  assert.equal(context.taskId, "unknown");
  assert.equal(context.tenantId, "default");
  assert.equal(context.userId, "anonymous");
  assert.equal(context.sessionId, "none");
  assert.equal(context.sandboxTier, "read_only");
  assert.equal(context.callDepth, 0);
  assert.equal(context.delegationDepth, 0);
});

test("PluginContext accepts custom config", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    executionId: "exec-123",
    taskId: "task-456",
    tenantId: "tenant-abc",
    userId: "user-789",
    sessionId: "session-xyz",
    sandboxTier: "container",
    resourceLimits: { maxMemoryMb: 1024 },
  });

  assert.equal(context.executionId, "exec-123");
  assert.equal(context.taskId, "task-456");
  assert.equal(context.tenantId, "tenant-abc");
  assert.equal(context.userId, "user-789");
  assert.equal(context.sessionId, "session-xyz");
  // container maps to workspace_write
  assert.equal(context.sandboxTier, "workspace_write");
});

test("PluginContext get and set values", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  context.set("foo", "bar");
  assert.equal(context.get("foo"), "bar");

  context.set("number", 42);
  assert.equal(context.get("number"), 42);

  assert.equal(context.has("foo"), true);
  assert.equal(context.has("nonexistent"), false);
});

test("PluginContext setValues bulk sets", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });

  context.setValues({ a: 1, b: "two", c: true });
  assert.equal(context.get("a"), 1);
  assert.equal(context.get("b"), "two");
  assert.equal(context.get("c"), true);
});

test("PluginContext keys returns all keys", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  context.set("key1", "value1");
  context.set("key2", "value2");

  const keys = context.keys();
  assert.ok(keys.includes("key1"));
  assert.ok(keys.includes("key2"));
  assert.ok(keys.includes("system.plugin_id"));
  assert.ok(keys.includes("system.timestamp"));
});

test("PluginContext set with different sources", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  context.set("user-key", "user-value", "user");
  context.set("system-key", "system-value", "system");
  context.set("plugin-key", "plugin-value", "plugin");

  assert.equal(context.get("user-key"), "user-value");
  assert.equal(context.get("system-key"), "system-value");
  assert.equal(context.get("plugin-key"), "plugin-value");
});

test("PluginContext getResourceLimits returns defaults", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  const limits = context.getResourceLimits();

  assert.equal(limits.maxMemoryMb, 512);
  assert.equal(limits.maxCpuMs, 5000);
  assert.equal(limits.maxDurationMs, 30000);
});

test("PluginContext getResourceLimits uses custom values", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    resourceLimits: { maxMemoryMb: 2048, maxCpuMs: 10000, maxDurationMs: 60000 },
  });
  const limits = context.getResourceLimits();

  assert.equal(limits.maxMemoryMb, 2048);
  assert.equal(limits.maxCpuMs, 10000);
  assert.equal(limits.maxDurationMs, 60000);
});

test("PluginContext fork creates child context with incremented callDepth", () => {
  const parent = new PluginContext({
    pluginId: "test-plugin",
    executionId: "parent-exec",
    taskId: "parent-task",
    tenantId: "parent-tenant",
  });

  const child = parent.fork({
    executionId: "child-exec",
    taskId: "child-task",
  });

  assert.equal(child.pluginId, "test-plugin");
  assert.equal(child.executionId, "child-exec");
  assert.equal(child.taskId, "child-task");
  assert.equal(child.tenantId, "parent-tenant");
  assert.equal(child.callDepth, 1);
  assert.equal(child.delegationDepth, 0);
});

test("PluginContext fork increments callDepth for each level", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  const child1 = context.fork({});
  const child2 = child1.fork({});
  const child3 = child2.fork({});

  assert.equal(context.callDepth, 0);
  assert.equal(child1.callDepth, 1);
  assert.equal(child2.callDepth, 2);
  assert.equal(child3.callDepth, 3);
});

test("PluginContext fork preserves delegationDepth", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  const child = context.fork({});

  assert.equal(child.delegationDepth, 0);
});

test("PluginContext forkForDelegation increments delegationDepth only", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  const delegated = context.forkForDelegation();

  assert.equal(delegated.callDepth, 0);
  assert.equal(delegated.delegationDepth, 1);
});

test("PluginContext forkForDelegation preserves callDepth", () => {
  const parent = new PluginContext({
    pluginId: "test-plugin",
    callDepth: 3,
    delegationDepth: 1,
  });
  const delegated = parent.forkForDelegation();

  assert.equal(delegated.callDepth, 3);
  assert.equal(delegated.delegationDepth, 2);
});

test("PluginContext isCallDepthExceeded returns true when at or above max", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    callDepth: 5,
  });

  assert.equal(context.isCallDepthExceeded(5), true);
  assert.equal(context.isCallDepthExceeded(6), false);
});

test("PluginContext isDelegationDepthExceeded returns true when at or above max", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    delegationDepth: 3,
  });

  assert.equal(context.isDelegationDepthExceeded(3), true);
  assert.equal(context.isDelegationDepthExceeded(4), false);
});

test("PluginContext toRecord returns plain object", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  context.set("custom-key", "custom-value");

  const record = context.toRecord();
  assert.ok(record["custom-key"]);
  assert.ok(record["system.plugin_id"]);
  assert.ok(record["system.timestamp"]);
});

test("PluginContext initializes with system context", () => {
  const context = new PluginContext({ pluginId: "my-plugin" });

  assert.equal(context.get("system.plugin_id"), "my-plugin");
  assert.ok(context.get("system.timestamp"));
});

test("PluginContext sandboxTier normalization", () => {
  const cases: Array<{ input: string; expected: string }> = [
    { input: "read_only", expected: "read_only" },
    { input: "process", expected: "read_only" },
    { input: "container", expected: "workspace_write" },
    { input: "workspace_write", expected: "workspace_write" },
    { input: "scoped_external_access", expected: "scoped_external_access" },
    { input: "restricted_exec", expected: "restricted_exec" },
    { input: "unknown-mode", expected: "read_only" },
    { input: "none", expected: "read_only" },
  ];

  for (const { input, expected } of cases) {
    const context = new PluginContext({
      pluginId: "test-plugin",
      sandboxTier: input,
    });
    assert.equal(context.sandboxTier, expected, `Input "${input}" should normalize to "${expected}"`);
  }
});

test("PluginContext with custom callDepth and delegationDepth", () => {
  const context = new PluginContext({
    pluginId: "test-plugin",
    callDepth: 2,
    delegationDepth: 1,
  });

  assert.equal(context.callDepth, 2);
  assert.equal(context.delegationDepth, 1);
});

test("PluginContext fork with custom delegationDepth override", () => {
  const parent = new PluginContext({
    pluginId: "test-plugin",
    delegationDepth: 1,
  });

  const child = parent.fork({ delegationDepth: 5 });

  assert.equal(child.delegationDepth, 5);
});

test("PluginContext forkForDelegation multiple times accumulates", () => {
  const context = new PluginContext({ pluginId: "test-plugin" });
  const d1 = context.forkForDelegation();
  const d2 = d1.forkForDelegation();
  const d3 = d2.forkForDelegation();

  assert.equal(d1.delegationDepth, 1);
  assert.equal(d2.delegationDepth, 2);
  assert.equal(d3.delegationDepth, 3);
});