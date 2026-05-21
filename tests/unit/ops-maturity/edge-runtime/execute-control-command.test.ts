/**
 * Unit tests for EdgeRuntimeSyncService.executeControlCommand
 *
 * @see src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EdgeRuntimeSyncService,
  type EdgeRuntimeProfile,
  type EdgeControlCommand,
} from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

describe("EdgeRuntimeSyncService.executeControlCommand", () => {
  const defaultProfile: EdgeRuntimeProfile = {
    edgeNodeId: "node-001",
    deviceId: "device-001",
    capabilities: ["offline-execution"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    allowedModels: ["model-a"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
  };

  function createCommand(overrides: Partial<EdgeControlCommand> = {}): EdgeControlCommand {
    return {
      commandId: "cmd-001",
      edgeNodeId: "node-001",
      action: "edge_quarantine",
      reason: "Test quarantine",
      requestedBy: "admin@example.com",
      requestedAt: "2026-04-20T00:00:00.000Z",
      ...overrides,
    };
  }

  test("executes edge_quarantine command successfully", () => {
    const service = new EdgeRuntimeSyncService();
    const command = createCommand({ action: "edge_quarantine" });

    const receipt = service.executeControlCommand(defaultProfile, command);

    assert.equal(receipt.commandId, "cmd-001");
    assert.equal(receipt.edgeNodeId, "node-001");
    assert.equal(receipt.action, "edge_quarantine");
    assert.equal(receipt.status, "executed");
    assert.ok(receipt.executedAt);
  });

  test("executes remote_wipe command successfully", () => {
    const service = new EdgeRuntimeSyncService();
    const command = createCommand({ action: "remote_wipe" });

    const receipt = service.executeControlCommand(defaultProfile, command);

    assert.equal(receipt.commandId, "cmd-001");
    assert.equal(receipt.action, "remote_wipe");
    assert.equal(receipt.status, "executed");
  });

  test("sets connectivityMode to offline for edge_quarantine", () => {
    const service = new EdgeRuntimeSyncService();
    const profile = { ...defaultProfile, connectivityMode: "online" as const };
    const command = createCommand({ action: "edge_quarantine" });

    const receipt = service.executeControlCommand(profile, command);

    assert.equal(receipt.resultingConnectivityMode, "offline");
  });

  test("preserves original connectivityMode for remote_wipe", () => {
    const service = new EdgeRuntimeSyncService();
    const profile = { ...defaultProfile, connectivityMode: "online" as const };
    const command = createCommand({ action: "remote_wipe" });

    const receipt = service.executeControlCommand(profile, command);

    assert.equal(receipt.resultingConnectivityMode, "online");
  });

  test("preserves original connectivityMode for intermittent profile with remote_wipe", () => {
    const service = new EdgeRuntimeSyncService();
    const profile = { ...defaultProfile, connectivityMode: "intermittent" as const };
    const command = createCommand({ action: "remote_wipe" });

    const receipt = service.executeControlCommand(profile, command);

    assert.equal(receipt.resultingConnectivityMode, "intermittent");
  });

  test("uses custom executedAt timestamp when provided", () => {
    const service = new EdgeRuntimeSyncService();
    const command = createCommand();
    const customExecutedAt = "2026-05-01T12:00:00.000Z";

    const receipt = service.executeControlCommand(defaultProfile, command, customExecutedAt);

    assert.equal(receipt.executedAt, customExecutedAt);
  });

  test("throws error when edgeNodeId does not match profile", () => {
    const service = new EdgeRuntimeSyncService();
    const command = createCommand({ edgeNodeId: "different-node" });

    assert.throws(
      () => service.executeControlCommand(defaultProfile, command),
      /control_command_node_mismatch/,
    );
  });

  test("handles offline connectivity profile with remote_wipe", () => {
    const service = new EdgeRuntimeSyncService();
    const profile = { ...defaultProfile, connectivityMode: "offline" as const };
    const command = createCommand({ action: "remote_wipe" });

    const receipt = service.executeControlCommand(profile, command);

    assert.equal(receipt.resultingConnectivityMode, "offline");
  });

  test("receipt includes all command fields", () => {
    const service = new EdgeRuntimeSyncService();
    const command = createCommand({
      commandId: "cmd-special",
      requestedBy: "system@admin",
    });

    const receipt = service.executeControlCommand(defaultProfile, command);

    assert.equal(receipt.commandId, "cmd-special");
    assert.equal(receipt.edgeNodeId, "node-001");
  });
});