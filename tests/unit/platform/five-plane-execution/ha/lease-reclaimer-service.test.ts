import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { HaCoordinatorService } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-inner.js";
import { LeaseReclaimerService } from "../../../../../src/platform/five-plane-execution/ha/lease-reclaimer-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("LeaseReclaimerService can be instantiated", () => {
  const service = new LeaseReclaimerService({
    reclaimerId: "test-reclaimer",
  });
  assert.ok(service instanceof LeaseReclaimerService);
});

test("LeaseReclaimerService getReclaimerId returns configured id", () => {
  const service = new LeaseReclaimerService({
    reclaimerId: "custom-reclaimer",
  });
  assert.equal(service.getReclaimerId(), "custom-reclaimer");
});

test("LeaseReclaimerService getReclaimerId returns default when not configured", () => {
  const service = new LeaseReclaimerService({});
  assert.equal(service.getReclaimerId(), "lease-reclaimer");
});

test("LeaseReclaimerService reclaimExpiredLeases returns count", () => {
  const service = new LeaseReclaimerService({});
  const count = service.reclaimExpiredLeases();
  assert.ok(typeof count === "number");
});

test("LeaseReclaimerService getMetrics returns metrics", () => {
  const service = new LeaseReclaimerService({});
  const metrics = service.getMetrics();
  assert.ok(typeof metrics.totalReclaimed === "number");
  assert.ok(typeof metrics.lastReclaimedAt === "number");
});

test("LeaseReclaimerService runReclaimerCycle returns report", async () => {
  const service = new LeaseReclaimerService({});
  const report = await service.runReclaimerCycle();
  assert.ok(typeof report.reclaimerId === "string");
  assert.ok(typeof report.durationMs === "number");
  assert.ok(Array.isArray(report.errors));
});

test("LeaseReclaimerService expires leadership leases in the authoritative store", async () => {
  const workspace = createTempWorkspace("aa-lease-reclaimer-");
  const db = new SqliteDatabase(join(workspace, "lease-reclaimer.db"));
  try {
    db.migrate();
    const coordinator = new HaCoordinatorService(db);
    coordinator.registerNode("node-a", "cn-sh");
    const acquired = coordinator.acquireLeadership({ nodeId: "node-a", ttlMs: 5_000 });
    assert.equal(acquired.acquired, true);
    assert.ok(acquired.lease);

    db.connection
      .prepare("UPDATE leadership_leases SET expires_at = ? WHERE lease_id = ?")
      .run(new Date(Date.now() - 60_000).toISOString(), acquired.lease!.leaseId);

    const service = new LeaseReclaimerService({
      coordinator,
      config: { reclaimIntervalMs: 10, gracePeriodMs: 0, autoFailover: false },
    });
    service.start();
    const result = await service.reclaimOnce();
    service.stop();

    const leaseRow = db.connection
      .prepare("SELECT status FROM leadership_leases WHERE lease_id = ?")
      .get(acquired.lease!.leaseId) as { status: string } | undefined;
    const nodeRow = db.connection
      .prepare("SELECT is_leader FROM coordinator_nodes WHERE node_id = ?")
      .get("node-a") as { is_leader: number } | undefined;
    const epochRow = db.connection
      .prepare("SELECT ended_at, cause FROM leadership_epochs WHERE epoch = ?")
      .get(acquired.epoch) as { ended_at: string | null; cause: string } | undefined;

    assert.equal(result.reclaimedCount, 1);
    assert.equal(leaseRow?.status, "expired");
    assert.equal(nodeRow?.is_leader, 0);
    assert.equal(epochRow?.cause, "expired");
    assert.ok(epochRow?.ended_at);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
