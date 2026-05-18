/**
 * Unit tests for HierarchicalConfigLoader
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HierarchicalConfigLoader, type ConfigHierarchyLayer } from "../../../../../src/platform/five-plane-control-plane/config-center/hierarchical-config-loader.js";

test("HierarchicalConfigLoader.loadConfig merges platform config as base", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = {
    timeout: 30000,
    maxRetries: 3,
    logLevel: "info",
  };

  const result = loader.loadConfig(platformConfig);

  assert.equal(result.merged.timeout, 30000);
  assert.equal(result.merged.maxRetries, 3);
  assert.equal(result.merged.logLevel, "info");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0]!.layer, "platform");
  assert.equal(result.layerMap["timeout"], "platform");
});

test("HierarchicalConfigLoader.loadConfig tenant overrides platform", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = { timeout: 30000, logLevel: "info" };
  const tenantConfigs = { "tenant-1": { timeout: 60000, customField: "tenant-value" } };

  const result = loader.loadConfig(
    platformConfig,
    tenantConfigs,
    {},
    {},
    "tenant-1",
  );

  assert.equal(result.merged.timeout, 60000);
  assert.equal(result.merged.logLevel, "info");
  assert.equal(result.merged.customField, "tenant-value");
  assert.equal(result.sources.length, 2);
  assert.equal(result.layerMap["timeout"], "tenant");
  assert.equal(result.layerMap["logLevel"], "platform");
  assert.equal(result.layerMap["customField"], "tenant");
});

test("HierarchicalConfigLoader.loadConfig pack overrides tenant", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = { timeout: 30000, logLevel: "info" };
  const tenantConfigs = { "tenant-1": { timeout: 60000 } };
  const packConfigs = { "pack-1": { timeout: 120000, packField: "pack-value" } };

  const result = loader.loadConfig(
    platformConfig,
    tenantConfigs,
    packConfigs,
    {},
    "tenant-1",
    "pack-1",
  );

  assert.equal(result.merged.timeout, 120000);
  assert.equal(result.merged.packField, "pack-value");
  assert.equal(result.sources.length, 3);
  assert.equal(result.layerMap["timeout"], "pack");
});

test("HierarchicalConfigLoader.loadConfig task_type overrides pack", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = { timeout: 30000, logLevel: "info" };
  const packConfigs = { "pack-1": { timeout: 120000 } };
  const taskTypeConfigs = { "task-type-1": { timeout: 180000, taskTypeField: "task-type-value" } };

  const result = loader.loadConfig(
    platformConfig,
    {},
    packConfigs,
    taskTypeConfigs,
    null,
    "pack-1",
    "task-type-1",
  );

  assert.equal(result.merged.timeout, 180000);
  assert.equal(result.merged.taskTypeField, "task-type-value");
  assert.equal(result.sources.length, 3);
  assert.equal(result.layerMap["timeout"], "task_type");
});

test("HierarchicalConfigLoader.loadConfig deep merges nested objects", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = {
    settings: { timeout: 30000, retries: 3, nested: { a: 1 } },
  };
  const tenantConfigs = {
    "tenant-1": { settings: { timeout: 60000, nested: { b: 2 } } },
  };

  const result = loader.loadConfig(
    platformConfig,
    tenantConfigs,
    {},
    {},
    "tenant-1",
  );

  assert.deepEqual(result.merged.settings, {
    timeout: 60000,
    retries: 3,
    nested: { a: 1, b: 2 },
  });
});

test("HierarchicalConfigLoader.loadConfig returns detached source config snapshots", () => {
  const loader = new HierarchicalConfigLoader();
  const tenantConfig = { nested: { timeout: 1000 } };

  const result = loader.loadConfig({}, { "tenant-1": tenantConfig }, {}, {}, "tenant-1");
  (result.sources[1]!.config.nested as Record<string, unknown>).timeout = 5000;

  assert.equal((tenantConfig.nested as Record<string, unknown>).timeout, 1000);
});

test("HierarchicalConfigLoader.loadConfig without active tenant uses platform only", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = { timeout: 30000 };
  const tenantConfigs = { "tenant-1": { timeout: 60000 } };

  const result = loader.loadConfig(platformConfig, tenantConfigs, {}, {}, null);

  assert.equal(result.merged.timeout, 30000);
  assert.equal(result.sources.length, 1);
});

test("HierarchicalConfigLoader.loadConfig computes version", () => {
  const loader = new HierarchicalConfigLoader();
  const config1 = { a: 1, b: 2 };
  const config2 = { a: 1, b: 3 };

  const result1 = loader.loadConfig(config1);
  const result2 = loader.loadConfig(config2);

  assert.notEqual(result1.version, result2.version);
  assert.equal(result1.version.length, 64);
  assert.equal(result2.version.length, 64);
});

test("HierarchicalConfigLoader.loadConfig computes stable SHA-256 version regardless of object key order", () => {
  const loader = new HierarchicalConfigLoader();
  const config1 = { a: 1, nested: { x: 1, y: 2 } };
  const config2 = { nested: { y: 2, x: 1 }, a: 1 };

  const result1 = loader.loadConfig(config1);
  const result2 = loader.loadConfig(config2);

  assert.equal(result1.version, result2.version);
});

test("HierarchicalConfigLoader.emitConfigChange does not throw without eventBus", () => {
  const loader = new HierarchicalConfigLoader({ emitChangeEvents: false });
  const oldConfig = { timeout: 30000 };
  const newConfig = { timeout: 60000 };

  // Should not throw
  loader.emitConfigChange("tenant", "tenant-1", oldConfig, newConfig);
  assert.ok(true);
});

test("HierarchicalConfigLoader.loadConfig returns layerMap with correct layer per key", () => {
  const loader = new HierarchicalConfigLoader();
  const platformConfig = { platformKey: 1 };
  const tenantConfigs = { "tenant-1": { tenantKey: 2 } };
  const packConfigs = { "pack-1": { packKey: 3 } };
  const taskTypeConfigs = { "task-type-1": { taskTypeKey: 4 } };

  const result = loader.loadConfig(
    platformConfig,
    tenantConfigs,
    packConfigs,
    taskTypeConfigs,
    "tenant-1",
    "pack-1",
    "task-type-1",
  );

  assert.equal(result.layerMap["platformKey"], "platform");
  assert.equal(result.layerMap["tenantKey"], "tenant");
  assert.equal(result.layerMap["packKey"], "pack");
  assert.equal(result.layerMap["taskTypeKey"], "task_type");
});
