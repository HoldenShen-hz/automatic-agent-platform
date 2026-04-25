import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID,
  buildAiOperationsRuntimeCatalog,
  registerAiOperationsRuntimeCatalog,
  type AiOperationsRuntimeCatalog,
} from "../../../src/platform/ai-operations-runtime-catalog.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("buildAiOperationsRuntimeCatalog returns correct interface shape", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.ok(catalog != null);
  assert.ok(Array.isArray(catalog.modelGateway));
  assert.ok(Array.isArray(catalog.promptEngine));
  assert.ok(Array.isArray(catalog.compliance));
  assert.ok(Array.isArray(catalog.harness));
});

test("buildAiOperationsRuntimeCatalog modelGateway has 6 capabilities", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.equal(catalog.modelGateway.length, 6);
  assert.ok(catalog.modelGateway.every((c) => c.capabilityId != null));
  assert.ok(catalog.modelGateway.every((c) => c.entryModule != null));
});

test("buildAiOperationsRuntimeCatalog promptEngine has 5 capabilities", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.equal(catalog.promptEngine.length, 5);
  assert.ok(catalog.promptEngine.every((c) => c.capabilityId != null));
  assert.ok(catalog.promptEngine.every((c) => c.entryModule != null));
});

test("buildAiOperationsRuntimeCatalog compliance has 5 capabilities", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.equal(catalog.compliance.length, 5);
  assert.ok(catalog.compliance.every((c) => c.capabilityId != null));
  assert.ok(catalog.compliance.every((c) => c.entryModule != null));
});

test("buildAiOperationsRuntimeCatalog harness has 4 capabilities", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  assert.equal(catalog.harness.length, 4);
  assert.ok(catalog.harness.every((c) => c.capabilityId != null));
  assert.ok(catalog.harness.every((c) => c.entryModule != null));
});

test("buildAiOperationsRuntimeCatalog catalog entries contain required fields", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  const allEntries = [
    ...catalog.modelGateway,
    ...catalog.promptEngine,
    ...catalog.compliance,
    ...catalog.harness,
  ];

  for (const entry of allEntries) {
    assert.ok(typeof entry.capabilityId === "string");
    assert.ok(typeof entry.entryModule === "string");
    assert.ok(typeof entry.description === "string");
    assert.ok(Array.isArray(entry.baselineServices));
  }
});

test("buildAiOperationsRuntimeCatalog modelGateway capabilities are correct", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  const capabilityIds = catalog.modelGateway.map((c) => c.capabilityId);

  assert.ok(capabilityIds.includes("provider-registry"));
  assert.ok(capabilityIds.includes("router"));
  assert.ok(capabilityIds.includes("fallback"));
  assert.ok(capabilityIds.includes("degradation"));
  assert.ok(capabilityIds.includes("cost-tracker"));
  assert.ok(capabilityIds.includes("messages"));
});

test("buildAiOperationsRuntimeCatalog promptEngine capabilities are correct", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  const capabilityIds = catalog.promptEngine.map((c) => c.capabilityId);

  assert.ok(capabilityIds.includes("registry"));
  assert.ok(capabilityIds.includes("renderer"));
  assert.ok(capabilityIds.includes("rollout"));
  assert.ok(capabilityIds.includes("eval"));
  assert.ok(capabilityIds.includes("conversation-template"));
});

test("buildAiOperationsRuntimeCatalog compliance capabilities are correct", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  const capabilityIds = catalog.compliance.map((c) => c.capabilityId);

  assert.ok(capabilityIds.includes("crypto-shredding"));
  assert.ok(capabilityIds.includes("data-residency"));
  assert.ok(capabilityIds.includes("encryption"));
  assert.ok(capabilityIds.includes("erasure"));
  assert.ok(capabilityIds.includes("lineage"));
});

test("buildAiOperationsRuntimeCatalog harness capabilities are correct", () => {
  const catalog = buildAiOperationsRuntimeCatalog();
  const capabilityIds = catalog.harness.map((c) => c.capabilityId);

  assert.ok(capabilityIds.includes("constraint-pack"));
  assert.ok(capabilityIds.includes("planner-generator-evaluator-loop"));
  assert.ok(capabilityIds.includes("hitl"));
  assert.ok(capabilityIds.includes("governance"));
});

test("registerAiOperationsRuntimeCatalog registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerAiOperationsRuntimeCatalog(registry);

    assert.ok(registry.isInitialized(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID));
    assert.deepEqual(catalog.modelGateway.length, 6);
    assert.deepEqual(catalog.promptEngine.length, 5);
    assert.deepEqual(catalog.compliance.length, 5);
    assert.deepEqual(catalog.harness.length, 4);
  } finally {
    await registry.reset();
  }
});

test("registerAiOperationsRuntimeCatalog returns same service on subsequent calls", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog1 = registerAiOperationsRuntimeCatalog(registry);
    const catalog2 = registerAiOperationsRuntimeCatalog(registry);

    assert.strictEqual(catalog1, catalog2);
  } finally {
    await registry.reset();
  }
});

test("registerAiOperationsRuntimeCatalog harness contains governance capability", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const catalog = registerAiOperationsRuntimeCatalog(registry);

    assert.ok(catalog.harness.some((item) => item.capabilityId === "governance"));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeCatalog interface is readonly", () => {
  const catalog = buildAiOperationsRuntimeCatalog();

  // Verify that the arrays are readonly (frozen)
  assert.ok(Object.isFrozen(catalog.modelGateway));
  assert.ok(Object.isFrozen(catalog.promptEngine));
  assert.ok(Object.isFrozen(catalog.compliance));
  assert.ok(Object.isFrozen(catalog.harness));
});
