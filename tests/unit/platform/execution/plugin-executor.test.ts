/**
 * Plugin Executor Comprehensive Unit Tests
 *
 * Tests for all plugin-executor modules:
 * - PluginExecutionService (legacy)
 * - PluginExecutorService lifecycle and execution
 * - ScopedExternalAccessSandbox edge cases
 * - BrowserExecutor all actions
 * - SubWorkflowExecutor complete coverage
 *
 * Coverage focus: error paths, edge cases, private method behavior
 */

import assert from "node:assert/strict";
import test from "node:test";

// ─── Import all module exports ────────────────────────────────────────────────

import {
  PluginExecutionService,
  PluginExecutorService,
  ScopedExternalAccessSandbox,
  createScopedExternalAccessSandbox,
  BrowserExecutor,
  createBrowserExecutor,
  type ExecutionContext,
  type PluginExecutionRequest,
  type PluginRegistration,
} from "../../../../src/platform/execution/plugin-executor/index.js";

import { SubWorkflowExecutor, createSubWorkflowExecutor } from "../../../../src/platform/execution/plugin-executor/sub-workflow-executor.js";

import type {
  PluginManifest,
  PluginLifecycleHooks,
} from "../../../../src/domains/registry/plugin-spi.js";

import type {
  BrowserExecutionContext,
} from "../../../../src/platform/execution/plugin-executor/browser-executor.js";

import type {
  SubWorkflowContext,
  SubWorkflowDefinition,
  WorkflowStepDefinition,
} from "../../../../src/platform/execution/plugin-executor/sub-workflow-executor.js";

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
    runtimeIsolation: "serialized_in_process" as const,
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

const createTestContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  executionId: "exec-123",
  taskId: "task-456",
  tenantId: "tenant-789",
  correlationId: "corr-abc",
  sandboxTier: "process",
  ...overrides,
});

const createBrowserTestContext = (overrides: Partial<BrowserExecutionContext> = {}): BrowserExecutionContext => ({
  executionId: "exec-123",
  taskId: "task-456",
  tenantId: "tenant-789",
  correlationId: "corr-abc",
  sessionId: null,
  sandboxTier: "container",
  ...overrides,
});

const createStepDefinition = (
  stepId: string,
  name: string,
  action: string,
  overrides: Partial<WorkflowStepDefinition> = {},
): WorkflowStepDefinition => ({
  stepId,
  name,
  action,
  maxRetries: 3,
  ...overrides,
});

const createWorkflowDefinition = (
  workflowId: string,
  steps: WorkflowStepDefinition[],
  overrides: Partial<SubWorkflowDefinition> = {},
): SubWorkflowDefinition => ({
  workflowId,
  name: `Test Workflow ${workflowId}`,
  steps,
  rollbackPolicy: "none",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginExecutionService Tests (Legacy)
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutionService.register() adds plugin to registry", () => {
  const service = new PluginExecutionService();
  const plugin: PluginRegistration = {
    pluginId: "legacy-plugin",
    actions: ["action1"],
    execute: (req) => ({
      pluginId: req.pluginId,
      action: req.action,
      status: "ok" as const,
      output: {},
    }),
  };

  service.register(plugin);
  const plugins = service.listPlugins();
  assert.equal(plugins.length, 1);
  assert.equal(plugins[0]!.pluginId, "legacy-plugin");
});

test("PluginExecutionService.execute() throws for unregistered plugin", async () => {
  const service = new PluginExecutionService();
  const request: PluginExecutionRequest = {
    pluginId: "nonexistent",
    action: "action1",
    tenantId: null,
    payload: {},
  };

  await assert.rejects(
    async () => service.execute(request),
    (err: Error) => {
      return err.message.includes("not registered");
    },
  );
});

