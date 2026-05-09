/**
 * Unit Tests: TrafficRoutingService
 *
 * Tests the blue-green / canary traffic routing service with a real in-memory
 * SQLite database to verify slot management, traffic shifting, and rollback behavior.
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
  type RollbackTrigger,
} from "../../../../../src/platform/control-plane/rollout-controller/traffic-routing-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

/**
 * Creates an in-memory database with the traffic routing schema.
 */
function createTestDb(): AuthoritativeSqlDatabase {
  const db = new DatabaseSync(":memory:");
  db.exec(TRAFFIC_ROUTING_DDL);

  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: db as Pick<DatabaseSync, "exec" | "prepare">,
    migrate: () => {},
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

// ---------------------------------------------------------------------------
// Slot Management Tests
// ---------------------------------------------------------------------------

test("registerSlot creates a new deployment slot", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 2);

  assert.equal(record.slot, "blue");
  assert.equal(record.version, "v1.0.0");
  assert.equal(record.status, "standby");
  assert.equal(record.trafficWeight, 0);
  assert.equal(record.instanceCount, 2);
  assert.equal(record.healthScore, null);
  assert.ok(record.id.startsWith("dslot_"));
});

test("registerSlot with metadata serializes it correctly", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("green", "v2.0.0", 1, { region: "us-east", priority: "high" });

  assert.equal(record.slot, "green");
  assert.ok(record.metadata !== null);
  const metadata = JSON.parse(record.metadata!);
  assert.equal(metadata.region, "us-east");
  assert.equal(metadata.priority, "high");
});

test("getActiveSlot returns the most recent active/standby slot by created_at", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  // Register first blue slot
  const first = service.registerSlot("blue", "v1.0.0", 1);
  // Manually update created_at to be older
  db.connection.prepare(`UPDATE deployment_slots SET created_at = '2025-01-01T00:00:00.000Z' WHERE id = ?`).run(first.id);

  // Register second blue slot (newer)
  const second = service.registerSlot("blue", "v1.1.0", 1);

  const active = service.getActiveSlot("blue");
  assert.ok(active !== null);
  // Should return the second slot which has the newer created_at
  assert.equal(active.version, "v1.1.0");
});

test("getActiveSlot returns null when no slot exists", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const active = service.getActiveSlot("blue");
  assert.equal(active, null);
});

test("listSlots returns all active and standby slots", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 2);
  service.registerSlot("canary", "v3.0.0", 1);

  const slots = service.listSlots();
  assert.equal(slots.length, 3);
});

test("updateHealth modifies the health score of a slot", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 1);
  service.updateHealth(record.id, 0.98);

  const updated = service.getActiveSlot("blue");
  assert.ok(updated !== null);
  assert.equal(updated.healthScore, 0.98);
});

// ---------------------------------------------------------------------------
// Traffic Shift Tests
// ---------------------------------------------------------------------------

test("startCanaryShift creates a new shift with correct steps", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  // Register source slot first
  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  assert.equal(shift.fromSlot, "blue");
  assert.equal(shift.toSlot, "green");
  assert.equal(shift.fromWeight, 100);
  assert.equal(shift.status, "in_progress");
  assert.equal(shift.currentStep, 0);
  assert.ok(shift.id.startsWith("tshift_"));

  // Verify steps are generated: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 100]
  const steps = JSON.parse(shift.shiftSteps);
  assert.deepEqual(steps, [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 100]);
  assert.equal(shift.totalSteps, 11);
});

test("startCanaryShift applies initial traffic weights", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  service.startCanaryShift("blue", "green");

  const blue = service.getActiveSlot("blue");
  const green = service.getActiveSlot("green");

  assert.ok(blue !== null);
  assert.ok(green !== null);
  assert.equal(blue.trafficWeight, 95);
  assert.equal(green.trafficWeight, 5);
});

test("startCanaryShift respects custom canary config", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const customConfig: CanaryConfig = {
    initialWeightPct: 10,
    stepIncrementPct: 20,
    stepIntervalMinutes: 3,
    healthThreshold: 0.9,
    errorRateThreshold: 0.05,
    autoPromoteOnSuccess: false,
  };

  const shift = service.startCanaryShift("blue", "green", customConfig);

  // Steps should be: [10, 30, 50, 70, 90, 100]
  const steps = JSON.parse(shift.shiftSteps);
  assert.deepEqual(steps, [10, 30, 50, 70, 90, 100]);
  assert.equal(shift.totalSteps, 6);
});

