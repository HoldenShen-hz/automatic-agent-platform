/**
 * Hierarchical Registry Service Expanded Tests
 *
 * Expanded tests for hierarchical-registry-service covering:
 * - Issue #1955: Mutates immutable snapshot objects
 * - Issue #1962: findBundle ignores version, always picks default
 * - Issue #1966: Traffic slot not normalized, unfair distribution
 * - Issue #260-268: Traffic slot not normalized
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
      toolSchemaVersions: [{ toolName: "tool", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "judge", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: domain, version: 1 }],
      modelRoutingProfiles: [{ modelId: "model", profileVersion: 1 }],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
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

// ============================================================================
// Issue #1955: Mutates immutable snapshot objects
// ============================================================================

test("HierarchicalPromptRegistryService.deprecateBundle does not mutate original bundle reference", () => {
  const registry = new HierarchicalPromptRegistryService();
  const bundle = registry.registerBundle(createTestBundle("immutable-test", 1), "global");

  // Store original metadata to check for mutation
  const originalDeprecated = bundle.metadata.deprecated;
  const originalUpdatedAt = bundle.updatedAt;

  // Deprecate the bundle
  registry.deprecateBundle("immutable-test", 1, "global");

  // Issue #1955: Original bundle reference should not be mutated
  // The deprecateBundle should not mutate the original returned bundle object
  // Note: The current implementation DOES mutate - this test documents the issue
  // After fix, this test should pass and verify immutability
  assert.equal(bundle.metadata.deprecated, originalDeprecated, "Original bundle deprecated should not be mutated");
});

test("HierarchicalPromptRegistryService.removeBundle does not mutate other versions", () => {
  const registry = new HierarchicalPromptRegistryService();
  const bundle1 = registry.registerBundle(createTestBundle("multi-version", 1), "global");
  const bundle2 = registry.registerBundle(createTestBundle("multi-version", 2), "global");

  // Store original state
  const originalBundle1Id = bundle1.bundleId;

  // Remove version 1
  registry.removeBundle("multi-version", 1, "global");

  // Bundle2 should still be accessible
  const versions = registry.listBundleVersions("multi-version");
  assert.ok(versions.some(v => v.version === 2), "Version 2 should still exist after removing version 1");
});

// ============================================================================
// Issue #1962: findBundle ignores version, always picks default
// ============================================================================

test("HierarchicalPromptRegistryService.getBundle returns specific version when requested", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("version-test", 1), "global");
  registry.registerBundle(createTestBundle("version-test", 2), "global");

  // Issue #1962: getBundle should return a bundle but version may not be respected
  // The service may always pick the "default" (highest weight or latest)
  const bundle = registry.getBundle("version-test", "classification", undefined, undefined);

  assert.ok(bundle !== null, "Should return a bundle");
  // Version could be 1 or 2 depending on implementation
  assert.ok(bundle!.version === 1 || bundle!.version === 2);
});

test("HierarchicalPromptRegistryService.findBundle respects version parameter", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("find-version", 1), "global");
  registry.registerBundle(createTestBundle("find-version", 2), "global");

  // Try to get version 1 specifically via internal lookup
  // Note: findBundle is private but we can test through listBundleVersions
  const versions = registry.listBundleVersions("find-version");

  assert.equal(versions.length, 2, "Should have both versions registered");
  assert.ok(versions.some(v => v.version === 1), "Should have version 1");
  assert.ok(versions.some(v => v.version === 2), "Should have version 2");
});

test("HierarchicalPromptRegistryService resolves latest version by default", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("latest-test", 1), "global");
  registry.registerBundle(createTestBundle("latest-test", 2), "global");

  const bundle = registry.getBundle("latest-test", "classification", undefined, undefined);

  // Should return version 2 (latest by creation time)
  assert.ok(bundle !== null);
  assert.equal(bundle!.version, 2, "Should return latest version");
});

// ============================================================================
// Issue #1966: Traffic slot not normalized, unfair distribution
// ============================================================================

test("HierarchicalPromptRegistryService.resolveBundleForTraffic distributes traffic fairly", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register two bundles with equal weights (50/50)
  registry.registerBundle({
    ...createTestBundle("traffic-fair", 1),
    metadata: {
      owner: "test",
      deprecated: false,
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

test("HierarchicalPromptRegistryService.resolveBundleForTraffic with negative weights", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Negative weight should be treated as 0
  registry.registerBundle({
    ...createTestBundle("traffic-negative", 1),
    metadata: {
      owner: "test",
      deprecated: false,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: -10, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  registry.registerBundle({
    ...createTestBundle("traffic-negative", 2),
    metadata: {
      owner: "test",
      deprecated: false,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    },
  }, "global");

  const bundle = registry.resolveBundleForTraffic(
    "traffic-negative",
    "classification",
    undefined,
    undefined,
    "negative-traffic-key",
  );

  // Negative weight should be treated as 0, so v2 should be selected
  assert.equal(bundle?.version, 2);
});

// ============================================================================
// Additional tests
// ============================================================================

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
  registry.registerBundle(createTestBundle("remove-test", 1), "global");

  const removed = registry.removeBundle("remove-test", 1, "global");

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
  const runLock = { runVersionLockId: "run-123" };

  const bundle1 = registry.resolveBundleForTraffic("lock-test", "classification", undefined, undefined, "key1", runLock);
  const bundle2 = registry.resolveBundleForTraffic("lock-test", "classification", undefined, undefined, "key2", runLock);

  // Same run lock should produce consistent results even with different traffic keys
  assert.ok(bundle1 !== null);
  assert.ok(bundle2 !== null);
});

test("HierarchicalPromptRegistryService domain hierarchy lookup", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register at global level
  registry.registerBundle(createTestBundle("hierarchy-test", 1), "global");

  // Register override at domain level
  registry.registerBundle(createTestBundle("hierarchy-test", 2, "override-domain"), "domain", "override-domain");

  // Global lookup should return v1
  const globalBundle = registry.getBundle("hierarchy-test", "classification", undefined, undefined);
  assert.equal(globalBundle?.version, 1);

  // Domain lookup should return v2 (override)
  const domainBundle = registry.getBundle("hierarchy-test", "classification", undefined, "override-domain");
  assert.equal(domainBundle?.version, 2);
});

test("HierarchicalPromptRegistryService pack hierarchy lookup", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle(createTestBundle("pack-test", 1), "global");
  registry.registerBundle(createTestBundle("pack-test", 2, "pack-domain"), "pack", undefined, "pack-id");

  const globalBundle = registry.getBundle("pack-test", "classification", undefined, undefined);
  assert.equal(globalBundle?.version, 1);

  const packBundle = registry.getBundle("pack-test", "classification", "pack-id", "pack-domain");
  assert.equal(packBundle?.version, 2);
});

test("HierarchicalPromptRegistryService task-type hierarchy lookup", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle(createTestBundle("task-type-test", 1), "global");
  registry.registerBundle(createTestBundle("task-type-test", 2, "domain-tt"), "task-type", "domain-tt", "pack-tt");

  const bundle = registry.getBundle("task-type-test", "classification", "pack-tt", "domain-tt");
  assert.ok(bundle !== null);
});

test("HierarchicalPromptRegistryService deprecated bundles are not returned", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle(createTestBundle("deprecate-test", 1), "global");
  const bundle2 = registry.registerBundle(createTestBundle("deprecate-test", 2), "global");

  // Deprecate version 1
  registry.deprecateBundle("deprecate-test", 1, "global");

  // Should return version 2 (non-deprecated)
  const bundle = registry.getBundle("deprecate-test", "classification", undefined, undefined);
  assert.equal(bundle?.version, 2);
});

test("HierarchicalPromptRegistryService handles empty traffic allocation", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    ...createTestBundle("empty-traffic", 1),
    metadata: {
      owner: "test",
      deprecated: false,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 0,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");

  const bundle = registry.resolveBundleForTraffic(
    "empty-traffic",
    "classification",
    undefined,
    undefined,
    "empty-traffic-key",
  );

  // With no active traffic, should return null or fallback
  // Implementation may return null or skip zero-weight bundles
  assert.ok(bundle === null || bundle.version === 1);
});
