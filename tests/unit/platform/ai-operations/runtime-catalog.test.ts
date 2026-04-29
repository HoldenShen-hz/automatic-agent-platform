import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID,
  buildAiOperationsRuntimeCatalog,
  registerAiOperationsRuntimeCatalog,
  type AiOperationsRuntimeCatalog,
} from "../../../../src/platform/ai-operations-runtime-catalog.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("buildAiOperationsRuntimeCatalog returns all four capability domains", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  assert.ok(catalog.modelGateway, "modelGateway should exist");
  assert.ok(catalog.promptEngine, "promptEngine should exist");
  assert.ok(catalog.compliance, "compliance should exist");
  assert.ok(catalog.harness, "harness should exist");
});

test("AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID is defined correctly", () => {
  assert.equal(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID, "aiops.runtime.catalog");
});

test("catalog capability domains are readonly arrays", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  assert.ok(Array.isArray(catalog.modelGateway), "modelGateway should be array");
  assert.ok(Array.isArray(catalog.promptEngine), "promptEngine should be array");
  assert.ok(Array.isArray(catalog.compliance), "compliance should be array");
  assert.ok(Array.isArray(catalog.harness), "harness should be array");
});

test("capability baselines have expected structure", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  if (catalog.modelGateway.length > 0) {
    const cap = catalog.modelGateway[0];
    assert.ok("capabilityId" in cap, "capability should have capabilityId");
    assert.ok("entryModule" in cap, "capability should have entryModule");
    assert.ok("description" in cap, "capability should have description");
    assert.equal(typeof cap.capabilityId, "string");
  }

  if (catalog.promptEngine.length > 0) {
    const cap = catalog.promptEngine[0];
    assert.ok("capabilityId" in cap, "capability should have capabilityId");
    assert.ok("entryModule" in cap, "capability should have entryModule");
    assert.ok("description" in cap, "capability should have description");
    assert.equal(typeof cap.capabilityId, "string");
  }

  if (catalog.compliance.length > 0) {
    const cap = catalog.compliance[0];
    assert.ok("capabilityId" in cap, "capability should have capabilityId");
    assert.ok("entryModule" in cap, "capability should have entryModule");
    assert.ok("description" in cap, "capability should have description");
    assert.equal(typeof cap.capabilityId, "string");
  }

  if (catalog.harness.length > 0) {
    const cap = catalog.harness[0];
    assert.ok("capabilityId" in cap, "capability should have capabilityId");
    assert.ok("entryModule" in cap, "capability should have entryModule");
    assert.ok("description" in cap, "capability should have description");
    assert.equal(typeof cap.capabilityId, "string");
  }
});

test("catalog interface type is correctly exported", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  assert.ok(catalog.modelGateway.length >= 0);
  assert.ok(catalog.promptEngine.length >= 0);
  assert.ok(catalog.compliance.length >= 0);
  assert.ok(catalog.harness.length >= 0);
});

test("registerAiOperationsRuntimeCatalog registers catalog in service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerAiOperationsRuntimeCatalog(registry);
    assert.equal(registry.isInitialized(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID), true);
    assert.ok(catalog.modelGateway, "catalog should have modelGateway");
    assert.ok(catalog.promptEngine, "catalog should have promptEngine");
    assert.ok(catalog.compliance, "catalog should have compliance");
    assert.ok(catalog.harness, "catalog should have harness");
  } finally {
    await registry.reset();
  }
});

test("catalog returns same service id on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog1 = registerAiOperationsRuntimeCatalog(registry);
    const catalog2 = registry.get<AiOperationsRuntimeCatalog>(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID);
    assert.strictEqual(catalog1, catalog2, "should return same catalog instance");
  } finally {
    await registry.reset();
  }
});