import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  TrafficRoutingService,
  TRAFFIC_ROUTING_DDL,
  DEFAULT_CANARY_CONFIG,
} from "../../../../src/platform/five-plane-control-plane/rollout-controller/traffic-routing-service.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "traffic-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(TRAFFIC_ROUTING_DDL);
  return { workspace, db };
}

test("traffic routing handles SQL injection in version string", () => {
  const h = createHarness("aa-traffic-sqli-");
  try {
    const svc = new TrafficRoutingService(h.db);
    const slot = svc.registerSlot("blue", "'; DROP TABLE deployment_slots; --");
    assert.equal(slot.version, "'; DROP TABLE deployment_slots; --");
    const slots = svc.listSlots();
    assert.equal(slots.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("rollback of nonexistent shift does not crash", () => {
  const h = createHarness("aa-traffic-rbk-miss-");
  try {
    const svc = new TrafficRoutingService(h.db);
    const rollback = svc.rollbackShift("tshift_nonexistent", "manual", "test");
    assert.equal(rollback.success, true); // logged but no-op
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("checkCanaryHealth on nonexistent shift returns not healthy", () => {
  const h = createHarness("aa-traffic-health-miss-");
  try {
    const svc = new TrafficRoutingService(h.db);
    const result = svc.checkCanaryHealth("tshift_nonexistent");
    assert.equal(result.healthy, false);
    assert.equal(result.reason, "shift_not_active");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("traffic weights never exceed 100% in aggregate", () => {
  const h = createHarness("aa-traffic-weights-");
  try {
    const svc = new TrafficRoutingService(h.db);
    svc.registerSlot("blue", "v1.0.0");
    svc.registerSlot("green", "v1.1.0");

    svc.startCanaryShift("blue", "green", {
      ...DEFAULT_CANARY_CONFIG,
      initialWeightPct: 30,
      stepIncrementPct: 30,
    });

    const slots = svc.listSlots();
    const totalWeight = slots.reduce((sum, s) => sum + s.trafficWeight, 0);
    assert.ok(totalWeight <= 100, `Total weight ${totalWeight} exceeds 100`);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