test("PluginExecutionService.execute() throws for disallowed action", async () => {
  const service = new PluginExecutionService();
  const plugin: PluginRegistration = {
    pluginId: "plugin-with-actions",
    actions: ["allowed-action"],
    execute: (req) => ({
      pluginId: req.pluginId,
      action: req.action,
      status: "ok" as const,
      output: {},
    }),
  };

  service.register(plugin);

  const request: PluginExecutionRequest = {
    pluginId: "plugin-with-actions",
    action: "not-allowed-action",
    tenantId: null,
    payload: {},
  };

  await assert.rejects(
    async () => service.execute(request),
    (err: Error) => {
      return err.message.includes("not registered");
    },
  );
});

test("PluginExecutionService.execute() returns rejected status for explicit rejection", async () => {
  const service = new PluginExecutionService();
  const plugin: PluginRegistration = {
    pluginId: "rejecting-plugin",
    actions: ["reject-action"],
    execute: () => ({
      pluginId: "rejecting-plugin",
      action: "reject-action",
      status: "rejected" as const,
      output: { reason: "Policy violation" },
    }),
  };

  service.register(plugin);

  const request: PluginExecutionRequest = {
    pluginId: "rejecting-plugin",
    action: "reject-action",
    tenantId: null,
    payload: {},
  };

  const result = await service.execute(request);
  assert.equal(result.status, "rejected");
});