test("advanceShift progresses the traffic shift", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const advanced = service.advanceShift(shift.id);

  assert.ok(advanced !== null);
  assert.equal(advanced.currentStep, 1);
  assert.equal(advanced.toWeight, 15);

  // Verify traffic weights updated
  const green = service.getActiveSlot("green");
  assert.ok(green !== null);
  assert.equal(green.trafficWeight, 15);
});

test("advanceShift returns null for non-existent shift", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const result = service.advanceShift("nonexistent_shift_id");
  assert.equal(result, null);
});

test("advanceShift completes the shift when all steps are done", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Advance through all steps
  for (let i = 0; i < shift.totalSteps; i++) {
    const result = service.advanceShift(shift.id);
    assert.ok(result !== null);
  }

  // Verify shift is completed
  const completed = service.getShift(shift.id);
  assert.ok(completed !== null);
  assert.equal(completed.status, "completed");
  assert.equal(completed.toWeight, 100);

  // Verify green slot is now active with 100% traffic
  const green = service.getActiveSlot("green");
  assert.ok(green !== null);
  assert.equal(green.trafficWeight, 100);
  assert.equal(green.status, "active");
});

test("getShift retrieves a shift by ID", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const retrieved = service.getShift(shift.id);

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.id, shift.id);
  assert.equal(retrieved!.fromSlot, "blue");
  assert.equal(retrieved!.toSlot, "green");
});

test("getShift returns null for non-existent shift", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const result = service.getShift("nonexistent");
  assert.equal(result, null);
});

test("listShifts returns recent shifts", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);
  service.registerSlot("canary", "v3.0.0", 1);

  service.startCanaryShift("blue", "green");
  service.startCanaryShift("green", "canary");

  const shifts = service.listShifts();
  assert.equal(shifts.length, 2);
});

// ---------------------------------------------------------------------------
// Rollback Tests
// ---------------------------------------------------------------------------

test("rollbackShift restores traffic to source slot", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  const rollback = service.rollbackShift(shift.id, "manual", "User requested rollback");

  assert.equal(rollback.trigger, "manual");
  assert.equal(rollback.reason, "User requested rollback");
  assert.equal(rollback.success, true);
  assert.ok(rollback.id.startsWith("rbk_"));

  // Verify shift status is rolled_back
  const rolledBackShift = service.getShift(shift.id);
  assert.ok(rolledBackShift !== null);
  assert.equal(rolledBackShift!.status, "rolled_back");
  assert.equal(rolledBackShift!.rollbackReason, "User requested rollback");
});

test("rollbackShift with health_check_failed trigger", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "health_check_failed", "Health score dropped below threshold");

  assert.equal(rollback.trigger, "health_check_failed");
  assert.ok(rollback.reason.includes("Health score"));
});

test("rollbackShift with error_rate_exceeded trigger", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "error_rate_exceeded", "Error rate exceeded 2%");

  assert.equal(rollback.trigger, "error_rate_exceeded");
});

test("rollbackShift with latency_exceeded trigger", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "latency_exceeded", "P99 latency exceeded 500ms");

  assert.equal(rollback.trigger, "latency_exceeded");
});

test("rollbackShift with auto_timeout trigger", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "auto_timeout", "Canary did not stabilize within timeout");

  assert.equal(rollback.trigger, "auto_timeout");
});

test("listRollbacks returns recent rollback records ordered by executed_at desc", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift1 = service.startCanaryShift("blue", "green");
  const rollback1 = service.rollbackShift(shift1.id, "manual", "First rollback");

  service.registerSlot("blue", "v2.0.1", 1);
  const shift2 = service.startCanaryShift("blue", "green");
  const rollback2 = service.rollbackShift(shift2.id, "health_check_failed", "Second rollback");

  // Manually adjust executed_at timestamps to ensure proper ordering
  db.connection.prepare(`UPDATE rollback_records SET executed_at = '2026-04-20T00:00:00.000Z' WHERE id = ?`).run(rollback1.id);
  db.connection.prepare(`UPDATE rollback_records SET executed_at = '2026-04-21T00:00:00.000Z' WHERE id = ?`).run(rollback2.id);

  const rollbacks = service.listRollbacks();
  assert.equal(rollbacks.length, 2);
  // Most recent should be first
  assert.equal(rollbacks[0]!.trigger, "health_check_failed");
  assert.equal(rollbacks[1]!.trigger, "manual");
});

test("listRollbacks respects limit parameter", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  for (let i = 0; i < 5; i++) {
    const shift = service.startCanaryShift("blue", "green");
    service.rollbackShift(shift.id, "manual", `Rollback ${i}`);
    // Register new slot for next iteration
    service.registerSlot("blue", `v1.0.${i + 1}`, 1);
  }

  const rollbacks = service.listRollbacks(3);
  assert.equal(rollbacks.length, 3);
});

