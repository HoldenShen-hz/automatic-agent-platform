import assert from "node:assert/strict";
import test from "node:test";
import { AgentVersionManager, AgentVersionDetailSchema, AgentVersionSchema, ComponentSnapshotSchema, parseSemver, compareSemver, resolveLatestAgentVersion, } from "../../../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";
function createEmptyMetrics() {
    return { totalExecutions: 0, successRate: 0, avgDurationMs: 0 };
}
// ---------------------------------------------------------------------------
// AgentVersionManager - additional branch coverage tests
// ---------------------------------------------------------------------------
// Branch coverage: slot === "blue" branch in assignDeploymentSlot
test("AgentVersionManager.assignDeploymentSlot evicts green slot when assigning blue", () => {
    const mgr = new AgentVersionManager();
    const v1 = mgr.registerVersion({
        agentId: "agent-evict",
        version: "1.0.0",
        stage: "stable",
        deprecatedAt: null,
        stable: true,
        deploymentSlot: "green",
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    const v2 = mgr.registerVersion({
        agentId: "agent-evict",
        version: "2.0.0",
        stage: "canary",
        deprecatedAt: null,
        stable: false,
        deploymentSlot: null,
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    mgr.assignDeploymentSlot("agent-evict", v2.versionId, "blue");
    const versions = mgr.listVersions("agent-evict");
    const greenVersion = versions.find((v) => v.versionId === v1.versionId);
    const blueVersion = versions.find((v) => v.versionId === v2.versionId);
    assert.equal(greenVersion?.deploymentSlot, null); // green evicted
    assert.equal(blueVersion?.deploymentSlot, "blue");
});
// Branch coverage: slot !== "blue" branch (else branch) in assignDeploymentSlot
test("AgentVersionManager.assignDeploymentSlot evicts blue slot when assigning green", () => {
    const mgr = new AgentVersionManager();
    const v1 = mgr.registerVersion({
        agentId: "agent-evict-green",
        version: "1.0.0",
        stage: "stable",
        deprecatedAt: null,
        stable: true,
        deploymentSlot: "blue",
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    const v2 = mgr.registerVersion({
        agentId: "agent-evict-green",
        version: "2.0.0",
        stage: "canary",
        deprecatedAt: null,
        stable: false,
        deploymentSlot: null,
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    mgr.assignDeploymentSlot("agent-evict-green", v2.versionId, "green");
    const versions = mgr.listVersions("agent-evict-green");
    const blueVersion = versions.find((v) => v.versionId === v1.versionId);
    const greenVersion = versions.find((v) => v.versionId === v2.versionId);
    assert.equal(blueVersion?.deploymentSlot, null); // blue evicted
    assert.equal(greenVersion?.deploymentSlot, "green");
});
// Branch coverage: switchSlot with latestForSlot truthy - verifies the if-branch where latestForSlot exists
test("AgentVersionManager.switchSlot with eligible version available switches to target slot", () => {
    const mgr = new AgentVersionManager();
    // Register v1 and assign it to green slot FIRST
    const v1 = mgr.registerVersion({
        agentId: "agent-switch",
        version: "1.0.0",
        stage: "stable",
        deprecatedAt: null,
        stable: true,
        deploymentSlot: null,
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    mgr.assignDeploymentSlot("agent-switch", v1.versionId, "green");
    // Register v2 but don't assign to any slot (eligible for switchSlot target blue)
    const v2 = mgr.registerVersion({
        agentId: "agent-switch",
        version: "2.0.0",
        stage: "canary",
        deprecatedAt: null,
        stable: false,
        deploymentSlot: null,
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    // When switching from green (v1) to blue, it should find v2 as eligible
    const result = mgr.switchSlot("agent-switch", "blue");
    // The result should be v2 (the eligible unassigned canary)
    assert.equal(result?.versionId, v2.versionId);
    assert.equal(result?.deploymentSlot, "blue");
});
// Branch coverage: switchSlot with latestForSlot falsy - falls back to currentVersion
test("AgentVersionManager.switchSlot returns current version when no eligible non-alpha version exists", () => {
    const mgr = new AgentVersionManager();
    // Only have an alpha version assigned to green
    const v1 = mgr.registerVersion({
        agentId: "agent-no-eligible",
        version: "1.0.0",
        stage: "alpha",
        deprecatedAt: null,
        stable: false,
        deploymentSlot: null,
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    mgr.assignDeploymentSlot("agent-no-eligible", v1.versionId, "green");
    // No non-alpha unassigned versions, so should return current version unchanged
    const result = mgr.switchSlot("agent-no-eligible", "blue");
    assert.equal(result?.versionId, v1.versionId); // falls back to current alpha
    // When latestForSlot is falsy, we just return currentVersion without modification
});
// Branch coverage: switchSlot when currentSlot has no version (returns null)
test("AgentVersionManager.switchSlot returns null when no current version in opposite slot", () => {
    const mgr = new AgentVersionManager();
    // Register a version but don't assign any slot
    mgr.registerVersion({
        agentId: "agent-no-slot",
        version: "1.0.0",
        stage: "stable",
        deprecatedAt: null,
        stable: true,
        deploymentSlot: null,
        changelog: "",
        metrics: createEmptyMetrics(),
    });
    const result = mgr.switchSlot("agent-no-slot", "green");
    assert.equal(result, null); // no current version to switch from
});
// ---------------------------------------------------------------------------
// parseSemver - branch coverage for null return
// ---------------------------------------------------------------------------
test("parseSemver returns null for semver with spaces", () => {
    assert.equal(parseSemver("1.0.0 "), null);
    assert.equal(parseSemver(" 1.0.0"), null);
});
test("parseSemver returns null for negative numbers", () => {
    assert.equal(parseSemver("-1.0.0"), null);
});
// ---------------------------------------------------------------------------
// compareSemver - branch coverage for parseSemver returning null
// ---------------------------------------------------------------------------
test("compareSemver returns 0 when left semver is invalid", () => {
    assert.equal(compareSemver("invalid", "1.0.0"), 0);
});
test("compareSemver returns 0 when right semver is invalid", () => {
    assert.equal(compareSemver("1.0.0", "invalid"), 0);
});
test("compareSemver returns 0 when both semvers are invalid", () => {
    assert.equal(compareSemver("invalid", "invalid"), 0);
});
// Branch coverage: major numbers equal, minor numbers different
test("compareSemver returns negative when major equal but minor left < right", () => {
    assert.ok(compareSemver("1.1.0", "1.2.0") < 0);
});
test("compareSemver returns positive when major equal but minor left > right", () => {
    assert.ok(compareSemver("1.3.0", "1.2.0") > 0);
});
// Branch coverage: major and minor equal, patch different
test("compareSemver returns negative when major.minor equal but patch left < right", () => {
    assert.ok(compareSemver("1.0.1", "1.0.2") < 0);
});
test("compareSemver returns positive when major.minor equal but patch left > right", () => {
    assert.ok(compareSemver("1.0.3", "1.0.2") > 0);
});
// ---------------------------------------------------------------------------
// resolveLatestAgentVersion - branch coverage
// ---------------------------------------------------------------------------
test("resolveLatestAgentVersion returns null for empty readonly array", () => {
    const versions = [];
    assert.equal(resolveLatestAgentVersion(versions), null);
});
test("resolveLatestAgentVersion returns single version when only one exists", () => {
    const versions = [
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
// Additional schema validation branch coverage
// ---------------------------------------------------------------------------
test("AgentVersionDetailSchema rejects invalid stage", () => {
    assert.throws(() => AgentVersionDetailSchema.parse({
        versionId: "v1",
        agentId: "a1",
        version: "1.0.0",
        stage: "invalid-stage",
        createdAt: "2024-01-01T00:00:00Z",
    }));
});
test("AgentVersionDetailSchema rejects invalid deploymentSlot", () => {
    assert.throws(() => AgentVersionDetailSchema.parse({
        versionId: "v1",
        agentId: "a1",
        version: "1.0.0",
        createdAt: "2024-01-01T00:00:00Z",
        deploymentSlot: "red",
    }));
});
test("AgentVersionDetailSchema accepts valid version with all fields", () => {
    const result = AgentVersionDetailSchema.parse({
        versionId: "v1",
        agentId: "a1",
        version: "1.0.0",
        stage: "beta",
        createdAt: "2024-01-01T00:00:00Z",
        deprecatedAt: "2024-06-01T00:00:00Z",
        stable: true,
        deploymentSlot: "green",
        changelog: "major improvements",
        metrics: { totalExecutions: 500, successRate: 0.99, avgDurationMs: 250 },
    });
    assert.equal(result.stage, "beta");
    assert.equal(result.deploymentSlot, "green");
    assert.equal(result.stable, true);
    assert.equal(result.deprecatedAt, "2024-06-01T00:00:00Z");
});
test("ComponentSnapshotSchema rejects empty packVersion", () => {
    assert.throws(() => ComponentSnapshotSchema.parse({
        packVersion: "",
        promptBundleVersion: "2.0.0",
        modelBindingHash: "abc123",
        trustProfileHash: "def456",
        triggerSetHash: "ghi789",
        autonomyConfigHash: "jkl012",
    }));
});
test("ComponentSnapshotSchema rejects empty modelBindingHash", () => {
    assert.throws(() => ComponentSnapshotSchema.parse({
        packVersion: "1.0.0",
        promptBundleVersion: "2.0.0",
        modelBindingHash: "",
        trustProfileHash: "def456",
        triggerSetHash: "ghi789",
        autonomyConfigHash: "jkl012",
    }));
});
test("AgentVersionSchema rejects missing required fields", () => {
    assert.throws(() => AgentVersionSchema.parse({}));
});
test("AgentVersionSchema rejects missing createdBy", () => {
    assert.throws(() => AgentVersionSchema.parse({
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
    }));
});
test("AgentVersionSchema accepts version with empty releaseNote", () => {
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
// AgentVersionManager - slotAssignments internal state verification
// ---------------------------------------------------------------------------
test("AgentVersionManager slotAssignments is updated after switchSlot", () => {
    const mgr = new AgentVersionManager();
    const v1 = mgr.registerVersion({ agentId: "agent-slot-state", version: "1.0.0", stage: "stable", deprecatedAt: null, stable: true, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
    mgr.assignDeploymentSlot("agent-slot-state", v1.versionId, "blue");
    const v2 = mgr.registerVersion({ agentId: "agent-slot-state", version: "2.0.0", stage: "canary", deprecatedAt: null, stable: false, deploymentSlot: null, changelog: "", metrics: createEmptyMetrics() });
    // Verify initial state: blue has v1, green is empty
    const initialActiveGreen = mgr.getActiveSlot("agent-slot-state", "green");
    assert.equal(initialActiveGreen, null);
    // Switch to green - should assign v2 to green
    const result = mgr.switchSlot("agent-slot-state", "green");
    // After switch: green should have v2 (the eligible canary)
    assert.equal(result?.versionId, v2.versionId);
    assert.equal(result?.deploymentSlot, "green");
});
// ---------------------------------------------------------------------------
// parseSemver - edge cases
// ---------------------------------------------------------------------------
test("parseSemver handles very large version numbers", () => {
    const result = parseSemver("1000.2000.3000");
    assert.deepStrictEqual(result, { major: 1000, minor: 2000, patch: 3000 });
});
test("parseSemver handles zero version numbers", () => {
    const result = parseSemver("0.0.0");
    assert.deepStrictEqual(result, { major: 0, minor: 0, patch: 0 });
});
// ---------------------------------------------------------------------------
// compareSemver - edge cases
// ---------------------------------------------------------------------------
test("compareSemver handles zero versions", () => {
    assert.equal(compareSemver("0.0.0", "0.0.0"), 0);
    assert.ok(compareSemver("0.0.1", "0.0.0") > 0);
    assert.ok(compareSemver("0.0.0", "0.0.1") < 0);
});
// ---------------------------------------------------------------------------
// AgentVersionManager updateMetrics - additional coverage
// ---------------------------------------------------------------------------
test("AgentVersionManager.updateMetrics updates only specified fields", () => {
    const mgr = new AgentVersionManager();
    const v1 = mgr.registerVersion({
        agentId: "agent-metrics",
        version: "1.0.0",
        stage: "stable",
        deprecatedAt: null,
        stable: true,
        deploymentSlot: null,
        changelog: "",
        metrics: { totalExecutions: 10, successRate: 0.5, avgDurationMs: 100 },
    });
    mgr.updateMetrics("agent-metrics", v1.versionId, { avgDurationMs: 200 });
    const versions = mgr.listVersions("agent-metrics");
    assert.equal(versions[0].metrics.totalExecutions, 10); // unchanged
    assert.equal(versions[0].metrics.successRate, 0.5); // unchanged
    assert.equal(versions[0].metrics.avgDurationMs, 200); // updated
});
test("AgentVersionManager.updateMetrics handles empty partial metrics", () => {
    const mgr = new AgentVersionManager();
    const v1 = mgr.registerVersion({
        agentId: "agent-metrics-empty",
        version: "1.0.0",
        stage: "stable",
        deprecatedAt: null,
        stable: true,
        deploymentSlot: null,
        changelog: "",
        metrics: { totalExecutions: 10, successRate: 0.5, avgDurationMs: 100 },
    });
    mgr.updateMetrics("agent-metrics-empty", v1.versionId, {});
    const versions = mgr.listVersions("agent-metrics-empty");
    assert.equal(versions[0].metrics.totalExecutions, 10); // unchanged
    assert.equal(versions[0].metrics.successRate, 0.5); // unchanged
    assert.equal(versions[0].metrics.avgDurationMs, 100); // unchanged
});
//# sourceMappingURL=agent-version-manager.branches.test.js.map