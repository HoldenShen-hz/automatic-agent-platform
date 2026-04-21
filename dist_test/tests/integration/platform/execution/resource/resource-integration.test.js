import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("Resource creation with usage tracking", () => {
    const resource = {
        id: newId("res"),
        kind: "cpu",
        allocatedTo: null,
        capacity: 100,
        used: 0,
        updatedAt: nowIso(),
    };
    assert.ok(resource.id.startsWith("res_"));
    assert.equal(resource.kind, "cpu");
    assert.equal(resource.used, 0);
});
test("Resource allocation to task", () => {
    const taskId = newId("task");
    const resource = {
        id: newId("res"),
        kind: "memory",
        allocatedTo: taskId,
        capacity: 1000,
        used: 500,
        updatedAt: nowIso(),
    };
    assert.equal(resource.allocatedTo, taskId);
    assert.equal(resource.used, 500);
});
test("Resource usage calculation", () => {
    const resource = {
        id: newId("res"),
        kind: "disk",
        allocatedTo: newId("task"),
        capacity: 10000,
        used: 3500,
        updatedAt: nowIso(),
    };
    const utilization = (resource.used / resource.capacity) * 100;
    assert.equal(utilization, 35);
});
test("Resource release", () => {
    const resource = {
        id: newId("res"),
        kind: "cpu",
        allocatedTo: newId("task"),
        capacity: 100,
        used: 75,
        updatedAt: nowIso(),
    };
    resource.allocatedTo = null;
    resource.used = 0;
    assert.equal(resource.allocatedTo, null);
    assert.equal(resource.used, 0);
});
test("Multiple resources of same kind", () => {
    const resources = [];
    for (let i = 0; i < 3; i++) {
        resources.push({
            id: newId("res"),
            kind: "network",
            allocatedTo: null,
            capacity: 1000,
            used: 0,
            updatedAt: nowIso(),
        });
    }
    const networkResources = resources.filter((r) => r.kind === "network");
    assert.equal(networkResources.length, 3);
});
test("Resource capacity limits", () => {
    const resource = {
        id: newId("res"),
        kind: "memory",
        allocatedTo: newId("task"),
        capacity: 8000,
        used: 8000,
        updatedAt: nowIso(),
    };
    const utilization = resource.used / resource.capacity;
    assert.equal(utilization, 1); // 100% utilization
    assert.ok(utilization <= 1); // Cannot exceed capacity
});
//# sourceMappingURL=resource-integration.test.js.map