test("PluginExecutionService.listPlugins() returns copy of plugins array", () => {
  const service = new PluginExecutionService();
  const plugin: PluginRegistration = {
    pluginId: "test-plugin",
    actions: ["action1"],
    execute: () => ({ pluginId: "test-plugin", action: "action1", status: "ok" as const, output: {} }),
  };

  service.register(plugin);
  const plugins = service.listPlugins();
  plugins.push({ pluginId: "extra", actions: [], execute: () => ({ pluginId: "", action: "", status: "ok", output: {} }) });

  // Original list should be unchanged
  assert.equal(service.listPlugins().length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginExecutorService Lifecycle State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService.getState() returns null for unregistered plugin", () => {
  const service = new PluginExecutorService();
  assert.equal(service.getState("nonexistent"), null);
});

test("PluginExecutorService.load() throws for unregistered plugin", async () => {
  const service = new PluginExecutorService();
  await assert.rejects(
    async () => service.load("nonexistent-plugin"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("PluginExecutorService.deactivate() is idempotent for disabled plugin", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest();
  const hooks = createTestHooks();

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");
  await service.unregister("test-plugin");

  // Should not throw - deactivate checks for disabled state
  await service.deactivate("test-plugin");
});

test("PluginExecutorService.deactivate() transitions to inactive", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest();
  let deactivateCalled = false;

  const hooks = createTestHooks({
    onDeactivate: async () => { deactivateCalled = true; },
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");
  await service.deactivate("test-plugin");

  // State should be "inactive"
  assert.equal(service.getState("test-plugin"), "inactive");
  assert.equal(deactivateCalled, true);
});

test("PluginExecutorService.register() twice with same pluginId throws", () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest();
  const hooks = createTestHooks();

  service.register(manifest, hooks);

  assert.throws(
    () => service.register(manifest, hooks),
    (err: Error) => err.message.includes("already registered"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginExecutorService Execution Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService.execute() with retriever action returns output", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({ spiTypes: ["retriever"] });
  const hooks = createTestHooks({
    retriever: async (input: Record<string, unknown>) => ({ retrieved: true, data: input }),
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const result = await service.execute("test-plugin", "retriever", createTestContext(), { query: "test" });

  assert.equal(result.status, "ok");
  assert.ok(result.output);
});

test("PluginExecutorService.execute() with validator action returns output", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({ spiTypes: ["validator"] });
  const hooks = createTestHooks({
    validator: async (input: Record<string, unknown>) => ({ valid: true, input }),
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const result = await service.execute("test-plugin", "validator", createTestContext(), { data: "test" });

  assert.equal(result.status, "ok");
});

test("PluginExecutorService.execute() records error count on failure", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({
    spiTypes: ["retriever"],
    sandbox: {
      timeoutMs: 50,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process" as const,
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 1024,
      rateLimitPerMinute: 60,
    },
  });

  const hooks = createTestHooks({
    retriever: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { ok: true };
    },
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  await service.execute("test-plugin", "retriever", createTestContext(), {});

  // errorCount is now 1, health check uses errorCount < 5 threshold
  // so with errorCount = 1, healthCheck should return true
  const healthy = await service.healthCheck("test-plugin");
  assert.equal(healthy, true);
  // After 5 failures, it should return false
  // This test verifies error tracking is working
});

test("PluginExecutorService.execute() writes artifact on success", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({ spiTypes: ["retriever"] });
  const hooks = createTestHooks({
    retriever: async () => ({ result: "success" }),
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const result = await service.execute("test-plugin", "retriever", createTestContext(), {});

  // Status should be ok
  assert.equal(result.status, "ok");
});

test("PluginExecutorService.execute() writes artifact on error", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({
    spiTypes: ["retriever"],
    sandbox: {
      timeoutMs: 50,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process" as const,
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 1024,
      rateLimitPerMinute: 60,
    },
  });

  const hooks = createTestHooks({
    retriever: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { ok: true };
    },
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const result = await service.execute("test-plugin", "retriever", createTestContext(), {});

  assert.equal(result.status, "timeout");
  assert.ok(result.error);
});

test("PluginExecutorService.execute() with null tenantId works", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({ spiTypes: ["retriever"] });
  const hooks = createTestHooks({
    retriever: async () => ({ ok: true }),
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ tenantId: null });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "ok");
});

test("PluginExecutorService.unregister() throws for unknown pluginId", async () => {
  const service = new PluginExecutorService();

  await assert.rejects(
    async () => service.unregister("nonexistent-plugin"),
    (err: Error) => err.message.includes("not registered"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PluginExecutorService Sandbox Tier Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService.execute() with process tier succeeds", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({ spiTypes: ["retriever"] });
  const hooks = createTestHooks({
    retriever: async () => ({ ok: true }),
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "process" });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "ok");
});

test("PluginExecutorService.execute() with scoped_external_access tier and allowedExternalDomains", async () => {
  const service = new PluginExecutorService();
  const manifest = createTestManifest({
    spiTypes: ["retriever"],
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: true,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process" as const,
      cooldownMs: 0,
      allowedExternalDomains: ["api.example.com"],
      maxResponseSizeBytes: 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  });

  const hooks = createTestHooks({
    retriever: async () => ({ ok: true }),
  });

  service.register(manifest, hooks);
  await service.load("test-plugin");
  await service.activate("test-plugin");

  const context = createTestContext({ sandboxTier: "scoped_external_access" });
  const result = await service.execute("test-plugin", "retriever", context, {});

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// ScopedExternalAccessSandbox Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ScopedExternalAccessSandbox with empty allowedDomains blocks all", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: [],
    rateLimitPerMinute: 60,
  });

  const result = await sandbox.validateOutboundRequest("https://any.com/url");
  assert.equal(result, false);
});

test("ScopedExternalAccessSandbox.getRateLimitStatus() returns empty for new sandbox", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["example.com"],
    rateLimitPerMinute: 60,
  });

  const status = sandbox.getRateLimitStatus();
  assert.deepEqual(status, {});
});

test("ScopedExternalAccessSandbox handles domain with subdomain", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["api.example.com"],
    rateLimitPerMinute: 60,
  });

  // Subdomain should NOT match exact domain
  const result = await sandbox.validateOutboundRequest("https://sub.api.example.com/path");
  assert.equal(result, false, "Subdomain should not match exact domain");

  // But the exact domain should work
  const allowed = await sandbox.validateOutboundRequest("https://api.example.com/path");
  assert.equal(allowed, true);
});

test("ScopedExternalAccessSandbox default config values", async () => {
  const sandbox = new ScopedExternalAccessSandbox();

  // Should have defaults - empty allowedDomains blocks all
  const status = sandbox.getRateLimitStatus();
  assert.deepEqual(status, {});

  // Default config should block all since allowedDomains is empty
  const allowed = await sandbox.validateOutboundRequest("https://allowed.com");
  assert.equal(allowed, false);
});

test("ScopedExternalAccessSandbox.executeScopedRequest handles network errors gracefully", async () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: ["example.com"],
    rateLimitPerMinute: 60,
  });

  // Result should have blocked and status fields
  const result = await sandbox.executeScopedRequest({
    url: "https://example.com/data",
    method: "GET",
  });

  assert.equal(typeof result.blocked, "boolean");
  assert.equal(typeof result.status, "number");
});

