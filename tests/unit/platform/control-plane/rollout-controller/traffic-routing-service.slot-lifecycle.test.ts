/**
 * Unit Tests: TrafficRoutingService Slot Lifecycle
 *
 * Tests the lifecycle of deployment slots including status transitions
 * from standby through active, draining, and retirement states.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
  type DeploymentSlotStatus,
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
// Initial Slot Status
// ---------------------------------------------------------------------------

test("registerSlot creates slot with standby status", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 1);

  assert.equal(record.status, "standby");
  assert.equal(record.trafficWeight, 0);
});

test("newly registered slot has zero traffic weight", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("green", "v2.0.0", 3);

  assert.equal(record.trafficWeight, 0);
  assert.equal(record.instanceCount, 3);
});

// ---------------------------------------------------------------------------
// Slot Status After Traffic Shift
// ---------------------------------------------------------------------------

test("source slot becomes active with reduced traffic after shift starts", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  service.startCanaryShift("blue", "green");

  const blue = service.getActiveSlot("blue");
  assert.ok(blue !== null);
  assert.equal(blue.status, "active");
  assert.ok(blue.trafficWeight < 100);
});

test("target slot becomes active with initial traffic weight", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  service.startCanaryShift("blue", "green");

  const green = service.getActiveSlot("green");
  assert.ok(green !== null);
  assert.equal(green.status, "active");
  assert.ok(green.trafficWeight > 0);
});

// ---------------------------------------------------------------------------
// Slot Status After Shift Completion
// ---------------------------------------------------------------------------

test("source slot is retired (draining) after shift completes", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Complete the shift
  for (let i = 0; i < shift.totalSteps; i++) {
    service.advanceShift(shift.id);
  }

  // Query database directly to see draining status
  const row = db.connection
    .prepare(`SELECT status FROM deployment_slots WHERE slot = 'blue' AND status = 'draining'`)
    .get();

  assert.ok(row !== undefined);
});

test("target slot is active with 100% traffic after shift completes", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Complete the shift
  for (let i = 0; i < shift.totalSteps; i++) {
    service.advanceShift(shift.id);
  }

  const green = service.getActiveSlot("green");
  assert.ok(green !== null);
  assert.equal(green.status, "active");
  assert.equal(green.trafficWeight, 100);
});

// ---------------------------------------------------------------------------
// Slot Status After Rollback
// ---------------------------------------------------------------------------

test("source slot restored to active with 100% traffic after rollback", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.rollbackShift(shift.id, "manual", "User requested rollback");

  const blue = service.getActiveSlot("blue");
  assert.ok(blue !== null);
  assert.equal(blue.status, "active");
  assert.equal(blue.trafficWeight, 100);
});

test("target slot has 0% traffic after rollback", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Advance a few steps
  service.advanceShift(shift.id);
  service.advanceShift(shift.id);

  service.rollbackShift(shift.id, "manual", "Rollback");

  // Query green slot - it should have 0 traffic weight
  const row = db.connection
    .prepare(`SELECT traffic_weight FROM deployment_slots WHERE slot = 'green' ORDER BY created_at DESC LIMIT 1`)
    .get() as { traffic_weight: number } | undefined;

  assert.ok(row !== undefined);
  assert.equal(row.traffic_weight, 0);
});

// ---------------------------------------------------------------------------
// Multiple Slots Same Name
// ---------------------------------------------------------------------------

test("registering new slot with same name creates additional record", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const slot1 = service.registerSlot("blue", "v1.0.0", 1);
  const slot2 = service.registerSlot("blue", "v2.0.0", 1);

  assert.notEqual(slot1.id, slot2.id);
  assert.notEqual(slot1.version, slot2.version);
});

test("listSlots returns all active and standby slots regardless of version", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("blue", "v1.1.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const slots = service.listSlots();
  assert.equal(slots.length, 3);
});

// ---------------------------------------------------------------------------
// Slot Timestamps
// ---------------------------------------------------------------------------

test("registerSlot sets createdAt and updatedAt to same value", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 1);

  assert.equal(record.createdAt, record.updatedAt);
});

test("updateHealth modifies health score", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record = service.registerSlot("blue", "v1.0.0", 1);
  // Initially healthScore is null

  service.updateHealth(record.id, 0.95);

  const updated = service.getActiveSlot("blue");
  assert.ok(updated !== null);
  assert.equal(updated.healthScore, 0.95);
});

// ---------------------------------------------------------------------------
// Traffic Weight Distribution
// ---------------------------------------------------------------------------

test("traffic weights always sum to 100 during active shift", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");

  // Check throughout shift progression
  for (let i = 0; i < shift.totalSteps; i++) {
    service.advanceShift(shift.id);

    const blue = service.getActiveSlot("blue");
    const green = service.getActiveSlot("green");

    if (blue && green && blue.status === "active" && green.status === "active") {
      assert.equal(blue.trafficWeight + green.trafficWeight, 100);
    }
  }
});

test("after rollback traffic weights return to 100/0 split", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  service.registerSlot("blue", "v1.0.0", 1);
  service.registerSlot("green", "v2.0.0", 1);

  const shift = service.startCanaryShift("blue", "green");
  service.advanceShift(shift.id);
  service.advanceShift(shift.id);
  service.rollbackShift(shift.id, "manual", "Rollback");

  const blue = service.getActiveSlot("blue");
  const green = service.getActiveSlot("green");

  assert.ok(blue !== null);
  assert.ok(green !== null);
  assert.equal(blue.trafficWeight, 100);
  assert.equal(green.trafficWeight, 0);
});

// ---------------------------------------------------------------------------
// Slot with Metadata
// ---------------------------------------------------------------------------

test("slot metadata preserves complex nested objects", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const metadata = {
    region: "us-west-2",
    cluster: "prod-1",
    config: {
      cpu: "2 cores",
      memory: "4GB",
      replicas: [1, 2, 3],
    },
    tags: ["production", "critical"],
  };

  const record = service.registerSlot("blue", "v1.0.0", 3, metadata);

  const parsed = JSON.parse(record.metadata!);
  assert.equal(parsed.region, "us-west-2");
  assert.deepEqual(parsed.config.replicas, [1, 2, 3]);
  assert.deepEqual(parsed.tags, ["production", "critical"]);
});

// ---------------------------------------------------------------------------
// Instance Count
// ---------------------------------------------------------------------------

test("registerSlot preserves instance count", () => {
  const db = createTestDb();
  const service = new TrafficRoutingService(db);

  const record1 = service.registerSlot("blue", "v1.0.0", 1);
  const record2 = service.registerSlot("green", "v2.0.0", 5);
  const record3 = service.registerSlot("canary", "v3.0.0", 10);

  assert.equal(record1.instanceCount, 1);
  assert.equal(record2.instanceCount, 5);
  assert.equal(record3.instanceCount, 10);
});
