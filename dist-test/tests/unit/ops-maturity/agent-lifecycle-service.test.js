import assert from "node:assert/strict";
import test from "node:test";
import { AgentLifecycleService, } from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";
import { CANARY_STAGES, DEFAULT_PROMOTION_CRITERIA, } from "../../../src/ops-maturity/agent-lifecycle/canary-controller/index.js";
import { isValidLifecycleTransition, } from "../../../src/ops-maturity/agent-lifecycle/agent-registry/index.js";
import { canRetireAgent, isGracePeriodExpired, createRetirementRecord, } from "../../../src/ops-maturity/agent-lifecycle/retirement/index.js";
import { compareSemver, parseSemver, } from "../../../src/ops-maturity/agent-lifecycle/version-manager/index.js";
function makeAgent(overrides = {}) {
    return {
        agentId: "agent_ops_1",
        name: "Ops Agent",
        domainId: "ops",
        owner: { orgNodeId: "node_1", path: "/ops" },
        components: {
            pack: { packId: "pack_ops", version: "1.0.0" },
            promptBundle: { bundleId: "bundle_ops", version: "1.0.0" },
            modelBinding: { provider: "openai", model: "gpt-4", fallbackChain: [] },
            trustProfile: {
                initialLevel: "semi_auto",
                scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 },
            },
            triggerSet: [],
            autonomyConfig: { maxAutomationLevel: "semi_auto", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
        },
        currentVersionId: "v1.0.0",
        lifecycleState: "draft",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        ...overrides,
    };
}
function makeVersion(overrides = {}) {
    return {
        versionId: "v1.0.0",
        agentId: "agent_ops_1",
        semver: "1.0.0",
        componentSnapshot: {
            packVersion: "1.0.0",
            promptBundleVersion: "1.0.0",
            modelBindingHash: "hash_model_v1",
            trustProfileHash: "hash_trust_v1",
            triggerSetHash: "hash_trigger_v1",
            autonomyConfigHash: "hash_auto_v1",
        },
        createdAt: "2026-04-01T00:00:00.000Z",
        createdBy: "system",
        releaseNote: "initial version",
        ...overrides,
    };
}
function seedService() {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "canary", currentVersionId: "v2.0.0" }));
    service.addVersion(makeVersion({
        versionId: "v1.0.0",
        semver: "1.0.0",
        createdAt: "2026-04-01T00:00:00.000Z",
    }));
    service.addVersion(makeVersion({
        versionId: "v2.0.0",
        semver: "2.0.0",
        createdAt: "2026-04-15T00:00:00.000Z",
    }));
    return service;
}
// State machine tests
test("isValidLifecycleTransition allows draft→testing", () => {
    assert.equal(isValidLifecycleTransition("draft", "testing"), true);
});
test("isValidLifecycleTransition forbids draft→active", () => {
    assert.equal(isValidLifecycleTransition("draft", "active"), false);
});
test("isValidLifecycleTransition allows canary→active when criteria met", () => {
    assert.equal(isValidLifecycleTransition("canary", "active"), true);
});
test("isValidLifecycleTransition forbids canary→archived directly", () => {
    assert.equal(isValidLifecycleTransition("canary", "archived"), false);
});
// AgentLifecycleService lifecycle state transitions
test("AgentLifecycleService.transition moves draft→testing", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "draft" }));
    const result = service.transition("agent_ops_1", "testing");
    assert.equal(result.allowed, true);
    assert.equal(result.fromState, "draft");
    assert.equal(result.toState, "testing");
});
test("AgentLifecycleService.transition rejects invalid transitions", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "draft" }));
    const result = service.transition("agent_ops_1", "active");
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "Invalid transition from draft to active");
});
test("AgentLifecycleService.transition throws for unknown agent", () => {
    const service = new AgentLifecycleService();
    assert.throws(() => {
        service.transition("agent_unknown", "testing");
    }, /agent_lifecycle\.agent_not_found/);
});
// Canary promotion tests
test("AgentLifecycleService.promoteCanary advances canary→active when criteria met", () => {
    const service = seedService();
    const progress = {
        rolloutPercent: 50,
        successRate: 0.995,
        latencyP50Ms: 1500,
        errorRate: 0.005,
        currentStage: 50,
    };
    const receipt = service.promoteCanary("agent_ops_1", progress, "2026-04-20T01:00:00.000Z");
    assert.equal(receipt.toState, "active");
    assert.equal(receipt.fromState, "canary");
    assert.equal(receipt.reasonCodes.includes("agent_lifecycle.canary_promoted"), true);
});
test("AgentLifecycleService.promoteCanary throws when criteria not met", () => {
    const service = seedService();
    const badProgress = {
        rolloutPercent: 10,
        successRate: 0.85,
        latencyP50Ms: 5000,
        errorRate: 0.15,
        currentStage: 5,
    };
    assert.throws(() => {
        service.promoteCanary("agent_ops_1", badProgress);
    }, /agent_lifecycle\.canary_not_ready/);
});
test("AgentLifecycleService.promoteCanary throws when agent not in canary state", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "active" }));
    service.addVersion(makeVersion());
    assert.throws(() => {
        service.promoteCanary("agent_ops_1", {
            rolloutPercent: 50,
            successRate: 0.995,
            latencyP50Ms: 1500,
            errorRate: 0.005,
            currentStage: 50,
        });
    }, /agent_lifecycle\.invalid_state/);
});
// Rollback tests
test("AgentLifecycleService.rollback reverts to previous version", () => {
    const service = seedService();
    const receipt = service.rollback("agent_ops_1", "2026-04-20T02:00:00.000Z");
    assert.equal(receipt.fromVersionId, "v2.0.0");
    assert.equal(receipt.toVersionId, "v1.0.0");
    assert.equal(service.getAgent("agent_ops_1")?.currentVersionId, "v1.0.0");
    assert.equal(service.getAgent("agent_ops_1")?.lifecycleState, "staging");
});
test("AgentLifecycleService.rollback throws when no fallback version", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "canary", currentVersionId: "v1.0.0" }));
    service.addVersion(makeVersion({ versionId: "v1.0.0" }));
    assert.throws(() => {
        service.rollback("agent_ops_1");
    }, /agent_lifecycle\.rollback_target_not_found/);
});
// Retire and archive tests
test("AgentLifecycleService.retire moves agent to deprecated state", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "active" }));
    service.addVersion(makeVersion());
    const plan = {
        agentId: "agent_ops_1",
        successorAgentId: null,
        transferItems: [],
        gracePeriodDays: 0,
        notificationTargets: [],
        revokeAt: "2026-04-20T00:00:00.000Z",
        reason: "decommission",
    };
    const receipt = service.retire(plan, "2026-04-20T00:00:00.000Z");
    assert.equal(receipt.toState, "deprecated");
});
test("AgentLifecycleService.archive moves deprecated→archived", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "deprecated" }));
    service.addVersion(makeVersion());
    const receipt = service.archive("agent_ops_1", "2026-04-25T00:00:00.000Z");
    assert.equal(receipt.fromState, "deprecated");
    assert.equal(receipt.toState, "archived");
});
test("AgentLifecycleService.archive rejects non-deprecated agents", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "active" }));
    service.addVersion(makeVersion());
    assert.throws(() => {
        service.archive("agent_ops_1");
    }, /agent_lifecycle\.can_only_archive_from_deprecated/);
});
// Binding tests
test("AgentLifecycleService.bindTask succeeds for active agent", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "active" }));
    service.addVersion(makeVersion());
    const binding = service.bindTask("agent_ops_1", "task_new_1");
    assert.equal(binding.agentId, "agent_ops_1");
    assert.equal(binding.taskId, "task_new_1");
});
test("AgentLifecycleService.bindTask rejects archived agent", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "archived" }));
    service.addVersion(makeVersion());
    assert.throws(() => {
        service.bindTask("agent_ops_1", "task_new_1");
    }, /agent_lifecycle\.binding_forbidden/);
});
// Canary traffic split tests
test("AgentLifecycleService.getCanaryTrafficSplit returns null when no progress", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "canary" }));
    assert.equal(service.getCanaryProgress("agent_ops_1"), null);
});
test("AgentLifecycleService.advanceCanary updates canary progress", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent({ lifecycleState: "canary" }));
    service.addVersion(makeVersion());
    const progress = {
        rolloutPercent: 5,
        successRate: 0.998,
        latencyP50Ms: 800,
        errorRate: 0.002,
        currentStage: 5,
    };
    const receipt = service.advanceCanary("agent_ops_1", progress);
    assert.equal(receipt.fromState, "canary");
    assert.equal(receipt.toState, "canary");
});
// Version resolution tests
test("AgentLifecycleService.getLatestVersion returns most recent version", () => {
    const service = new AgentLifecycleService();
    service.registerAgent(makeAgent());
    service.addVersion(makeVersion({ versionId: "v1.0.0", semver: "1.0.0", createdAt: "2026-04-01T00:00:00.000Z" }));
    service.addVersion(makeVersion({ versionId: "v2.0.0", semver: "2.0.0", createdAt: "2026-04-15T00:00:00.000Z" }));
    const latest = service.getLatestVersion("agent_ops_1");
    assert.equal(latest?.versionId, "v2.0.0");
});
// Canary controller tests
test("DEFAULT_PROMOTION_CRITERIA has correct thresholds", () => {
    assert.equal(DEFAULT_PROMOTION_CRITERIA.minRolloutPercent, 25);
    assert.equal(DEFAULT_PROMOTION_CRITERIA.minSuccessRate, 0.99);
    assert.equal(DEFAULT_PROMOTION_CRITERIA.maxErrorRate, 0.01);
    assert.equal(DEFAULT_PROMOTION_CRITERIA.maxLatencyP50Ms, 2000);
});
test("CANARY_STAGES progresses from 5 to 100", () => {
    assert.deepEqual(CANARY_STAGES, [5, 20, 50, 100]);
});
// Semver comparison tests
test("compareSemver orders versions correctly", () => {
    assert.ok(compareSemver("2.0.0", "1.0.0") > 0);
    assert.ok(compareSemver("1.1.0", "1.0.0") > 0);
    assert.ok(compareSemver("1.0.1", "1.0.0") > 0);
    assert.ok(compareSemver("1.0.0", "2.0.0") < 0);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
});
test("parseSemver extracts major minor patch", () => {
    const parsed = parseSemver("1.2.3");
    assert.deepEqual(parsed, { major: 1, minor: 2, patch: 3 });
});
test("parseSemver returns null for invalid semver", () => {
    assert.equal(parseSemver("invalid"), null);
    assert.equal(parseSemver("1.2"), null);
    assert.equal(parseSemver("v1.0.0"), null);
});
// Retirement logic tests
test("canRetireAgent returns true when revokeAt <= now", () => {
    const plan = {
        agentId: "agent_ops_1",
        successorAgentId: null,
        transferItems: [],
        gracePeriodDays: 30,
        notificationTargets: [],
        revokeAt: "2026-04-01T00:00:00.000Z",
        reason: "",
    };
    assert.equal(canRetireAgent(plan, "2026-04-02T00:00:00.000Z"), true);
});
test("canRetireAgent returns false when revokeAt > now", () => {
    const plan = {
        agentId: "agent_ops_1",
        successorAgentId: null,
        transferItems: [],
        gracePeriodDays: 30,
        notificationTargets: [],
        revokeAt: "2026-04-20T00:00:00.000Z",
        reason: "",
    };
    assert.equal(canRetireAgent(plan, "2026-04-01T00:00:00.000Z"), false);
});
test("createRetirementRecord builds correct record", () => {
    const plan = {
        agentId: "agent_ops_1",
        successorAgentId: "agent_ops_2",
        transferItems: ["triggers", "ownership"],
        gracePeriodDays: 30,
        notificationTargets: ["admin@example.com"],
        revokeAt: "2026-04-20T00:00:00.000Z",
        reason: "migration",
    };
    const record = createRetirementRecord(plan, "2026-04-01T00:00:00.000Z");
    assert.equal(record.retiringAgentId, "agent_ops_1");
    assert.equal(record.successorAgentId, "agent_ops_2");
    assert.deepEqual(record.transferItems, ["triggers", "ownership"]);
    assert.equal(record.status, "initiated");
});
test("isGracePeriodExpired detects expired grace period", () => {
    const record = createRetirementRecord({
        agentId: "agent_ops_1",
        successorAgentId: null,
        transferItems: [],
        gracePeriodDays: 1,
        notificationTargets: [],
        revokeAt: "2026-04-20T00:00:00.000Z",
        reason: "",
    }, "2026-04-01T00:00:00.000Z");
    assert.equal(isGracePeriodExpired(record, "2026-04-03T00:00:00.000Z"), true);
    assert.equal(isGracePeriodExpired(record, "2026-04-01T12:00:00.000Z"), false);
});
//# sourceMappingURL=agent-lifecycle-service.test.js.map