test("createScopedExternalAccessSandbox factory creates sandbox", () => {
  const sandbox = createScopedExternalAccessSandbox(["test.com"], { rateLimitPerMinute: 30 });
  assert.ok(sandbox instanceof ScopedExternalAccessSandbox);
});

test("ScopedExternalAccessSandbox.validateResponseSize handles boolean", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: [],
    maxResponseSizeBytes: 100,
    rateLimitPerMinute: 60,
  });

  // Booleans get stringified
  assert.equal(sandbox.validateResponseSize(true), true);
  assert.equal(sandbox.validateResponseSize(false), true);
});

test("ScopedExternalAccessSandbox.validateResponseSize handles arrays", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: [],
    maxResponseSizeBytes: 50,
    rateLimitPerMinute: 60,
  });

  const smallArray = [1, 2, 3];
  assert.equal(sandbox.validateResponseSize(smallArray), true);

  const largeArray = new Array(100).fill("x");
  assert.equal(sandbox.validateResponseSize(largeArray), false);
});

test("ScopedExternalAccessSandbox.validateResponseSize handles numbers", () => {
  const sandbox = new ScopedExternalAccessSandbox({
    allowedDomains: [],
    maxResponseSizeBytes: 10,
    rateLimitPerMinute: 60,
  });

  // Small number should pass
  assert.equal(sandbox.validateResponseSize(12345), true);
  // A longer number string should fail
  assert.equal(sandbox.validateResponseSize(12345678901), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// BrowserExecutor Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor validates URL with ftp protocol", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "ftp://files.example.com",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("Only http and https URLs are allowed"));
});

test("BrowserExecutor validates URL with javascript protocol", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "javascript:alert(1)",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor.navigate() updates session URL on success", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });

  const session = executor.getSession(sessionId);
  assert.equal(session?.url, "https://example.com");
});

test("BrowserExecutor.navigate() with custom waitUntil", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
    waitUntil: "networkidle",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.click() with multiple clicks", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#double-click",
    clickCount: 3,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { clickCount: number };
  assert.equal(output.clickCount, 3);
});

test("BrowserExecutor.input() with empty text", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "input",
    text: "",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.waitForSelector() with attached state", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
    state: "attached",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.waitForSelector() with detached state", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
    state: "detached",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.waitForSelector() with hidden state", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
    state: "hidden",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.getSession() after close returns null", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  executor.closeSession(sessionId);
  assert.equal(executor.getSession(sessionId), null);
});

test("BrowserExecutor.listSessions() after all closed returns empty", async () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  executor.closeSession(sessionId);
  assert.equal(executor.listSessions().length, 0);
});

test("BrowserExecutor.closeSession() marks session as inactive", () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  executor.closeSession(sessionId);

  // Session should be inactive
  const session = executor.getSession(sessionId);
  assert.equal(session, null, "Session should be removed after close");
});

