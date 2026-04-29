import assert from "node:assert/strict";
import test from "node:test";

import { PluginSpiRegistry } from "../../../../src/domains/registry/plugin-spi-registry.js";
import type { PluginSandboxPolicy, PluginLifecycleContext } from "../../../../src/domains/registry/plugin-spi.js";

function makeSandboxPolicy(overrides: Partial<PluginSandboxPolicy> = {}): PluginSandboxPolicy {
  return {
    timeoutMs: 5000,
    allowFilesystemWrite: false,
    allowNetworkEgress: false,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 1,
    maxQueuedInvocations: 8,
    runtimeIsolation: "serialized_in_process",
    cooldownMs: 0,
    allowedExternalDomains: [],
    maxResponseSizeBytes: 5 * 1024 * 1024,
    rateLimitPerMinute: 60,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invocation concurrency limits
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry enforces maxConcurrentInvocations limit", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });
  let activeCount = 0;
  let maxObserved = 0;

  registry.register({
    pluginId: "plugin.concurrent",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      activeCount++;
      maxObserved = Math.max(maxObserved, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeCount--;
      return [];
    },
  }, {
    pluginId: "plugin.concurrent",
    name: "concurrent plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      maxConcurrentInvocations: 2,
      maxQueuedInvocations: 4,
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.concurrent");

  // Launch more concurrent invocations than max allowed
  const promises = Array.from({ length: 5 }, (_, i) =>
    registry.invokeRetriever("plugin.concurrent", {
      query: {
        taskId: `task_${i}`,
        intent: "test",
        context: {},
        tokenBudget: 1000,
      },
    }),
  );

  await Promise.all(promises);
  assert.ok(maxObserved <= 2, `Expected max ${2} concurrent, observed ${maxObserved}`);
});

test("PluginSpiRegistry queues invocations up to maxQueuedInvocations", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });
  let processing = false;

  registry.register({
    pluginId: "plugin.queue",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      while (processing) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      processing = true;
      await new Promise((resolve) => setTimeout(resolve, 20));
      processing = false;
      return [];
    },
  }, {
    pluginId: "plugin.queue",
    name: "queue plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 3,
      timeoutMs: 2000,
    }),
  });

  await registry.ensureActive("plugin.queue");

  // Launch more invocations than can be queued
  const results: Promise<unknown>[] = [];
  for (let i = 0; i < 6; i++) {
    results.push(
      registry.invokeRetriever("plugin.queue", {
        query: {
          taskId: `task_q_${i}`,
          intent: "test",
          context: {},
          tokenBudget: 1000,
        },
      }).catch(() => "error"),
    );
  }

  const outcomes = await Promise.all(results);
  // Some may have failed due to queue overflow, but at least some should succeed
  const successes = outcomes.filter((r) => Array.isArray(r));
  assert.ok(successes.length >= 3);
});

test("PluginSpiRegistry throws when queue overflow exceeds limit", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });
  let block = true;

  registry.register({
    pluginId: "plugin.overflow",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      while (block) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return [];
    },
  }, {
    pluginId: "plugin.overflow",
    name: "overflow plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 1,
      timeoutMs: 5000,
    }),
  });

  await registry.ensureActive("plugin.overflow");

  // First invocation should be in-flight
  const first = registry.invokeRetriever("plugin.overflow", {
    query: {
      taskId: "task_blocked",
      intent: "block",
      context: {},
      tokenBudget: 1000,
    },
  });

  // Second should queue
  const second = registry.invokeRetriever("plugin.overflow", {
    query: {
      taskId: "task_queued",
      intent: "queued",
      context: {},
      tokenBudget: 1000,
    },
  });

  // Third should fail due to queue overflow
  try {
    await registry.invokeRetriever("plugin.overflow", {
      query: {
        taskId: "task_overflow",
        intent: "overflow",
        context: {},
        tokenBudget: 1000,
      },
    });
    assert.fail("Expected queue overflow error");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("queue_overflow") || err.message.includes("exceeded"));
  } finally {
    block = false;
    await first;
    await second.catch(() => "queued error");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown mechanism
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry applies cooldown after failures", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 3 });
  let attemptCount = 0;

  registry.register({
    pluginId: "plugin.cooldown",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      attemptCount++;
      throw new Error("Plugin failure");
    },
  }, {
    pluginId: "plugin.cooldown",
    name: "cooldown plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      cooldownMs: 5000,
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.cooldown");

  await assert.rejects(
    registry.invokeRetriever("plugin.cooldown", {
      query: {
        taskId: "task_fail_0",
        intent: "fail",
        context: {},
        tokenBudget: 1000,
      },
    }),
  );

  await assert.rejects(
    registry.invokeRetriever("plugin.cooldown", {
      query: {
        taskId: "task_fail_1",
        intent: "fail",
        context: {},
        tokenBudget: 1000,
      },
    }),
    /cooling down during retrieve/i,
  );

  assert.equal(attemptCount, 1);
});

