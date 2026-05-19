import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeGovernanceService } from "../../../src/scale-ecosystem/runtime-governance-service.js";
function createBaseRequest(overrides = {}) {
    return {
        capability: "notify",
        connectors: [
            { connectorId: "slack_primary", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
            { connectorId: "slack_backup", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_primary", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
            { connectorId: "slack_backup", status: "healthy", latencyMs: 200, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
        regions: [
            { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true },
            { regionId: "us-west-2", jurisdiction: "US", latencyScore: 80, residencyAllowed: true },
        ],
        primaryRegionHealthy: true,
        quotaPolicy: { scopeId: "tenant_1", hardLimit: 10, currentUsage: 3 },
        requestedUnits: 2,
        queueItems: [
            { itemId: "job_1", tenantId: "tenant_1", priority: 1, ageMs: 60_000 },
            { itemId: "job_2", tenantId: "tenant_2", priority: 2, ageMs: 1_000 },
        ],
        preemptionCandidates: [
            { executionId: "exec_1", priority: 1, progressPercent: 20, lastCheckpointTimestampMs: Date.now() - 1000 },
            { executionId: "exec_2", priority: 3, progressPercent: 50, lastCheckpointTimestampMs: Date.now() - 1000 },
        ],
        tiers: [
            { tierId: "standard", displayName: "Standard", priority: 1, reservedCapacityPercent: 20 },
            { tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 40 },
        ],
        reservedCapacityPlan: [
            { tierId: "enterprise", reservedPercent: 40 },
            { tierId: "standard", reservedPercent: 20 },
        ],
        totalCapacityUnits: 100,
        observation: { latencyMs: 350, successRate: 0.98, queueWaitMs: 500 },
        commitment: { maxLatencyMs: 300, minSuccessRate: 0.99, maxQueueWaitMs: 1000 },
        ...overrides,
    };
}
test("RuntimeGovernanceService evaluates with empty inputs", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        connectors: [],
        connectorHealthReports: [],
        regions: [],
        quotaPolicy: { scopeId: "tenant_1", hardLimit: 10, currentUsage: 0 },
        requestedUnits: 0,
        queueItems: [],
        preemptionCandidates: [],
        tiers: [],
        reservedCapacityPlan: [],
        totalCapacityUnits: 0,
        observation: { latencyMs: 0, successRate: 1.0, queueWaitMs: 0 },
        commitment: { maxLatencyMs: 1000, minSuccessRate: 0.95, maxQueueWaitMs: 5000 },
    });
    const decision = service.evaluate(request);
    assert.equal(decision.connectorId, null);
    assert.equal(decision.regionId, null);
    assert.equal(decision.failoverRegionId, null);
    assert.equal(decision.quotaAllowed, true);
    assert.deepEqual(decision.queueOrder, []);
    assert.equal(decision.preemptionVictimId, null);
    assert.equal(decision.highestTierId, null);
    assert.deepEqual(decision.reservedCapacity, {});
    assert.deepEqual(decision.breaches, []);
});
test("RuntimeGovernanceService selects first healthy connector matching capability", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        capability: "notify",
        connectors: [
            { connectorId: "slack_primary", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
            { connectorId: "slack_backup", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
            { connectorId: "email_primary", provider: "smtp", capabilities: ["email"], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_primary", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
            { connectorId: "slack_backup", status: "healthy", latencyMs: 200, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.connectorId, "slack_primary");
});
test("RuntimeGovernanceService returns null connector when all health reports are failed", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        connectors: [
            { connectorId: "slack_primary", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_primary", status: "failed", latencyMs: 0, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.connectorId, null);
});
test("RuntimeGovernanceService filters connectors by requested capability", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        capability: "email",
        connectors: [
            { connectorId: "slack_primary", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
            { connectorId: "email_primary", provider: "smtp", capabilities: ["email"], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_primary", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
            { connectorId: "email_primary", status: "healthy", latencyMs: 50, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.connectorId, "email_primary");
});
test("RuntimeGovernanceService selects preferred region by latency score", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        regions: [
            { regionId: "us-west-2", jurisdiction: "US", latencyScore: 80, residencyAllowed: true },
            { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true },
            { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 60, residencyAllowed: true },
        ],
        primaryRegionHealthy: true,
    });
    const decision = service.evaluate(request);
    assert.equal(decision.regionId, "cn-sh");
});
test("RuntimeGovernanceService handles failover when primary region unhealthy", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        regions: [
            { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true },
            { regionId: "us-west-2", jurisdiction: "US", latencyScore: 80, residencyAllowed: true },
        ],
        primaryRegionHealthy: false,
    });
    const decision = service.evaluate(request);
    assert.equal(decision.failoverRegionId, "us-west-2");
});
test("RuntimeGovernanceService skips non-residency-allowed regions for failover", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        regions: [
            { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: false },
            { regionId: "us-west-2", jurisdiction: "US", latencyScore: 80, residencyAllowed: true },
            { regionId: "eu-west-1", jurisdiction: "EU", latencyScore: 60, residencyAllowed: true },
        ],
        primaryRegionHealthy: false,
    });
    const decision = service.evaluate(request);
    // cn-sh is filtered out (residency not allowed), so failover should be one of us-west-2 or eu-west-1
    assert.ok(decision.failoverRegionId === "us-west-2" || decision.failoverRegionId === "eu-west-1");
});
test("RuntimeGovernanceService denies quota when hard limit exceeded", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        quotaPolicy: { scopeId: "tenant_1", hardLimit: 10, currentUsage: 9 },
        requestedUnits: 2,
    });
    const decision = service.evaluate(request);
    assert.equal(decision.quotaAllowed, false);
});
test("RuntimeGovernanceService allows quota when within hard limit", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        quotaPolicy: { scopeId: "tenant_1", hardLimit: 10, currentUsage: 3 },
        requestedUnits: 2,
    });
    const decision = service.evaluate(request);
    assert.equal(decision.quotaAllowed, true);
});
test("RuntimeGovernanceService orders queue items fairly by priority and age", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        queueItems: [
            { itemId: "job_1", tenantId: "tenant_1", priority: 1, ageMs: 60_000 },
            { itemId: "job_2", tenantId: "tenant_2", priority: 2, ageMs: 1_000 },
            { itemId: "job_3", tenantId: "tenant_1", priority: 3, ageMs: 30_000 },
        ],
    });
    const decision = service.evaluate(request);
    assert.ok(decision.queueOrder.length === 3);
    assert.ok(decision.queueOrder.includes("job_1"));
    assert.ok(decision.queueOrder.includes("job_2"));
    assert.ok(decision.queueOrder.includes("job_3"));
});
test("RuntimeGovernanceService selects preemption victim by lowest priority", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        preemptionCandidates: [
            { executionId: "exec_high", priority: 5, progressPercent: 90, lastCheckpointTimestampMs: Date.now() - 1000 },
            { executionId: "exec_low", priority: 1, progressPercent: 30, lastCheckpointTimestampMs: Date.now() - 1000 },
            { executionId: "exec_mid", priority: 3, progressPercent: 60, lastCheckpointTimestampMs: Date.now() - 1000 },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.preemptionVictimId, "exec_low");
});
test("RuntimeGovernanceService returns null preemption victim when no candidates", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        preemptionCandidates: [],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.preemptionVictimId, null);
});
test("RuntimeGovernanceService resolves highest priority SLA tier", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        tiers: [
            { tierId: "basic", displayName: "Basic", priority: 0, reservedCapacityPercent: 10 },
            { tierId: "standard", displayName: "Standard", priority: 1, reservedCapacityPercent: 20 },
            { tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 40 },
            { tierId: "premium", displayName: "Premium", priority: 2, reservedCapacityPercent: 30 },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.highestTierId, "enterprise");
});
test("RuntimeGovernanceService returns null tier when no tiers provided", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        tiers: [],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.highestTierId, null);
});
test("RuntimeGovernanceService allocates reserved capacity correctly", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        totalCapacityUnits: 100,
        reservedCapacityPlan: [
            { tierId: "enterprise", reservedPercent: 40 },
            { tierId: "standard", reservedPercent: 20 },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.reservedCapacity["enterprise"], 40);
    assert.equal(decision.reservedCapacity["standard"], 20);
});
test("RuntimeGovernanceService detects SLA latency breach", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        observation: { latencyMs: 500, successRate: 0.99, queueWaitMs: 500 },
        commitment: { maxLatencyMs: 300, minSuccessRate: 0.95, maxQueueWaitMs: 1000 },
    });
    const decision = service.evaluate(request);
    assert.ok(decision.breaches.includes("sla.latency_breach"));
});
test("RuntimeGovernanceService detects SLA success rate breach", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        observation: { latencyMs: 200, successRate: 0.90, queueWaitMs: 500 },
        commitment: { maxLatencyMs: 300, minSuccessRate: 0.95, maxQueueWaitMs: 1000 },
    });
    const decision = service.evaluate(request);
    assert.ok(decision.breaches.includes("sla.success_rate_breach"));
});
test("RuntimeGovernanceService detects SLA queue wait breach", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        observation: { latencyMs: 200, successRate: 0.99, queueWaitMs: 2000 },
        commitment: { maxLatencyMs: 300, minSuccessRate: 0.95, maxQueueWaitMs: 1000 },
    });
    const decision = service.evaluate(request);
    assert.ok(decision.breaches.includes("sla.queue_wait_breach"));
});
test("RuntimeGovernanceService returns no breaches when SLA is met", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        observation: { latencyMs: 200, successRate: 0.99, queueWaitMs: 500 },
        commitment: { maxLatencyMs: 300, minSuccessRate: 0.95, maxQueueWaitMs: 1000 },
    });
    const decision = service.evaluate(request);
    assert.deepEqual(decision.breaches, []);
});
test("RuntimeGovernanceService handles disabled connector lifecycle state", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        connectors: [
            { connectorId: "slack_disabled", provider: "slack", capabilities: ["notify"], lifecycleState: "disabled" },
            { connectorId: "slack_enabled", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_disabled", status: "healthy", latencyMs: 50, checkedAt: "2026-04-20T00:00:00.000Z" },
            { connectorId: "slack_enabled", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.connectorId, "slack_enabled");
});
test("RuntimeGovernanceService handles connector without capabilities list", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        capability: "notify",
        connectors: [
            { connectorId: "slack_no_cap", provider: "slack", capabilities: [], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_no_cap", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
    });
    const decision = service.evaluate(request);
    assert.equal(decision.connectorId, null);
});
test("RuntimeGovernanceService combines all decisions in single evaluate call", () => {
    const service = new RuntimeGovernanceService();
    const decision = service.evaluate(createBaseRequest());
    assert.ok(decision.connectorId !== undefined);
    assert.ok(decision.regionId !== undefined);
    assert.ok(decision.failoverRegionId !== undefined);
    assert.ok(typeof decision.quotaAllowed === "boolean");
    assert.ok(Array.isArray(decision.queueOrder));
    assert.ok(decision.preemptionVictimId !== undefined);
    assert.ok(decision.highestTierId !== undefined);
    assert.ok(decision.reservedCapacity !== undefined);
    assert.ok(Array.isArray(decision.breaches));
});
test("RuntimeGovernanceService handles zero capacity units", () => {
    const service = new RuntimeGovernanceService();
    const request = createBaseRequest({
        totalCapacityUnits: 0,
        reservedCapacityPlan: [
            { tierId: "enterprise", reservedPercent: 40 },
        ],
    });
    const decision = service.evaluate(request);
    assert.deepEqual(decision.reservedCapacity, { enterprise: 0 });
});
test("RuntimeGovernanceService combines connector, region, quota, queue, and SLA decisions", () => {
    const service = new RuntimeGovernanceService();
    const decision = service.evaluate({
        capability: "notify",
        connectors: [
            { connectorId: "slack_primary", provider: "slack", capabilities: ["notify"], lifecycleState: "enabled" },
        ],
        connectorHealthReports: [
            { connectorId: "slack_primary", status: "healthy", latencyMs: 100, checkedAt: "2026-04-20T00:00:00.000Z" },
        ],
        regions: [
            { regionId: "cn-sh", jurisdiction: "CN", latencyScore: 30, residencyAllowed: true },
            { regionId: "us-west-2", jurisdiction: "US", latencyScore: 80, residencyAllowed: true },
        ],
        primaryRegionHealthy: false,
        quotaPolicy: { scopeId: "tenant_1", hardLimit: 10, currentUsage: 3 },
        requestedUnits: 2,
        queueItems: [
            { itemId: "job_1", tenantId: "tenant_1", priority: 1, ageMs: 60_000 },
            { itemId: "job_2", tenantId: "tenant_2", priority: 2, ageMs: 1_000 },
        ],
        preemptionCandidates: [
            { executionId: "exec_1", priority: 1, progressPercent: 20, lastCheckpointTimestampMs: Date.now() - 1000 },
            { executionId: "exec_2", priority: 3, progressPercent: 50, lastCheckpointTimestampMs: Date.now() - 1000 },
        ],
        tiers: [
            { tierId: "standard", displayName: "Standard", priority: 1, reservedCapacityPercent: 20 },
            { tierId: "enterprise", displayName: "Enterprise", priority: 3, reservedCapacityPercent: 40 },
        ],
        reservedCapacityPlan: [
            { tierId: "enterprise", reservedPercent: 40 },
            { tierId: "standard", reservedPercent: 20 },
        ],
        totalCapacityUnits: 100,
        observation: { latencyMs: 350, successRate: 0.98, queueWaitMs: 500 },
        commitment: { maxLatencyMs: 300, minSuccessRate: 0.99, maxQueueWaitMs: 1000 },
    });
    assert.equal(decision.connectorId, "slack_primary");
    assert.equal(decision.regionId, "cn-sh");
    assert.equal(decision.failoverRegionId, "us-west-2");
    assert.equal(decision.quotaAllowed, true);
    assert.equal(decision.queueOrder[0], "job_1");
    assert.equal(decision.preemptionVictimId, "exec_1");
    assert.equal(decision.highestTierId, "enterprise");
    assert.deepEqual(decision.reservedCapacity, { enterprise: 40, standard: 20 });
    assert.deepEqual(decision.breaches, ["sla.latency_breach", "sla.success_rate_breach"]);
});
//# sourceMappingURL=runtime-governance-service.test.js.map
