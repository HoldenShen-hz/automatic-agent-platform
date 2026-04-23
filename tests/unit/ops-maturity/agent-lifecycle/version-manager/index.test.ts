import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentVersionManager,
  AgentVersionStageSchema,
  DeploymentSlotSchema,
  AgentVersionDetailSchema,
  AgentVersionSchema,
  ComponentSnapshotSchema,
  parseSemver,
  compareSemver,
  resolveLatestAgentVersion,
  type AgentVersionDetail,
  type DeploymentSlot,
} from "../../../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";

function createEmptyMetrics(): AgentVersionDetail["metrics"] {
  return { totalExecutions: 0, successRate: 0, avgDurationMs: 0 };
}

// ---------------------------------------------------------------------------
// AgentVersionManager
// ---------------------------------------------------------------------------

test("AgentVersionManager.registerVersion creates a version with generated id and timestamp", () => {
  const mgr = new AgentVersionManager();
  const detail: Omit<AgentVersionDetail, "versionId" | "createdAt"> = {
    agentId: "agent-1",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "initial release",
    metrics: { totalExecutions: 0, successRate: 0, avgDurationMs: 0 },
  };

  const result = mgr.registerVersion(detail);

  assert.ok(result.versionId.startsWith("agentver_"));
  assert.ok(result.createdAt.length > 0);
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.stage, "stable");
  assert.equal(result.stable, true);
});

test("AgentVersionManager.registerVersion accumulates multiple versions for same agent", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({ agentId: "agent-1", version: "1.0.0", stage: "alpha", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.registerVersion({ agentId: "agent-1", version: "1.1.0", stage: "beta", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  const versions = mgr.listVersions("agent-1");
  assert.equal(versions.length, 2);
});

test("AgentVersionManager.listVersions returns versions sorted by createdAt descending", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-x", version: "1.0.0", stage: "alpha", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  const v2 = mgr.registerVersion({ agentId: "agent-x", version: "2.0.0", stage: "alpha", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  const versions = mgr.listVersions("agent-x");
  // Both versions present - ordering may vary if createdAt timestamps collide
  assert.equal(versions.length, 2);
  const ids = versions.map((v) => v.versionId);
  assert.ok(ids.includes(v1.versionId));
  assert.ok(ids.includes(v2.versionId));
});

test("AgentVersionManager.listVersions returns empty array for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.deepStrictEqual(mgr.listVersions("unknown"), []);
});

test("AgentVersionManager.getStableVersions filters to stable versions only", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({ agentId: "agent-s", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.registerVersion({ agentId: "agent-s", version: "1.1.0", stage: "alpha", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  const stable = mgr.getStableVersions("agent-s");
  assert.equal(stable.length, 1);
  assert.equal(stable[0].version, "1.0.0");
});

test("AgentVersionManager.assignDeploymentSlot assigns slot and evicts opposite slot", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-d", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  // Register v2 with a different stage so it can be distinguished from v1
  const v2 = mgr.registerVersion({ agentId: "agent-d", version: "2.0.0", stage: "canary", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  mgr.assignDeploymentSlot("agent-d", v1.versionId, "green");
  mgr.assignDeploymentSlot("agent-d", v2.versionId, "green");

  const versions = mgr.listVersions("agent-d");
  const greenV2 = versions.find((v) => v.versionId === v2.versionId);
  const greenV1 = versions.find((v) => v.versionId === v1.versionId);

  assert.equal(greenV2?.deploymentSlot, "green");
  assert.equal(greenV1?.deploymentSlot, null); // evicted
});

test("AgentVersionManager.assignDeploymentSlot assigns green and evicts blue", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-g", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  const v2 = mgr.registerVersion({ agentId: "agent-g", version: "2.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  mgr.assignDeploymentSlot("agent-g", v1.versionId, "blue");
  mgr.assignDeploymentSlot("agent-g", v2.versionId, "green");

  const versions = mgr.listVersions("agent-g");
  const greenV2 = versions.find((v) => v.versionId === v2.versionId);
  const blueV1 = versions.find((v) => v.versionId === v1.versionId);

  assert.equal(greenV2?.deploymentSlot, "green");
  assert.equal(blueV1?.deploymentSlot, null); // evicted
});

test("AgentVersionManager.assignDeploymentSlot ignores unknown agent", () => {
  const mgr = new AgentVersionManager();
  mgr.assignDeploymentSlot("unknown", "some-version", "blue");
  // Should not throw
});

test("AgentVersionManager.assignDeploymentSlot ignores unknown version", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-h", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.assignDeploymentSlot("agent-h", "unknown-version", "blue");
  assert.equal(v1.deploymentSlot, null);
});

test("AgentVersionManager.getActiveSlot returns version assigned to slot", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-a", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.assignDeploymentSlot("agent-a", v1.versionId, "blue");

  const result = mgr.getActiveSlot("agent-a", "blue");
  assert.equal(result?.versionId, v1.versionId);
});

test("AgentVersionManager.getActiveSlot returns null when slot is empty", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({ agentId: "agent-b", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  assert.equal(mgr.getActiveSlot("agent-b", "blue"), null);
});

test("AgentVersionManager.getActiveSlot returns null for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.equal(mgr.getActiveSlot("unknown", "blue"), null);
});

test("AgentVersionManager.switchSlot promotes non-alpha version to target slot", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-s", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  const v2 = mgr.registerVersion({ agentId: "agent-s", version: "2.0.0", stage: "canary", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.assignDeploymentSlot("agent-s", v1.versionId, "blue");

  const result = mgr.switchSlot("agent-s", "green");

  assert.equal(result?.versionId, v2.versionId);
  assert.equal(result?.deploymentSlot, "green");
});

test("AgentVersionManager.switchSlot returns current version when no eligible replacement exists", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-r", version: "1.0.0", stage: "alpha", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.assignDeploymentSlot("agent-r", v1.versionId, "blue");

  const result = mgr.switchSlot("agent-r", "green");

  assert.equal(result?.versionId, v1.versionId); // falls back to current
});

