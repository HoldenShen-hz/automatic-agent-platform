import assert from "node:assert/strict";
import test from "node:test";
import { scoreSystemHealth } from "../../../../../src/interaction/dashboard/health-scorer/index.js";
test("scoreSystemHealth returns 100 for ok status with no backlog or findings", () => {
    const system = {
        healthStatus: "ok",
        providerHealth: { status: "healthy", successRate: 1, recentCalls: 100 },
        resourceUtilization: { memoryRssMb: 512, activeProcesses: 10 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
        observedAt: Date.now(),
    };
    assert.equal(scoreSystemHealth(system), 100);
});
test("scoreSystemHealth returns 80 for degraded status", () => {
    const system = {
        healthStatus: "degraded",
        providerHealth: { status: "degraded", successRate: 0.9, recentCalls: 100 },
        resourceUtilization: { memoryRssMb: 512, activeProcesses: 10 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
        observedAt: Date.now(),
    };
    assert.equal(scoreSystemHealth(system), 80);
});
test("scoreSystemHealth returns 60 for overloaded status with no backlog", () => {
    const system = {
        healthStatus: "overloaded",
        providerHealth: { status: "degraded", successRate: 0.85, recentCalls: 1000 },
        resourceUtilization: { memoryRssMb: 2048, activeProcesses: 50 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 100 },
        findings: [],
        observedAt: Date.now(),
    };
    // Base is 60 (overloaded), no backlog penalty
    assert.equal(scoreSystemHealth(system), 60);
});
test("scoreSystemHealth returns 30 for unhealthy status with no backlog", () => {
    const system = {
        healthStatus: "unhealthy",
        providerHealth: { status: "failed", successRate: 0.5, recentCalls: 5000 },
        resourceUtilization: { memoryRssMb: 4096, activeProcesses: 100 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 500 },
        findings: [],
        observedAt: Date.now(),
    };
    // Base is 30 (unhealthy), no backlog penalty
    assert.equal(scoreSystemHealth(system), 30);
});
test("scoreSystemHealth applies backlog penalty (max 30)", () => {
    const baseSystem = {
        healthStatus: "ok",
        providerHealth: { status: "healthy", successRate: 1, recentCalls: 100 },
        resourceUtilization: { memoryRssMb: 512, activeProcesses: 10 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
        observedAt: Date.now(),
    };
    const withBacklog = {
        ...baseSystem,
        queueBacklog: { size: 50, degraded: true },
    };
    // Base is 100, backlog of 50 should apply 30 penalty (capped)
    assert.equal(scoreSystemHealth(withBacklog), 70);
});
test("scoreSystemHealth applies findings penalty (max 20)", () => {
    const baseSystem = {
        healthStatus: "ok",
        providerHealth: { status: "healthy", successRate: 1, recentCalls: 100 },
        resourceUtilization: { memoryRssMb: 512, activeProcesses: 10 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
        observedAt: Date.now(),
    };
    // 5 findings * 5 = 25, capped at 20
    const withFindings = {
        ...baseSystem,
        findings: ["finding1", "finding2", "finding3", "finding4", "finding5"],
    };
    // Base 100 - 20 (capped findings) = 80
    assert.equal(scoreSystemHealth(withFindings), 80);
});
test("scoreSystemHealth returns 0 when penalties exceed base", () => {
    const system = {
        healthStatus: "unhealthy",
        providerHealth: { status: "failed", successRate: 0.3, recentCalls: 10000 },
        resourceUtilization: { memoryRssMb: 8192, activeProcesses: 200 },
        queueBacklog: { size: 100, degraded: true },
        eventBusBacklog: { tier1PendingAcks: 1000 },
        findings: ["f1", "f2", "f3", "f4", "f5", "f6"],
        observedAt: Date.now(),
    };
    // Base 30 - 30 (backlog) - 20 (findings, capped) = -20, clamped to 0
    assert.equal(scoreSystemHealth(system), 0);
});
test("scoreSystemHealth handles minimal system state", () => {
    const system = {
        healthStatus: "ok",
        providerHealth: { status: "healthy", successRate: 1, recentCalls: 0 },
        resourceUtilization: { memoryRssMb: 0, activeProcesses: 0 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
        observedAt: Date.now(),
    };
    assert.equal(scoreSystemHealth(system), 100);
});
//# sourceMappingURL=index.test.js.map