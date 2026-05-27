/**
 * Unit tests for ResourcePoolService multi-consumer and edge cases
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

test("ResourcePoolService multiple consumers share pool correctly [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100, burstUnits: 20 }));

  const alloc1 = service.allocate("pool-1", "consumer-1", 40);
  const alloc2 = service.allocate("pool-1", "consumer-2", 40);
  const alloc3 = service.allocate("pool-1", "consumer-3", 20);

  assert.equal(alloc1.granted, true);
  assert.equal(alloc2.granted, true);
  assert.equal(alloc3.granted, true);
  assert.deepEqual(alloc1.reasonCodes, ["resource_pool.allocated"]);
  assert.deepEqual(alloc2.reasonCodes, ["resource_pool.allocated"]);
  assert.deepEqual(alloc3.reasonCodes, ["resource_pool.allocated"]);
});

test("ResourcePoolService allocate exactly uses remaining capacity [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100, burstUnits: 20 }));

  // Fill to 100, leaving 20 for burst
  service.allocate("pool-1", "consumer-1", 100);
  const alloc2 = service.allocate("pool-1", "consumer-2", 20);

  assert.equal(alloc2.granted, true);
  assert.equal(alloc2.units, 20);
});

test("ResourcePoolService allocate at capacity boundary [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 80, burstUnits: 20 }));

  const alloc = service.allocate("pool-1", "consumer-1", 40);

  // available = 100 + 20 - 80 = 40, exactly enough
  assert.equal(alloc.granted, true);
});

test("ResourcePoolService release then reallocate [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 60 }));

  service.release("pool-1", 60);
  const alloc = service.allocate("pool-1", "consumer-1", 100);

  assert.equal(alloc.granted, true);
  assert.equal(alloc.units, 100);
});

test("ResourcePoolService release zero does nothing [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 50 }));

  const pool = service.release("pool-1", 0);

  assert.equal(pool.allocatedUnits, 50);
});

test("ResourcePoolService allocate zero units succeeds [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100 }));

  const alloc = service.allocate("pool-1", "consumer-1", 0);

  assert.equal(alloc.granted, true);
  assert.equal(alloc.units, 0);
});

test("ResourcePoolService registerPool overwrites existing pool [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 100 }));
  service.registerPool(createTestPool({ poolId: "pool-1", capacityUnits: 200 }));

  const pool = service.getPool("pool-1");

  assert.equal(pool?.capacityUnits, 200);
});

test("ResourcePoolService getPool returns null for unregistered pool [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();

  const pool = service.getPool("nonexistent");

  assert.equal(pool, null);
});

test("ResourcePoolService allocate with burst only pool [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 0, burstUnits: 50 }));

  const alloc = service.allocate("pool-1", "consumer-1", 30);

  assert.equal(alloc.granted, true);
});

test("ResourcePoolService full release with excessive units [resource-pool-service-edge-cases]", () => {
  const service = new ResourcePoolService();
  service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 30 }));

  const pool = service.release("pool-1", 100);

  // Should clamp to 0, not go negative
  assert.equal(pool.allocatedUnits, 0);
});
