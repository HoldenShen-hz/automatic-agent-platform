/**
 * Integration Test: Traffic Routing Service
 *
 * Tests rollout-controller traffic routing using the current
 * canary/rollback API rather than removed placeholder methods.
 */

import * as assert from "node:assert/strict";
import * as test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
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

function listSlotsByName(service: TrafficRoutingService): Record<string, ReturnType<TrafficRoutingService["listSlots"]>[number]> {
  return Object.fromEntries(service.listSlots().map((slot) => [slot.slot, slot]));
}

test("traffic routing: starts canary shift and applies initial traffic weights", () => {
  const service = new TrafficRoutingService(createTestDb());
  service.registerSlot("blue", "1.0.0");
  service.registerSlot("green", "1.1.0");

  const shift = service.startCanaryShift("blue", "green", {
    ...DEFAULT_CANARY_CONFIG,
    initialWeightPct: 10,
    stepIncrementPct: 45,
  });
  const slots = listSlotsByName(service);

  assert.equal(shift.status, "in_progress");
  assert.equal(shift.toWeight, 10);
  assert.equal(slots.blue?.trafficWeight, 90);
  assert.equal(slots.green?.trafficWeight, 10);
});

test("traffic routing: advances progressive rollout stages until completion", () => {
  const service = new TrafficRoutingService(createTestDb());
  service.registerSlot("blue", "1.0.0");
  service.registerSlot("green", "1.1.0");

  const shift = service.startCanaryShift("blue", "green", {
    ...DEFAULT_CANARY_CONFIG,
    initialWeightPct: 50,
    stepIncrementPct: 50,
  });

  const stage1 = service.advanceShift(shift.id);
  const finalStage = service.advanceShift(shift.id);
  const slots = listSlotsByName(service);

  assert.equal(stage1?.toWeight, 100);
  assert.equal(finalStage?.status, "completed");
  assert.equal(finalStage?.completedAt != null, true);
  assert.equal(slots.blue?.status, "draining");
  assert.equal(slots.blue?.trafficWeight, 0);
  assert.equal(slots.green?.status, "active");
  assert.equal(slots.green?.trafficWeight, 100);
});

test("traffic routing: rollback restores original slot traffic and records audit entry", () => {
  const service = new TrafficRoutingService(createTestDb());
  service.registerSlot("blue", "1.0.0");
  service.registerSlot("green", "1.1.0");

  const shift = service.startCanaryShift("blue", "green", {
    ...DEFAULT_CANARY_CONFIG,
    initialWeightPct: 25,
    stepIncrementPct: 25,
  });

  const rollback = service.rollbackShift(shift.id, "health_check_failed", "canary unhealthy");
  const slots = listSlotsByName(service);
  const persistedShift = service.getShift(shift.id);

  assert.equal(rollback.success, true);
  assert.equal(rollback.fromVersion, "1.1.0");
  assert.equal(rollback.toVersion, "1.0.0");
  assert.equal(persistedShift?.status, "rolled_back");
  assert.equal(persistedShift?.rollbackReason, "canary unhealthy");
  assert.equal(slots.blue?.trafficWeight, 100);
  assert.equal(slots.green?.trafficWeight, 0);
});

test("traffic routing: checkCanaryHealth reports missing health and healthy threshold crossings", () => {
  const service = new TrafficRoutingService(createTestDb());
  service.registerSlot("blue", "1.0.0");
  const green = service.registerSlot("green", "1.1.0");

  const shift = service.startCanaryShift("blue", "green", {
    ...DEFAULT_CANARY_CONFIG,
    initialWeightPct: 5,
    stepIncrementPct: 95,
  });

  assert.deepEqual(service.checkCanaryHealth(shift.id), {
    healthy: false,
    reason: "no_health_data",
  });

  service.updateHealth(green.id, 0.98);

  assert.deepEqual(service.checkCanaryHealth(shift.id), {
    healthy: true,
    reason: "canary_healthy",
  });
});

test("traffic routing: lists recent shifts and rollbacks", () => {
  const service = new TrafficRoutingService(createTestDb());
  service.registerSlot("blue", "1.0.0");
  service.registerSlot("green", "1.1.0");

  const shift = service.startCanaryShift("blue", "green");
  const rollback = service.rollbackShift(shift.id, "manual", "operator requested rollback");

  const shifts = service.listShifts();
  const rollbacks = service.listRollbacks();

  assert.equal(shifts.length, 1);
  assert.equal(shifts[0]?.id, shift.id);
  assert.equal(rollbacks.length, 1);
  assert.equal(rollbacks[0]?.id, rollback.id);
});
