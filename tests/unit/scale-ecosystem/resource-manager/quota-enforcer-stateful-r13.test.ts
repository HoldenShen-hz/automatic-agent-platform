import assert from "node:assert/strict";
import { closeSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FileQuotaStateStore,
  QuotaEnforcerService,
  type MultiResourceQuotaVector,
} from "../../../../src/scale-ecosystem/resource-manager/quota-enforcer/index.js";

const STATE_FILE = join(tmpdir(), `aa-quota-enforcer-state-r13-${process.pid}.json`);

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

function assertQuotaVector(
  quota: ReturnType<QuotaEnforcerService["getQuota"]>,
): asserts quota is MultiResourceQuotaVector {
  assert.ok(quota != null);
  assert.ok("workerUnits" in quota || "qps" in quota);
}

test("QuotaEnforcerService registers tenant-scoped quota with mandatory scope binding [quota-enforcer-stateful-r13]", () => {
  const service = new QuotaEnforcerService();
  const quota = service.registerTenant("tenant-alpha", makeQuotaVector("tenant-alpha"));

  assert.equal(quota.scope, "tenant");
  assert.equal(quota.scopeId, "tenant-alpha");
  assert.equal(service.listRegistrations().length, 1);
});

test("QuotaEnforcerService persists usage across service restarts via file-backed store [quota-enforcer-stateful-r13]", () => {
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

  assertQuotaVector(restored);
  assert.equal(restored.workerUnits?.currentUsage, 4);
  assert.equal(restored.qps?.currentUsage, 25);
  rmSync(STATE_FILE, { force: true });
});

test("QuotaEnforcerService merges concurrent file-backed updates instead of last-write-wins overwrite [quota-enforcer-stateful-r13]", () => {
  rmSync(STATE_FILE, { force: true });
  const store = new FileQuotaStateStore(STATE_FILE);
  const bootstrap = new QuotaEnforcerService(store);
  bootstrap.registerTenant("tenant-charlie", makeQuotaVector("tenant-charlie"));

  const serviceA = new QuotaEnforcerService(store);
  const serviceB = new QuotaEnforcerService(store);
  serviceA.updateUsage("tenant", "tenant-charlie", {
    workerUnits: 4,
  });
  serviceB.updateUsage("tenant", "tenant-charlie", {
    qps: 25,
  });

  const restored = new QuotaEnforcerService(store).getQuota("tenant", "tenant-charlie");
  assertQuotaVector(restored);
  assert.equal(restored.workerUnits?.currentUsage, 4);
  assert.equal(restored.qps?.currentUsage, 25);
  rmSync(STATE_FILE, { force: true });
});

test("QuotaEnforcerService enforces quota per tenant instead of using stateless global checks [quota-enforcer-stateful-r13]", () => {
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

test("FileQuotaStateStore fails closed under held lock without corrupting persisted snapshot [quota-enforcer-stateful-r13]", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "quota-state-lock-"));
  const stateFile = join(rootDir, "quota-state.json");
  const store = new FileQuotaStateStore(stateFile);

  try {
    store.save({
      revision: 0,
      registrations: {
        "tenant:tenant-delta": {
          scope: "tenant",
          scopeId: "tenant-delta",
          ...makeQuotaVector("tenant-delta"),
        },
      },
    });
    const originalContents = readFileSync(stateFile, "utf8");
    const lockFd = openSync(`${stateFile}.lock`, "wx");
    try {
      const snapshot = store.load();
      const updatedSnapshot = {
        ...snapshot,
        registrations: {
          ...snapshot.registrations,
          "tenant:tenant-delta": {
            scope: "tenant",
            scopeId: "tenant-delta",
            ...makeQuotaVector("tenant-delta"),
            workerUnits: { hardLimit: 10, softLimit: 8, currentUsage: 3 },
          },
        },
      };
      assert.throws(() => store.save(updatedSnapshot), /quota_state\.lock_timeout/);
    } finally {
      closeSync(lockFd);
      rmSync(`${stateFile}.lock`, { force: true });
    }

    assert.equal(readFileSync(stateFile, "utf8"), originalContents);
    assert.equal(readdirSync(rootDir).filter((entry) => entry.endsWith(".tmp")).length, 0);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
