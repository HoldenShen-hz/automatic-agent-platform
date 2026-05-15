/**
 * Unit Tests: RollbackRecord and listRollbacks
 *
 * Tests for the RollbackRecord interface structure and the listRollbacks()
 * method which returns rollback history records.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
  DEFAULT_CANARY_CONFIG,
  type RollbackRecord,
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
// RollbackRecord Structure Tests
// ---------------------------------------------------------------------------

test("RollbackRecord has all required fields", () => {
  const record: RollbackRecord = {
    id: "rbk_test123",
    shiftId: "tshift_abc",
    trigger: "manual",
    fromVersion: "v1.0.0",
    toVersion: "v2.0.0",
    reason: "Test rollback",
    executedAt: "2026-04-27T10:00:00.000Z",
    completedAt: "2026-04-27T10:05:00.000Z",
    success: true,
  };

  assert.equal(record.id, "rbk_test123");
  assert.equal(record.shiftId, "tshift_abc");
  assert.equal(record.trigger, "manual");
  assert.equal(record.fromVersion, "v1.0.0");
  assert.equal(record.toVersion, "v2.0.0");
  assert.equal(record.reason, "Test rollback");
  assert.equal(record.executedAt, "2026-04-27T10:00:00.000Z");
  assert.equal(record.completedAt, "2026-04-27T10:05:00.000Z");
  assert.equal(record.success, true);
});

test("RollbackRecord with null completedAt is valid", () => {
  const record: RollbackRecord = {
    id: "rbk_test456",
    shiftId: "tshift_xyz",
    trigger: "health_check_failed",
    fromVersion: "v1.0.0",
    toVersion: "v2.0.0",
    reason: "Health check failed",
    executedAt: "2026-04-27T10:00:00.000Z",
    completedAt: null,
    success: false,
  };

  assert.equal(record.completedAt, null);
  assert.equal(record.success, false);
});

test("RollbackRecord accepts all valid trigger types", () => {
  const triggers: Array<RollbackRecord["trigger"]> = [
    "manual",
    "health_check_failed",
    "error_rate_exceeded",
    "latency_exceeded",
    "auto_timeout",
  ];

  for (const trigger of triggers) {
    const record: RollbackRecord = {
      id: `rbk_${trigger}`,
      shiftId: "tshift_test",
      trigger,
      fromVersion: "v1.0.0",
      toVersion: "v2.0.0",
      reason: `Testing ${trigger} trigger`,
      executedAt: nowIso(),
      completedAt: null,
      success: false,
    };
    assert.equal(record.trigger, trigger);
  }
});

// ---------------------------------------------------------------------------
// listRollbacks Method Tests
// ---------------------------------------------------------------------------

test("listRollbacks returns rollback records in descending order by executedAt", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  // Setup slots and create multiple shifts with rollbacks
  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Create first shift and rollback
  const shift1 = service.startCanaryShift("blue", "green");
  const rollback1 = service.rollbackShift(shift1.id, "manual", "First rollback");

  // Create second shift and rollback (newer)
  service.registerSlot("blue", "v1.0.1", 1);
  const shift2 = service.startCanaryShift("blue", "green");
  const rollback2 = service.rollbackShift(shift2.id, "health_check_failed", "Second rollback");

  // Adjust timestamps so rollback1 is older
  db.connection
    .prepare(`UPDATE rollback_records SET executed_at = '2026-04-20T00:00:00.000Z' WHERE id = ?`)
    .run(rollback1.id);
  db.connection
    .prepare(`UPDATE rollback_records SET executed_at = '2026-04-27T00:00:00.000Z' WHERE id = ?`)
    .run(rollback2.id);

  const rollbacks = service.listRollbacks();

  assert.equal(rollbacks.length, 2);
  // Most recent should be first (rollback2)
  assert.equal(rollbacks[0]!.id, rollback2.id);
  assert.equal(rollbacks[0]!.trigger, "health_check_failed");
  assert.equal(rollbacks[1]!.id, rollback1.id);
  assert.equal(rollbacks[1]!.trigger, "manual");
});

test("listRollbacks returns all fields correctly mapped from database", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "error_rate_exceeded", "Error rate exceeded threshold");

  const rollbacks = service.listRollbacks();

  assert.equal(rollbacks.length, 1);
  const record = rollbacks[0]!;

  assert.equal(record.id, rollback.id);
  assert.equal(record.shiftId, shift.id);
  assert.equal(record.trigger, "error_rate_exceeded");
  assert.equal(record.reason, "Error rate exceeded threshold");
  assert.equal(record.success, true);
  assert.ok(record.executedAt.length > 0);
  assert.ok(record.completedAt !== null);
});

test("listRollbacks with limit returns only specified number of records", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Create 5 shifts with rollbacks
  for (let i = 0; i < 5; i++) {
    service.registerSlot("blue", `v1.0.${i}`, 1);
    const shift = service.startCanaryShift("blue", "green");
    service.rollbackShift(shift.id, "manual", `Rollback ${i}`);
  }

  const rollbacks = service.listRollbacks(3);
  assert.equal(rollbacks.length, 3);
});

test("listRollbacks with limit of 0 returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "manual", "Test");

  const rollbacks = service.listRollbacks(0);
  assert.equal(rollbacks.length, 0);
});

test("listRollbacks when no rollbacks exist returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const rollbacks = service.listRollbacks();
  assert.deepEqual(rollbacks, []);
});

test("listRollbacks when no shifts exist returns empty array", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  // Register slots but never create any shifts
  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const rollbacks = service.listRollbacks();
  assert.deepEqual(rollbacks, []);
});

test("listRollbacks preserves success boolean correctly", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "manual", "Successful rollback");

  const rollbacks = service.listRollbacks();
  assert.equal(rollbacks.length, 1);
  assert.equal(typeof rollbacks[0]!.success, "boolean");
  assert.equal(rollbacks[0]!.success, true);
});

test("multiple rollbacks for same shift appear as separate records", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // First rollback
  const rollback1 = service.rollbackShift(shift.id, "manual", "First rollback attempt");
  db.connection
    .prepare(`UPDATE rollback_records SET executed_at = '2026-04-20T00:00:00.000Z' WHERE id = ?`)
    .run(rollback1.id);

  // Second rollback on same shift
  const rollback2 = service.rollbackShift(shift.id, "health_check_failed", "Second rollback after health failure");

  const rollbacks = service.listRollbacks();
  assert.equal(rollbacks.length, 2);

  // Most recent first
  assert.equal(rollbacks[0]!.id, rollback2.id);
  assert.equal(rollbacks[0]!.trigger, "health_check_failed");
  assert.equal(rollbacks[1]!.id, rollback1.id);
  assert.equal(rollbacks[1]!.trigger, "manual");
});

test("rollback records have correct version tracking", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "manual", "Rolling back deployment");

  const rollbacks = service.listRollbacks();
  assert.equal(rollbacks.length, 1);

  // fromVersion should be green's version (toSlot) since we're rolling back FROM green TO blue
  // toVersion should be blue's version (fromSlot)
  assert.equal(rollbacks[0]!.fromVersion, "v2.0.0");
  assert.equal(rollbacks[0]!.toVersion, "v1.0.0");
});

test("listRollbacks uses default limit of 50", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  // Create 60 rollbacks (exceeds default limit of 50)
  for (let i = 0; i < 60; i++) {
    service.registerSlot("blue", `v1.0.${i}`, 1);
    const shift = service.startCanaryShift("blue", "green");
    service.rollbackShift(shift.id, "manual", `Rollback ${i}`);
  }

  const rollbacks = service.listRollbacks();
  // Should be limited to 50
  assert.equal(rollbacks.length, 50);
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}
