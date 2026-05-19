/**
 * Unit tests for ServiceRegistry transitive dependency resolution.
 *
 * Tests that services with transitive dependencies (A depends on B, B depends on C)
 * are initialized in the correct order regardless of registration order.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";
test("ServiceRegistry resolves transitive dependencies in correct order", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    const initOrder = [];
    // C has no dependencies
    registry.register("service-c", {
        init: () => { initOrder.push("service-c"); return {}; },
    });
    // B depends on C
    registry.register("service-b", {
        init: () => { initOrder.push("service-b"); return {}; },
        dependsOn: ["service-c"],
    });
    // A depends on B
    registry.register("service-a", {
        init: () => { initOrder.push("service-a"); return {}; },
        dependsOn: ["service-b"],
    });
    // Access A (should trigger chain: C -> B -> A)
    registry.get("service-a");
    // Verify order: C first, then B, then A
    const cIdx = initOrder.indexOf("service-c");
    const bIdx = initOrder.indexOf("service-b");
    const aIdx = initOrder.indexOf("service-a");
    assert.ok(cIdx >= 0, "service-c should be initialized");
    assert.ok(bIdx >= 0, "service-b should be initialized");
    assert.ok(aIdx >= 0, "service-a should be initialized");
    assert.ok(cIdx < bIdx, "service-c should be initialized before service-b");
    assert.ok(bIdx < aIdx, "service-b should be initialized before service-a");
});
test("ServiceRegistry handles diamond dependency pattern", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    const initOrder = [];
    // D is the base (no deps)
    registry.register("diamond-d", {
        init: () => { initOrder.push("diamond-d"); return {}; },
    });
    // B depends on D
    registry.register("diamond-b", {
        init: () => { initOrder.push("diamond-b"); return {}; },
        dependsOn: ["diamond-d"],
    });
    // C depends on D
    registry.register("diamond-c", {
        init: () => { initOrder.push("diamond-c"); return {}; },
        dependsOn: ["diamond-d"],
    });
    // A depends on both B and C
    registry.register("diamond-a", {
        init: () => { initOrder.push("diamond-a"); return {}; },
        dependsOn: ["diamond-b", "diamond-c"],
    });
    registry.get("diamond-a");
    // D should come before A
    const dIdx = initOrder.indexOf("diamond-d");
    const aIdx = initOrder.indexOf("diamond-a");
    assert.ok(dIdx < aIdx, "diamond-d should be initialized before diamond-a");
});
test("ServiceRegistry skips missing dependencies in dependsOn", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    let initialized = false;
    // Register a service that depends on a non-existent service
    registry.register("orphan-service", {
        init: () => { initialized = true; return {}; },
        dependsOn: ["nonexistent-service"],
    });
    // Should still work - missing deps are skipped
    const instance = registry.get("orphan-service");
    assert.ok(initialized, "Service should be initialized");
    assert.ok(instance != null);
});
test("ServiceRegistry handles multiple independent dependency chains", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    const initOrder = [];
    // Chain 1: X -> Y -> Z
    registry.register("chain-z", {
        init: () => { initOrder.push("chain-z"); return {}; },
    });
    registry.register("chain-y", {
        init: () => { initOrder.push("chain-y"); return {}; },
        dependsOn: ["chain-z"],
    });
    registry.register("chain-x", {
        init: () => { initOrder.push("chain-x"); return {}; },
        dependsOn: ["chain-y"],
    });
    // Chain 2: A -> B -> C
    registry.register("chain-c", {
        init: () => { initOrder.push("chain-c"); return {}; },
    });
    registry.register("chain-b", {
        init: () => { initOrder.push("chain-b"); return {}; },
        dependsOn: ["chain-c"],
    });
    registry.register("chain-a", {
        init: () => { initOrder.push("chain-a"); return {}; },
        dependsOn: ["chain-b"],
    });
    // Initialize both chains
    registry.get("chain-x");
    registry.get("chain-a");
    // Verify each chain is internally ordered correctly
    const zIdx = initOrder.indexOf("chain-z");
    const yIdx = initOrder.indexOf("chain-y");
    const xIdx = initOrder.indexOf("chain-x");
    assert.ok(zIdx < yIdx, "chain-z before chain-y");
    assert.ok(yIdx < xIdx, "chain-y before chain-x");
    const cIdx = initOrder.indexOf("chain-c");
    const bIdx = initOrder.indexOf("chain-b");
    const aIdx = initOrder.indexOf("chain-a");
    assert.ok(cIdx < bIdx, "chain-c before chain-b");
    assert.ok(bIdx < aIdx, "chain-b before chain-a");
});
test("ServiceRegistry does not reinitialize dependency when accessed multiple times", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    let initCount = 0;
    registry.register("shared-dep", {
        init: () => { initCount++; return { value: initCount }; },
    });
    registry.register("consumer-1", {
        init: () => registry.get("shared-dep"),
        dependsOn: ["shared-dep"],
    });
    registry.register("consumer-2", {
        init: () => registry.get("shared-dep"),
        dependsOn: ["shared-dep"],
    });
    const result1 = registry.get("consumer-1");
    const result2 = registry.get("consumer-2");
    // shared-dep should only be initialized once
    assert.equal(initCount, 1, "shared-dep should only initialize once");
    assert.equal(result1.value, 1);
    assert.equal(result2.value, 1);
});
test("ServiceRegistry topologicalSort orders based on all dependencies", async () => {
    const registry = ServiceRegistry.getInstance();
    await registry.reset();
    // Register in reverse dependency order
    registry.register("leaf", { init: () => ({}) });
    registry.register("middle", {
        init: () => ({}),
        dependsOn: ["leaf"],
    });
    registry.register("root", {
        init: () => ({}),
        dependsOn: ["middle"],
    });
    const sorted = registry.topologicalSort();
    // Root should come after middle, middle after leaf
    const rootIdx = sorted.indexOf("root");
    const middleIdx = sorted.indexOf("middle");
    const leafIdx = sorted.indexOf("leaf");
    assert.ok(leafIdx >= 0);
    assert.ok(middleIdx >= 0);
    assert.ok(rootIdx >= 0);
    assert.ok(leafIdx < middleIdx, "leaf should come before middle");
    assert.ok(middleIdx < rootIdx, "middle should come before root");
});
//# sourceMappingURL=service-registry-transitive-deps.test.js.map