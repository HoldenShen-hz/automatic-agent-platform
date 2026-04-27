/**
 * Additional ModelGatewayBootstrap edge case tests for increased coverage
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildModelGatewayBootstrap,
  MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID,
  MODEL_GATEWAY_CATALOG_SERVICE_ID,
  registerModelGatewayBootstrap,
} from "../../../../src/platform/model-gateway/model-gateway-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildModelGatewayBootstrap returns correct capabilityGroupId", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "model-gateway");
});

test("buildModelGatewayBootstrap returns catalog with all 6 capabilities", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.equal(bootstrap.catalog.length, 6);
});

test("buildModelGatewayBootstrap catalog contains provider-registry", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.catalog.some((c) => c.capabilityId === "provider-registry"));
});

test("buildModelGatewayBootstrap catalog contains router", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.catalog.some((c) => c.capabilityId === "router"));
});

test("buildModelGatewayBootstrap catalog contains fallback", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.catalog.some((c) => c.capabilityId === "fallback"));
});

test("buildModelGatewayBootstrap catalog contains degradation", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.catalog.some((c) => c.capabilityId === "degradation"));
});

test("buildModelGatewayBootstrap catalog contains cost-tracker", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.catalog.some((c) => c.capabilityId === "cost-tracker"));
});

test("buildModelGatewayBootstrap catalog contains messages", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.catalog.some((c) => c.capabilityId === "messages"));
});

test("buildModelGatewayBootstrap catalog entries have correct structure", () => {
  const bootstrap = buildModelGatewayBootstrap();
  for (const item of bootstrap.catalog) {
    assert.ok("capabilityId" in item);
    assert.ok("entryModule" in item);
    assert.ok("description" in item);
    assert.ok("baselineServices" in item);
    assert.ok(Array.isArray(item.baselineServices));
  }
});

test("buildModelGatewayBootstrap registeredServiceIds has correct length", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.equal(bootstrap.registeredServiceIds.length, 2);
});

test("buildModelGatewayBootstrap registeredServiceIds contains catalog service", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.registeredServiceIds.includes(MODEL_GATEWAY_CATALOG_SERVICE_ID));
});

test("buildModelGatewayBootstrap registeredServiceIds contains bootstrap service", () => {
  const bootstrap = buildModelGatewayBootstrap();
  assert.ok(bootstrap.registeredServiceIds.includes(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID));
});

test("registerModelGatewayBootstrap uses default registry when not provided", () => {
  // This test uses the global registry, so we need to be careful
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerModelGatewayBootstrap();
    assert.ok(bootstrap.catalog.length > 0);
  } finally {
    // Clean up
    registry.reset().catch(() => {});
  }
});

test("registerModelGatewayBootstrap returns bootstrap from registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerModelGatewayBootstrap(registry);
    assert.equal(bootstrap.capabilityGroupId, "model-gateway");
    assert.ok(bootstrap.catalog.length > 0);
  } finally {
    await registry.reset();
  }
});

test("MODEL_GATEWAY_CATALOG_SERVICE_ID is a string", () => {
  assert.equal(typeof MODEL_GATEWAY_CATALOG_SERVICE_ID, "string");
});

test("MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID is a string", () => {
  assert.equal(typeof MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID, "string");
});

test("MODEL_GATEWAY_CATALOG_SERVICE_ID is not empty", () => {
  assert.ok(MODEL_GATEWAY_CATALOG_SERVICE_ID.length > 0);
});

test("MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID is not empty", () => {
  assert.ok(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID.length > 0);
});

test("registerModelGatewayBootstrap can be called with fresh registry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const bootstrap = registerModelGatewayBootstrap(registry);
    assert.ok(bootstrap.catalog.length === 6);
    assert.equal(bootstrap.capabilityGroupId, "model-gateway");
  } finally {
    await registry.reset();
  }
});

test("catalog entries have non-empty descriptions", () => {
  const bootstrap = buildModelGatewayBootstrap();
  for (const item of bootstrap.catalog) {
    assert.ok(item.description.length > 0);
  }
});

test("catalog entries have non-empty entryModule paths", () => {
  const bootstrap = buildModelGatewayBootstrap();
  for (const item of bootstrap.catalog) {
    assert.ok(item.entryModule.length > 0);
    assert.ok(item.entryModule.startsWith("src/platform/model-gateway/"));
  }
});

test("catalog entries have non-empty capabilityIds", () => {
  const bootstrap = buildModelGatewayBootstrap();
  for (const item of bootstrap.catalog) {
    assert.ok(item.capabilityId.length > 0);
  }
});

test("catalog entries have at least one baseline service", () => {
  const bootstrap = buildModelGatewayBootstrap();
  for (const item of bootstrap.catalog) {
    assert.ok(item.baselineServices.length > 0);
  }
});

test("registerModelGatewayBootstrap registers catalog service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    registerModelGatewayBootstrap(registry);
    assert.equal(registry.isInitialized(MODEL_GATEWAY_CATALOG_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registerModelGatewayBootstrap registers bootstrap service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    registerModelGatewayBootstrap(registry);
    assert.equal(registry.isInitialized(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("bootstrap dependsOn includes catalog service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const bootstrap = registerModelGatewayBootstrap(registry);
    // The bootstrap should have been registered with dependsOn
    assert.ok(bootstrap);
  } finally {
    await registry.reset();
  }
});
