import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentVersionManager,
  AgentVersionDetailSchema,
  AgentVersionStageSchema,
  DeploymentSlotSchema,
  ComponentSnapshotSchema,
  AgentVersionSchema,
  parseSemver,
  compareSemver,
  resolveLatestAgentVersion,
  type AgentVersionDetail,
  type AgentVersion,
} from "../../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";

function emptyMetrics(): AgentVersionDetail["metrics"] {
  return { totalExecutions: 0, successRate: 0, avgDurationMs: 0 };
}

// ---------------------------------------------------------------------------
// AgentVersionManager construction
// ---------------------------------------------------------------------------

test("AgentVersionManager is constructed with empty version registry", () => {
  const mgr = new AgentVersionManager();
  assert.deepStrictEqual(mgr.listVersions("any-agent"), []);
});

// ---------------------------------------------------------------------------
// registerVersion
// ---------------------------------------------------------------------------

test("registerVersion creates version with generated versionId and createdAt", () => {
  const mgr = new AgentVersionManager();
  const detail: Omit<AgentVersionDetail, "versionId" | "createdAt"> = {
    agentId: "agent-1",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "initial release",
    metrics: emptyMetrics(),
  };

  const result = mgr.registerVersion(detail);

  assert.ok(result.versionId.startsWith("agentver_"));
  assert.ok(result.createdAt.length > 0);
  assert.equal(result.agentId, "agent-1");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.stage, "stable");
  assert.equal(result.stable, true);
  assert.equal(result.deprecatedAt, null);
  assert.equal(result.deploymentSlot, null);
  assert.equal(result.changelog, "initial release");
});

test("registerVersion accumulates multiple versions for same agent", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-1",
    version: "1.0.0",
    stage: "alpha",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  mgr.registerVersion({
    agentId: "agent-1",
    version: "1.1.0",
    stage: "beta",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  mgr.registerVersion({
    agentId: "agent-1",
    version: "2.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const versions = mgr.listVersions("agent-1");
  assert.equal(versions.length, 3);
});

test("registerVersion separates agents by agentId", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-a",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  mgr.registerVersion({
    agentId: "agent-b",
    version: "1.0.0",
    stage: "canary",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  assert.equal(mgr.listVersions("agent-a").length, 1);
  assert.equal(mgr.listVersions("agent-b").length, 1);
  assert.equal(mgr.listVersions("agent-a")[0]!.stage, "stable");
  assert.equal(mgr.listVersions("agent-b")[0]!.stage, "canary");
});

// ---------------------------------------------------------------------------
// listVersions
// ---------------------------------------------------------------------------

test("listVersions returns empty array for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.deepStrictEqual(mgr.listVersions("nonexistent"), []);
});

test("listVersions returns versions sorted by createdAt descending", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-x",
    version: "1.0.0",
    stage: "alpha",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-x",
    version: "2.0.0",
    stage: "beta",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v3 = mgr.registerVersion({
    agentId: "agent-x",
    version: "3.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const versions = mgr.listVersions("agent-x");
  assert.equal(versions.length, 3);
  const ids = versions.map((v) => v.versionId);
  assert.ok(ids.includes(v1.versionId));
  assert.ok(ids.includes(v2.versionId));
  assert.ok(ids.includes(v3.versionId));
});

test("listVersions does not mutate internal state", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-mut",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const first = mgr.listVersions("agent-mut");
  first.length = 0; // attempt mutation

  const second = mgr.listVersions("agent-mut");
  assert.equal(second.length, 1); // internal state unchanged
});

// ---------------------------------------------------------------------------
// getStableVersions
// ---------------------------------------------------------------------------

test("getStableVersions filters to stable versions only", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-s",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  mgr.registerVersion({
    agentId: "agent-s",
    version: "1.1.0",
    stage: "alpha",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const stable = mgr.getStableVersions("agent-s");
  assert.equal(stable.length, 1);
  assert.equal(stable[0]!.version, "1.0.0");
  assert.equal(stable[0]!.stable, true);
});

