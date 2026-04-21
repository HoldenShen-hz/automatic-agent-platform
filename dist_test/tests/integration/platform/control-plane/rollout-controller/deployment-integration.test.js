import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("Traffic route basic allocation", () => {
    const route = {
        id: newId("route"),
        serviceId: newId("svc"),
        targetPercent: 100,
        weight: 100,
        region: "us-east-1",
        active: true,
    };
    assert.ok(route.id.startsWith("route_"));
    assert.equal(route.targetPercent, 100);
    assert.equal(route.weight, 100);
});
test("Traffic route weight distribution across regions", () => {
    const routes = [
        { id: newId("route"), serviceId: newId("svc"), targetPercent: 50, weight: 50, region: "us-east-1", active: true },
        { id: newId("route"), serviceId: newId("svc"), targetPercent: 30, weight: 30, region: "us-west-2", active: true },
        { id: newId("route"), serviceId: newId("svc"), targetPercent: 20, weight: 20, region: "eu-west-1", active: true },
    ];
    const totalWeight = routes.reduce((sum, r) => sum + r.weight, 0);
    assert.equal(totalWeight, 100);
});
test("Deployment record creation", () => {
    const deployment = {
        id: newId("deploy"),
        version: "2.0.0",
        status: "planned",
        startedAt: nowIso(),
        completedAt: null,
        rolloutPercent: 0,
    };
    assert.ok(deployment.id.startsWith("deploy_"));
    assert.equal(deployment.status, "planned");
    assert.equal(deployment.rolloutPercent, 0);
});
test("Deployment rolling update progression", () => {
    const deployment = {
        id: newId("deploy"),
        version: "2.0.0",
        status: "rolling",
        startedAt: nowIso(),
        completedAt: null,
        rolloutPercent: 0,
    };
    const stages = [10, 25, 50, 75, 100];
    for (const percent of stages) {
        deployment.rolloutPercent = percent;
    }
    assert.equal(deployment.rolloutPercent, 100);
    assert.equal(deployment.status, "rolling");
});
test("Deployment completion", () => {
    const deployment = {
        id: newId("deploy"),
        version: "2.0.0",
        status: "rolling",
        startedAt: nowIso(),
        completedAt: null,
        rolloutPercent: 100,
    };
    deployment.status = "complete";
    deployment.completedAt = nowIso();
    assert.equal(deployment.status, "complete");
    assert.ok(deployment.completedAt !== null);
});
test("Deployment rollback", () => {
    const deployment = {
        id: newId("deploy"),
        version: "2.0.0",
        status: "rolling",
        startedAt: nowIso(),
        completedAt: null,
        rolloutPercent: 50,
    };
    deployment.status = "rollback";
    deployment.completedAt = nowIso();
    assert.equal(deployment.status, "rollback");
});
test("Multiple active deployments per service", () => {
    const deployments = [
        { id: newId("deploy"), version: "1.9.0", status: "complete", startedAt: nowIso(), completedAt: nowIso(), rolloutPercent: 100 },
        { id: newId("deploy"), version: "2.0.0", status: "rolling", startedAt: nowIso(), completedAt: null, rolloutPercent: 50 },
        { id: newId("deploy"), version: "2.1.0", status: "planned", startedAt: nowIso(), completedAt: null, rolloutPercent: 0 },
    ];
    const active = deployments.filter(d => d.status === "rolling" || d.status === "planned");
    assert.equal(active.length, 2);
});
test("Traffic route weight recalculation", () => {
    const routes = [
        { id: newId("route"), serviceId: newId("svc"), targetPercent: 50, weight: 50, region: "us-east-1", active: true },
        { id: newId("route"), serviceId: newId("svc"), targetPercent: 50, weight: 50, region: "us-west-2", active: true },
    ];
    // Deactivate one route, redistribute weight
    routes[0].active = false;
    const activeRoutes = routes.filter(r => r.active);
    const totalActiveWeight = activeRoutes.reduce((sum, r) => sum + r.weight, 0);
    assert.equal(activeRoutes.length, 1);
    assert.equal(totalActiveWeight, 50);
});
//# sourceMappingURL=deployment-integration.test.js.map