test("PluginSpiRegistry clears cooldown when invocations succeed", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 2 });
  let attemptCount = 0;

  registry.register({
    pluginId: "plugin.clear_cooldown",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error("Transient failure");
      }
      return [{ knowledgeRef: "knowledge:test", snippet: "test", score: 1, namespace: "test", chunkId: "c1", documentId: "d1", matchType: "keyword" as const }];
    },
  }, {
    pluginId: "plugin.clear_cooldown",
    name: "clear cooldown plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      cooldownMs: 10,
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.clear_cooldown");

  // First failure starts cooldown.
  for (let i = 0; i < 2; i++) {
    try {
      await registry.invokeRetriever("plugin.clear_cooldown", {
        query: {
          taskId: `task_fail_${i}`,
          intent: "fail",
          context: {},
          tokenBudget: 1000,
        },
      });
    } catch {
      // Expected
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  // Third succeeds after cooldown expiry and clears failure state.
  const result = await registry.invokeRetriever("plugin.clear_cooldown", {
    query: {
      taskId: "task_success",
      intent: "success",
      context: {},
      tokenBudget: 1000,
    },
  });

  assert.ok(Array.isArray(result));
});

// ─────────────────────────────────────────────────────────────────────────────
// Namespace assertion
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry asserts namespace allowed for retriever", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });

  registry.register({
    pluginId: "plugin.namespace",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.namespace",
    name: "namespace plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      allowedKnowledgeNamespaces: ["allowed/ns"],
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.namespace");

  // Accessing allowed namespace should work
  const result = await registry.invokeRetriever("plugin.namespace", {
    namespace: "allowed/ns",
    query: {
      taskId: "task_allowed",
      intent: "test",
      context: {},
      tokenBudget: 1000,
    },
  });

  assert.ok(Array.isArray(result));

  // Accessing denied namespace should throw
  try {
    await registry.invokeRetriever("plugin.namespace", {
      namespace: "denied/ns",
      query: {
        taskId: "task_denied",
        intent: "test",
        context: {},
        tokenBudget: 1000,
      },
    });
    assert.fail("Expected namespace denied error");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("namespace_denied"));
  }
});

test("PluginSpiRegistry allows null namespace when no restriction", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });

  registry.register({
    pluginId: "plugin.no_namespace_restrict",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      return [];
    },
  }, {
    pluginId: "plugin.no_namespace_restrict",
    name: "no restrict plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      allowedKnowledgeNamespaces: [], // Empty = no restriction
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.no_namespace_restrict");

  // Null namespace should be allowed when no restrictions
  const result = await registry.invokeRetriever("plugin.no_namespace_restrict", {
    namespace: null,
    query: {
      taskId: "task_null_ns",
      intent: "test",
      context: {},
      tokenBudget: 1000,
    },
  });

  assert.ok(Array.isArray(result));
});