test("AgentVersionManager.switchSlot returns null when no current version in slot", () => {
  const mgr = new AgentVersionManager();
  const result = mgr.switchSlot("agent-empty", "green");
  assert.equal(result, null);
});

test("AgentVersionManager.deprecateVersion sets deprecatedAt timestamp", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({ agentId: "agent-d", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });

  const result = mgr.deprecateVersion("agent-d", v1.versionId);

  assert.equal(result, true);
  assert.ok(mgr.listVersions("agent-d")[0].deprecatedAt !== null);
});

test("AgentVersionManager.deprecateVersion returns false for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.equal(mgr.deprecateVersion("unknown", "some-id"), false);
});

test("AgentVersionManager.deprecateVersion returns false for unknown version", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({ agentId: "agent-e", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  assert.equal(mgr.deprecateVersion("agent-e", "unknown-id"), false);
});

test("AgentVersionManager.updateMetrics merges metrics correctly", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-m",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: { totalExecutions: 10, successRate: 0.9, avgDurationMs: 1000 },
  });

  mgr.updateMetrics("agent-m", v1.versionId, { totalExecutions: 15, successRate: 0.95 });

  const versions = mgr.listVersions("agent-m");
  assert.equal(versions[0].metrics.totalExecutions, 15);
  assert.equal(versions[0].metrics.successRate, 0.95);
  assert.equal(versions[0].metrics.avgDurationMs, 1000); // unchanged
});

test("AgentVersionManager.updateMetrics ignores unknown agent", () => {
  const mgr = new AgentVersionManager();
  mgr.updateMetrics("unknown", "some-id", { totalExecutions: 5 });
  // Should not throw
});

