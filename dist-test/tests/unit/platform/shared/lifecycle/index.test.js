import assert from "node:assert/strict";
import test from "node:test";
// Barrel test for lifecycle module
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/index.js";
test("ServiceRegistry.getInstance returns singleton", () => {
    const registry1 = ServiceRegistry.getInstance();
    const registry2 = ServiceRegistry.getInstance();
    assert.strictEqual(registry1, registry2);
});
test("ServiceRegistry.isInitialized returns false for unregistered service", () => {
    const registry = ServiceRegistry.getInstance();
    // Use a unique name to avoid conflicts with other tests
    const uniqueName = "lifecycle-test-" + Date.now();
    assert.equal(registry.isInitialized(uniqueName), false);
});
test("ServiceRegistry.topologicalSort returns array", () => {
    const registry = ServiceRegistry.getInstance();
    const sorted = registry.topologicalSort();
    assert.ok(Array.isArray(sorted));
});
//# sourceMappingURL=index.test.js.map