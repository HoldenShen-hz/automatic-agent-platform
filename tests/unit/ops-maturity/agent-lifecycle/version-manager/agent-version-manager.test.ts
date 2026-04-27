/**
 * Unit tests for AgentVersionManager
 *
 * @see src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentVersionManager,
  type AgentVersionDetail,
  type DeploymentSlot,
} from "../../../../../src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.js";

function makeVersion(overrides: Partial<Omit<AgentVersionDetail, "versionId" | "createdAt">> = {}): Omit<AgentVersionDetail, "versionId" | "createdAt"> {
  return {
    agentId: "agent_test",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: { totalExecutions: 0, successRate: 0, avgDurationMs: 0 },
    ...overrides,
  };
}

test("AgentVersionManager.registerVersion creates version with newId and nowIso", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  assert.ok(version.versionId.startsWith("agentver_"));
  assert.ok(version.createdAt.length > 0);
  assert.equal(version.version, "1.0.0");
});

test("AgentVersionManager.registerVersion stores multiple versions per agent", () => {
  const manager = new AgentVersionManager();
  manager.registerVersion(makeVersion({ version: "1.0.0" }));
  manager.registerVersion(makeVersion({ version: "2.0.0" }));
  manager.registerVersion(makeVersion({ version: "3.0.0" }));

  const versions = manager.listVersions("agent_test");
  assert.equal(versions.length, 3);
});

test("AgentVersionManager.listVersions returns newest first", () => {
  const manager = new AgentVersionManager();
  manager.registerVersion(makeVersion({ version: "1.0.0", createdAt: "2024-01-01T00:00:00.000Z" }));
  manager.registerVersion(makeVersion({ version: "2.0.0", createdAt: "2024-01-02T00:00:00.000Z" }));
  manager.registerVersion(makeVersion({ version: "3.0.0", createdAt: "2024-01-03T00:00:00.000Z" }));

  const versions = manager.listVersions("agent_test");
  assert.equal(versions[0]!.version, "3.0.0");
  assert.equal(versions[1]!.version, "2.0.0");
  assert.equal(versions[2]!.version, "1.0.0");
});

test("AgentVersionManager.assignDeploymentSlot assigns to blue slot", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  manager.assignDeploymentSlot("agent_test", version.versionId, "blue");

  const active = manager.getActiveSlot("agent_test", "blue");
  assert.ok(active !== null);
  assert.equal(active!.versionId, version.versionId);
});

test("AgentVersionManager.assignDeploymentSlot assigns to green slot", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  manager.assignDeploymentSlot("agent_test", version.versionId, "green");

  const active = manager.getActiveSlot("agent_test", "green");
  assert.ok(active !== null);
  assert.equal(active!.versionId, version.versionId);
});

test("AgentVersionManager.assignDeploymentSlot blue revokes existing green", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0" }));

  manager.assignDeploymentSlot("agent_test", v1.versionId, "green");
  manager.assignDeploymentSlot("agent_test", v2.versionId, "blue");

  const green = manager.getActiveSlot("agent_test", "green");
  assert.equal(green, null);
});

test("AgentVersionManager.assignDeploymentSlot green revokes existing blue", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0" }));

  manager.assignDeploymentSlot("agent_test", v1.versionId, "blue");
  manager.assignDeploymentSlot("agent_test", v2.versionId, "green");

  const blue = manager.getActiveSlot("agent_test", "blue");
  assert.equal(blue, null);
});

test("AgentVersionManager.getActiveSlot returns null for empty slot", () => {
  const manager = new AgentVersionManager();
  const active = manager.getActiveSlot("agent_nonexistent", "blue");
  assert.equal(active, null);
});

test("AgentVersionManager.switchSlot promotes unslotted version to target slot", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0", deploymentSlot: "blue" }));
  const v2 = manager.registerVersion(makeVersion({ version: "2.0.0", deploymentSlot: null, stage: "canary" }));

  const switched = manager.switchSlot("agent_test", "green");

  assert.ok(switched !== null);
  assert.equal(switched!.versionId, v2.versionId);
  assert.equal(switched!.deploymentSlot, "green");
});

test("AgentVersionManager.switchSlot returns current version when no unslotted available", () => {
  const manager = new AgentVersionManager();
  const v1 = manager.registerVersion(makeVersion({ version: "1.0.0", deploymentSlot: "blue" }));

  const switched = manager.switchSlot("agent_test", "green");

  assert.ok(switched !== null);
  assert.equal(switched!.versionId, v1.versionId);
});

test("AgentVersionManager.deprecateVersion sets deprecatedAt timestamp", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  const result = manager.deprecateVersion("agent_test", version.versionId);

  assert.equal(result, true);
  const retrieved = manager.listVersions("agent_test")[0]!;
  assert.ok(retrieved.deprecatedAt !== null);
});

test("AgentVersionManager.deprecateVersion returns false for unknown agent", () => {
  const manager = new AgentVersionManager();
  const result = manager.deprecateVersion("nonexistent", "any_version");
  assert.equal(result, false);
});

test("AgentVersionManager.deprecateVersion returns false for unknown version", () => {
  const manager = new AgentVersionManager();
  manager.registerVersion(makeVersion());

  const result = manager.deprecateVersion("agent_test", "unknown_version_id");
  assert.equal(result, false);
});

test("AgentVersionManager.getStableVersions filters stable versions", () => {
  const manager = new AgentVersionManager();
  manager.registerVersion(makeVersion({ version: "1.0.0", stable: false }));
  manager.registerVersion(makeVersion({ version: "2.0.0", stable: true }));
  manager.registerVersion(makeVersion({ version: "3.0.0", stable: true }));

  const stable = manager.getStableVersions("agent_test");
  assert.equal(stable.length, 2);
  assert.ok(stable.every((v) => v.stable === true));
});

test("AgentVersionManager.updateMetrics updates metrics fields", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion(makeVersion({ version: "1.0.0" }));

  manager.updateMetrics("agent_test", version.versionId, {
    totalExecutions: 100,
    successRate: 0.95,
    avgDurationMs: 250,
  });

  const updated = manager.listVersions("agent_test")[0]!;
  assert.equal(updated.metrics.totalExecutions, 100);
  assert.equal(updated.metrics.successRate, 0.95);
  assert.equal(updated.metrics.avgDurationMs, 250);
});

test("AgentVersionManager.updateMetrics handles partial updates", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion(makeVersion({
    version: "1.0.0",
    metrics: { totalExecutions: 50, successRate: 0.8, avgDurationMs: 100 },
  }));

  manager.updateMetrics("agent_test", version.versionId, { totalExecutions: 100 });

  const updated = manager.listVersions("agent_test")[0]!;
  assert.equal(updated.metrics.totalExecutions, 100);
  assert.equal(updated.metrics.successRate, 0.8);
  assert.equal(updated.metrics.avgDurationMs, 100);
});

test("AgentVersionManager.updateMetrics handles unknown agent gracefully", () => {
  const manager = new AgentVersionManager();
  manager.updateMetrics("nonexistent", "any_id", { totalExecutions: 10 });
  // No throw
});

test("AgentVersionManager.registerVersion applies default values", () => {
  const manager = new AgentVersionManager();
  const version = manager.registerVersion({
    agentId: "agent_test",
    version: "1.0.0",
  });

  assert.equal(version.stage, "alpha");
  assert.equal(version.deprecatedAt, null);
  assert.equal(version.stable, false);
  assert.equal(version.deploymentSlot, null);
  assert.equal(version.changelog, "");
});

test("AgentVersionManager.listVersions returns empty array for unknown agent", () => {
  const manager = new AgentVersionManager();
  const versions = manager.listVersions("nonexistent");
  assert.deepEqual(versions, []);
});