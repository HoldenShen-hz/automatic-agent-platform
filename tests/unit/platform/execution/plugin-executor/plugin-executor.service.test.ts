/**
 * PluginExecutorService Unit Tests
 *
 * Tests for:
 * - Plugin lifecycle (register, load, activate, execute, deactivate, unregister)
 * - Sandbox tier configuration
 * - Scoped external access sandbox
 * - Error handling (timeout, plugin not found, action not allowed)
 * - Artifact collection
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginExecutorService, type ExecutionContext } from "../../../../../src/platform/five-plane-execution/plugin-executor/index.js";
import type { PluginManifest, PluginLifecycleHooks } from "../../../../../src/domains/registry/plugin-spi.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const createTestManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  pluginId: "test-plugin",
  name: "Test Plugin",
  version: "1.0.0",
  owner: "test-owner",
  domainIds: ["test-domain"],
  capabilityIds: ["test-capability"],
  spiTypes: ["retriever", "validator"],
  extensionKind: "domain_plugin",
  trustLevel: "internal",
  publicSdkSurface: "test-sdk",
  settingsSchema: {},
  sandbox: {
    timeoutMs: 5000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 8,
    runtimeIsolation: "serialized_in_process",
    cooldownMs: 0,
    allowedExternalDomains: [],
    maxResponseSizeBytes: 1024 * 1024,
    rateLimitPerMinute: 60,
  },
  ...overrides,
});

const createTestHooks = (
  overrides: Partial<PluginLifecycleHooks> & Record<string, unknown> = {},
): PluginLifecycleHooks & Record<string, unknown> => ({
  initialize: async () => {},
  onLoad: async () => {},
  onActivate: async () => {},
  onDeactivate: async () => {},
  onUnload: async () => {},
  healthCheck: () => true,
  ...overrides,
});

const createActionHooks = (
  action: string,
  handler: (input: Record<string, unknown>) => unknown | Promise<unknown>,
  overrides: Partial<PluginLifecycleHooks> = {},
): PluginLifecycleHooks & Record<string, unknown> =>
  createTestHooks({
    [action]: handler,
    ...overrides,
  });

const createTestContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  executionId: "exec-123",
  taskId: "task-456",
  tenantId: "tenant-789",
  correlationId: "corr-abc",
  sandboxTier: "process",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService registers plugins and tracks state [plugin-executor.service]", () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest();
  const hooks = createTestHooks();

  service.register(manifest, hooks);

  const plugins = service.listPlugins();
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0]!.pluginId, "test-plugin");

  const state = service.getState("test-plugin");
  assert.equal(state, "registered");
});

test("PluginExecutorService.load() transitions state from registered to loaded [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();
  let loadCalled = false;

  const manifest = createTestManifest();
  const hooks = createTestHooks({
    onLoad: async () => { loadCalled = true; },
    initialize: async () => {},
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");

  assert.equal(loadCalled, true);
  assert.equal(service.getState("test-plugin"), "loaded");
});

test("PluginExecutorService.activate() transitions state from loaded to active [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();
  let activateCalled = false;

  const manifest = createTestManifest();
  const hooks = createTestHooks({
    onActivate: async () => { activateCalled = true; },
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  assert.equal(activateCalled, true);
  assert.equal(service.getState("test-plugin"), "active");
});

test("PluginExecutorService.deactivate() transitions state from active to inactive [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();
  let deactivateCalled = false;

  const manifest = createTestManifest();
  const hooks = createTestHooks({
    onDeactivate: async () => { deactivateCalled = true; },
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");
  await service.deactivate("test-plugin");

  assert.equal(deactivateCalled, true);
  assert.equal(service.getState("test-plugin"), "inactive");
});

test("PluginExecutorService.unregister() transitions state to disabled and calls onUnload [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();
  let unloadCalled = false;

  const manifest = createTestManifest();
  const hooks = createTestHooks({
    onUnload: async () => { unloadCalled = true; },
  });

  service.register(manifest, hooks);
  await service.unregister("test-plugin");

  assert.equal(unloadCalled, true);
  assert.equal(service.getState("test-plugin"), null);
  assert.equal(service.listPlugins().length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService.execute() runs plugin action and returns result [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest({
    spiTypes: ["retriever"],
  });

  const hooks = createActionHooks("retriever", async (input) => ({
    taskId: input.taskId,
    ok: true,
  }));

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "process" });
  const result = await service.execute("test-plugin", "retriever", context, { taskId: "task-123" });

  assert.equal(result.status, "ok");
  assert.equal(result.pluginId, "test-plugin");
  assert.ok(result.executionId.startsWith("exec_"));
  assert.ok(result.durationMs >= 0);
  assert.ok(result.timestamp);
});

test("PluginExecutorService.execute() rejects executing inactive plugin [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest();
  const hooks = createTestHooks();

  service.register(manifest, hooks);
  // Don't load or activate - plugin stays in "registered" state

  const context = createTestContext();

  await assert.rejects(
    () => service.execute("test-plugin", "retriever", context, {}),
    (err: Error) => {
      return err.message.includes("not active");
    },
  );
});

test("PluginExecutorService.execute() throws for unknown plugin [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();
  const context = createTestContext();

  await assert.rejects(
    () => service.execute("nonexistent-plugin", "retriever", context, {}),
    (err: Error) => {
      return err.message.includes("not found");
    },
  );
});

test("PluginExecutorService.execute() rejects action not in manifest spiTypes [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest({ spiTypes: ["retriever"] });
  const hooks = createTestHooks();

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext();

  await assert.rejects(
    () => service.execute("test-plugin", "validator", context, {}),
    (err: Error) => {
      return err.message.includes("not defined in plugin manifest");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService.execute() handles timeout and returns error status [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest({
    sandbox: {
      timeoutMs: 50, // Very short timeout
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  });

  const hooks = createActionHooks(
    "retriever",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { ok: true };
    },
  );

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "process" });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "timeout");
  assert.ok(result.error?.includes("timed out"));
  assert.equal(result.pluginId, "test-plugin");
});

test("PluginExecutorService.healthCheck() returns plugin health status [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest();
  const hooks = createTestHooks({
    healthCheck: () => true,
  });

  service.register(manifest, hooks);

  const healthy = await service.healthCheck("test-plugin");
  assert.equal(healthy, true);

  const nonexistent = await service.healthCheck("nonexistent-plugin");
  assert.equal(nonexistent, false);
});

test("PluginExecutorService.healthCheck() falls back to error count threshold [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest();
  const hooks = createTestHooks({} as any);

  service.register(manifest, hooks);

  // With no healthCheck, relies on errorCount < 5
  const result = await service.healthCheck("test-plugin");
  assert.equal(result, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Tier Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService handles none sandbox tier [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest();
  const hooks = createActionHooks("retriever", async () => ({ ok: true }));

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "none" });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "ok");
});

test("PluginExecutorService handles container sandbox tier [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest();
  const hooks = createActionHooks("retriever", async () => ({ ok: true }));

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "container" });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// Scoped External Access Sandbox Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService execute with scoped_external_access tier [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  const manifest = createTestManifest();
  const hooks = createActionHooks("retriever", async () => ({ ok: true }));

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "scoped_external_access" });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "ok");
});

test("ScopedExternalAccessSandbox validates domain whitelist [plugin-executor.service]", async () => {
  const { ScopedExternalAccessSandbox } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js"
  );

  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const allowed = await sandbox.validateOutboundRequest("https://api.example.com/data");
  assert.equal(allowed, true);

  const blocked = await sandbox.validateOutboundRequest("https://evil.com/data");
  assert.equal(blocked, false);
});

test("ScopedExternalAccessSandbox enforces rate limits [plugin-executor.service]", async () => {
  const { ScopedExternalAccessSandbox } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js"
  );

  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 1024 * 1024,
    rateLimitPerMinute: 3, // Very low for testing
  });

  // First 3 requests should be allowed
  for (let i = 0; i < 3; i++) {
    const allowed = await sandbox.checkRateLimit("api.example.com");
    assert.equal(allowed, true);
  }

  // 4th request should be blocked
  const blocked = await sandbox.checkRateLimit("api.example.com");
  assert.equal(blocked, false);
});

test("ScopedExternalAccessSandbox filters sensitive headers [plugin-executor.service]", async () => {
  const { ScopedExternalAccessSandbox } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js"
  );

  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  const headers = {
    "content-type": "application/json",
    "authorization": "Bearer secret-token",
    "x-api-key": "my-api-key",
    "custom-header": "value",
  };

  const filtered = sandbox.filterResponseHeaders(headers);

  assert.ok(filtered["content-type"]);
  assert.ok(filtered["custom-header"]);
  assert.equal(filtered["authorization"], undefined);
  assert.equal(filtered["x-api-key"], undefined);
});

test("ScopedExternalAccessSandbox validates response size [plugin-executor.service]", async () => {
  const { ScopedExternalAccessSandbox } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js"
  );

  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 100, // Very small limit
    rateLimitPerMinute: 60,
  });

  const smallBody = { data: "small" };
  assert.equal(sandbox.validateResponseSize(smallBody), true);

  const largeBody = { data: "x".repeat(200) };
  assert.equal(sandbox.validateResponseSize(largeBody), false);
});

test("ScopedExternalAccessSandbox blocks oversized responses [plugin-executor.service]", async () => {
  const { ScopedExternalAccessSandbox } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js"
  );

  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    maxResponseSizeBytes: 50,
    rateLimitPerMinute: 60,
  });

  const response = await sandbox.executeScopedRequest({
    url: "https://api.example.com/data",
    method: "GET",
  });

  // Should be blocked due to being in whitelist and rate limit or size
  assert.equal(response.blocked, true);
});

test("ScopedExternalAccessSandbox reports rate limit status [plugin-executor.service]", async () => {
  const { ScopedExternalAccessSandbox } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.js"
  );

  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com", "another-api.com"],
    maxResponseSizeBytes: 1024 * 1024,
    rateLimitPerMinute: 60,
  });

  await sandbox.checkRateLimit("api.example.com");
  await sandbox.checkRateLimit("api.example.com");
  await sandbox.checkRateLimit("another-api.com");

  const status = sandbox.getRateLimitStatus();

  assert.ok(status["api.example.com"]);
  assert.equal(status["api.example.com"].count, 2);
  assert.ok(status["another-api.com"]);
  assert.equal(status["another-api.com"].count, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Registration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService.register() throws for duplicate pluginId [plugin-executor.service]", () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest();
  const hooks = createTestHooks();

  service.register(manifest, hooks);

  assert.throws(
    () => service.register(manifest, hooks),
    (err: Error) => {
      return err.message.includes("already registered");
    },
  );
});

test("PluginExecutorService.unregister() throws for unknown pluginId [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  await assert.rejects(
    () => service.unregister("nonexistent-plugin"),
    (err: Error) => {
      return err.message.includes("not registered");
    },
  );
});

test("PluginExecutorService.load() throws for unknown pluginId [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();

  await assert.rejects(
    () => service.load("nonexistent-plugin"),
    (err: Error) => {
      return err.message.includes("not found");
    },
  );
});

test("PluginExecutorService.activate() throws for disabled plugin [plugin-executor.service]", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest();
  const hooks = createTestHooks();

  service.register(manifest, hooks);
  await service.unregister("test-plugin");

  await assert.rejects(
    () => service.activate("test-plugin"),
    (err: Error) => {
      return err.message.includes("disabled");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy PluginExecutionService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutionService registers plugins and exposes listPlugins [plugin-executor.service]", async () => {
  const { PluginExecutionService } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/index.js"
  );

  const service = new PluginExecutionService();

  service.register({
    pluginId: "legacy-plugin",
    actions: ["fetch", "validate"],
    execute: async () => ({ pluginId: "legacy-plugin", action: "fetch", status: "ok" as const, output: {} }),
  });

  const plugins = service.listPlugins();
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0]!.pluginId, "legacy-plugin");
});

test("PluginExecutionService.execute() runs plugin action and returns result [plugin-executor.service]", async () => {
  const { PluginExecutionService } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/index.js"
  );

  const service = new PluginExecutionService();

  service.register({
    pluginId: "legacy-plugin",
    actions: ["fetch"],
    execute: async (request) => ({
      pluginId: request.pluginId,
      action: request.action,
      status: "ok" as const,
      output: { received: request.payload },
    }),
  });

  const result = await service.execute({
    pluginId: "legacy-plugin",
    action: "fetch",
    tenantId: "tenant-1",
    payload: { key: "value" },
  });

  assert.equal(result.status, "ok");
  assert.equal(result.pluginId, "legacy-plugin");
  assert.equal(result.action, "fetch");
});

test("PluginExecutionService.execute() throws for unknown plugin [plugin-executor.service]", async () => {
  const { PluginExecutionService } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/index.js"
  );

  const service = new PluginExecutionService();

  await assert.rejects(
    () =>
      service.execute({
        pluginId: "nonexistent",
        action: "fetch",
        tenantId: null,
        payload: {},
      }),
    (err: Error) => {
      return err.message.includes("not registered");
    },
  );
});

test("PluginExecutionService.execute() throws for unregistered action [plugin-executor.service]", async () => {
  const { PluginExecutionService } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/index.js"
  );

  const service = new PluginExecutionService();

  service.register({
    pluginId: "legacy-plugin",
    actions: ["fetch"], // Only 'fetch' is registered
    execute: async () => ({ pluginId: "legacy-plugin", action: "fetch", status: "ok" as const, output: {} }),
  });

  await assert.rejects(
    () =>
      service.execute({
        pluginId: "legacy-plugin",
        action: "validate", // Not registered
        tenantId: null,
        payload: {},
      }),
    (err: Error) => {
      return err.message.includes("not registered");
    },
  );
});

test("PluginExecutionService.execute() supports sync execute function [plugin-executor.service]", async () => {
  const { PluginExecutionService } = await import(
    "../../../../../src/platform/five-plane-execution/plugin-executor/index.js"
  );

  const service = new PluginExecutionService();

  service.register({
    pluginId: "sync-plugin",
    actions: ["process"],
    execute: (request) => ({
      pluginId: request.pluginId,
      action: request.action,
      status: "ok" as const,
      output: { sync: true },
    }),
  });

  const result = await service.execute({
    pluginId: "sync-plugin",
    action: "process",
    tenantId: null,
    payload: {},
  });

  assert.equal(result.status, "ok");
  assert.deepStrictEqual(result.output, { sync: true });
});