// ---------------------------------------------------------------------------
// Canary Health Check Tests
// ---------------------------------------------------------------------------

test("checkCanaryHealth returns healthy when above threshold", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenRecord = service.registerSlot("green", "v2.0.0", 1);
  service.updateHealth(greenRecord.id, 0.98);

  const shift = service.startCanaryShift("blue", "green");

  const health = service.checkCanaryHealth(shift.id);
  assert.equal(health.healthy, true);
  assert.equal(health.reason, "canary_healthy");
});

test("checkCanaryHealth returns unhealthy when below threshold", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenRecord = service.registerSlot("green", "v2.0.0", 1);
  service.updateHealth(greenRecord.id, 0.90); // Below default threshold of 0.95

  const shift = service.startCanaryShift("blue", "green");

  const health = service.checkCanaryHealth(shift.id);
  assert.equal(health.healthy, false);
  assert.ok(health.reason.includes("health_score_0.9"));
});

test("checkCanaryHealth returns shift_not_active when shift is completed", () => {
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

test("checkCanaryHealth returns shift_not_active when shift does not exist", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const health = service.checkCanaryHealth("nonexistent_shift");
  assert.equal(health.healthy, false);
  assert.equal(health.reason, "shift_not_active");
});

test("checkCanaryHealth returns no_health_data when health score is null", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1); // No health update

  const shift = service.startCanaryShift("blue", "green");

  const health = service.checkCanaryHealth(shift.id);
  assert.equal(health.healthy, false);
  assert.equal(health.reason, "no_health_data");
});

test("checkCanaryHealth respects custom health threshold", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  const greenRecord = service.registerSlot("green", "v2.0.0", 1);
  service.updateHealth(greenRecord.id, 0.92);

  const shift = service.startCanaryShift("blue", "green");

  // With default threshold (0.95), should be unhealthy
  const health1 = service.checkCanaryHealth(shift.id);
  assert.equal(health1.healthy, false);

  // With custom threshold of 0.90, should be healthy
  const customConfig: CanaryConfig = { ...DEFAULT_CANARY_CONFIG, healthThreshold: 0.90 };
  const health2 = service.checkCanaryHealth(shift.id, customConfig);
  assert.equal(health2.healthy, true);
});

// ---------------------------------------------------------------------------
// List Shifts Tests
// ---------------------------------------------------------------------------

test("listShifts returns shifts in descending order by start time", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift1 = service.startCanaryShift("blue", "green");
  // Adjust started_at to be older
  db.connection.prepare(`UPDATE traffic_shifts SET started_at = '2026-04-20T00:00:00.000Z' WHERE id = ?`).run(shift1.id);

  service.registerSlot("blue", "v1.0.1", 1);
  const shift2 = service.startCanaryShift("blue", "green");

  const shifts = service.listShifts();
  assert.equal(shifts.length, 2);
  // Most recent first
  assert.equal(shifts[0]!.id, shift2.id);
  assert.equal(shifts[1]!.id, shift1.id);
});

test("listShifts respects limit parameter", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  for (let i = 0; i < 5; i++) {
    service.startCanaryShift("blue", "green");
    // Register new slot for next iteration
    service.registerSlot("blue", `v1.0.${i + 1}`, 1);
  }

  const shifts = service.listShifts(3);
  assert.equal(shifts.length, 3);
});

// ---------------------------------------------------------------------------
// Canary Config Tests
// ---------------------------------------------------------------------------

test("DEFAULT_CANARY_CONFIG has expected structure for canary deployment", () => {
  assert.equal(DEFAULT_CANARY_CONFIG.initialWeightPct, 5);
  assert.equal(DEFAULT_CANARY_CONFIG.stepIncrementPct, 10);
  assert.equal(DEFAULT_CANARY_CONFIG.stepIntervalMinutes, 5);
  assert.equal(DEFAULT_CANARY_CONFIG.healthThreshold, 0.95);
  assert.equal(DEFAULT_CANARY_CONFIG.errorRateThreshold, 0.02);
  assert.equal(DEFAULT_CANARY_CONFIG.autoPromoteOnSuccess, true);

  // Verify steps calculation: starting at 5, incrementing by 10 until 100
  // [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 100]
  const steps: number[] = [];
  let weight = DEFAULT_CANARY_CONFIG.initialWeightPct;
  while (weight < 100) {
    steps.push(weight);
    weight += DEFAULT_CANARY_CONFIG.stepIncrementPct;
  }
  steps.push(100);
  assert.equal(steps.length, 11);
});

