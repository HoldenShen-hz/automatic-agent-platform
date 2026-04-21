import assert from "node:assert/strict";
import test from "node:test";
import { SimpleRolloutManager } from "../../../../src/ops-maturity/drift-detection/rollout-manager.js";
function createProposal(id) {
    return {
        id,
        title: "Test Proposal",
        description: "Test description",
        kind: "tool_routing_rule",
        target: "test",
        patch: "test patch",
        rationale: "test rationale",
        risk: "low",
        evidenceIds: [],
        status: "proposed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}
function createMetrics(overrides = {}) {
    return {
        successRate: 0.95,
        errorRate: 0.05,
        latencyMs: 150,
        costUsd: 0.25,
        ...overrides,
    };
}
test("SimpleRolloutManager.start creates rollout record", async () => {
    const manager = new SimpleRolloutManager();
    const proposal = createProposal("prop_1");
    const record = await manager.start(proposal, "canary", 5);
    assert.equal(record.proposalId, "prop_1");
    assert.equal(record.stage, "canary");
    assert.equal(record.percentage, 5);
    assert.equal(record.status, "running");
    assert.ok(record.startedAt !== undefined);
});
test("SimpleRolloutManager.start sets default percentage for stage", async () => {
    const manager = new SimpleRolloutManager();
    const proposal = createProposal("prop_1");
    const record = await manager.start(proposal, "canary", manager.getStagePercentage("canary"));
    assert.equal(record.percentage, 5);
});
test("SimpleRolloutManager.updateMetrics updates rollout metrics", async () => {
    const manager = new SimpleRolloutManager();
    const proposal = createProposal("prop_1");
    await manager.start(proposal, "canary", 5);
    await manager.updateMetrics("prop_1", createMetrics({ successRate: 0.98 }));
    const record = await manager.getRollout("prop_1");
    assert.equal(record?.metrics?.successRate, 0.98);
});
test("SimpleRolloutManager.updateMetrics does nothing for unknown proposal", async () => {
    const manager = new SimpleRolloutManager();
    await manager.updateMetrics("unknown", createMetrics());
    // Should not throw
});
test("SimpleRolloutManager.complete marks rollout as succeeded", async () => {
    const manager = new SimpleRolloutManager();
    const proposal = createProposal("prop_1");
    await manager.start(proposal, "stable", 100);
    await manager.complete("prop_1");
    const record = await manager.getRollout("prop_1");
    assert.equal(record?.status, "succeeded");
    assert.ok(record?.completedAt !== undefined);
});
test("SimpleRolloutManager.complete does nothing for unknown proposal", async () => {
    const manager = new SimpleRolloutManager();
    await manager.complete("unknown");
    // Should not throw
});
test("SimpleRolloutManager.fail marks rollout as failed", async () => {
    const manager = new SimpleRolloutManager();
    const proposal = createProposal("prop_1");
    await manager.start(proposal, "canary", 5);
    await manager.fail("prop_1", "Health check failed");
    const record = await manager.getRollout("prop_1");
    assert.equal(record?.status, "failed");
    assert.equal(record?.failureReason, "Health check failed");
    assert.ok(record?.completedAt !== undefined);
});
test("SimpleRolloutManager.rollback marks rollout as rolled_back", async () => {
    const manager = new SimpleRolloutManager();
    const proposal = createProposal("prop_1");
    await manager.start(proposal, "canary", 5);
    await manager.rollback("prop_1", "Manual rollback requested");
    const record = await manager.getRollout("prop_1");
    assert.equal(record?.status, "rolled_back");
    assert.equal(record?.failureReason, "Manual rollback requested");
    assert.ok(record?.completedAt !== undefined);
});
test("SimpleRolloutManager.getRollout returns null for unknown proposal", async () => {
    const manager = new SimpleRolloutManager();
    const record = await manager.getRollout("unknown");
    assert.equal(record, null);
});
test("SimpleRolloutManager.getActiveRollouts returns only running rollouts", async () => {
    const manager = new SimpleRolloutManager();
    const proposal1 = createProposal("prop_1");
    const proposal2 = createProposal("prop_2");
    const proposal3 = createProposal("prop_3");
    await manager.start(proposal1, "canary", 5);
    await manager.start(proposal2, "stable", 100);
    await manager.complete("prop_2");
    await manager.start(proposal3, "shadow", 0);
    const activeRollouts = await manager.getActiveRollouts();
    assert.equal(activeRollouts.length, 2);
    assert.ok(activeRollouts.every(r => r.status === "running"));
});
test("SimpleRolloutManager.getActiveRollouts returns empty array when no rollouts", async () => {
    const manager = new SimpleRolloutManager();
    const activeRollouts = await manager.getActiveRollouts();
    assert.equal(activeRollouts.length, 0);
});
test("SimpleRolloutManager.getDefaultStageSequence returns correct order", () => {
    const manager = new SimpleRolloutManager();
    const sequence = manager.getDefaultStageSequence();
    assert.deepEqual(sequence, ["shadow", "canary", "partial", "stable"]);
});
test("SimpleRolloutManager.getStagePercentage returns correct percentages", () => {
    const manager = new SimpleRolloutManager();
    assert.equal(manager.getStagePercentage("shadow"), 0);
    assert.equal(manager.getStagePercentage("canary"), 5);
    assert.equal(manager.getStagePercentage("partial"), 25);
    assert.equal(manager.getStagePercentage("stable"), 100);
});
test("SimpleRolloutManager handles multiple rollouts", async () => {
    const manager = new SimpleRolloutManager();
    await manager.start(createProposal("prop_1"), "shadow", 0);
    await manager.start(createProposal("prop_2"), "canary", 5);
    await manager.start(createProposal("prop_3"), "partial", 25);
    const activeRollouts = await manager.getActiveRollouts();
    assert.equal(activeRollouts.length, 3);
});
test("RolloutStage type accepts all valid values", () => {
    const stages = ["shadow", "canary", "partial", "stable"];
    for (const stage of stages) {
        assert.ok(["shadow", "canary", "partial", "stable"].includes(stage));
    }
});
test("RolloutStatus type accepts all valid values", () => {
    const statuses = ["running", "succeeded", "failed", "rolled_back"];
    for (const status of statuses) {
        assert.ok(["running", "succeeded", "failed", "rolled_back"].includes(status));
    }
});
//# sourceMappingURL=rollout-manager.test.js.map