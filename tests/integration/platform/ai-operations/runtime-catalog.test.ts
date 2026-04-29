import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID,
  buildAiOperationsRuntimeCatalog,
  registerAiOperationsRuntimeCatalog,
  type AiOperationsRuntimeCatalog,
} from "../../../../src/platform/ai-operations-runtime-catalog.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("AI operations runtime catalog integration - build and verify all capabilities", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.ok(catalog.modelGateway.length > 0, "modelGateway should have capabilities");
  assert.ok(catalog.promptEngine.length > 0, "promptEngine should have capabilities");
  assert.ok(catalog.compliance.length > 0, "compliance should have capabilities");
  assert.ok(catalog.harness.length > 0, "harness should have capabilities");
});

test("AI operations runtime catalog integration - each capability has required fields", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  const checkCapabilities = (caps: readonly { capabilityId: string; entryModule: string; description: string }[], name: string) => {
    for (const cap of caps) {
      assert.ok(cap.capabilityId, `${name}: capability should have capabilityId`);
      assert.ok(cap.entryModule, `${name}: capability should have entryModule`);
      assert.ok(cap.description, `${name}: capability should have description`);
    }
  };

  checkCapabilities(catalog.modelGateway, "modelGateway");
  checkCapabilities(catalog.promptEngine, "promptEngine");
  checkCapabilities(catalog.compliance, "compliance");
  checkCapabilities(catalog.harness, "harness");
});

test("AI operations runtime catalog integration - register and retrieve from registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerAiOperationsRuntimeCatalog(registry);
    const retrieved = registry.get<AiOperationsRuntimeCatalog>(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID);

    assert.strictEqual(catalog, retrieved, "registered catalog should be retrievable from registry");
    assert.ok(registry.isInitialized(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID), "catalog service should be initialized");
  } finally {
    await registry.reset();
  }
});

test("AI operations runtime catalog integration - service ID constant is correct", () => {
  assert.equal(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID, "aiops.runtime.catalog");
});

test("AI operations runtime catalog integration - all four domains present", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  const hasAllDomains =
    "modelGateway" in catalog &&
    "promptEngine" in catalog &&
    "compliance" in catalog &&
    "harness" in catalog;

  assert.ok(hasAllDomains, "catalog should have all four domains");
  assert.equal(Object.keys(catalog).length, 4, "catalog should have exactly four domains");
});

test("AI operations runtime catalog integration - readonly arrays maintain integrity", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.ok(Object.isFrozen(catalog.modelGateway), "modelGateway should be frozen");
  assert.ok(Object.isFrozen(catalog.promptEngine), "promptEngine should be frozen");
  assert.ok(Object.isFrozen(catalog.compliance), "compliance should be frozen");
  assert.ok(Object.isFrozen(catalog.harness), "harness should be frozen");
});