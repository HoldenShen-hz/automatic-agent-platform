/**
 * Unit tests for ResourcePoolService - resource pool management
 *
 * @see src/scale-ecosystem/resource-manager/resource-pool-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ResourcePoolService, type ResourcePool } from "../../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";

function createResourcePool(overrides: Partial<ResourcePool> = {}): ResourcePool {
  return {
    poolId: overrides.poolId ?? "pool-1",
    resourceType: overrides.resourceType ?? "compute",
    scopeType: overrides.scopeType ?? "shared",
    capacityUnits: overrides.capacityUnits ?? 100,
    allocatedUnits: overrides.allocatedUnits ?? 0,
    burstUnits: overrides.burstUnits ?? 20,
    failureRateThreshold: overrides.failureRateThreshold ?? 0.3,
    minSampleSize: overrides.minSampleSize ?? 20,
    failureRate: overrides.failureRate ?? 0,
    sampleCount: overrides.sampleCount ?? 0,
    isolationStatus: overrides.isolationStatus ?? "active",
    ...(overrides.tenantId != null ? { tenantId: overrides.tenantId } : {}),
    ...(overrides.organizationId != null ? { organizationId: overrides.organizationId } : {}),
    ...(overrides.workspaceId != null ? { workspaceId: overrides.workspaceId } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// registerPool Tests
// ─────────────────────────────────────────────────────────────────────────────

test("registerPool adds pool and returns parsed pool [resource-pool]", () => {
  const service = new ResourcePoolService();
  const pool = createResourcePool({ poolId: "pool-new" });

  const registered = service.registerPool(pool);

  assert.equal(registered.poolId, "pool-new");
  assert.equal(registered.capacityUnits, 100);
});

test("registerPool makes pool available via getPool [resource-pool]", () => {
  const service = new ResourcePoolService();
  const pool = createResourcePool({ poolId: "pool-visible" });

  service.registerPool(pool);
  const retrieved = service.getPool("pool-visible");

  assert.notEqual(retrieved, null);
  assert.equal(retrieved?.poolId, "pool-visible");
});

test("registerPool throws on invalid pool data [resource-pool]", () => {
  const service = new ResourcePoolService();

  assert.throws(() => {
    service.registerPool({ poolId: "", resourceType: "compute", capacityUnits: 100 } as ResourcePool);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// allocate Tests
// ─────────────────────────────────────────────────────────────────────────────

test("allocate grants request when capacity available [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-alloc", capacityUnits: 100, allocatedUnits: 0 }));

  const allocation = service.allocate("pool-alloc", "consumer-1", 30);

  assert.equal(allocation.granted, true);
  assert.equal(allocation.units, 30);
  assert.deepEqual(allocation.reasonCodes, ["resource_pool.allocated"]);
});

test("allocate updates pool allocatedUnits after grant [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-track", capacityUnits: 100, allocatedUnits: 0 }));

  service.allocate("pool-track", "consumer-1", 30);
  const pool = service.getPool("pool-track");

  assert.equal(pool?.allocatedUnits, 30);
});

test("allocate grants request using burst units when regular capacity exhausted [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({
    poolId: "pool-burst",
    capacityUnits: 100,
    allocatedUnits: 100,
    burstUnits: 20
  }));

  const allocation = service.allocate("pool-burst", "consumer-1", 15);

  assert.equal(allocation.granted, true);
  assert.equal(allocation.units, 15);
});

test("allocate denies request when capacity and burst exhausted [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({
    poolId: "pool-full",
    capacityUnits: 100,
    allocatedUnits: 100,
    burstUnits: 20
  }));

  const allocation = service.allocate("pool-full", "consumer-1", 25);

  assert.equal(allocation.granted, false);
  assert.equal(allocation.units, 25);
  assert.deepEqual(allocation.reasonCodes, ["resource_pool.capacity_exceeded"]);
});

test("allocate denies request for exact available amount plus one [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({
    poolId: "pool-exact",
    capacityUnits: 100,
    allocatedUnits: 80,
    burstUnits: 0
  }));

  const allocation = service.allocate("pool-exact", "consumer-1", 21);

  assert.equal(allocation.granted, false);
});

test("allocate multiple consumers correctly tracks allocation [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-multi", capacityUnits: 100, allocatedUnits: 0 }));

  service.allocate("pool-multi", "consumer-1", 30);
  service.allocate("pool-multi", "consumer-2", 40);
  const pool = service.getPool("pool-multi");

  assert.equal(pool?.allocatedUnits, 70);
});

test("allocate throws for non-existent pool [resource-pool]", () => {
  const service = new ResourcePoolService();

  assert.throws(() => {
    service.allocate("nonexistent-pool", "consumer-1", 10);
  }, /resource_pool\.not_found/);
});

// ─────────────────────────────────────────────────────────────────────────────
// release Tests
// ─────────────────────────────────────────────────────────────────────────────

test("release reduces allocatedUnits [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-release", capacityUnits: 100, allocatedUnits: 50 }));

  const pool = service.release("pool-release", 20);

  assert.equal(pool.allocatedUnits, 30);
});

test("release does not reduce below zero [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-underflow", capacityUnits: 100, allocatedUnits: 10 }));

  const pool = service.release("pool-underflow", 50);

  assert.equal(pool.allocatedUnits, 0);
});

test("release makes released capacity available for new allocation [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-reuse", capacityUnits: 100, allocatedUnits: 80 }));

  service.release("pool-reuse", 50);
  const allocation = service.allocate("pool-reuse", "consumer-new", 40);

  assert.equal(allocation.granted, true);
});

test("release throws for non-existent pool [resource-pool]", () => {
  const service = new ResourcePoolService();

  assert.throws(() => {
    service.release("nonexistent-pool", 10);
  }, /resource_pool\.not_found/);
});

// ─────────────────────────────────────────────────────────────────────────────
// getPool Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPool returns null for non-existent pool [resource-pool]", () => {
  const service = new ResourcePoolService();

  const pool = service.getPool("nonexistent");

  assert.equal(pool, null);
});

test("getPool returns current pool state after allocations [resource-pool]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createResourcePool({ poolId: "pool-state" }));

  service.allocate("pool-state", "consumer-1", 25);
  service.allocate("pool-state", "consumer-2", 25);
  const pool = service.getPool("pool-state");

  assert.notEqual(pool, null);
  assert.equal(pool?.allocatedUnits, 50);
});