test("canary shift with minimal steps config", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const minimalConfig: CanaryConfig = {
    initialWeightPct: 50,
    stepIncrementPct: 50,
    stepIntervalMinutes: 10,
    healthThreshold: 0.99,
    errorRateThreshold: 0.01,
    autoPromoteOnSuccess: false,
  };

  const shift = service.startCanaryShift("blue", "green", minimalConfig);

  // Steps: [50, 100]
  const steps = JSON.parse(shift.shiftSteps);
  assert.deepEqual(steps, [50, 100]);
  assert.equal(shift.totalSteps, 2);
});

// ---------------------------------------------------------------------------
// Traffic Routing DDL Tests
// ---------------------------------------------------------------------------

test("TRAFFIC_ROUTING_DDL creates all required tables and indexes", () => {
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE IF NOT EXISTS deployment_slots"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE IF NOT EXISTS traffic_shifts"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE TABLE IF NOT EXISTS rollback_records"));

  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE INDEX IF NOT EXISTS idx_deployment_slots_slot"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE INDEX IF NOT EXISTS idx_traffic_shifts_status"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("CREATE INDEX IF NOT EXISTS idx_rollback_records_shift"));
});

test("TRAFFIC_ROUTING_DDL has correct column definitions", () => {
  // deployment_slots
  assert.ok(TRAFFIC_ROUTING_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("slot TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("version TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("status TEXT NOT NULL DEFAULT 'standby'"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("traffic_weight REAL NOT NULL DEFAULT 0"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("health_score REAL NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("instance_count INTEGER NOT NULL DEFAULT 1"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("created_at TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("updated_at TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("metadata TEXT NULL"));

  // traffic_shifts
  assert.ok(TRAFFIC_ROUTING_DDL.includes("from_slot TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("to_slot TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("from_weight REAL NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("to_weight REAL NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("shift_steps TEXT NOT NULL DEFAULT '[]'"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("current_step INTEGER NOT NULL DEFAULT 0"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("total_steps INTEGER NOT NULL DEFAULT 1"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("rollback_reason TEXT NULL"));

  // rollback_records
  assert.ok(TRAFFIC_ROUTING_DDL.includes("shift_id TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("trigger TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("from_version TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("to_version TEXT NOT NULL"));
  assert.ok(TRAFFIC_ROUTING_DDL.includes("success INTEGER NOT NULL DEFAULT 0"));
});

// ---------------------------------------------------------------------------
// R4-14: P2 → P3/P4 OperationalDirective Emission
// ---------------------------------------------------------------------------

test("startCanaryShift emits OperationalDirective with mode_switch type", () => {
  const db = createTestDb();

  const emittedDirectives: any[] = [];
  const directiveSink = {
    emitOperationalDirective(directive: any) {
      emittedDirectives.push(directive);
    },
    emitDecisionDirective(_directive: any) {},
  };

  const service = new TrafficRoutingService(db, directiveSink as any);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  service.startCanaryShift("blue", "green");

  assert.strictEqual(emittedDirectives.length, 1);
  const directive = emittedDirectives[0];
  assert.strictEqual(directive.type, "mode_switch");
  assert.ok(directive.scope.harnessRunId.startsWith("tshift_"));
  assert.strictEqual(directive.params.fromSlot, "blue");
  assert.strictEqual(directive.params.toSlot, "green");
});

test("rollbackShift emits OperationalDirective with rollback type", () => {
  const db = createTestDb();

  const emittedDirectives: any[] = [];
  const directiveSink = {
    emitOperationalDirective(directive: any) {
      emittedDirectives.push(directive);
    },
    emitDecisionDirective(_directive: any) {},
  };

  const service = new TrafficRoutingService(db, directiveSink as any);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  emittedDirectives.length = 0; // clear startCanaryShift directive
  service.rollbackShift(shift.id, "manual", "User requested rollback");

  assert.strictEqual(emittedDirectives.length, 1);
  const directive = emittedDirectives[0];
  assert.strictEqual(directive.type, "rollback");
  assert.strictEqual(directive.scope.harnessRunId, shift.id);
  assert.strictEqual(directive.params.shiftId, shift.id);
  assert.strictEqual(directive.params.trigger, "manual");
});

test("TrafficRoutingService uses no-op directive sink when none provided", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Should not throw even with no directive sink
  const shift = service.startCanaryShift("blue", "green");
  assert.ok(shift.id.startsWith("tshift_"));

  const rollback = service.rollbackShift(shift.id, "manual", "test");
  assert.strictEqual(rollback.success, true);
});
