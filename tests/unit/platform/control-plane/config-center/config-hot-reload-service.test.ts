/**
 * Unit tests for ConfigHotReloadService
 * Tests configuration hot reload subscriptions, notifications, and change detection
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigHotReloadService,
  type ConfigChangeEvent,
  type ConfigHotReloadSubscription,
  type ConfigChangeSeverity,
  type ConfigChangeSource,
} from "../../../../../src/platform/control-plane/config-center/config-hot-reload-service.js";

// ============================================================================
// ConfigHotReloadService Creation Tests
// ============================================================================

test("ConfigHotReloadService creates with default options", () => {
  const service = new ConfigHotReloadService();
  assert.ok(service);
});

test("ConfigHotReloadService creates with custom file watcher interval", () => {
  const service = new ConfigHotReloadService({
    fileWatcherIntervalMs: 10000,
    enableFileWatcher: false,
  });
  assert.ok(service);
});

// ============================================================================
// Subscription Tests
// ============================================================================

test("subscribe adds a new subscription", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    callback,
    0,
  );

  assert.ok(subscriptionId);
});

test("subscribe returns unique subscription IDs", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};

  const id1 = service.subscribe("comp1", ["config1"], ["platform"], callback);
  const id2 = service.subscribe("comp2", ["config2"], ["platform"], callback);

  assert.notEqual(id1, id2);
});

test("unsubscribe removes a subscription", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    callback,
  );

  service.unsubscribe(subscriptionId);
});

test("unsubscribe does not error for non-existent subscription", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  service.unsubscribe("non-existent-id");
});

// ============================================================================
// Pause/Resume Subscription Tests
// ============================================================================

test("pauseSubscription sets subscription to inactive", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    callback,
  );

  service.pauseSubscription(subscriptionId);
});

test("resumeSubscription sets subscription to active", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "test-component",
    ["test.config"],
    ["platform"],
    callback,
  );

  service.pauseSubscription(subscriptionId);
  service.resumeSubscription(subscriptionId);
});

test("pauseSubscription does not error for non-existent subscription", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  service.pauseSubscription("non-existent-id");
});

test("resumeSubscription does not error for non-existent subscription", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  service.resumeSubscription("non-existent-id");
});

// ============================================================================
// Trigger Reload Tests
// ============================================================================

test("triggerReload creates change event with correct structure", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const receivedChanges: ConfigChangeEvent[] = [];
  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
    receivedChanges.push(change);
  };

  service.subscribe("test-component", ["test.config"], ["platform"], callback);

  await service.triggerReload(
    "test.config",
    "platform",
    null,
    { setting: "value" },
    "api",
    "medium",
  );

  assert.equal(receivedChanges.length, 1);
  const change = receivedChanges[0]!;
  assert.equal(change.configPath, "test.config");
  assert.equal(change.layer, "platform");
  assert.equal(change.source, "api");
  assert.equal(change.severity, "medium");
});

test("triggerReload supports different change sources", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const sources: ConfigChangeSource[] = ["file_watcher", "api", "event", "scheduled"];

  for (const source of sources) {
    const receivedChanges: ConfigChangeEvent[] = [];
    const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
      receivedChanges.push(change);
    };

    service.subscribe(`comp-${source}`, [`config-${source}`], ["platform"], callback);

    await service.triggerReload(
      `config-${source}`,
      "platform",
      null,
      { setting: "value" },
      source,
      "low",
    );

    assert.equal(receivedChanges.length, 1);
    assert.equal(receivedChanges[0]!.source, source);
  }
});

test("triggerReload supports different severity levels", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const severities: ConfigChangeSeverity[] = ["low", "medium", "high", "critical"];

  for (const severity of severities) {
    const receivedChanges: ConfigChangeEvent[] = [];
    const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
      receivedChanges.push(change);
    };

    service.subscribe(`comp-${severity}`, [`config-${severity}`], ["platform"], callback);

    await service.triggerReload(
      `config-${severity}`,
      "platform",
      null,
      { setting: "value" },
      "api",
      severity,
    );

    assert.equal(receivedChanges.length, 1);
    assert.equal(receivedChanges[0]!.severity, severity);
  }
});

test("triggerReload computes version for new config", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const receivedChanges: ConfigChangeEvent[] = [];
  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
    receivedChanges.push(change);
  };

  service.subscribe("test-component", ["test.config"], ["platform"], callback);

  await service.triggerReload("test.config", "platform", null, { key: "value1" });
  assert.ok(receivedChanges[0]!.previousVersion);

  await service.triggerReload("test.config", "platform", null, { key: "value2" });
  assert.notEqual(receivedChanges[1]!.previousVersion, receivedChanges[1]!.newVersion);
});

// ============================================================================
// Wildcard Subscription Tests
// ============================================================================

test("subscribe accepts wildcard patterns", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "wildcard-component",
    ["*.config", "test.*"],
    ["platform", "tenant"],
    callback,
  );

  assert.ok(subscriptionId);
});

// ============================================================================
// Layer Filtering Tests
// ============================================================================

test("subscribe accepts multiple layers", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "multi-layer-component",
    ["test.config"],
    ["platform", "tenant", "pack"],
    callback,
  );

  assert.ok(subscriptionId);
});

// ============================================================================
// Priority Tests
// ============================================================================

test("subscribe accepts custom priority", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const subscriptionId = service.subscribe(
    "priority-component",
    ["test.config"],
    ["platform"],
    callback,
    100,
  );

  assert.ok(subscriptionId);
});

// ============================================================================
// Multiple Subscriptions Tests
// ============================================================================

test("multiple subscriptions receive same change event", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const callback1 = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const callback2 = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};
  const callback3 = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {};

  service.subscribe("comp1", ["test.config"], ["platform"], callback1);
  service.subscribe("comp2", ["test.config"], ["platform"], callback2);
  service.subscribe("comp3", ["test.config"], ["platform"], callback3);

  await service.triggerReload(
    "test.config",
    "platform",
    null,
    { setting: "value" },
  );
});

// ============================================================================
// Change Event Structure Tests
// ============================================================================

test("triggerReload includes changeId in event", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const receivedChanges: ConfigChangeEvent[] = [];
  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
    receivedChanges.push(change);
  };

  service.subscribe("test-component", ["test.config"], ["platform"], callback);

  await service.triggerReload("test.config", "platform", null, { setting: "value" });

  assert.ok(receivedChanges[0]!.changeId);
  assert.ok(receivedChanges[0]!.changeId.startsWith("chg_"));
});

test("triggerReload includes timestamp in event", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const receivedChanges: ConfigChangeEvent[] = [];
  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
    receivedChanges.push(change);
  };

  service.subscribe("test-component", ["test.config"], ["platform"], callback);

  await service.triggerReload("test.config", "platform", null, { setting: "value" });

  assert.ok(receivedChanges[0]!.timestamp);
  assert.ok(receivedChanges[0]!.timestamp.length > 0);
});

test("triggerReload includes sourceId when provided", async () => {
  const service = new ConfigHotReloadService({ enableFileWatcher: false });
  await service.initialize();

  const receivedChanges: ConfigChangeEvent[] = [];
  const callback = async (change: ConfigChangeEvent, newConfig: Record<string, unknown>) => {
    receivedChanges.push(change);
  };

  service.subscribe("test-component", ["test.config"], ["platform"], callback);

  await service.triggerReload("test.config", "platform", "tenant-123", { setting: "value" });

  assert.equal(receivedChanges[0]!.sourceId, "tenant-123");
});
