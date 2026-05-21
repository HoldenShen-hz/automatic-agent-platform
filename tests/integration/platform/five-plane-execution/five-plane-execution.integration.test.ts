import assert from "node:assert/strict";
import test from "node:test";

import {
  listExecutionCapabilityBaselines,
  resolveExecutionCapabilityBaseline,
  EXECUTION_CAPABILITY_BASELINES,
} from "../../../../src/platform/five-plane-execution/execution-plane-baseline.js";

import {
  buildExecutionPlaneBootstrap,
  registerExecutionPlaneBootstrap,
  EXECUTION_PLANE_CATALOG_SERVICE_ID,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
} from "../../../../src/platform/five-plane-execution/execution-plane-bootstrap.js";

test("execution-plane-baseline module can be imported", async () => {
  const module = await import("../../../../src/platform/five-plane-execution/execution-plane-baseline.js");
  assert.ok(typeof module.listExecutionCapabilityBaselines === "function");
  assert.ok(typeof module.resolveExecutionCapabilityBaseline === "function");
  assert.ok(Array.isArray(module.EXECUTION_CAPABILITY_BASELINES));
});

test("execution-plane-bootstrap module can be imported", async () => {
  const module = await import("../../../../src/platform/five-plane-execution/execution-plane-bootstrap.js");
  assert.ok(typeof module.buildExecutionPlaneBootstrap === "function");
  assert.ok(typeof module.registerExecutionPlaneBootstrap === "function");
  assert.equal(module.EXECUTION_PLANE_CATALOG_SERVICE_ID, "plane.execution.catalog");
  assert.equal(module.EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID, "plane.execution.bootstrap");
});

test("execution-plane-bootstrap builds correct bootstrap", async () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.equal(bootstrap.planeId, "execution");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(bootstrap.registeredServiceIds.includes(EXECUTION_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("execution-plane-baseline has all thirteen capability baselines", async () => {
  const ids = EXECUTION_CAPABILITY_BASELINES.map((b) => b.capabilityId);
  assert.ok(ids.includes("dispatcher"), "should have dispatcher capability");
  assert.ok(ids.includes("distributed-lock"), "should have distributed-lock capability");
  assert.ok(ids.includes("execution-engine"), "should have execution-engine capability");
  assert.ok(ids.includes("ha"), "should have ha capability");
  assert.ok(ids.includes("hot-upgrade"), "should have hot-upgrade capability");
  assert.ok(ids.includes("lease"), "should have lease capability");
  assert.ok(ids.includes("plugin-executor"), "should have plugin-executor capability");
  assert.ok(ids.includes("queue"), "should have queue capability");
  assert.ok(ids.includes("recovery"), "should have recovery capability");
  assert.ok(ids.includes("resource"), "should have resource capability");
  assert.ok(ids.includes("startup"), "should have startup capability");
  assert.ok(ids.includes("state-transition"), "should have state-transition capability");
  assert.ok(ids.includes("tool-executor"), "should have tool-executor capability");
  assert.ok(ids.includes("worker-pool"), "should have worker-pool capability");
});

test("execution-plane-baseline lists all 14 capability baselines", async () => {
  const baselines = listExecutionCapabilityBaselines();
  assert.equal(baselines.length, 14);
});

test("resolveExecutionCapabilityBaseline returns correct baseline for valid id", async () => {
  const baseline = resolveExecutionCapabilityBaseline("execution-engine");
  assert.equal(baseline.capabilityId, "execution-engine");
  assert.ok(Array.isArray(baseline.baselineServices));
  assert.ok(baseline.baselineServices.includes("AgentExecutor"));
});

test("resolveExecutionCapabilityBaseline throws for invalid id", async () => {
  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => resolveExecutionCapabilityBaseline("invalid-capability" as any),
    /execution_capability.not_found/,
  );
});

test("registerExecutionPlaneBootstrap registers services without error", async () => {
  const bootstrap = registerExecutionPlaneBootstrap();
  assert.equal(bootstrap.planeId, "execution");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 14);
});

test("each capability baseline has required fields", async () => {
  const baselines = listExecutionCapabilityBaselines();
  for (const baseline of baselines) {
    assert.ok(typeof baseline.capabilityId === "string", `${baseline.capabilityId} should have capabilityId`);
    assert.ok(typeof baseline.entryModule === "string", `${baseline.capabilityId} should have entryModule`);
    assert.ok(typeof baseline.description === "string", `${baseline.capabilityId} should have description`);
    assert.ok(Array.isArray(baseline.baselineServices), `${baseline.capabilityId} should have baselineServices array`);
  }
});

test("capability baselines are frozen and immutable", async () => {
  const baselines = listExecutionCapabilityBaselines();
  assert.throws(
    () => {
      // @ts-expect-error - testing immutability
      baselines[0].capabilityId = "modified";
    },
    TypeError,
  );
});
