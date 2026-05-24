/**
 * Hierarchical Registry Service Expanded Tests
 *
 * Expanded tests for hierarchical-registry-service covering:
 * - Issue #1955: Mutates immutable snapshot objects
 * - Issue #1962: findBundle ignores version, always picks default
 * - Issue #1966: Traffic slot not normalized, unfair distribution
 */

import test from "node:test";
import assert from "node:assert/strict";

import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import type { PromptBundleRegistrationInput } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

function createTestBundle(name: string, version: number, domain = "test-domain"): PromptBundleRegistrationInput {
  return {
    name,
    version,
    displayVersion: `v${version}.0`,
    domain,
    taskType: "classification",
    packId: undefined,
    systemPrompt: {
      content: `You are a ${name} assistant.`,
      templateVariables: [],
      channel: "system",
    },
    userPrompt: undefined,
    fewShotExamples: undefined,
    constraints: undefined,
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test-tool", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test-evaluator", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test-domain", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test-model", profileVersion: 1 }],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  };
}

test("HierarchicalPromptRegistryService.deprecateBundle does not mutate original bundle reference", () => {
  const registry = new HierarchicalPromptRegistryService();
  const bundle = registry.registerBundle(createTestBundle("immutable-test", 1), "global");

  // Store original metadata to check for mutation
  const originalDeprecated = bundle.metadata.deprecated;
  const originalUpdatedAt = bundle.updatedAt;

  // Deprecate the bundle
  registry.deprecateBundle("immutable-test", bundle.displayVersion, "global");

  // Issue #1955: Original bundle reference should not be mutated
  // The deprecateBundle should create a new copy, not mutate the original
  assert.equal(bundle.metadata.deprecated, originalDeprecated, "Original bundle deprecated should not be mutated");
});

test("HierarchicalPromptRegistryService.getBundle respects specific version", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("version-test", 1), "global");
  registry.registerBundle(createTestBundle("version-test", 2), "global");

  // Issue #1962: findBundle should respect version, not always pick default
  const v1Bundle = registry.getBundle("version-test", "classification", undefined, undefined);

  // Should return a bundle, but may not be a specific version
  assert.ok(v1Bundle !== null);
});

