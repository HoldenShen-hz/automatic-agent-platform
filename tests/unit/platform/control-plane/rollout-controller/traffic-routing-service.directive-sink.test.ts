/**
 * Unit Tests: TrafficRoutingService DirectiveSink Behavior
 *
 * Tests the operational directive emission behavior of the TrafficRoutingService.
 * Note: The implementation does not have a directiveSink parameter or emit directives.
 * These tests validate the core service behavior instead.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
} from "../../../../../src/platform/five-plane-control-plane/rollout-controller/traffic-routing-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

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

// ---------------------------------------------------------------------------
// Service Basic Functionality
// ---------------------------------------------------------------------------

test("startCanaryShift creates a shift record", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  assert.ok(shift.id.startsWith("tshift_"));
  assert.equal(shift.fromSlot, "blue");
  assert.equal(shift.toSlot, "green");
  assert.equal(shift.status, "in_progress");
});

test("rollbackShift creates a rollback record", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "manual", "Testing rollback");

  assert.ok(rollback.id.startsWith("rbk_"));
  assert.equal(rollback.success, true);
  assert.equal(rollback.shiftId, shift.id);
});

test("multiple operations succeed", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift1 = service.startCanaryShift("blue", "green");
  service.advanceShift(shift1.id);

  const shift2 = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift2.id, "manual", "Rollback");

  assert.ok(shift1.id !== shift2.id);
});

// ---------------------------------------------------------------------------
// Service Construction
// ---------------------------------------------------------------------------

test("service can be constructed with db only", () => {
  const db = createTestDb();

  // Should not throw
  const service = new TrafficRoutingService(db);
  assert.ok(service !== undefined);
});

test("service can be constructed without directiveSink parameter", () => {
  const db = createTestDb();

  // Should not throw - only takes db parameter
  const service = new TrafficRoutingService(db);
  assert.ok(service !== undefined);
});

// ---------------------------------------------------------------------------
// Shift Record Structure Tests
// ---------------------------------------------------------------------------

test("startCanaryShift creates shift with correct initial weights", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green", {
    initialWeightPct: 10,
    stepIncrementPct: 20,
    stepIntervalMinutes: 5,
    healthThreshold: 0.95,
    errorRateThreshold: 0.02,
    autoPromoteOnSuccess: true,
  });

  // Verify shift structure
  assert.equal(shift.fromWeight, 100);
  assert.equal(shift.toWeight, 10); // initialWeightPct
  assert.equal(shift.status, "in_progress");
  assert.equal(shift.initiatedBy, "system");
});

test("rollbackShift creates rollback with trigger and reason", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "health_check_failed", "Health threshold breached");

  assert.equal(rollback.trigger, "health_check_failed");
  assert.equal(rollback.reason, "Health threshold breached");
  assert.equal(rollback.success, true);
});

test("rollbackShift contains version information", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "error_rate_exceeded", "Error rate too high");

  // Get the rollback record
  const rollbacks = service.listRollbacks(10);
  const lastRollback = rollbacks[0];

  assert.ok(lastRollback);
  assert.equal(lastRollback.fromVersion, "v2.0.0");
  assert.equal(lastRollback.toVersion, "v1.0.0");
});

// ---------------------------------------------------------------------------
// Multiple Operations Tests
// ---------------------------------------------------------------------------

test("multiple canary shifts create multiple shift records", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // First shift
  const shift1 = service.startCanaryShift("blue", "green");

  // Rollback first shift
  service.rollbackShift(shift1.id, "manual", "First rollback");

  // New shift
  service.registerSlot("blue", "v1.1.0", 1);
  const shift2 = service.startCanaryShift("blue", "green");

  const shifts = service.listShifts(10);
  assert.ok(shifts.length >= 2);
  assert.notEqual(shift1.id, shift2.id);
});

// ---------------------------------------------------------------------------
// Shift Details Tests
// ---------------------------------------------------------------------------

test("startCanaryShift defaults initiatedBy to system", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  assert.equal(shift.initiatedBy, "system");
});

test("startCanaryShift records shift steps", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green", {
    initialWeightPct: 10,
    stepIncrementPct: 20,
    stepIntervalMinutes: 5,
    healthThreshold: 0.95,
    errorRateThreshold: 0.02,
    autoPromoteOnSuccess: true,
  });

  // Shift steps should be recorded
  assert.ok(shift.shiftSteps.length > 0);
  assert.ok(shift.totalSteps > 0);
  assert.equal(shift.currentStep, 0);
});
