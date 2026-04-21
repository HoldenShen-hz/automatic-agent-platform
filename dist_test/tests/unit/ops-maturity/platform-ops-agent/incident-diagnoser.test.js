import assert from "node:assert/strict";
import test from "node:test";
import { summarizeOpsHealth } from "../../../../../src/ops-maturity/platform-ops-agent/incident-diagnoser/index.js";
test("summarizeOpsHealth returns healthy when all probes healthy", () => {
    const probes = [
        { component: "db", status: "healthy" },
        { component: "cache", status: "healthy" },
    ];
    const result = summarizeOpsHealth(probes);
    assert.equal(result, "healthy");
});
test("summarizeOpsHealth returns degraded when any probe degraded", () => {
    const probes = [
        { component: "db", status: "healthy" },
        { component: "cache", status: "degraded" },
    ];
    const result = summarizeOpsHealth(probes);
    assert.equal(result, "degraded");
});
test("summarizeOpsHealth returns failed when any probe failed", () => {
    const probes = [
        { component: "db", status: "failed" },
        { component: "cache", status: "healthy" },
    ];
    const result = summarizeOpsHealth(probes);
    assert.equal(result, "failed");
});
test("summarizeOpsHealth failed takes precedence over degraded", () => {
    const probes = [
        { component: "db", status: "failed" },
        { component: "cache", status: "degraded" },
    ];
    const result = summarizeOpsHealth(probes);
    assert.equal(result, "failed");
});
test("summarizeOpsHealth returns healthy for empty array", () => {
    const result = summarizeOpsHealth([]);
    assert.equal(result, "healthy");
});
test("summarizeOpsHealth single probe healthy", () => {
    const probes = [{ component: "api", status: "healthy" }];
    assert.equal(summarizeOpsHealth(probes), "healthy");
});
test("summarizeOpsHealth single probe failed", () => {
    const probes = [{ component: "api", status: "failed" }];
    assert.equal(summarizeOpsHealth(probes), "failed");
});
test("OpsHealthProbe interface accepts all status values", () => {
    const healthy = { component: "test", status: "healthy" };
    const degraded = { component: "test", status: "degraded" };
    const failed = { component: "test", status: "failed" };
    assert.ok(healthy);
    assert.ok(degraded);
    assert.ok(failed);
});
//# sourceMappingURL=incident-diagnoser.test.js.map