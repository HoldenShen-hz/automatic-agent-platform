import assert from "node:assert/strict";
import test from "node:test";
import { SystemSituationSchema, parseSystemSituation, } from "../../../../../src/platform/shared/observability/system-situation-model.js";
test("SystemSituationSchema parses valid minimal situation", () => {
    const input = {
        healthStatus: "ok",
        observedAt: 1713782400000,
    };
    const result = SystemSituationSchema.parse(input);
    assert.strictEqual(result.healthStatus, "ok");
    assert.strictEqual(result.providerHealth.status, "healthy");
    assert.strictEqual(result.providerHealth.successRate, 1);
    assert.strictEqual(result.providerHealth.recentCalls, 0);
    assert.deepStrictEqual(result.resourceUtilization, { memoryRssMb: 0, activeProcesses: 0 });
    assert.deepStrictEqual(result.queueBacklog, { size: 0, degraded: false });
    assert.deepStrictEqual(result.eventBusBacklog, { tier1PendingAcks: 0 });
    assert.deepStrictEqual(result.findings, []);
});
test("SystemSituationSchema parses fully populated situation", () => {
    const input = {
        healthStatus: "degraded",
        providerHealth: {
            status: "degraded",
            successRate: 0.85,
            recentCalls: 120,
        },
        resourceUtilization: {
            memoryRssMb: 512,
            cpuPercent: 72.5,
            activeProcesses: 8,
        },
        queueBacklog: {
            size: 42,
            degraded: true,
        },
        eventBusBacklog: {
            tier1PendingAcks: 15,
        },
        findings: ["memory-pressure", "queue-starvation"],
        observedAt: 1713782400000,
    };
    const result = SystemSituationSchema.parse(input);
    assert.strictEqual(result.healthStatus, "degraded");
    assert.strictEqual(result.providerHealth.status, "degraded");
    assert.strictEqual(result.providerHealth.successRate, 0.85);
    assert.strictEqual(result.providerHealth.recentCalls, 120);
    assert.strictEqual(result.resourceUtilization.memoryRssMb, 512);
    assert.strictEqual(result.resourceUtilization.cpuPercent, 72.5);
    assert.strictEqual(result.resourceUtilization.activeProcesses, 8);
    assert.strictEqual(result.queueBacklog.size, 42);
    assert.strictEqual(result.queueBacklog.degraded, true);
    assert.strictEqual(result.eventBusBacklog.tier1PendingAcks, 15);
    assert.deepStrictEqual(result.findings, ["memory-pressure", "queue-starvation"]);
    assert.strictEqual(result.observedAt, 1713782400000);
});
test("SystemSituationSchema rejects invalid healthStatus", () => {
    assert.throws(() => SystemSituationSchema.parse({
        healthStatus: "invalid",
        observedAt: 0,
    }), /healthStatus/);
});
test("SystemSituationSchema rejects successRate out of range", () => {
    assert.throws(() => SystemSituationSchema.parse({
        healthStatus: "ok",
        providerHealth: {
            status: "healthy",
            successRate: 1.5,
            recentCalls: 0,
        },
        observedAt: 0,
    }), /successRate/);
});
test("SystemSituationSchema rejects negative recentCalls", () => {
    assert.throws(() => SystemSituationSchema.parse({
        healthStatus: "ok",
        providerHealth: {
            status: "healthy",
            successRate: 1,
            recentCalls: -1,
        },
        observedAt: 0,
    }), /recentCalls/);
});
test("parseSystemSituation returns typed SystemSituation", () => {
    const input = {
        healthStatus: "overloaded",
        observedAt: 1713782400000,
    };
    const result = parseSystemSituation(input);
    assert.strictEqual(result.healthStatus, "overloaded");
    // TypeScript check: result should be SystemSituation
    const _check = result;
});
//# sourceMappingURL=system-situation-model.test.js.map