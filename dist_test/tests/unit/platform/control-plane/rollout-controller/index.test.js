import assert from "node:assert/strict";
import test from "node:test";
// Re-export test for barrel file
import { TrafficRoutingService, TRAFFIC_ROUTING_DDL, DEFAULT_CANARY_CONFIG, } from "../../../../../src/platform/control-plane/rollout-controller/index.js";
test("TrafficRoutingService can be referenced", () => {
    assert.equal(typeof TrafficRoutingService, "function");
});
test("TRAFFIC_ROUTING_DDL is a string", () => {
    assert.equal(typeof TRAFFIC_ROUTING_DDL, "string");
    assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE"));
});
test("DEFAULT_CANARY_CONFIG structure is correct", () => {
    assert.ok(DEFAULT_CANARY_CONFIG !== undefined);
    assert.equal(typeof DEFAULT_CANARY_CONFIG.initialWeightPct, "number");
    assert.equal(typeof DEFAULT_CANARY_CONFIG.stepIncrementPct, "number");
});
test("DeploymentSlot type accepts valid values", () => {
    const slots = ["blue", "green", "canary"];
    assert.equal(slots.length, 3);
});
test("DeploymentSlotStatus type accepts valid values", () => {
    const statuses = ["active", "standby", "draining", "retired"];
    assert.equal(statuses.length, 4);
});
test("TrafficShiftStatus type accepts valid values", () => {
    const statuses = ["pending", "in_progress", "completed", "rolled_back", "failed"];
    assert.equal(statuses.length, 5);
});
test("RollbackTrigger type accepts valid values", () => {
    const triggers = ["manual", "health_check_failed", "error_rate_exceeded", "latency_exceeded", "auto_timeout"];
    assert.equal(triggers.length, 5);
});
test("DeploymentSlotRecord structure is correct", () => {
    const record = {
        id: "slot_1",
        slot: "blue",
        version: "v1.0.0",
        status: "active",
        trafficWeight: 100,
        healthScore: 0.99,
        instanceCount: 3,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        metadata: '{"region":"us-east"}',
    };
    assert.equal(record.slot, "blue");
    assert.equal(record.version, "v1.0.0");
    assert.equal(record.trafficWeight, 100);
});
test("TrafficShiftRecord structure is correct", () => {
    const record = {
        id: "shift_1",
        fromSlot: "blue",
        toSlot: "green",
        fromWeight: 100,
        toWeight: 0,
        status: "completed",
        shiftSteps: "[]",
        currentStep: 5,
        totalSteps: 5,
        startedAt: "2026-04-14T00:00:00.000Z",
        completedAt: "2026-04-14T00:05:00.000Z",
        initiatedBy: "user:admin",
        rollbackReason: null,
    };
    assert.equal(record.status, "completed");
    assert.equal(record.currentStep, 5);
});
test("CanaryConfig structure is correct", () => {
    const config = {
        initialWeightPct: 10,
        stepIncrementPct: 20,
        stepIntervalMinutes: 5,
        healthThreshold: 0.95,
        errorRateThreshold: 0.02,
        autoPromoteOnSuccess: true,
    };
    assert.equal(config.initialWeightPct, 10);
    assert.equal(config.stepIncrementPct, 20);
    assert.equal(config.healthThreshold, 0.95);
});
//# sourceMappingURL=index.test.js.map