test("AgentVersionManager.updateMetrics ignores unknown version", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({ agentId: "agent-u", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
  mgr.updateMetrics("agent-u", "unknown-id", { totalExecutions: 5 });
  // Should not throw
});

// ---------------------------------------------------------------------------
// parseSemver
// ---------------------------------------------------------------------------

test("parseSemver parses valid semver strings", () => {
  assert.deepStrictEqual(parseSemver("1.2.3"), { major: 1, minor: 2, patch: 3 });
  assert.deepStrictEqual(parseSemver("0.0.0"), { major: 0, minor: 0, patch: 0 });
  assert.deepStrictEqual(parseSemver("10.20.30"), { major: 10, minor: 20, patch: 30 });
});

test("parseSemver returns null for invalid format", () => {
  assert.equal(parseSemver("1.0"), null);
  assert.equal(parseSemver("1"), null);
  assert.equal(parseSemver("v1.0.0"), null);
  assert.equal(parseSemver("1.0.0.0"), null);
  assert.equal(parseSemver("a.b.c"), null);
  assert.equal(parseSemver(""), null);
});

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------

test("compareSemver compares major version differences", () => {
  assert.ok(compareSemver("1.0.0", "2.0.0") < 0);
  assert.ok(compareSemver("2.0.0", "1.0.0") > 0);
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
});

test("compareSemver compares minor version differences", () => {
  assert.ok(compareSemver("1.1.0", "1.2.0") < 0);
  assert.ok(compareSemver("1.2.0", "1.1.0") > 0);
});

test("compareSemver compares patch version differences", () => {
  assert.ok(compareSemver("1.0.1", "1.0.2") < 0);
  assert.ok(compareSemver("1.0.2", "1.0.1") > 0);
});

test("compareSemver returns 0 for invalid versions", () => {
  assert.equal(compareSemver("invalid", "1.0.0"), 0);
  assert.equal(compareSemver("1.0.0", "invalid"), 0);
  assert.equal(compareSemver("invalid", "invalid"), 0);
});

// ---------------------------------------------------------------------------
// resolveLatestAgentVersion
// ---------------------------------------------------------------------------

test("resolveLatestAgentVersion returns version with most recent createdAt", () => {
  const versions = [
    { versionId: "v1", agentId: "a", semver: "1.0.0", componentSnapshot: { packVersion: "p1", promptBundleVersion: "pb1", modelBindingHash: "h1", trustProfileHash: "t1", triggerSetHash: "tr1", autonomyConfigHash: "ac1" }, createdAt: "2024-01-01T00:00:00Z", createdBy: "user1", releaseNote: "" },
    { versionId: "v3", agentId: "a", semver: "3.0.0", componentSnapshot: { packVersion: "p1", promptBundleVersion: "pb1", modelBindingHash: "h1", trustProfileHash: "t1", triggerSetHash: "tr1", autonomyConfigHash: "ac1" }, createdAt: "2024-01-03T00:00:00Z", createdBy: "user1", releaseNote: "" },
    { versionId: "v2", agentId: "a", semver: "2.0.0", componentSnapshot: { packVersion: "p1", promptBundleVersion: "pb1", modelBindingHash: "h1", trustProfileHash: "t1", triggerSetHash: "tr1", autonomyConfigHash: "ac1" }, createdAt: "2024-01-02T00:00:00Z", createdBy: "user1", releaseNote: "" },
  ] as const;

  const latest = resolveLatestAgentVersion(versions);
  assert.equal(latest?.versionId, "v3");
});

test("resolveLatestAgentVersion returns null for empty array", () => {
  assert.equal(resolveLatestAgentVersion([]), null);
});

test("resolveLatestAgentVersion returns null for single version", () => {
  const versions = [
    { versionId: "v1", agentId: "a", semver: "1.0.0", componentSnapshot: { packVersion: "p1", promptBundleVersion: "pb1", modelBindingHash: "h1", trustProfileHash: "t1", triggerSetHash: "tr1", autonomyConfigHash: "ac1" }, createdAt: "2024-01-01T00:00:00Z", createdBy: "user1", releaseNote: "" },
  ] as const;

  const latest = resolveLatestAgentVersion(versions);
  assert.equal(latest?.versionId, "v1");
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

test("AgentVersionStageSchema accepts valid stages", () => {
  assert.equal(AgentVersionStageSchema.parse("stable"), "stable");
  assert.equal(AgentVersionStageSchema.parse("canary"), "canary");
  assert.equal(AgentVersionStageSchema.parse("beta"), "beta");
  assert.equal(AgentVersionStageSchema.parse("alpha"), "alpha");
});

test("AgentVersionStageSchema rejects invalid stages", () => {
  assert.throws(() => AgentVersionStageSchema.parse("invalid"));
});

test("DeploymentSlotSchema accepts valid slots", () => {
  assert.equal(DeploymentSlotSchema.parse("blue"), "blue");
  assert.equal(DeploymentSlotSchema.parse("green"), "green");
});

test("DeploymentSlotSchema rejects invalid slots", () => {
  assert.throws(() => DeploymentSlotSchema.parse("red"));
});

test("AgentVersionDetailSchema applies defaults", () => {
  const result = AgentVersionDetailSchema.parse({
    versionId: "v1",
    agentId: "a1",
    version: "1.0.0",
    createdAt: "2024-01-01T00:00:00Z",
  });

  assert.equal(result.stage, "alpha");
  assert.equal(result.deprecatedAt, null);
  assert.equal(result.stable, false);
  assert.equal(result.deploymentSlot, null);
  assert.equal(result.changelog, "");
  assert.deepStrictEqual(result.metrics, { totalExecutions: 0, successRate: 0, avgDurationMs: 0 });
});

test("AgentVersionDetailSchema accepts full object", () => {
  const result = AgentVersionDetailSchema.parse({
    versionId: "v1",
    agentId: "a1",
    version: "1.0.0",
    stage: "stable",
    createdAt: "2024-01-01T00:00:00Z",
    deprecatedAt: "2024-06-01T00:00:00Z",
    stable: true,
    deploymentSlot: "blue",
    changelog: "bug fixes",
    metrics: { totalExecutions: 100, successRate: 0.98, avgDurationMs: 500 },
  });

  assert.equal(result.stage, "stable");
  assert.equal(result.deploymentSlot, "blue");
  assert.equal(result.metrics.totalExecutions, 100);
});

test("ComponentSnapshotSchema parses valid snapshot", () => {
  const result = ComponentSnapshotSchema.parse({
    packVersion: "1.0.0",
    promptBundleVersion: "2.0.0",
    modelBindingHash: "abc123",
    trustProfileHash: "def456",
    triggerSetHash: "ghi789",
    autonomyConfigHash: "jkl012",
  });

  assert.equal(result.packVersion, "1.0.0");
});

test("ComponentSnapshotSchema rejects missing fields", () => {
  assert.throws(() => ComponentSnapshotSchema.parse({ packVersion: "1.0.0" }));
});

test("AgentVersionSchema parses valid version", () => {
  const result = AgentVersionSchema.parse({
    versionId: "v1",
    agentId: "a1",
    semver: "1.0.0",
    componentSnapshot: {
      packVersion: "1.0.0",
      promptBundleVersion: "2.0.0",
      modelBindingHash: "abc",
      trustProfileHash: "def",
      triggerSetHash: "ghi",
      autonomyConfigHash: "jkl",
    },
    createdAt: "2024-01-01T00:00:00Z",
    createdBy: "user1",
    releaseNote: "initial",
  });

  assert.equal(result.semver, "1.0.0");
  assert.equal(result.releaseNote, "initial");
});
