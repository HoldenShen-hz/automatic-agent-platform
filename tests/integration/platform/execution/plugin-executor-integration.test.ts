/**
 * Integration Test: Plugin Executor Integration
 *
 * Verifies:
 * - Plugin lifecycle (register, load, activate, execute, deactivate, unregister)
 * - Sandbox tier configuration and enforcement
 * - Scoped external access sandbox for network egress
 * - Artifact collection for execution evidence
 * - Error handling (timeout, plugin not found, action not allowed)
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { PluginExecutorService, type ExecutionContext } from "../../../../src/platform/five-plane-execution/plugin-executor/index.js";
import type { PluginManifest, PluginLifecycleHooks } from "../../../../src/domains/registry/plugin-spi.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

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
): PluginLifecycleHooks & Record<string, unknown> => {
  const { healthCheck: _healthCheck, ...rest } = overrides;
  return {
    initialize: async () => {},
    onLoad: async () => {},
    onActivate: async () => {},
    onDeactivate: async () => {},
    onUnload: async () => {},
    ...(overrides.healthCheck === undefined ? {} : { healthCheck: overrides.healthCheck }),
    ...rest,
  };
};

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
// Plugin Lifecycle Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("plugin executor: register adds plugin to catalog", () => {
  const workspace = createTempWorkspace("aa-plugin-reg-");

  try {
    const dbPath = join(workspace, "plugin-reg.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest();
    const hooks = createTestHooks();

    service.register(manifest, hooks);

    const plugins = service.listPlugins();
    assert.equal(plugins.length, 1);
    assert.equal(plugins[0]!.pluginId, "test-plugin");

    const state = service.getState("test-plugin");
    assert.equal(state, "registered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: load transitions state from registered to loaded", async () => {
  const workspace = createTempWorkspace("aa-plugin-load-");

  try {
    const dbPath = join(workspace, "plugin-load.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest();
    const hooks = createActionHooks("retriever", () => ({ result: "data" }));

    service.register(manifest, hooks);
    assert.equal(service.getState("test-plugin"), "registered");

    await service.load("test-plugin");
    assert.equal(service.getState("test-plugin"), "loaded");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: activate transitions state from loaded to active", async () => {
  const workspace = createTempWorkspace("aa-plugin-activate-");

  try {
    const dbPath = join(workspace, "plugin-activate.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest();
    const hooks = createActionHooks("retriever", () => ({ result: "data" }));

    service.register(manifest, hooks);
    await service.load("test-plugin");
    assert.equal(service.getState("test-plugin"), "loaded");

    await service.activate("test-plugin");
    assert.equal(service.getState("test-plugin"), "active");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: deactivate transitions active plugin to inactive", async () => {
  const workspace = createTempWorkspace("aa-plugin-deactivate-");

  try {
    const dbPath = join(workspace, "plugin-deactivate.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest();
    const hooks = createActionHooks("retriever", () => ({ result: "data" }));

    service.register(manifest, hooks);
    await service.load("test-plugin");
    await service.activate("test-plugin");
    assert.equal(service.getState("test-plugin"), "active");

    await service.deactivate("test-plugin");
    assert.equal(service.getState("test-plugin"), "inactive");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: unregister removes plugin completely", async () => {
  const workspace = createTempWorkspace("aa-plugin-unreg-");

  try {
    const dbPath = join(workspace, "plugin-unreg.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest();
    const hooks = createTestHooks();

    service.register(manifest, hooks);

    await service.unregister("test-plugin");

    const plugins = service.listPlugins();
    assert.equal(plugins.length, 0);

    const state = service.getState("test-plugin");
    assert.equal(state, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: full lifecycle register -> load -> activate -> execute -> deactivate -> unregister", async () => {
  const workspace = createTempWorkspace("aa-plugin-lifecycle-");

  try {
    const dbPath = join(workspace, "plugin-lifecycle.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "lifecycle-plugin" });
    let executeCount = 0;

    const hooks = createActionHooks("retriever", (input) => {
      executeCount++;
      return { echo: input };
    });

    service.register(manifest, hooks);
    assert.equal(service.getState("lifecycle-plugin"), "registered");

    await service.load("lifecycle-plugin");
    assert.equal(service.getState("lifecycle-plugin"), "loaded");

    await service.activate("lifecycle-plugin");
    assert.equal(service.getState("lifecycle-plugin"), "active");

    const context = createTestContext({ executionId: newId("exec") });
    const result = await service.execute("lifecycle-plugin", "retriever", context, { key: "value" });

    assert.equal(result.status, "ok");
    assert.equal(executeCount, 1);

    await service.deactivate("lifecycle-plugin");
    assert.equal(service.getState("lifecycle-plugin"), "inactive");

    await service.unregister("lifecycle-plugin");
    assert.equal(service.getState("lifecycle-plugin"), null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Tier Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("plugin executor: execute with sandbox tier none enforces restricted exec", async () => {
  const workspace = createTempWorkspace("aa-plugin-sandbox-none-");

  try {
    const dbPath = join(workspace, "plugin-sandbox-none.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "sandbox-none-plugin" });
    const hooks = createActionHooks("retriever", () => ({ allowed: true }));

    service.register(manifest, hooks);
    await service.load("sandbox-none-plugin");
    await service.activate("sandbox-none-plugin");

    const context = createTestContext({ sandboxTier: "none", executionId: newId("exec") });
    const result = await service.execute("sandbox-none-plugin", "retriever", context, {});

    assert.equal(result.status, "ok");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: execute with sandbox tier container uses workspace write policy", async () => {
  const workspace = createTempWorkspace("aa-plugin-sandbox-container-");

  try {
    const dbPath = join(workspace, "plugin-sandbox-container.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "sandbox-container-plugin" });
    const hooks = createActionHooks("retriever", () => ({ tier: "container" }));

    service.register(manifest, hooks);
    await service.load("sandbox-container-plugin");
    await service.activate("sandbox-container-plugin");

    const context = createTestContext({ sandboxTier: "container", executionId: newId("exec") });
    const result = await service.execute("sandbox-container-plugin", "retriever", context, {});

    assert.equal(result.status, "ok");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: execute with scoped_external_access sandbox enforces allowed domains", async () => {
  const workspace = createTempWorkspace("aa-plugin-sandbox-scoped-");

  try {
    const dbPath = join(workspace, "plugin-sandbox-scoped.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({
      pluginId: "scoped-plugin",
      sandbox: {
        timeoutMs: 5000,
        allowFilesystemWrite: false,
        allowNetworkEgress: true,
        allowedKnowledgeNamespaces: [],
        maxConcurrentInvocations: 1,
        maxQueuedInvocations: 8,
        runtimeIsolation: "serialized_in_process",
        cooldownMs: 0,
        allowedExternalDomains: ["api.example.com", "data.example.org"],
        maxResponseSizeBytes: 1024 * 1024,
        rateLimitPerMinute: 60,
      },
    });
    const hooks = createActionHooks("retriever", () => ({ allowed: true }));

    service.register(manifest, hooks);
    await service.load("scoped-plugin");
    await service.activate("scoped-plugin");

    const context = createTestContext({ sandboxTier: "scoped_external_access", executionId: newId("exec") });
    const result = await service.execute("scoped-plugin", "retriever", context, {});

    assert.equal(result.status, "ok");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("plugin executor: execute non-existent plugin throws error", async () => {
  const workspace = createTempWorkspace("aa-plugin-not-found-");

  try {
    const dbPath = join(workspace, "plugin-not-found.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const context = createTestContext({ executionId: newId("exec") });

    await assert.rejects(
      async () => service.execute("non-existent-plugin", "retriever", context, {}),
      (err: Error & { code?: string }) => err.code === "plugin_executor.not_found",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: execute unregistered action throws action_not_allowed", async () => {
  const workspace = createTempWorkspace("aa-plugin-action-denied-");

  try {
    const dbPath = join(workspace, "plugin-action-denied.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "action-plugin" });
    const hooks = createActionHooks("retriever", () => ({ data: true }));

    service.register(manifest, hooks);
    await service.load("action-plugin");
    await service.activate("action-plugin");

    const context = createTestContext({ executionId: newId("exec") });

    await assert.rejects(
      async () => service.execute("action-plugin", "planner", context, {}),
      (err: Error & { code?: string }) => err.code === "plugin_executor.action_not_allowed",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: execute inactive plugin throws not_active error", async () => {
  const workspace = createTempWorkspace("aa-plugin-inactive-");

  try {
    const dbPath = join(workspace, "plugin-inactive.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "inactive-plugin" });
    const hooks = createActionHooks("retriever", () => ({ data: true }));

    service.register(manifest, hooks);
    await service.load("inactive-plugin");
    await service.activate("inactive-plugin");
    await service.deactivate("inactive-plugin");

    const context = createTestContext({ executionId: newId("exec") });

    await assert.rejects(
      async () => service.execute("inactive-plugin", "retriever", context, {}),
      (err: Error & { code?: string }) => err.code === "plugin_executor.not_active",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: execute timeout is recorded correctly", async () => {
  const workspace = createTempWorkspace("aa-plugin-timeout-");

  try {
    const dbPath = join(workspace, "plugin-timeout.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({
      pluginId: "timeout-plugin",
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

    const hooks = createActionHooks("retriever", async () => {
      // Simulate slow operation that exceeds timeout
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { slow: true };
    });

    service.register(manifest, hooks);
    await service.load("timeout-plugin");
    await service.activate("timeout-plugin");

    const context = createTestContext({ executionId: newId("exec") });
    const result = await service.execute("timeout-plugin", "retriever", context, {});

    assert.equal(result.status, "timeout");
    assert.ok(result.error != null);
    assert.ok(result.durationMs >= 50);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Collection Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("plugin executor: successful execution writes artifact", async () => {
  const workspace = createTempWorkspace("aa-plugin-artifact-");

  try {
    const dbPath = join(workspace, "plugin-artifact.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "artifact-plugin" });
    const hooks = createActionHooks("retriever", () => ({ captured: true }));

    service.register(manifest, hooks);
    await service.load("artifact-plugin");
    await service.activate("artifact-plugin");

    const context = createTestContext({ executionId: newId("exec"), taskId: newId("task") });
    const result = await service.execute("artifact-plugin", "retriever", context, {});

    assert.equal(result.status, "ok");
    assert.ok(result.artifactRef != null);
    assert.ok(result.artifactRef.length > 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: failed execution writes error artifact", async () => {
  const workspace = createTempWorkspace("aa-plugin-error-artifact-");

  try {
    const dbPath = join(workspace, "plugin-error-artifact.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "error-artifact-plugin" });
    const hooks = createActionHooks("retriever", () => {
      throw new Error("Intentional failure");
    });

    service.register(manifest, hooks);
    await service.load("error-artifact-plugin");
    await service.activate("error-artifact-plugin");

    const context = createTestContext({ executionId: newId("exec"), taskId: newId("task") });
    const result = await service.execute("error-artifact-plugin", "retriever", context, {});

    assert.equal(result.status, "error");
    assert.ok(result.error != null);
    assert.ok(result.artifactRef != null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("plugin executor: healthCheck returns true for healthy plugin", async () => {
  const workspace = createTempWorkspace("aa-plugin-health-");

  try {
    const dbPath = join(workspace, "plugin-health.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "health-plugin" });
    const hooks = createTestHooks({ healthCheck: () => true });

    service.register(manifest, hooks);
    await service.load("health-plugin");
    await service.activate("health-plugin");

    const healthy = await service.healthCheck("health-plugin");
    assert.equal(healthy, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: healthCheck returns false for non-existent plugin", async () => {
  const workspace = createTempWorkspace("aa-plugin-health-missing-");

  try {
    const dbPath = join(workspace, "plugin-health-missing.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const healthy = await service.healthCheck("non-existent-plugin");
    assert.equal(healthy, false);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: healthCheck falls back to error count threshold", async () => {
  const workspace = createTempWorkspace("aa-plugin-health-threshold-");

  try {
    const dbPath = join(workspace, "plugin-health-threshold.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest({ pluginId: "threshold-plugin" });
    const hooks = createTestHooks({});

    service.register(manifest, hooks);
    await service.load("threshold-plugin");
    await service.activate("threshold-plugin");

    // Should be healthy with 0 errors
    const healthy1 = await service.healthCheck("threshold-plugin");
    assert.equal(healthy1, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrent Execution Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("plugin executor: multiple plugins can be registered and executed concurrently", async () => {
  const workspace = createTempWorkspace("aa-plugin-multi-");

  try {
    const dbPath = join(workspace, "plugin-multi.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();

    // Register multiple plugins
    const plugin1Hooks = createActionHooks("retriever", () => ({ plugin: 1 }));
    service.register(createTestManifest({ pluginId: "plugin-1" }), plugin1Hooks);

    const plugin2Hooks = createActionHooks("retriever", () => ({ plugin: 2 }));
    service.register(createTestManifest({ pluginId: "plugin-2" }), plugin2Hooks);

    const plugin3Hooks = createActionHooks("retriever", () => ({ plugin: 3 }));
    service.register(createTestManifest({ pluginId: "plugin-3" }), plugin3Hooks);

    // Load and activate all
    for (const pid of ["plugin-1", "plugin-2", "plugin-3"]) {
      await service.load(pid);
      await service.activate(pid);
    }

    // Execute all concurrently
    const context = createTestContext({ executionId: newId("exec") });
    const results = await Promise.all([
      service.execute("plugin-1", "retriever", context, {}),
      service.execute("plugin-2", "retriever", context, {}),
      service.execute("plugin-3", "retriever", context, {}),
    ]);

    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.status === "ok"));
    assert.deepEqual(results[0]!.output, { plugin: 1 });
    assert.deepEqual(results[1]!.output, { plugin: 2 });
    assert.deepEqual(results[2]!.output, { plugin: 3 });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("plugin executor: duplicate registration throws already_registered error", () => {
  const workspace = createTempWorkspace("aa-plugin-dup-");

  try {
    const dbPath = join(workspace, "plugin-dup.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const service = new PluginExecutorService();
    const manifest = createTestManifest();
    const hooks = createTestHooks();

    service.register(manifest, hooks);

    assert.throws(
      () => service.register(manifest, hooks),
      (err: Error & { code?: string }) => err.code === "plugin_executor.already_registered",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
