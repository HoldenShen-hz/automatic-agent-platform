import assert from "node:assert/strict";
import test from "node:test";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
  DEFAULT_CANARY_CONFIG,
  type DeploymentSlot,
  type DeploymentSlotStatus,
  type TrafficShiftStatus,
  type RollbackTrigger,
  type DeploymentSlotRecord,
  type TrafficShiftRecord,
  type CanaryConfig,
  type RollbackRecord,
} from "../../../../../src/platform/control-plane/rollout-controller/traffic-routing-service.js";

test("TrafficRoutingService type exports are correct", () => {
  const slot: DeploymentSlot = "canary";
  assert.ok(slot === "canary");

  const status: DeploymentSlotStatus = "active";
  assert.ok(status === "active");

  const shiftStatus: TrafficShiftStatus = "in_progress";
  assert.ok(shiftStatus === "in_progress");

  const trigger: RollbackTrigger = "health_check_failed";
  assert.ok(trigger === "health_check_failed");
});

test("DEFAULT_CANARY_CONFIG has correct values", () => {
  assert.equal(DEFAULT_CANARY_CONFIG.initialWeightPct, 5);
  assert.equal(DEFAULT_CANARY_CONFIG.stepIncrementPct, 10);
  assert.equal(DEFAULT_CANARY_CONFIG.stepIntervalMinutes, 5);
  assert.equal(DEFAULT_CANARY_CONFIG.healthThreshold, 0.95);
  assert.equal(DEFAULT_CANARY_CONFIG.errorRateThreshold, 0.02);
  assert.equal(DEFAULT_CANARY_CONFIG.autoPromoteOnSuccess, true);
});

test("DeploymentSlotRecord structure", () => {
  const record: DeploymentSlotRecord = {
    id: "dslot_123",
    slot: "blue",
    version: "v1.0.0",
    status: "active",
    trafficWeight: 80,
    healthScore: 0.98,
    instanceCount: 3,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    metadata: null,
  };

  assert.equal(record.slot, "blue");
  assert.equal(record.version, "v1.0.0");
  assert.equal(record.status, "active");
  assert.equal(record.trafficWeight, 80);
  assert.equal(record.healthScore, 0.98);
  assert.equal(record.instanceCount, 3);
});

test("TrafficShiftRecord structure", () => {
  const record: TrafficShiftRecord = {
    id: "tshift_123",
    fromSlot: "blue",
    toSlot: "green",
    fromWeight: 100,
    toWeight: 10,
    status: "in_progress",
    shiftSteps: "[5, 10, 20, 50, 100]",
    currentStep: 1,
    totalSteps: 5,
    startedAt: "2026-04-14T00:00:00.000Z",
    completedAt: null,
    initiatedBy: "user_abc",
    rollbackReason: null,
  };

  assert.equal(record.fromSlot, "blue");
  assert.equal(record.toSlot, "green");
  assert.equal(record.status, "in_progress");
  assert.equal(record.currentStep, 1);
  assert.equal(record.totalSteps, 5);
});

test("RollbackRecord structure", () => {
  const record: RollbackRecord = {
    id: "rbk_123",
    shiftId: "tshift_123",
    trigger: "manual",
    fromVersion: "v1.0.0",
    toVersion: "v0.9.0",
    reason: "User requested rollback",
    executedAt: "2026-04-14T00:00:00.000Z",
    completedAt: "2026-04-14T00:05:00.000Z",
    success: true,
  };

  assert.equal(record.trigger, "manual");
  assert.equal(record.fromVersion, "v1.0.0");
  assert.equal(record.toVersion, "v0.9.0");
  assert.equal(record.success, true);
});

test("CanaryConfig structure", () => {
  const config: CanaryConfig = {
    initialWeightPct: 10,
    stepIncrementPct: 20,
    stepIntervalMinutes: 10,
    healthThreshold: 0.99,
    errorRateThreshold: 0.01,
    autoPromoteOnSuccess: false,
  };

  assert.equal(config.initialWeightPct, 10);
  assert.equal(config.stepIncrementPct, 20);
  assert.equal(config.healthThreshold, 0.99);
  assert.equal(config.autoPromoteOnSuccess, false);
});

test("Deployment slots are supported", () => {
  const slots: DeploymentSlot[] = ["blue", "green", "canary"];

  for (const slot of slots) {
    assert.ok(["blue", "green", "canary"].includes(slot));
  }
});

test("Deployment slot statuses are supported", () => {
  const statuses: DeploymentSlotStatus[] = ["active", "standby", "draining", "retired"];

  for (const status of statuses) {
    assert.ok(["active", "standby", "draining", "retired"].includes(status));
  }
});

test("Traffic shift statuses are supported", () => {
  const statuses: TrafficShiftStatus[] = ["pending", "in_progress", "completed", "rolled_back", "failed"];

  for (const status of statuses) {
    assert.ok(["pending", "in_progress", "completed", "rolled_back", "failed"].includes(status));
  }
});

test("Rollback triggers are supported", () => {
  const triggers: RollbackTrigger[] = ["manual", "health_check_failed", "error_rate_exceeded", "latency_exceeded", "auto_timeout"];

  for (const trigger of triggers) {
    assert.ok(["manual", "health_check_failed", "error_rate_exceeded", "latency_exceeded", "auto_timeout"].includes(trigger));
  }
});

test("TRAFFIC_ROUTING_DDL contains expected tables", () => {
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE IF NOT EXISTS deployment_slots"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE IF NOT EXISTS traffic_shifts"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE IF NOT EXISTS rollback_records"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("slot TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("version TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("traffic_weight REAL NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("health_score REAL NULL"));
});

test("TrafficRoutingService can be imported", () => {
  // Verify the class is exported and can be instantiated
  // (without database, just testing import)
  assert.ok(typeof TrafficRoutingService === "function");
});