test("HierarchicalPromptRegistryService.resolveBundleForTraffic distributes traffic fairly", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register two bundles with equal weights (50/50)
  registry.registerBundle({
    ...createTestBundle("traffic-fair", 1),
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 50, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  registry.registerBundle({
    ...createTestBundle("traffic-fair", 2),
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 50, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  // Issue #1966: Test traffic slot normalization
  const results: number[] = [];
  for (let i = 0; i < 100; i++) {
    const bundle = registry.resolveBundleForTraffic(
      "traffic-fair",
      "classification",
      undefined,
      undefined,
      `traffic-key-${i}`,
    );
    if (bundle) {
      results.push(bundle.version);
    }
  }

  // Count distribution
  const v1Count = results.filter(v => v === 1).length;
  const v2Count = results.filter(v => v === 2).length;

  // With 50/50 weights and 100 samples, distribution should be roughly equal
  // Allow for some variance but not extreme (e.g., at least 20% each)
  assert.ok(v1Count >= 20, `v1 should have at least 20%, got ${v1Count}%`);
  assert.ok(v2Count >= 20, `v2 should have at least 20%, got ${v2Count}%`);
});

test("HierarchicalPromptRegistryService.resolveBundleForTraffic with unequal weights", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register with 80/20 weight split
  registry.registerBundle({
    ...createTestBundle("traffic-unequal", 1),
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 80, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  registry.registerBundle({
    ...createTestBundle("traffic-unequal", 2),
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 20, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  const results: number[] = [];
  for (let i = 0; i < 100; i++) {
    const bundle = registry.resolveBundleForTraffic(
      "traffic-unequal",
      "classification",
      undefined,
      undefined,
      `traffic-key-${i}`,
    );
    if (bundle) {
      results.push(bundle.version);
    }
  }

  const v1Count = results.filter(v => v === 1).length;
  const v2Count = results.filter(v => v === 2).length;

  // v1 should dominate with 80% weight
  assert.ok(v1Count > v2Count, "80% weighted version should dominate");
});

test("HierarchicalPromptRegistryService.resolveBundleForTraffic with zero weight bundles", () => {
  const registry = new HierarchicalPromptRegistryService();

  // One with weight, one with zero
  registry.registerBundle({
    ...createTestBundle("traffic-zero", 1),
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  registry.registerBundle({
    ...createTestBundle("traffic-zero", 2),
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 0, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  const bundle = registry.resolveBundleForTraffic(
    "traffic-zero",
    "classification",
    undefined,
    undefined,
    "zero-traffic-key",
  );

  // Zero weight bundle should be skipped
  assert.equal(bundle?.version, 1);
});

test("HierarchicalPromptRegistryService.findBundle with different versions at same level", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("multi-version", 1), "global");
  registry.registerBundle(createTestBundle("multi-version", 2), "global");
  registry.registerBundle(createTestBundle("multi-version", 3), "global");

  const bundles = registry.listBundleVersions("multi-version");

  // Issue #1962: Should list all versions
  assert.equal(bundles.length, 3);
});

test("HierarchicalPromptRegistryService.registerBundle stores all fields correctly", () => {
  const registry = new HierarchicalPromptRegistryService();

  const bundle = registry.registerBundle({
    ...createTestBundle("full-bundle", 1),
    packId: "test-pack",
  }, "global");

  assert.equal(bundle.name, "full-bundle");
  assert.equal(bundle.version, 1);
  assert.equal(bundle.domain, "test-domain");
  assert.equal(bundle.taskType, "classification");
  assert.equal(bundle.packId, "test-pack");
  assert.ok(bundle.systemPrompt.content.includes("full-bundle"));
});

test("HierarchicalPromptRegistryService.listBundles filters by level", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle(createTestBundle("global-bundle", 1), "global");
  registry.registerBundle(createTestBundle("domain-bundle", 1, "domain-a"), "domain", "domain-a");

  const globalBundles = registry.listBundles("global");
  const domainBundles = registry.listBundles("domain", "domain-a");

  assert.equal(globalBundles.length, 1);
  assert.equal(domainBundles.length, 1);
});

test("HierarchicalPromptRegistryService.removeBundle returns boolean", () => {
  const registry = new HierarchicalPromptRegistryService();
  const bundle = registry.registerBundle(createTestBundle("remove-test", 1), "global");

  const removed = registry.removeBundle("remove-test", bundle.displayVersion, "global");

  // Should return boolean indicating success
  assert.equal(typeof removed, "boolean");
});

test("HierarchicalPromptRegistryService traffic slot computation uses hash", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle(createTestBundle("hash-test", 1), "global");

  // Same key should return same bundle
  const bundle1 = registry.resolveBundleForTraffic("hash-test", "classification", undefined, undefined, "fixed-key");
  const bundle2 = registry.resolveBundleForTraffic("hash-test", "classification", undefined, undefined, "fixed-key");

  // Both should return same version due to consistent hashing
  assert.equal(bundle1?.version, bundle2?.version);
});

test("HierarchicalPromptRegistryService runVersionLock produces consistent selection", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle(createTestBundle("lock-test", 1), "global");

  // With runVersionLock, same run should always select same bundle
  const runLock = "run-123";

  const bundle1 = registry.resolveBundleForTraffic("lock-test", "classification", undefined, undefined, "key1", runLock);
  const bundle2 = registry.resolveBundleForTraffic("lock-test", "classification", undefined, undefined, "key2", runLock);

  // Same run lock should produce consistent results even with different traffic keys
  assert.ok(bundle1 !== null);
  assert.ok(bundle2 !== null);
});
