import assert from "node:assert/strict";
import test from "node:test";

import { LeaseReclaimerService } from "../../../../../src/platform/five-plane-execution/ha/lease-reclaimer-service.js";

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
