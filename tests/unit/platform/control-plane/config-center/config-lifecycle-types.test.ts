import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigLifecycleManager,
  type ConfigLifecycleState,
} from "../../../../../src/platform/five-plane-control-plane/config-center/config-lifecycle-types.js";

test("ConfigLifecycleManager createAdmissionLocked creates locked config record", () => {
  const manager = new ConfigLifecycleManager();
  const record = manager.createAdmissionLocked(
    "test.config",
    "platform",
    null,
    "admin",
    "requires approval",
  );

  assert.equal(record.state, "admission_locked");
  assert.equal(record.configPath, "test.config");
  assert.equal(record.layer, "platform");
  assert.ok(record.metadata != null);
});

test("ConfigLifecycleManager approveAdmission transitions to checkpoint_revalidated", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", null, null, null);

  const approved = manager.approveAdmission(
    "test.config",
    "platform",
    null,
    "admin",
    ["condition1"],
  );

  assert.ok(approved != null);
  assert.equal(approved!.state, "checkpoint_revalidated");
  assert.ok(approved!.transitionHistory.length > 0);
});

test("ConfigLifecycleManager approveAdmission returns null for non-existent record", () => {
  const manager = new ConfigLifecycleManager();
  const result = manager.approveAdmission(
    "nonexistent.config",
    "platform",
    null,
    "admin",
    null,
  );
  assert.equal(result, null);
});

test("ConfigLifecycleManager approveAdmission returns null for wrong state", () => {
  const manager = new ConfigLifecycleManager();
  // Create a hot_reloadable config instead
  manager.enableHotReload("test.config", "platform", null);

  const result = manager.approveAdmission(
    "test.config",
    "platform",
    null,
    "admin",
    null,
  );
  assert.equal(result, null);
});

test("ConfigLifecycleManager enableHotReload creates hot_reloadable config", () => {
  const manager = new ConfigLifecycleManager();
  const record = manager.enableHotReload(
    "test.config",
    "platform",
    null,
    "graceful",
  );

  assert.ok(record != null);
  assert.equal(record.state, "hot_reloadable");
  const metadata = record.metadata;
  assert.ok(metadata != null);
});

test("ConfigLifecycleManager enableHotReload can transition existing record", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", null, null, null);

  const record = manager.enableHotReload("test.config", "platform", null);
  assert.equal(record!.state, "hot_reloadable");
});

test("ConfigLifecycleManager activateEmergencyOverride creates emergency override config", () => {
  const manager = new ConfigLifecycleManager();
  const record = manager.activateEmergencyOverride(
    "test.config",
    "platform",
    null,
    "admin",
    { original: "content" },
    "urgent fix needed",
  );

  assert.equal(record.state, "emergency_override");
  assert.ok(record.transitionHistory.length > 0);
});

test("ConfigLifecycleManager deactivateEmergencyOverride returns to previous state", () => {
  const manager = new ConfigLifecycleManager();
  manager.activateEmergencyOverride(
    "test.config",
    "platform",
    null,
    "admin",
    { original: "content" },
    "fix",
  );

  const record = manager.deactivateEmergencyOverride(
    "test.config",
    "platform",
    null,
    "admin",
  );

  assert.ok(record != null);
  // Should transition back to checkpoint_revalidated since originalContent existed
  assert.equal(record!.state, "checkpoint_revalidated");
});

test("ConfigLifecycleManager deactivateEmergencyOverride returns null for non-emergency", () => {
  const manager = new ConfigLifecycleManager();
  const result = manager.deactivateEmergencyOverride(
    "test.config",
    "platform",
    null,
    "admin",
  );
  assert.equal(result, null);
});

test("ConfigLifecycleManager getLifecycleRecord returns record for existing config", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", null, null, null);

  const record = manager.getLifecycleRecord("test.config", "platform", null);
  assert.ok(record != null);
  assert.equal(record!.state, "admission_locked");
});

test("ConfigLifecycleManager getLifecycleRecord returns null for non-existent config", () => {
  const manager = new ConfigLifecycleManager();
  const record = manager.getLifecycleRecord("nonexistent.config", "platform", null);
  assert.equal(record, null);
});

test("ConfigLifecycleManager canUseConfig returns allowed for checkpoint_revalidated", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", null, null, null);
  manager.approveAdmission("test.config", "platform", null, "admin", null);

  const result = manager.canUseConfig("test.config", "platform", null);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, null);
});

test("ConfigLifecycleManager canUseConfig returns not allowed for admission_locked", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", null, null, null);

  const result = manager.canUseConfig("test.config", "platform", null);
  assert.equal(result.allowed, false);
  assert.ok(result.reason != null);
});

test("ConfigLifecycleManager canUseConfig returns allowed for hot_reloadable", () => {
  const manager = new ConfigLifecycleManager();
  manager.enableHotReload("test.config", "platform", null);

  const result = manager.canUseConfig("test.config", "platform", null);
  assert.equal(result.allowed, true);
});

test("ConfigLifecycleManager canUseConfig returns allowed for emergency_override", () => {
  const manager = new ConfigLifecycleManager();
  manager.activateEmergencyOverride(
    "test.config",
    "platform",
    null,
    "admin",
    null,
    "emergency",
  );

  const result = manager.canUseConfig("test.config", "platform", null);
  assert.equal(result.allowed, true);
});

test("ConfigLifecycleManager canUseConfig returns not allowed for expired emergency_override", () => {
  const manager = new ConfigLifecycleManager();
  const past = new Date(Date.now() - 3600000).toISOString();
  manager.activateEmergencyOverride(
    "test.config",
    "platform",
    null,
    "admin",
    null,
    "emergency",
    past,
  );

  const result = manager.canUseConfig("test.config", "platform", null);
  assert.equal(result.allowed, false);
  assert.ok(result.reason != null);
});

test("ConfigLifecycleManager canUseConfig returns allowed for config with no record", () => {
  const manager = new ConfigLifecycleManager();
  const result = manager.canUseConfig("untracked.config", "platform", null);
  assert.equal(result.allowed, true);
});

test("ConfigLifecycleManager approveAdmission stores approval record", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", null, null, null);

  const approved = manager.approveAdmission(
    "test.config",
    "platform",
    null,
    "admin",
    ["condition1", "condition2"],
  );

  const metadata = approved!.metadata;
  assert.ok(metadata != null);
});

test("ConfigLifecycleManager handles sourceId in key construction", () => {
  const manager = new ConfigLifecycleManager();
  manager.createAdmissionLocked("test.config", "platform", "source-123", null, null);

  const record = manager.getLifecycleRecord("test.config", "platform", "source-123");
  assert.ok(record != null);
  assert.equal(record!.sourceId, "source-123");
});

test("ConfigLifecycleManager enableHotReload accepts different strategies", () => {
  const manager = new ConfigLifecycleManager();

  const immediate = manager.enableHotReload("test1.config", "platform", null, "immediate");
  assert.equal(immediate!.state, "hot_reloadable");

  const graceful = manager.enableHotReload("test2.config", "platform", null, "graceful");
  assert.equal(graceful!.state, "hot_reloadable");

  const scheduled = manager.enableHotReload("test3.config", "platform", null, "scheduled");
  assert.equal(scheduled!.state, "hot_reloadable");
});
