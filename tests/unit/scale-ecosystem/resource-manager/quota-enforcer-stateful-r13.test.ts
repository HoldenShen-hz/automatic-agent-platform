import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import test from "node:test";

import {
  FileQuotaStateStore,
  QuotaEnforcerService,
  type MultiResourceQuotaVector,
} from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

const STATE_FILE = `/private/tmp/aa-quota-enforcer-state-r13-${process.pid}.json`;

function makeQuotaVector(scopeId: string): Omit<MultiResourceQuotaVector, "scope" | "scopeId"> {
  return {
    workerUnits: { hardLimit: 10, softLimit: 8, currentUsage: 0 },
    qps: { hardLimit: 100, softLimit: 80, currentUsage: 0 },
    tpm: { hardLimit: 1000, softLimit: 800, currentUsage: 0 },
    budgetUsd: { hardLimit: 50, softLimit: 40, currentUsage: 0 },
    storageGb: { hardLimit: 500, softLimit: 400, currentUsage: 0 },
    concurrentSessions: { hardLimit: 20, softLimit: 16, currentUsage: 0 },
    apiCallsPerDay: { hardLimit: 10000, softLimit: 8000, currentUsage: 0 },
  };
}

test("QuotaEnforcerService registers tenant-scoped quota with mandatory scope binding", () => {
  const service = new QuotaEnforcerService();
  const quota = service.registerTenant("tenant-alpha", makeQuotaVector("tenant-alpha"));

  assert.equal(quota.scope, "tenant");
  assert.equal(quota.scopeId, "tenant-alpha");
  assert.equal(service.listRegistrations().length, 1);
});

test("QuotaEnforcerService persists usage across service restarts via file-backed store", () => {
  rmSync(STATE_FILE, { force: true });
  const store = new FileQuotaStateStore(STATE_FILE);
  const serviceA = new QuotaEnforcerService(store);
  serviceA.registerTenant("tenant-bravo", makeQuotaVector("tenant-bravo"));
  serviceA.updateUsage("tenant", "tenant-bravo", {
    workerUnits: 4,
    qps: 25,
  });

  const serviceB = new QuotaEnforcerService(store);
  const restored = serviceB.getQuota("tenant", "tenant-bravo");

  assert.equal(restored?.workerUnits?.currentUsage, 4);
  assert.equal(restored?.qps?.currentUsage, 25);
  rmSync(STATE_FILE, { force: true });
});

test("QuotaEnforcerService enforces quota per tenant instead of using stateless global checks", () => {
  const service = new QuotaEnforcerService();
  service.registerTenant("tenant-low", {
    workerUnits: { hardLimit: 3, softLimit: 2, currentUsage: 0 },
  });
  service.registerTenant("tenant-high", {
    workerUnits: { hardLimit: 10, softLimit: 8, currentUsage: 0 },
  });

  const lowDecision = service.checkQuota("tenant", "tenant-low", { workerUnits: 4 });
  const highDecision = service.checkQuota("tenant", "tenant-high", { workerUnits: 4 });

  assert.equal(lowDecision.passed, false);
  assert.ok(lowDecision.failedDimensions.includes("workerUnits"));
  assert.equal(highDecision.passed, true);
});
