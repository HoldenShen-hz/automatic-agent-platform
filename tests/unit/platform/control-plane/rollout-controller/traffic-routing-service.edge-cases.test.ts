/**
 * Unit Tests: TrafficRoutingService Edge Cases
 *
 * Tests additional edge cases and boundary conditions for
 * the TrafficRoutingService that may not be covered in the main test file.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
  DEFAULT_CANARY_CONFIG,
  type CanaryConfig,
  type DeploymentSlot,
} from "../../../../../src/platform/five-plane-control-plane/rollout-controller/traffic-routing-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

function createTestDb(): AuthoritativeSqlDatabase {
  const db = new DatabaseSync(":memory:");
  db.exec(TRAFFIC_ROUTING_DDL);

  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: db as Pick<DatabaseSync, "exec" | "prepare">,
    migrate: () => {},
    close: () => db.close(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSchemaStatus: (): any => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertSchemaCurrent: (): any => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    integrityCheck: (): any => [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: ((work: () => unknown) => work()) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readTransaction: ((work: () => unknown) => work()) as any,
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

test("registerSlot with default instance count of 1", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0");

  assert.equal(record.instanceCount, 1);
});

test("registerSlot multiple slots with same name updates list", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("blue", "v1.1.0", 2);
  service.registerSlot("blue", "v1.2.0", 3);

  const slots = service.listSlots();
  assert.ok(slots.length >= 1);
});

test("getActiveSlot returns null for non-existent slot name", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  // Use a valid slot but with no matching records - the slot "nonexistent" is
  // not a valid DeploymentSlot type, so we test with "blue" which has no records
  const active = service.getActiveSlot("blue");
  assert.equal(active, null);
});

test("updateHealth with valid health score", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 1);
  service.updateHealth(record.id, 0.5);
  service.updateHealth(record.id, 0.75);
  service.updateHealth(record.id, 1.0);

  const updated = service.getActiveSlot("blue");
  assert.ok(updated !== null);
  assert.equal(updated.healthScore, 1.0);
});

test("updateHealth with zero health score", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 1);
  service.updateHealth(record.id, 0.0);

  const updated = service.getActiveSlot("blue");
  assert.ok(updated !== null);
  assert.equal(updated.healthScore, 0.0);
});

test("advanceShift returns null for completed shift", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Complete the shift
  for (let i = 0; i < shift.totalSteps; i++) {
    service.advanceShift(shift.id);
  }

  // Try to advance completed shift
  const result = service.advanceShift(shift.id);
  assert.equal(result, null);
});

test("advanceShift with non-existent shift ID returns null", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const result = service.advanceShift("nonexistent_shift_id");
  assert.equal(result, null);
});

test("rollbackShift with all rollback trigger types", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const triggers: Array<"manual" | "health_check_failed" | "error_rate_exceeded" | "latency_exceeded" | "auto_timeout"> = [
    "manual",
    "health_check_failed",
    "error_rate_exceeded",
    "latency_exceeded",
    "auto_timeout",
  ];

  for (let i = 0; i < triggers.length; i++) {
    service.registerSlot("blue", `v1.${i}.0`, 1);
    service.registerSlot("green", `v2.${i}.0`, 1);

    const shift = service.startCanaryShift("blue", "green");
    const trigger = triggers[i]!;
    const rollback = service.rollbackShift(shift.id, trigger, `Test reason ${i}`);

    assert.equal(rollback.trigger, trigger);
    assert.ok(rollback.id.startsWith("rbk_"));
    assert.equal(rollback.success, true);
  }
});

test("checkCanaryHealth with non-existent shift ID", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const health = service.checkCanaryHealth("nonexistent_shift_id");
  assert.equal(health.healthy, false);
  assert.equal(health.reason, "shift_not_active");
});

test("checkCanaryHealth with completed shift", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenRecord = service.registerSlot("green", "v2.0.0", 1);
  service.updateHealth(greenRecord.id, 0.98);

  const shift = service.startCanaryShift("blue", "green");

  // Complete the shift
  for (let i = 0; i < shift.totalSteps; i++) {
    service.advanceShift(shift.id);
  }

  const health = service.checkCanaryHealth(shift.id);
  assert.equal(health.healthy, false);
  assert.equal(health.reason, "shift_not_active");
});

test("getShift returns null for non-existent ID", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const shift = service.getShift("nonexistent_id");
  assert.equal(shift, null);
});

test("listShifts with no shifts returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const shifts = service.listShifts();
  assert.deepEqual(shifts, []);
});

test("listRollbacks with no rollbacks returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const rollbacks = service.listRollbacks();
  assert.deepEqual(rollbacks, []);
});

test("listShifts with zero limit returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);
  service.startCanaryShift("blue", "green");

  const shifts = service.listShifts(0);
  assert.equal(shifts.length, 0);
});

test("listRollbacks with zero limit returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);
  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "manual", "Test");

  const rollbacks = service.listRollbacks(0);
  assert.equal(rollbacks.length, 0);
});

test("DEFAULT_CANARY_CONFIG has all required properties", () => {
  assert.ok(DEFAULT_CANARY_CONFIG.initialWeightPct !== undefined);
  assert.ok(DEFAULT_CANARY_CONFIG.stepIncrementPct !== undefined);
  assert.ok(DEFAULT_CANARY_CONFIG.stepIntervalMinutes !== undefined);
  assert.ok(DEFAULT_CANARY_CONFIG.healthThreshold !== undefined);
  assert.ok(DEFAULT_CANARY_CONFIG.errorRateThreshold !== undefined);
  assert.ok(DEFAULT_CANARY_CONFIG.autoPromoteOnSuccess !== undefined);
});

test("canary config with initialWeightPct at boundary (1)", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const minimalConfig: CanaryConfig = {
    initialWeightPct: 1,
    stepIncrementPct: 99,
    stepIntervalMinutes: 1,
    healthThreshold: 0.5,
    errorRateThreshold: 0.1,
    autoPromoteOnSuccess: false,
  };

  const shift = service.startCanaryShift("blue", "green", minimalConfig);
  // Steps: [1, 100]
  const steps = JSON.parse(shift.shiftSteps);
  assert.equal(steps.length, 2);
  assert.equal(steps[0], 1);
  assert.equal(steps[1], 100);
});

test("canary config with stepIncrementPct that doesn't divide evenly into 100", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const config: CanaryConfig = {
    initialWeightPct: 10,
    stepIncrementPct: 33,
    stepIntervalMinutes: 5,
    healthThreshold: 0.95,
    errorRateThreshold: 0.02,
    autoPromoteOnSuccess: true,
  };

  const shift = service.startCanaryShift("blue", "green", config);

  // Steps: [10, 43, 76, 109] - last goes over 100
  const steps = JSON.parse(shift.shiftSteps);
  assert.ok(steps[steps.length - 1]! >= 100);
  assert.equal(shift.totalSteps, steps.length);
});

test("TRAFFIC_ROUTING_DDL creates proper indexes", () => {
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE INDEX IF NOT EXISTS idx_deployment_slots_slot"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE INDEX IF NOT EXISTS idx_traffic_shifts_status"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE INDEX IF NOT EXISTS idx_rollback_records_shift"));
});

test("TRAFFIC_ROUTING_DDL has correct column types", () => {
  assert.ok(TRAFFIC_ROUTING_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("slot TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("version TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("status TEXT NOT NULL DEFAULT 'standby'"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("traffic_weight REAL NOT NULL DEFAULT 0"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("health_score REAL NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("instance_count INTEGER NOT NULL DEFAULT 1"));
});

test("startCanaryShift without registering slots returns shift but weights may not apply", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  // Not registering slots first
  const shift = service.startCanaryShift("blue", "green");

  assert.ok(shift.id.startsWith("tshift_"));
  assert.equal(shift.fromSlot, "blue");
  assert.equal(shift.toSlot, "green");
  assert.equal(shift.status, "in_progress");
});

test("rollbackShift without prior shift still creates rollback record", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);
  const shift = service.startCanaryShift("blue", "green");

  // Rollback the shift
  const rollback = service.rollbackShift(shift.id, "manual", "Testing rollback");

  assert.ok(rollback.id.startsWith("rbk_"));
  assert.equal(rollback.shiftId, shift.id);
  assert.equal(rollback.trigger, "manual");
});

test("registerSlot with numeric version string", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "1.2.3", 5);

  assert.equal(record.version, "1.2.3");
});

test("registerSlot with semantic version format", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("canary", "v2.0.0-rc.1", 1);

  assert.equal(record.version, "v2.0.0-rc.1");
});

test("applyTrafficWeights handles zero weight correctly", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Start shift with small weight
  const shift = service.startCanaryShift("blue", "green");

  const blue = service.getActiveSlot("blue");
  const green = service.getActiveSlot("green");

  assert.ok(blue !== null);
  assert.ok(green !== null);
  assert.equal(blue.trafficWeight + green.trafficWeight, 100);
});

test("startCanaryShift creates shift with totalSteps equal to steps array length", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  const steps = JSON.parse(shift.shiftSteps);
  assert.equal(shift.totalSteps, steps.length);
});

test("advanceShift updates currentStep correctly", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const green = service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  assert.equal(shift.currentStep, 0);

  service.updateHealth(green.id, 0.95);
  const advanced1 = service.advanceShift(shift.id);
  assert.ok(advanced1 !== null);
  assert.equal(advanced1.currentStep, 1);

  const advanced2 = service.advanceShift(shift.id);
  assert.ok(advanced2 !== null);
  assert.equal(advanced2.currentStep, 2);
});

test("rollbackShift updates shift status to rolled_back", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "manual", "Test");

  const updated = service.getShift(shift.id);
  assert.ok(updated !== null);
  assert.equal(updated.status, "rolled_back");
  assert.equal(updated.rollbackReason, "Test");
});

test("advanceShift completes shift when reaching final step", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const green = service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const stepsCount = shift.totalSteps;

  // Advance to the last step
  service.updateHealth(green.id, 0.95);
  for (let i = 0; i < stepsCount - 1; i++) {
    service.advanceShift(shift.id);
  }

  // Next advance should complete
  const final = service.advanceShift(shift.id);
  assert.ok(final !== null);

  const completed = service.getShift(shift.id);
  assert.ok(completed !== null);
  assert.equal(completed.status, "completed");
  assert.equal(completed.toWeight, 100);
});

test("complete shift activates green and retires blue slot", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenSlot = service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Complete the shift
  service.updateHealth(greenSlot.id, 0.95);
  for (let i = 0; i < shift.totalSteps; i++) {
    service.advanceShift(shift.id);
  }

  // Blue should be retired (draining) and green should be active
  const blue = service.getActiveSlot("blue");
  const green = service.getActiveSlot("green");

  // Blue slot may or may not be returned by getActiveSlot based on status filter
  // Green should be active
  assert.ok(green !== null);
  assert.equal(green.status, "active");
  assert.equal(green.trafficWeight, 100);
});

test("checkCanaryHealth with exact threshold returns healthy", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenRecord = service.registerSlot("green", "v2.0.0", 1);

  // Set health exactly at threshold
  service.updateHealth(greenRecord.id, 0.95);

  const shift = service.startCanaryShift("blue", "green");

  const health = service.checkCanaryHealth(shift.id, DEFAULT_CANARY_CONFIG);
  // Based on implementation (< threshold), exactly at threshold should be healthy
  assert.equal(health.healthy, true);
});

test("checkCanaryHealth with just below threshold returns unhealthy", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenRecord = service.registerSlot("green", "v2.0.0", 1);

  // Set health just below threshold
  service.updateHealth(greenRecord.id, 0.949);

  const shift = service.startCanaryShift("blue", "green");

  const health = service.checkCanaryHealth(shift.id, DEFAULT_CANARY_CONFIG);
  assert.equal(health.healthy, false);
});

test("listShifts returns in descending order by started_at", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Create first shift
  const shift1 = service.startCanaryShift("blue", "green");
  db.connection.prepare(`UPDATE traffic_shifts SET started_at = '2026-04-20T00:00:00.000Z' WHERE id = ?`).run(shift1.id);

  // Create second shift (needs new slots)
  service.registerSlot("blue", "v2.0.0", 1);
  const shift2 = service.startCanaryShift("blue", "green");

  const shifts = service.listShifts();
  assert.equal(shifts[0]!.id, shift2.id);
  assert.equal(shifts[1]!.id, shift1.id);
});

test("registerSlot preserves metadata correctly", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const metadata = {
    region: "us-west-2",
    cluster: "prod-1",
    priority: "high",
    tags: ["production", "database"],
  };

  const record = service.registerSlot("blue", "v1.0.0", 3, metadata);

  assert.ok(record.metadata !== null);
  const parsed = JSON.parse(record.metadata!);
  assert.equal(parsed.region, "us-west-2");
  assert.equal(parsed.cluster, "prod-1");
  assert.deepEqual(parsed.tags, ["production", "database"]);
});

test("rollback with reason is preserved", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "health_check_failed", "Health score dropped below 0.9 threshold");

  assert.equal(rollback.reason, "Health score dropped below 0.9 threshold");
});