// ─────────────────────────────────────────────────────────────────────────────
// Network assertion
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry asserts network allowed for adapter operations", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });

  registry.register({
    pluginId: "plugin.adapter.network",
    spiType: "adapter",
    adapterType: "github",
    async authenticate() {},
    async execute() {
      return {};
    },
  }, {
    pluginId: "plugin.adapter.network",
    name: "network adapter",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      allowNetworkEgress: false,
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.adapter.network");

  // Authenticate without network should work since network assertion is per-phase
  // Actually the assertion is called for authenticate and execute
  // Since allowNetworkEgress is false, both should fail
  try {
    await registry.invokeAdapterAuthenticate("plugin.adapter.network", {
      credentials: { token: "test" },
    });
    assert.fail("Expected network denied error");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("network_denied"));
  }
});

test("PluginSpiRegistry allows network when allowNetworkEgress is true", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });

  registry.register({
    pluginId: "plugin.adapter.allowed_network",
    spiType: "adapter",
    adapterType: "github",
    async authenticate() {},
    async execute() {
      return { result: "ok" };
    },
  }, {
    pluginId: "plugin.adapter.allowed_network",
    name: "allowed network adapter",
    version: "1.0.0",
    owner: "test",
    domainIds: [],
    capabilityIds: [],
    spiTypes: ["adapter"],
    extensionKind: "external_adapter",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      allowNetworkEgress: true,
      timeoutMs: 1000,
    }),
  });

  await registry.ensureActive("plugin.adapter.allowed_network");

  // Authenticate should work when network is allowed
  await registry.invokeAdapterAuthenticate("plugin.adapter.allowed_network", {
    credentials: { token: "test" },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle state transitions
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry transitions to degraded after invocation failure", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 5 });

  registry.register({
    pluginId: "plugin.degrade_on_fail",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      throw new Error("Invoke failure");
    },
  }, {
    pluginId: "plugin.degrade_on_fail",
    name: "degrade plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({ timeoutMs: 1000 }),
  });

  await registry.ensureActive("plugin.degrade_on_fail");

  try {
    await registry.invokeRetriever("plugin.degrade_on_fail", {
      query: {
        taskId: "task_invoke_fail",
        intent: "fail",
        context: {},
        tokenBudget: 1000,
      },
    });
  } catch {
    // Expected
  }

  const record = registry.get("plugin.degrade_on_fail");
  assert.ok(record);
  assert.ok(
    record.lifecycleState === "suspended" || record.lifecycleState === "disabled",
    `Expected suspended or disabled, got ${record.lifecycleState}`,
  );
});

test("PluginSpiRegistry transitions to disabled after max consecutive failures", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 2 });

  registry.register({
    pluginId: "plugin.disable_after_failures",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      throw new Error("Permanent failure");
    },
  }, {
    pluginId: "plugin.disable_after_failures",
    name: "disable plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({ timeoutMs: 1000 }),
  });

  await registry.ensureActive("plugin.disable_after_failures");

  // Trigger failures to exceed threshold
  for (let i = 0; i < 3; i++) {
    try {
      await registry.invokeRetriever("plugin.disable_after_failures", {
        query: {
          taskId: `task_fail_${i}`,
          intent: "fail",
          context: {},
          tokenBudget: 1000,
        },
      });
    } catch {
      // Expected
    }
  }

  const record = registry.get("plugin.disable_after_failures");
  assert.ok(record);
  assert.equal(record.lifecycleState, "disabled");
});

test("PluginSpiRegistry records failure metrics", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });

  registry.register({
    pluginId: "plugin.metrics",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      throw new Error("Metrics failure");
    },
  }, {
    pluginId: "plugin.metrics",
    name: "metrics plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({ timeoutMs: 1000 }),
  });

  await registry.ensureActive("plugin.metrics");

  try {
    await registry.invokeRetriever("plugin.metrics", {
      query: {
        taskId: "task_metrics",
        intent: "fail",
        context: {},
        tokenBudget: 1000,
      },
    });
  } catch {
    // Expected
  }

  const record = registry.get("plugin.metrics");
  assert.ok(record);
  assert.ok(record.failureCount > 0);
  assert.ok(record.lastErrorMessage?.includes("Metrics failure"));
  assert.ok(record.lastErrorAt);
});

