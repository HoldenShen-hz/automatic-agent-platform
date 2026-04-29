import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildInterfacePlaneBootstrap,
  INTERFACE_PLANE_CATALOG_SERVICE_ID,
  INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID,
} from "../../../../src/platform/five-plane-interface/interface-plane-bootstrap.js";

test("buildInterfacePlaneBootstrap returns correct structure", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.equal(bootstrap.catalog.length, 6);
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  assert.equal(bootstrap.registeredServiceIds.length, 2);
});

test("buildInterfacePlaneBootstrap catalog contains api capability", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  const apiCap = bootstrap.catalog.find((b) => b.capabilityId === "api");
  assert.ok(apiCap, "api capability should be in catalog");
});

test("buildInterfacePlaneBootstrap registeredServiceIds contains catalog and bootstrap service ids", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.ok(bootstrap.registeredServiceIds.includes(INTERFACE_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("buildInterfacePlaneBootstrap returns non-null catalog", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.ok(bootstrap.catalog != null, "catalog should not be null");
  assert.ok(Array.isArray(bootstrap.catalog), "catalog should be an array");
});

test("buildInterfacePlaneBootstrap returns planeId as interface", () => {
  const bootstrap = buildInterfacePlaneBootstrap();
  assert.equal(bootstrap.planeId, "interface");
});

test("INTERFACE_PLANE_CATALOG_SERVICE_ID is correct string value", () => {
  assert.equal(INTERFACE_PLANE_CATALOG_SERVICE_ID, "plane.interface.catalog");
});

test("INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID is correct string value", () => {
  assert.equal(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, "plane.interface.bootstrap");
});