test("getStableVersions returns empty array when no stable versions", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-ns",
    version: "1.0.0",
    stage: "alpha",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  assert.deepStrictEqual(mgr.getStableVersions("agent-ns"), []);
});

test("getStableVersions returns empty for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.deepStrictEqual(mgr.getStableVersions("unknown"), []);
});

// ---------------------------------------------------------------------------
// assignDeploymentSlot
// ---------------------------------------------------------------------------

test("assignDeploymentSlot assigns slot and evicts prior occupant (blue -> green)", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-d",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-d",
    version: "2.0.0",
    stage: "canary",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-d", v1.versionId, "blue");
  mgr.assignDeploymentSlot("agent-d", v2.versionId, "green");

  const versions = mgr.listVersions("agent-d");
  const blueV1 = versions.find((v) => v.versionId === v1.versionId);
  const greenV2 = versions.find((v) => v.versionId === v2.versionId);

  assert.equal(greenV2?.deploymentSlot, "green");
  assert.equal(blueV1?.deploymentSlot, null); // evicted when green was assigned
});

test("assignDeploymentSlot assigns green and evicts blue", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-g",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-g",
    version: "2.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-g", v1.versionId, "blue");
  mgr.assignDeploymentSlot("agent-g", v2.versionId, "green");

  const versions = mgr.listVersions("agent-g");
  const greenV2 = versions.find((v) => v.versionId === v2.versionId);
  const blueV1 = versions.find((v) => v.versionId === v1.versionId);

  assert.equal(greenV2?.deploymentSlot, "green");
  assert.equal(blueV1?.deploymentSlot, null); // evicted
});

test("assignDeploymentSlot ignores unknown agent", () => {
  const mgr = new AgentVersionManager();
  // Should not throw
  mgr.assignDeploymentSlot("unknown-agent", "some-version-id", "blue");
});

test("assignDeploymentSlot ignores unknown version", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-h",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-h", "unknown-version-id", "blue");
  assert.equal(v1.deploymentSlot, null);
});

// ---------------------------------------------------------------------------
// getActiveSlot
// ---------------------------------------------------------------------------

test("getActiveSlot returns version assigned to slot", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-a",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-a", v1.versionId, "blue");

  const result = mgr.getActiveSlot("agent-a", "blue");
  assert.equal(result?.versionId, v1.versionId);
});

test("getActiveSlot returns null when slot is empty", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-b",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  assert.equal(mgr.getActiveSlot("agent-b", "blue"), null);
  assert.equal(mgr.getActiveSlot("agent-b", "green"), null);
});

test("getActiveSlot returns null for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.equal(mgr.getActiveSlot("unknown-agent", "blue"), null);
});

test("getActiveSlot returns null after slot is evicted", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-e",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-e",
    version: "2.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-e", v1.versionId, "blue");
  mgr.assignDeploymentSlot("agent-e", v2.versionId, "blue"); // evicts v1

  assert.equal(mgr.getActiveSlot("agent-e", "blue")?.versionId, v2.versionId);
});

// ---------------------------------------------------------------------------
// switchSlot
// ---------------------------------------------------------------------------

test("switchSlot promotes non-alpha version to target slot", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-s",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-s",
    version: "2.0.0",
    stage: "canary",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-s", v1.versionId, "blue");

  const result = mgr.switchSlot("agent-s", "green");

  assert.equal(result?.versionId, v2.versionId);
  assert.equal(result?.deploymentSlot, "green");
});

test("switchSlot returns current version when no eligible replacement exists", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-r",
    version: "1.0.0",
    stage: "alpha",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-r", v1.versionId, "blue");

  const result = mgr.switchSlot("agent-r", "green");

  assert.equal(result?.versionId, v1.versionId); // falls back to current
});

test("switchSlot returns null when no current version in slot", () => {
  const mgr = new AgentVersionManager();
  const result = mgr.switchSlot("agent-empty", "green");
  assert.equal(result, null);
});

test("switchSlot returns null when no versions exist for agent", () => {
  const mgr = new AgentVersionManager();
  assert.equal(mgr.switchSlot("nonexistent-agent", "blue"), null);
});

// ---------------------------------------------------------------------------
// deprecateVersion
// ---------------------------------------------------------------------------