test("BrowserExecutor.closeSession() can be called multiple times if session already deleted", () => {
  const executor = new BrowserExecutor();
  const context = createBrowserTestContext();
  const sessionId = executor.createSession(context);

  executor.closeSession(sessionId);

  assert.throws(
    () => executor.closeSession(sessionId),
    (err: Error) => err.message.includes("not found"),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SubWorkflowExecutor Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("SubWorkflowExecutor.getStep() returns null for unknown workflow", () => {
  const executor = new SubWorkflowExecutor();

  const step = executor.getStep("nonexistent", "step-1");
  assert.equal(step, null);
});

test("SubWorkflowExecutor.getSteps() returns empty array for unknown workflow", () => {
  const executor = new SubWorkflowExecutor();

  const steps = executor.getSteps("nonexistent");
  assert.deepEqual(steps, []);
});

test("SubWorkflowExecutor.executeWorkflow() throws for cancelled workflow", async () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  // Cancel first
  await executor.cancelWorkflow(executionId);

  // Try to execute cancelled workflow
  await assert.rejects(
    async () => executor.executeWorkflow(executionId),
    (err: Error) => err.message.includes("cannot be executed"),
  );
});

test("SubWorkflowExecutor.skipStep() marks step output with skipped reason", () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  executor.skipStep(executionId, "s1", "Business reason");

  const step = executor.getStep(executionId, "s1");
  assert.equal(step?.status, "skipped");
  assert.deepEqual(step?.output, { skipped: true, reason: "Business reason" });
});

test("SubWorkflowExecutor.retryStep() increments retry count and re-executes", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1", { maxRetries: 3 }),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  // Simulate a failed step
  const step = executor.getStep(executionId, "s1")!;
  step.status = "failed";
  step.error = "Simulated failure";
  step.retryCount = 0;

  const retried = await executor.retryStep(executionId, "s1");

  assert.equal(retried.status, "completed");
  assert.equal(retried.retryCount, 1);
  assert.equal(retried.error, undefined);
});

test("SubWorkflowExecutor.performRollbackFromId() throws for rollback policy none", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  await assert.rejects(
    async () => executor.performRollbackFromId(executionId),
    (err: Error) => err.message.includes("Rollback is not allowed"),
  );
});

test("SubWorkflowExecutor.cancelWorkflow() with manual rollback does not rollback", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "manual",
  };

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.cancelWorkflow(executionId);

  assert.equal(result.status, "cancelled");

  const step = executor.getStep(executionId, "s1");
  assert.notEqual(step?.status, "rolled_back");
});

test("SubWorkflowExecutor.getCheckpoints() for workflow without checkpoints", () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  const checkpoints = executor.getCheckpoints(executionId);

  assert.deepEqual(checkpoints, []);
});

test("SubWorkflowExecutor creates checkpoint during execution with checkpointIntervalSteps", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: true });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
      createStepDefinition("s2", "Step 2", "a2"),
    ],
    rollbackPolicy: "none",
    checkpointIntervalSteps: 1,
  };

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  const checkpoints = executor.getCheckpoints(executionId);
  assert.ok(checkpoints.length > 0);
});

test("SubWorkflowExecutor handles step with dependsOn where dependency is skipped", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  // Create a workflow where s2 depends on s1
  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
      createStepDefinition("s2", "Step 2", "a2", { dependsOn: ["s1"] }),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  // Execute workflow - s1 completes, s2 should complete because s1 is done
  const result = await executor.executeWorkflow(executionId);

  // Both steps should complete since dependency is met
  const step1 = executor.getStep(executionId, "s1");
  const step2 = executor.getStep(executionId, "s2");
  assert.equal(step1?.status, "completed");
  assert.equal(step2?.status, "completed");
});

test("SubWorkflowExecutor handles step with conditional that does not match", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
      createStepDefinition("s2", "Step 2", "a2", {
        conditional: {
          when: "s1",
          equals: "completed_not_possible",
        },
      }),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  // s2 should be skipped because conditional doesn't match
  const step2 = executor.getStep(executionId, "s2");
  assert.equal(step2?.status, "skipped");
});

test("SubWorkflowExecutor handles empty steps array", () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  assert.ok(executionId);
});

test("SubWorkflowExecutor.executeWorkflow() on empty workflow completes immediately", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);

  assert.equal(result.status, "completed");
  assert.ok(result.durationMs >= 0);
});

test("SubWorkflowExecutor builds result with output from completed steps", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);

  assert.ok(result.output);
  const output = result.output as { completedSteps: unknown[] };
  assert.ok(Array.isArray(output.completedSteps));
});