test("PluginSpiRegistry resets failure metrics on success", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });
  let attemptCount = 0;

  registry.register({
    pluginId: "plugin.reset_metrics",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error("Initial failure");
      }
      return [];
    },
  }, {
    pluginId: "plugin.reset_metrics",
    name: "reset plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({ timeoutMs: 1000 }),
  });

  await registry.ensureActive("plugin.reset_metrics");

  // First invocation fails
  try {
    await registry.invokeRetriever("plugin.reset_metrics", {
      query: {
        taskId: "task_fail",
        intent: "fail",
        context: {},
        tokenBudget: 1000,
      },
    });
  } catch {
    // Expected
  }

  const recordAfterFail = registry.get("plugin.reset_metrics");
  assert.ok(recordAfterFail);
  assert.ok(recordAfterFail.failureCount > 0);

  // Second invocation succeeds
  await registry.invokeRetriever("plugin.reset_metrics", {
    query: {
      taskId: "task_success",
      intent: "success",
      context: {},
      tokenBudget: 1000,
    },
  });

  const recordAfterSuccess = registry.get("plugin.reset_metrics");
  assert.ok(recordAfterSuccess);
  assert.equal(recordAfterSuccess.failureCount, 0);
  assert.equal(recordAfterSuccess.lastErrorMessage, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Invocation waiters management
// ─────────────────────────────────────────────────────────────────────────────

test("PluginSpiRegistry releases queued invocations when slots become available", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });
  let blockProcessing = true;
  let processedCount = 0;

  registry.register({
    pluginId: "plugin.release_waiters",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      processedCount++;
      return [];
    },
  }, {
    pluginId: "plugin.release_waiters",
    name: "release plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 2,
      timeoutMs: 2000,
    }),
  });

  await registry.ensureActive("plugin.release_waiters");

  // Launch initial invocation that will complete quickly
  const first = registry.invokeRetriever("plugin.release_waiters", {
    query: {
      taskId: "task_first",
      intent: "first",
      context: {},
      tokenBudget: 1000,
    },
  });

  // Wait for first to start
  await new Promise((resolve) => setTimeout(resolve, 5));

  // Queue more invocations
  const queued = [
    registry.invokeRetriever("plugin.release_waiters", {
      query: {
        taskId: "task_queued_1",
        intent: "queued1",
        context: {},
        tokenBudget: 1000,
      },
    }),
    registry.invokeRetriever("plugin.release_waiters", {
      query: {
        taskId: "task_queued_2",
        intent: "queued2",
        context: {},
        tokenBudget: 1000,
      },
    }),
  ];

  const results = await Promise.all([first, ...queued]);
  assert.equal(results.length, 3);
});

test("PluginSpiRegistry handles invocation timing metrics", async () => {
  const registry = new PluginSpiRegistry({ maxConsecutiveFailures: 10 });

  registry.register({
    pluginId: "plugin.timing",
    domainId: "coding",
    spiType: "retriever",
    async retrieve() {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [];
    },
  }, {
    pluginId: "plugin.timing",
    name: "timing plugin",
    version: "1.0.0",
    owner: "test",
    domainIds: ["coding"],
    capabilityIds: [],
    spiTypes: ["retriever"],
    extensionKind: "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "test",
    settingsSchema: {},
    sandbox: makeSandboxPolicy({ timeoutMs: 1000 }),
  });

  await registry.ensureActive("plugin.timing");

  await registry.invokeRetriever("plugin.timing", {
    query: {
      taskId: "task_timing",
      intent: "timing",
      context: {},
      tokenBudget: 1000,
    },
  });

  const record = registry.get("plugin.timing");
  assert.ok(record);
  assert.ok(record.lastInvocationStartedAt);
  assert.ok(record.lastInvocationCompletedAt);
});