test("deprecateVersion sets deprecatedAt timestamp", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-d",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const result = mgr.deprecateVersion("agent-d", v1.versionId);

  assert.equal(result, true);
  assert.ok(mgr.listVersions("agent-d")[0]!.deprecatedAt !== null);
});

test("deprecateVersion returns false for unknown agent", () => {
  const mgr = new AgentVersionManager();
  assert.equal(mgr.deprecateVersion("unknown-agent", "some-id"), false);
});

test("deprecateVersion returns false for unknown version", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-e",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  assert.equal(mgr.deprecateVersion("agent-e", "unknown-id"), false);
});

test("deprecateVersion marks version as no longer stable", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-ns",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.deprecateVersion("agent-ns", v1.versionId);

  const versions = mgr.listVersions("agent-ns");
  assert.ok(versions[0]!.deprecatedAt !== null);
  assert.equal(versions[0]!.stable, true); // stable flag unchanged
});

// ---------------------------------------------------------------------------
// updateMetrics
// ---------------------------------------------------------------------------

test("updateMetrics merges metrics correctly", () => {
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
  assert.equal(versions[0]!.metrics.totalExecutions, 15);
  assert.equal(versions[0]!.metrics.successRate, 0.95);
  assert.equal(versions[0]!.metrics.avgDurationMs, 1000); // unchanged
});

test("updateMetrics ignores unknown agent", () => {
  const mgr = new AgentVersionManager();
  // Should not throw
  mgr.updateMetrics("unknown-agent", "some-id", { totalExecutions: 5 });
});

