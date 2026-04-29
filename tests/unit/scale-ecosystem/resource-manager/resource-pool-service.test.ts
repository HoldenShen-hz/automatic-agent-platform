/**
 * Unit tests for ResourcePoolService - resource allocation focus
 *
 * @see src/scale-ecosystem/resource-manager/resource-pool-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ResourcePoolService, type ResourcePool } from "../../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";

function createTestPool(overrides: Partial<ResourcePool> = {}): ResourcePool {
  return {
    poolId: overrides.poolId ?? "pool-1",
    resourceType: overrides.resourceType ?? "compute_units",
    capacityUnits: overrides.capacityUnits ?? 100,
    allocatedUnits: overrides.allocatedUnits ?? 0,
    burstUnits: overrides.burstUnits ?? 0,
  };
}

test("acquireResources allocates from pool when capacity available", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, burstUnits: 20 }));

  // allocate is the actual method; acquireResources maps to it
  const allocation = service.allocate("pool-1", "consumer-1", 50);

  assert.equal(allocation.granted, true);
  assert.equal(allocation.poolId, "pool-1");
  assert.equal(allocation.consumerId, "consumer-1");
  assert.equal(allocation.units, 50);
  assert.deepEqual(allocation.reasonCodes, ["resource_pool.allocated"]);

  // verify pool state updated
  const pool = service.getPool("pool-1");
  assert.equal(pool?.allocatedUnits, 50);
});

test("releaseResources returns units to pool", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 50 }));

  // release is the actual method; releaseResources maps to it
  const updated = service.release("pool-1", 30);

  assert.equal(updated.allocatedUnits, 20);

  const pool = service.getPool("pool-1");
  assert.equal(pool?.allocatedUnits, 20);
});

test("releaseResources clamps to zero when releasing more than allocated", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 10 }));

  const updated = service.release("pool-1", 50);

  assert.equal(updated.allocatedUnits, 0);
});

test("pool respects maxCapacity - allocation within capacity succeeds", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 0 }));

  const allocation = service.allocate("pool-1", "consumer-1", 100);

  assert.equal(allocation.granted, true);
  const pool = service.getPool("pool-1");
  assert.equal(pool?.allocatedUnits, 100);
});

test("pool respects maxCapacity - allocation at capacity boundary succeeds", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 90, burstUnits: 10 }));

  // 10 available (100 - 90 = 10), request exactly 10
  const allocation = service.allocate("pool-1", "consumer-1", 10);

  assert.equal(allocation.granted, true);
});

test("allocation fails when at capacity", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 100 }));

  const allocation = service.allocate("pool-1", "consumer-1", 1);

  assert.equal(allocation.granted, false);
  assert.equal(allocation.units, 1);
  assert.deepEqual(allocation.reasonCodes, ["resource_pool.capacity_exceeded"]);
});

test("allocation fails when exceeding capacity even with burst available", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 115, burstUnits: 20 }));

  // available = 100 + 20 - 115 = 5, request 10
  const allocation = service.allocate("pool-1", "consumer-1", 10);

  assert.equal(allocation.granted, false);
  assert.deepEqual(allocation.reasonCodes, ["resource_pool.capacity_exceeded"]);
});

test("burst capacity allows allocation beyond base capacity", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 100, burstUnits: 20 }));

  // base at capacity, but 20 burst available
  const allocation = service.allocate("pool-1", "consumer-1", 15);

  assert.equal(allocation.granted, true);
  assert.equal(allocation.units, 15);

  const pool = service.getPool("pool-1");
  assert.equal(pool?.allocatedUnits, 115);
});

test("multiple consumers can acquire resources up to capacity", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100 }));

  const alloc1 = service.allocate("pool-1", "consumer-1", 30);
  const alloc2 = service.allocate("pool-1", "consumer-2", 30);
  const alloc3 = service.allocate("pool-1", "consumer-3", 30);

  assert.equal(alloc1.granted, true);
  assert.equal(alloc2.granted, true);
  assert.equal(alloc3.granted, true);

  const pool = service.getPool("pool-1");
  assert.equal(pool?.allocatedUnits, 90);
});

test("fourth consumer blocked when capacity exhausted after three allocations", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100 }));

  service.allocate("pool-1", "consumer-1", 30);
  service.allocate("pool-1", "consumer-2", 30);
  service.allocate("pool-1", "consumer-3", 30);

  // 10 remaining, request 20
  const blocked = service.allocate("pool-1", "consumer-4", 20);

  assert.equal(blocked.granted, false);
  assert.deepEqual(blocked.reasonCodes, ["resource_pool.capacity_exceeded"]);
});

test("unknown pool throws on allocate", () => {
  const service = new ResourcePoolService();

  assert.throws(
    () => service.allocate("nonexistent", "consumer-1", 10),
    /resource_pool.not_found/
  );
});

test("unknown pool throws on release", () => {
  const service = new ResourcePoolService();

  assert.throws(
    () => service.release("nonexistent", 10),
    /resource_pool.not_found/
  );
});

test("getPool returns null for unregistered pool", () => {
  const service = new ResourcePoolService();

  const pool = service.getPool("nonexistent");

  assert.equal(pool, null);
});

test("getPool returns registered pool with correct state", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100, allocatedUnits: 25 }));

  const pool = service.getPool("pool-1");

  assert.notEqual(pool, null);
  assert.equal(pool?.poolId, "pool-1");
  assert.equal(pool?.capacityUnits, 100);
  assert.equal(pool?.allocatedUnits, 25);
});

test("registerPool stores pool and applies schema defaults", () => {
  const service = new ResourcePoolService();
  const pool = service.registerPool({
    poolId: "pool-1",
    resourceType: "gpu_units",
    capacityUnits: 50,
  });

  assert.equal(pool.poolId, "pool-1");
  assert.equal(pool.resourceType, "gpu_units");
  assert.equal(pool.capacityUnits, 50);
  assert.equal(pool.allocatedUnits, 0);
  assert.equal(pool.burstUnits, 0);
});