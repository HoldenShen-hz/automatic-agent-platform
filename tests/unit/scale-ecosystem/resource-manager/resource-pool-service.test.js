/**
 * Unit tests for ResourcePoolService
 *
 * @see src/scale-ecosystem/resource-manager/resource-pool-service.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ResourcePoolService, ResourcePoolSchema } from "../../../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
function createTestPool(overrides = {}) {
    return {
        poolId: overrides.poolId ?? "pool-1",
        resourceType: overrides.resourceType ?? "compute_units",
        capacityUnits: overrides.capacityUnits ?? 100,
        allocatedUnits: overrides.allocatedUnits ?? 0,
        burstUnits: overrides.burstUnits ?? 20,
    };
}
test("ResourcePoolService.registerPool parses and stores pool", () => {
    const service = new ResourcePoolService();
    const pool = createTestPool();
    const registered = service.registerPool(pool);
    assert.equal(registered.poolId, "pool-1");
    assert.equal(registered.capacityUnits, 100);
});
test("ResourcePoolService.registerPool applies defaults", () => {
    const service = new ResourcePoolService();
    const pool = {
        poolId: "pool-1",
        resourceType: "compute_units",
        capacityUnits: 100,
        allocatedUnits: 0,
        burstUnits: 0,
    };
    const registered = service.registerPool(pool);
    assert.equal(registered.allocatedUnits, 0);
    assert.equal(registered.burstUnits, 0);
});
test("ResourcePoolService.allocate grants when capacity available", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ capacityUnits: 100, burstUnits: 20 }));
    const allocation = service.allocate("pool-1", "consumer-1", 50);
    assert.equal(allocation.granted, true);
    assert.equal(allocation.units, 50);
    assert.deepEqual(allocation.reasonCodes, ["resource_pool.allocated"]);
});
test("ResourcePoolService.allocate uses burst when base capacity exceeded", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 90, burstUnits: 20 }));
    const allocation = service.allocate("pool-1", "consumer-1", 20);
    assert.equal(allocation.granted, true);
});
test("ResourcePoolService.allocate denies when burst capacity exceeded", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 100, burstUnits: 20 }));
    const allocation = service.allocate("pool-1", "consumer-1", 25);
    assert.equal(allocation.granted, false);
    assert.deepEqual(allocation.reasonCodes, ["resource_pool.capacity_exceeded"]);
});
test("ResourcePoolService.allocate updates allocatedUnits", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ capacityUnits: 100 }));
    service.allocate("pool-1", "consumer-1", 30);
    // 70 remaining, request 40, should succeed
    const second = service.allocate("pool-1", "consumer-2", 40);
    assert.equal(second.granted, true);
});
test("ResourcePoolService.release reduces allocatedUnits", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 60 }));
    const updated = service.release("pool-1", 30);
    assert.equal(updated.allocatedUnits, 30);
});
test("ResourcePoolService.release clamps to zero", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ capacityUnits: 100, allocatedUnits: 10 }));
    const updated = service.release("pool-1", 50);
    assert.equal(updated.allocatedUnits, 0);
});
test("ResourcePoolService.getPool returns pool when registered", () => {
    const service = new ResourcePoolService();
    service.registerPool(createTestPool({ poolId: "pool-1" }));
    const pool = service.getPool("pool-1");
    assert.equal(pool?.poolId, "pool-1");
});
test("ResourcePoolService.getPool returns null when not found", () => {
    const service = new ResourcePoolService();
    const pool = service.getPool("nonexistent");
    assert.equal(pool, null);
});
test("ResourcePoolService.allocate throws for unknown pool", () => {
    const service = new ResourcePoolService();
    assert.throws(() => service.allocate("unknown", "consumer", 10), /resource_pool.not_found/);
});
test("ResourcePoolService.release throws for unknown pool", () => {
    const service = new ResourcePoolService();
    assert.throws(() => service.release("unknown", 10), /resource_pool.not_found/);
});
test("ResourcePoolSchema parses valid pool", () => {
    const result = ResourcePoolSchema.safeParse({
        poolId: "pool-1",
        resourceType: "gpu_units",
        capacityUnits: 50,
    });
    assert.equal(result.success, true);
});
test("ResourcePoolSchema rejects empty poolId", () => {
    const result = ResourcePoolSchema.safeParse({
        poolId: "",
        resourceType: "gpu_units",
        capacityUnits: 50,
    });
    assert.equal(result.success, false);
});
test("ResourcePoolSchema rejects negative capacity", () => {
    const result = ResourcePoolSchema.safeParse({
        poolId: "pool-1",
        resourceType: "gpu_units",
        capacityUnits: -10,
    });
    assert.equal(result.success, false);
});
//# sourceMappingURL=resource-pool-service.test.js.map