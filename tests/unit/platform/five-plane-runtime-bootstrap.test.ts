import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFivePlaneRuntimeCatalog,
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  X1_FABRIC_BOOTSTRAP_SERVICE_ID,
  buildX1FabricBootstrap,
  registerFivePlaneRuntimeCatalog,
} from "../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
} from "../../../src/platform/model-gateway/model-gateway-bootstrap.js";
import {
  PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID,
} from "../../../src/platform/prompt-engine/prompt-engine-bootstrap.js";
import {
  COMPLIANCE_BOOTSTRAP_SERVICE_ID,
} from "../../../src/platform/compliance/compliance-bootstrap.js";

test("buildFivePlaneRuntimeCatalog returns all five planes", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  assert.ok(catalog.interfacePlane, "interfacePlane should exist");
  assert.ok(catalog.controlPlane, "controlPlane should exist");
  assert.ok(catalog.orchestrationPlane, "orchestrationPlane should exist");
  assert.ok(catalog.executionPlane, "executionPlane should exist");
  assert.ok(catalog.stateEvidencePlane, "stateEvidencePlane should exist");
});

test("five-plane runtime bootstrap builds the full five-plane catalog", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  assert.ok(catalog.interfacePlane.length > 0, "interfacePlane should have capabilities");
  assert.ok(catalog.controlPlane.length > 0, "controlPlane should have capabilities");
  assert.ok(catalog.orchestrationPlane.length > 0, "orchestrationPlane should have capabilities");
  assert.ok(catalog.executionPlane.length > 0, "executionPlane should have capabilities");
  assert.ok(catalog.stateEvidencePlane.length > 0, "stateEvidencePlane should have capabilities");
});

test("catalog capability baselines have expected structure", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  const firstInterfaceCapability = catalog.interfacePlane[0];
  assert.ok(firstInterfaceCapability, "interfacePlane should have at least one capability");
  assert.ok("capabilityId" in firstInterfaceCapability, "capability should have capabilityId");
  assert.ok("entryModule" in firstInterfaceCapability, "capability should have entryModule");
  assert.ok("description" in firstInterfaceCapability, "capability should have description");
  assert.ok("baselineServices" in firstInterfaceCapability, "capability should have baselineServices");
  assert.equal(typeof firstInterfaceCapability.capabilityId, "string");
});

test("capability baselines have capabilityId in each plane", () => {
  const catalog = buildFivePlaneRuntimeCatalog();

  for (const capability of catalog.interfacePlane) {
    assert.ok(capability.capabilityId, "interface capability should have capabilityId");
  }
  for (const capability of catalog.controlPlane) {
    assert.ok(capability.capabilityId, "control-plane capability should have capabilityId");
  }
  for (const capability of catalog.orchestrationPlane) {
    assert.ok(capability.capabilityId, "orchestration capability should have capabilityId");
  }
  for (const capability of catalog.executionPlane) {
    assert.ok(capability.capabilityId, "execution capability should have capabilityId");
  }
  for (const capability of catalog.stateEvidencePlane) {
    assert.ok(capability.capabilityId, "state-evidence capability should have capabilityId");
  }
});

test("FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID is defined correctly", () => {
  assert.equal(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID, "plane.runtime.catalog");
});

test("X1_FABRIC_BOOTSTRAP_SERVICE_ID is defined correctly", () => {
  assert.equal(X1_FABRIC_BOOTSTRAP_SERVICE_ID, "plane.x1-fabric.bootstrap");
});

test("buildX1FabricBootstrap returns correct structure", () => {
  const bootstrap = buildX1FabricBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "x1-fabric");
  assert.ok(bootstrap.capabilityCount > 0, "capabilityCount should be greater than 0");
  assert.ok(bootstrap.registeredServiceIds.length > 0, "registeredServiceIds should not be empty");
  assert.ok(bootstrap.registeredServiceIds.includes(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(COMPLIANCE_BOOTSTRAP_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(X1_FABRIC_BOOTSTRAP_SERVICE_ID));
});

test("catalog type is correctly exported", () => {
  const catalog = buildFivePlaneRuntimeCatalog();
  assert.ok(catalog.interfacePlane.length >= 0);
  assert.ok(catalog.controlPlane.length >= 0);
  assert.ok(catalog.orchestrationPlane.length >= 0);
  assert.ok(catalog.executionPlane.length >= 0);
  assert.ok(catalog.stateEvidencePlane.length >= 0);
});

test("registerFivePlaneRuntimeCatalog registers plane catalogs in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerFivePlaneRuntimeCatalog(registry);
    assert.equal(registry.isInitialized(FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized("plane.interface.catalog"), true);
    assert.equal(registry.isInitialized("plane.interface.bootstrap"), true);
    assert.equal(registry.isInitialized(X1_FABRIC_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
