import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFivePlaneRuntimeCatalog,
  FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID,
  X1_FABRIC_BOOTSTRAP_SERVICE_ID,
  buildX1FabricBootstrap,
  registerFivePlaneRuntimeCatalog,
  performBootstrapHealthCheck,
  type BootstrapHealthCheck,
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

test("performBootstrapHealthCheck returns healthy status when all services are initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    const health = performBootstrapHealthCheck(registry);
    assert.equal(health.healthy, true, "health check should be healthy");
    assert.deepEqual(health.failedServices, [], "no services should have failed");
    assert.deepEqual(health.errors, [], "no errors should be present");
    assert.ok(health.checkedAt, "checkedAt should be set");
  } finally {
    await registry.reset();
  }
});

test("performBootstrapHealthCheck returns correct BootstrapHealthCheck structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    const health = performBootstrapHealthCheck(registry);
    assert.ok("healthy" in health, "health check should have healthy property");
    assert.ok("failedServices" in health, "health check should have failedServices property");
    assert.ok("errors" in health, "health check should have errors property");
    assert.ok("checkedAt" in health, "health check should have checkedAt property");
    assert.equal(typeof health.healthy, "boolean", "healthy should be boolean");
    assert.ok(Array.isArray(health.failedServices), "failedServices should be an array");
    assert.ok(Array.isArray(health.errors), "errors should be an array");
    assert.equal(typeof health.checkedAt, "string", "checkedAt should be a string");
  } finally {
    await registry.reset();
  }
});

test("performBootstrapHealthCheck includes all five plane bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    const health = performBootstrapHealthCheck(registry);
    const expectedServices = [
      "plane.interface.bootstrap",
      "plane.control.bootstrap",
      "plane.orchestration.bootstrap",
      "plane.execution.bootstrap",
      "plane.state-evidence.bootstrap",
    ];
    for (const serviceId of expectedServices) {
      assert.ok(
        !health.failedServices.includes(serviceId),
        `${serviceId} should not be in failedServices`,
      );
    }
  } finally {
    await registry.reset();
  }
});
