/**
 * Unit tests for ConfigLifecycleManager
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ConfigLifecycleManager } from "../../../../../src/platform/control-plane/config-center/config-lifecycle-types.js";

test("ConfigLifecycleManager.createAdmissionLocked creates locked record", () => {
  const manager = new ConfigLifecycleManager();

  const record = manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");

  assert.strictEqual(record.state, "admission_locked");
  assert.strictEqual(record.configPath, "runtime.config");
  assert.strictEqual(record.layer, "platform");
  assert.ok(record.metadata && "lockedAt" in record.metadata);
});

test("ConfigLifecycleManager.createAdmissionLocked blocks config usage", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");

  const result = manager.canUseConfig("runtime.config", "platform", null);

  assert.ok(!result.allowed);
  assert.ok(result.reason?.includes("admission-locked"));
});

test("ConfigLifecycleManager.approveAdmission transitions to checkpoint_revalidated", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");
  const approved = manager.approveAdmission("runtime.config", "platform", null, "admin-1", ["condition1"]);

  assert.ok(approved);
  assert.strictEqual(approved!.state, "checkpoint_revalidated");
  assert.ok(approved!.metadata && "checkpointId" in approved!.metadata);
});

test("ConfigLifecycleManager.approveAdmission unblocks config usage", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");
  manager.approveAdmission("runtime.config", "platform", null, "admin-1", null);

  const result = manager.canUseConfig("runtime.config", "platform", null);

  assert.ok(result.allowed);
  assert.strictEqual(result.reason, null);
});

test("ConfigLifecycleManager.approveAdmission returns null if not in admission_locked state", () => {
  const manager = new ConfigLifecycleManager();

  // Create directly as checkpoint_revalidated
  manager.enableHotReload("runtime.config", "platform", null, "graceful");
  const result = manager.approveAdmission("runtime.config", "platform", null, "admin-1", null);

  assert.strictEqual(result, null);
});

test("ConfigLifecycleManager.enableHotReload creates hot_reloadable record", () => {
  const manager = new ConfigLifecycleManager();

  const record = manager.enableHotReload("runtime.config", "platform", null, "immediate");

  assert.ok(record);
  assert.strictEqual(record.state, "hot_reloadable");
  assert.ok(record.metadata && "reloadEnabled" in record.metadata);
  const metadata = record.metadata as { reloadStrategy: string };
  assert.strictEqual(metadata.reloadStrategy, "immediate");
});

test("ConfigLifecycleManager.enableHotReload transitions existing record", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");
  const record = manager.enableHotReload("runtime.config", "platform", null, "graceful");

  assert.strictEqual(record.state, "hot_reloadable");
  assert.ok(record.transitionHistory.length > 0);
});

test("ConfigLifecycleManager.enableHotReload allows config usage", () => {
  const manager = new ConfigLifecycleManager();

  manager.enableHotReload("runtime.config", "platform", null, "graceful");

  const result = manager.canUseConfig("runtime.config", "platform", null);

  assert.ok(result.allowed);
});

test("ConfigLifecycleManager.activateEmergencyOverride creates emergency record", () => {
  const manager = new ConfigLifecycleManager();

  const record = manager.activateEmergencyOverride(
    "runtime.config",
    "platform",
    null,
    "admin-1",
    { timeout: 5000 },
    "Critical fix needed",
  );

  assert.strictEqual(record.state, "emergency_override");
  assert.ok(record.metadata && "activatedAt" in record.metadata);
  const metadata = record.metadata as { reason: string | null };
  assert.strictEqual(metadata.reason, "Critical fix needed");
});

test("ConfigLifecycleManager.activateEmergencyOverride stores original content", () => {
  const manager = new ConfigLifecycleManager();
  const originalContent = { timeout: 5000, maxRetries: 3 };

  const record = manager.activateEmergencyOverride(
    "runtime.config",
    "platform",
    null,
    "admin-1",
    originalContent,
    "Emergency",
  );

  const metadata = record.metadata as { originalContent: Record<string, unknown> | null };
  assert.deepStrictEqual(metadata.originalContent, originalContent);
});

test("ConfigLifecycleManager.activateEmergencyOverride allows config usage", () => {
  const manager = new ConfigLifecycleManager();

  manager.activateEmergencyOverride("runtime.config", "platform", null, "admin-1", null, "Emergency");

  const result = manager.canUseConfig("runtime.config", "platform", null);

  assert.ok(result.allowed);
  assert.ok(result.reason?.includes("Emergency override"));
});

test("ConfigLifecycleManager.activateEmergencyOverride with expiration blocks after expiry", () => {
  const manager = new ConfigLifecycleManager();

  const pastTime = new Date(Date.now() - 1000).toISOString();
  manager.activateEmergencyOverride("runtime.config", "platform", null, "admin-1", null, "Emergency", pastTime);

  const result = manager.canUseConfig("runtime.config", "platform", null);

  assert.ok(!result.allowed);
  assert.ok(result.reason?.includes("expired"));
});

test("ConfigLifecycleManager.deactivateEmergencyOverride returns to previous state", () => {
  const manager = new ConfigLifecycleManager();

  manager.activateEmergencyOverride("runtime.config", "platform", null, "admin-1", { timeout: 5000 }, "Emergency");
  const deactivated = manager.deactivateEmergencyOverride("runtime.config", "platform", null, "admin-1");

  assert.ok(deactivated);
  // Should transition back to checkpoint_revalidated since originalContent existed
  assert.strictEqual(deactivated!.state, "checkpoint_revalidated");
});

test("ConfigLifecycleManager.deactivateEmergencyOverride records transition history", () => {
  const manager = new ConfigLifecycleManager();

  manager.activateEmergencyOverride("runtime.config", "platform", null, "admin-1", { timeout: 5000 }, "Emergency");
  const deactivated = manager.deactivateEmergencyOverride("runtime.config", "platform", null, "admin-1");

  assert.ok(deactivated!.transitionHistory.length >= 2); // activation + deactivation
});

test("ConfigLifecycleManager.deactivateEmergencyOverride returns null if not in emergency state", () => {
  const manager = new ConfigLifecycleManager();

  manager.enableHotReload("runtime.config", "platform", null, "graceful");
  const result = manager.deactivateEmergencyOverride("runtime.config", "platform", null, "admin-1");

  assert.strictEqual(result, null);
});

test("ConfigLifecycleManager.getLifecycleRecord returns record for existing config", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");
  const record = manager.getLifecycleRecord("runtime.config", "platform", null);

  assert.ok(record);
  assert.strictEqual(record!.state, "admission_locked");
});

test("ConfigLifecycleManager.getLifecycleRecord returns null for non-existent config", () => {
  const manager = new ConfigLifecycleManager();

  const record = manager.getLifecycleRecord("non.existent", "platform", null);

  assert.strictEqual(record, null);
});

test("ConfigLifecycleManager.canUseConfig allows configs without any record", () => {
  const manager = new ConfigLifecycleManager();

  const result = manager.canUseConfig("unmanaged.config", "platform", null);

  assert.ok(result.allowed);
  assert.strictEqual(result.reason, null);
});

test("ConfigLifecycleManager handles different layers separately", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Platform lock");
  manager.createAdmissionLocked("runtime.config", "tenant", "tenant-1", "user-1", "Tenant lock");

  const platformResult = manager.canUseConfig("runtime.config", "platform", null);
  const tenantResult = manager.canUseConfig("runtime.config", "tenant", "tenant-1");

  assert.ok(!platformResult.allowed);
  assert.ok(!tenantResult.allowed);
});

test("ConfigLifecycleManager handles sourceId correctly", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "tenant", "tenant-1", "user-1", "Lock 1");
  manager.createAdmissionLocked("runtime.config", "tenant", "tenant-2", "user-1", "Lock 2");

  const record1 = manager.getLifecycleRecord("runtime.config", "tenant", "tenant-1");
  const record2 = manager.getLifecycleRecord("runtime.config", "tenant", "tenant-2");

  assert.ok(record1);
  assert.ok(record2);
  assert.strictEqual((record1!.metadata as { reason: string | null }).reason, "Lock 1");
  assert.strictEqual((record2!.metadata as { reason: string | null }).reason, "Lock 2");
});

test("ConfigLifecycleManager.enableHotReload defaults to graceful strategy", () => {
  const manager = new ConfigLifecycleManager();

  const record = manager.enableHotReload("runtime.config", "platform", null);

  const metadata = record!.metadata as { reloadStrategy: string };
  assert.strictEqual(metadata.reloadStrategy, "graceful");
});

test("ConfigLifecycleManager.approveAdmission includes conditions in metadata", () => {
  const manager = new ConfigLifecycleManager();

  manager.createAdmissionLocked("runtime.config", "platform", null, "user-1", "Requires review");
  const record = manager.approveAdmission("runtime.config", "platform", null, "admin-1", ["check1", "check2"]);

  const metadata = record!.metadata as { validationDetails: string | null };
  assert.ok(metadata.validationDetails?.includes("check1"));
  assert.ok(metadata.validationDetails?.includes("check2"));
});