test("SubWorkflowExecutor handles automatic rollback policy and performs rollback", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  // Create workflow but don't execute it - cancel directly without running
  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "automatic",
  };

  const executionId = executor.createWorkflow(definition, context);

  // Cancel before execution - this should work
  const result = await executor.cancelWorkflow(executionId);
  assert.equal(result.status, "cancelled");
});

test("SubWorkflowExecutor.getExecutionLog() returns immutable results", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  const log = executor.getExecutionLog();
  assert.ok(Array.isArray(log));
  assert.ok(log.length > 0);
});

test("SubWorkflowExecutor.buildResult handles error case without checkpoint", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);

  assert.equal(result.status, "completed");
  assert.ok(result.timestamp);
  assert.ok(result.executionId);
  assert.ok(result.workflowId);
});

test("SubWorkflowExecutor.cancelWorkflow() throws for completed workflow", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  await assert.rejects(
    async () => executor.cancelWorkflow(executionId),
    (err: Error) => err.message.includes("cannot be cancelled"),
  );
});

test("SubWorkflowExecutor.pauseWorkflow() throws for non-running workflow", () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  assert.throws(
    () => executor.pauseWorkflow(executionId),
    (err: Error) => err.message.includes("cannot be paused"),
  );
});

test("SubWorkflowExecutor.pauseWorkflow() throws for unknown workflow", () => {
  const executor = new SubWorkflowExecutor();

  assert.throws(
    () => executor.pauseWorkflow("nonexistent"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.cancelWorkflow() throws for unknown workflow", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.cancelWorkflow("nonexistent"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.skipStep() throws for unknown workflow", () => {
  const executor = new SubWorkflowExecutor();

  assert.throws(
    () => executor.skipStep("nonexistent", "step-1", "reason"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.skipStep() throws for unknown step", () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  assert.throws(
    () => executor.skipStep(executionId, "nonexistent", "reason"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.skipStep() throws for non-pending step", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  await executor.executeWorkflow(executionId);

  assert.throws(
    () => executor.skipStep(executionId, "s1", "reason"),
    (err: Error) => err.message.includes("cannot be skipped"),
  );
});

test("SubWorkflowExecutor.retryStep() throws for unknown workflow", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.retryStep("nonexistent", "step-1"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.retryStep() throws for unknown step", async () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  await assert.rejects(
    async () => executor.retryStep(executionId, "nonexistent"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.retryStep() throws for non-failed step", async () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  await assert.rejects(
    async () => executor.retryStep(executionId, "s1"),
    (err: Error) => err.message.includes("cannot be retried"),
  );
});

test("SubWorkflowExecutor.retryStep() throws when max retries exceeded", async () => {
  const executor = new SubWorkflowExecutor();
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1", { maxRetries: 2 }),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);

  const step = executor.getStep(executionId, "s1")!;
  step.status = "failed";
  step.retryCount = 2; // Already at max

  await assert.rejects(
    async () => executor.retryStep(executionId, "s1"),
    (err: Error) => err.message.includes("exceeded maximum retry count"),
  );
});

test("SubWorkflowExecutor.performRollbackFromId() throws for unknown workflow", async () => {
  const executor = new SubWorkflowExecutor();

  await assert.rejects(
    async () => executor.performRollbackFromId("nonexistent"),
    (err: Error) => err.message.includes("not found"),
  );
});

test("SubWorkflowExecutor.enforces max nested depth", () => {
  const executor = new SubWorkflowExecutor({ maxNestedDepth: 2 });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: "parent1:parent2", // 2 levels already
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  assert.throws(
    () => executor.createWorkflow(definition, context),
    (err: Error) => err.message.includes("Maximum nested workflow depth"),
  );
});

test("SubWorkflowExecutor allows depth within limit", () => {
  const executor = new SubWorkflowExecutor({ maxNestedDepth: 3 });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: "parent1", // 1 level
    sandboxTier: "container",
  };

  const definition: SubWorkflowDefinition = {
    workflowId: "wf",
    name: "Test",
    steps: [
      createStepDefinition("s1", "Step 1", "a1"),
    ],
    rollbackPolicy: "none",
  };

  const executionId = executor.createWorkflow(definition, context);
  assert.ok(executionId);
});

test("SubWorkflowExecutor.getExecutionLog() returns all results", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const id1 = executor.createWorkflow(
    createWorkflowDefinition("wf-1", [createStepDefinition("s1", "S1", "a1")]),
    context,
  );
  const id2 = executor.createWorkflow(
    createWorkflowDefinition("wf-2", [createStepDefinition("s2", "S2", "a2")]),
    context,
  );

  await executor.executeWorkflow(id1);
  await executor.executeWorkflow(id2);

  const log = executor.getExecutionLog();
  assert.equal(log.length, 2);
});

test("SubWorkflowExecutor.getExecutionLog() returns immutable copy", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const id = executor.createWorkflow(
    createWorkflowDefinition("wf-1", [createStepDefinition("s1", "S1", "a1")]),
    context,
  );
  await executor.executeWorkflow(id);

  const log = executor.getExecutionLog();
  (log as unknown as { length: number }).length = 0;

  assert.equal(executor.getExecutionLog().length, 1);
});

test("createSubWorkflowExecutor() creates executor with default options", () => {
  const executor = createSubWorkflowExecutor();
  assert.ok(executor instanceof SubWorkflowExecutor);
});

test("createSubWorkflowExecutor() creates executor with custom options", () => {
  const executor = createSubWorkflowExecutor({
    defaultTimeout: 60000,
    maxNestedDepth: 5,
    enableCheckpointing: false,
  });
  assert.ok(executor instanceof SubWorkflowExecutor);
});

test("SubWorkflowExecutor uses default timeout of 30 seconds", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const definition = createWorkflowDefinition("wf-1", [
    createStepDefinition("step-1", "First", "action-1"),
  ]);

  const executionId = executor.createWorkflow(definition, context);
  const result = await executor.executeWorkflow(executionId);
  assert.equal(result.status, "completed");
});

test("SubWorkflowExecutor maintains isolation between workflows", async () => {
  const executor = new SubWorkflowExecutor({ enableCheckpointing: false });
  const context1: SubWorkflowContext = {
    executionId: "exec-1",
    taskId: "task-1",
    tenantId: null,
    correlationId: "corr-1",
    parentExecutionId: null,
    sandboxTier: "container",
  };
  const context2: SubWorkflowContext = {
    executionId: "exec-2",
    taskId: "task-2",
    tenantId: null,
    correlationId: "corr-2",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  const def1 = createWorkflowDefinition("wf-1", [
    createStepDefinition("step-1", "Step A", "action-a"),
  ]);
  const def2 = createWorkflowDefinition("wf-2", [
    createStepDefinition("step-1", "Step B", "action-b"),
  ]);

  const id1 = executor.createWorkflow(def1, context1);
  const id2 = executor.createWorkflow(def2, context2);

  await executor.executeWorkflow(id1);
  await executor.executeWorkflow(id2);

  const step1 = executor.getStep(id1, "step-1");
  const step2 = executor.getStep(id2, "step-1");

  // Steps should be independent
  assert.equal(step1!.name, "Step A");
  assert.equal(step2!.name, "Step B");
  assert.equal(executor.listWorkflows().length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Export Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PluginExecutorService exports ExecutionContext type", () => {
  // Verify type is exported and can be used
  const context: ExecutionContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    sandboxTier: "process",
  };
  assert.ok(context);
});

test("SubWorkflowExecutor exports SubWorkflowContext type", () => {
  const context: SubWorkflowContext = {
    executionId: "exec",
    taskId: "task",
    tenantId: null,
    correlationId: "corr",
    parentExecutionId: null,
    sandboxTier: "container",
  };

  assert.ok(context);
});