test("updateMetrics ignores unknown version", () => {
  const mgr = new AgentVersionManager();
  mgr.registerVersion({
    agentId: "agent-u",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  // Should not throw
  mgr.updateMetrics("agent-u", "unknown-id", { totalExecutions: 5 });
});

test("updateMetrics can set all metric fields at once", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-all",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: { totalExecutions: 0, successRate: 0, avgDurationMs: 0 },
  });

  mgr.updateMetrics("agent-all", v1.versionId, {
    totalExecutions: 100,
    successRate: 0.98,
    avgDurationMs: 250,
  });

  const versions = mgr.listVersions("agent-all");
  assert.equal(versions[0]!.metrics.totalExecutions, 100);
  assert.equal(versions[0]!.metrics.successRate, 0.98);
  assert.equal(versions[0]!.metrics.avgDurationMs, 250);
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
  assert.equal(parseSemver("1.2"), null);
  assert.equal(parseSemver("1.2.3.4.5"), null);
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

test("compareSemver handles zero major/minor/patch", () => {
  assert.ok(compareSemver("0.0.1", "0.0.2") < 0);
  assert.ok(compareSemver("0.1.0", "0.2.0") < 0);
  assert.ok(compareSemver("1.0.0", "0.9.9") > 0);
});

// ---------------------------------------------------------------------------
// resolveLatestAgentVersion
// ---------------------------------------------------------------------------

test("resolveLatestAgentVersion returns version with most recent createdAt", () => {
  const versions: AgentVersion[] = [
    {
      versionId: "v1",
      agentId: "a",
      semver: "1.0.0",
      componentSnapshot: {
        packVersion: "p1",
        promptBundleVersion: "pb1",
        modelBindingHash: "h1",
        trustProfileHash: "t1",
        triggerSetHash: "tr1",
        autonomyConfigHash: "ac1",
      },
      createdAt: "2024-01-01T00:00:00Z",
      createdBy: "user1",
      releaseNote: "",
    },
    {
      versionId: "v3",
      agentId: "a",
      semver: "3.0.0",
      componentSnapshot: {
        packVersion: "p1",
        promptBundleVersion: "pb1",
        modelBindingHash: "h1",
        trustProfileHash: "t1",
        triggerSetHash: "tr1",
        autonomyConfigHash: "ac1",
      },
      createdAt: "2024-01-03T00:00:00Z",
      createdBy: "user1",
      releaseNote: "",
    },
    {
      versionId: "v2",
      agentId: "a",
      semver: "2.0.0",
      componentSnapshot: {
        packVersion: "p1",
        promptBundleVersion: "pb1",
        modelBindingHash: "h1",
        trustProfileHash: "t1",
        triggerSetHash: "tr1",
        autonomyConfigHash: "ac1",
      },
      createdAt: "2024-01-02T00:00:00Z",
      createdBy: "user1",
      releaseNote: "",
    },
  ];

  const latest = resolveLatestAgentVersion(versions);
  assert.equal(latest?.versionId, "v3");
});

test("resolveLatestAgentVersion returns null for empty array", () => {
  assert.equal(resolveLatestAgentVersion([]), null);
});

test("resolveLatestAgentVersion returns single version", () => {
  const versions: AgentVersion[] = [
    {
      versionId: "v1",
      agentId: "a",
      semver: "1.0.0",
      componentSnapshot: {
        packVersion: "p1",
        promptBundleVersion: "pb1",
        modelBindingHash: "h1",
        trustProfileHash: "t1",
        triggerSetHash: "tr1",
        autonomyConfigHash: "ac1",
      },
      createdAt: "2024-01-01T00:00:00Z",
      createdBy: "user1",
      releaseNote: "",
    },
  ];

  const latest = resolveLatestAgentVersion(versions);
  assert.equal(latest?.versionId, "v1");
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

test("AgentVersionStageSchema accepts valid stages", () => {
  for (const stage of ["stable", "canary", "beta", "alpha"] as const) {
    assert.equal(AgentVersionStageSchema.parse(stage), stage);
  }
});

test("AgentVersionStageSchema rejects invalid stages", () => {
  assert.throws(() => AgentVersionStageSchema.parse("Stable")); // case-sensitive
  assert.throws(() => AgentVersionStageSchema.parse("invalid"));
  assert.throws(() => AgentVersionStageSchema.parse(""));
});

test("DeploymentSlotSchema accepts valid slots", () => {
  assert.equal(DeploymentSlotSchema.parse("blue"), "blue");
  assert.equal(DeploymentSlotSchema.parse("green"), "green");
});

test("DeploymentSlotSchema rejects invalid slots", () => {
  assert.throws(() => DeploymentSlotSchema.parse("red"));
  assert.throws(() => DeploymentSlotSchema.parse("BLUE")); // case-sensitive
  assert.throws(() => DeploymentSlotSchema.parse(""));
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

test("AgentVersionDetailSchema rejects invalid stage", () => {
  assert.throws(() =>
    AgentVersionDetailSchema.parse({
      versionId: "v1",
      agentId: "a1",
      version: "1.0.0",
      stage: "gold",
      createdAt: "2024-01-01T00:00:00Z",
    }),
  );
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
  assert.throws(() => ComponentSnapshotSchema.parse({ packVersion: "1.0.0", promptBundleVersion: "2.0.0" }));
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
  assert.equal(result.createdBy, "user1");
});

test("AgentVersionSchema applies default releaseNote", () => {
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
  });

  assert.equal(result.releaseNote, "");
});

// ---------------------------------------------------------------------------
// Blue-green deployment scenario
// ---------------------------------------------------------------------------

test("blue-green deployment: full promotion flow", () => {
  const mgr = new AgentVersionManager();

  // Register three versions
  const v1 = mgr.registerVersion({
    agentId: "bg-agent",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "bg-agent",
    version: "2.0.0",
    stage: "canary",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  // Assign blue slot to v1
  mgr.assignDeploymentSlot("bg-agent", v1.versionId, "blue");
  assert.equal(mgr.getActiveSlot("bg-agent", "blue")?.versionId, v1.versionId);

  // Switch green slot (promotes v2)
  const promoted = mgr.switchSlot("bg-agent", "green");
  assert.equal(promoted?.versionId, v2.versionId);
  assert.equal(promoted?.deploymentSlot, "green");

  // Green slot now active
  assert.equal(mgr.getActiveSlot("bg-agent", "green")?.versionId, v2.versionId);
  // Blue slot still holds v1
  assert.equal(mgr.getActiveSlot("bg-agent", "blue")?.versionId, v1.versionId);
});