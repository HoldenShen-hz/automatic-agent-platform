/**
 * Integration Tests: Rollout Controller
 *
 * Tests the TrafficRoutingService slot management and traffic shifting.
 * Note: These tests use in-memory database operations via SQLite.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
} from "../../../../src/platform/five-plane-control-plane/rollout-controller/index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createInMemoryDb() {
  const db = new SqliteDatabase(":memory:");
  db.migrate();
  db.connection.exec(TRAFFIC_ROUTING_DDL);
  return db;
}

// ============================================================================
// Rollout Controller End-to-End Integration Tests
// ============================================================================

test("integration: can register and retrieve deployment slots", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  const slot = service.registerSlot("canary", "v2.0.0", 3, { version: "2.0.0" });

  assert.equal(slot.slot, "canary");
  assert.equal(slot.version, "v2.0.0");
  assert.equal(slot.status, "standby");
  assert.equal(slot.trafficWeight, 0);

  db.close();
});

test("integration: can update slot health", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  const slot = service.registerSlot("canary", "v2.0.0", 2);

  service.updateHealth(slot.id, 0.98);

  const retrieved = service.getActiveSlot("canary");
  assert.ok(retrieved !== null);
  assert.equal(retrieved.healthScore, 0.98);

  db.close();
});

test("integration: can start canary shift", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  // Register blue and canary slots
  service.registerSlot("blue", "v1.0.0", 5);
  service.registerSlot("canary", "v2.0.0", 2);

  // Start a canary shift
  const shift = service.startCanaryShift("blue", "canary", {
    initialWeightPct: 10,
    stepIncrementPct: 20,
    stepIntervalMinutes: 5,
    healthThreshold: 0.95,
    errorRateThreshold: 0.02,
    autoPromoteOnSuccess: true,
  });

  assert.equal(shift.fromSlot, "blue");
  assert.equal(shift.toSlot, "canary");
  assert.equal(shift.status, "in_progress");
  assert.ok(shift.totalSteps > 1);

  db.close();
});

test("integration: can list deployment slots", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 3);
  service.registerSlot("green", "v1.0.0", 3);
  service.registerSlot("canary", "v2.0.0", 1);

  const slots = service.listSlots();

  assert.equal(slots.length, 3);
  assert.ok(slots.some(s => s.slot === "blue"));
  assert.ok(slots.some(s => s.slot === "canary"));

  db.close();
});

test("integration: can get shift by id", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 5);
  service.registerSlot("canary", "v2.0.0", 2);

  const shift = service.startCanaryShift("blue", "canary");
  const retrieved = service.getShift(shift.id);

  assert.ok(retrieved !== null);
  assert.equal(retrieved.id, shift.id);
  assert.equal(retrieved.status, "in_progress");

  db.close();
});

test("integration: can list shifts", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 5);
  service.registerSlot("canary", "v2.0.0", 2);

  service.startCanaryShift("blue", "canary");
  service.startCanaryShift("blue", "canary");

  const shifts = service.listShifts(10);

  assert.ok(shifts.length >= 2);
  assert.ok(shifts.every(s => s.fromSlot === "blue" && s.toSlot === "canary"));

  db.close();
});

test("integration: can rollback shift", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 5);
  service.registerSlot("canary", "v2.0.0", 2);

  const shift = service.startCanaryShift("blue", "canary");

  const rollback = service.rollbackShift(shift.id, "manual", "Health check failed");

  assert.equal(rollback.shiftId, shift.id);
  assert.equal(rollback.trigger, "manual");
  assert.ok(rollback.success);

  db.close();
});

test("integration: can check canary health", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 5);
  const canary = service.registerSlot("canary", "v2.0.0", 2);

  const shift = service.startCanaryShift("blue", "canary");

  // Update canary to healthy
  service.updateHealth(canary.id, 0.98);

  const health = service.checkCanaryHealth(shift.id);

  assert.equal(health.healthy, true);
  assert.equal(health.reason, "canary_healthy");

  db.close();
});

test("integration: can list rollbacks", () => {
  const db = createInMemoryDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 5);
  service.registerSlot("canary", "v2.0.0", 2);

  const shift = service.startCanaryShift("blue", "canary");
  service.rollbackShift(shift.id, "health_check_failed", "Error rate exceeded");

  const rollbacks = service.listRollbacks(10);

  assert.ok(rollbacks.length >= 1);
  const firstRollback = rollbacks[0];
  assert.ok(firstRollback !== undefined);
  assert.equal(firstRollback.trigger, "health_check_failed");

  db.close();
});
