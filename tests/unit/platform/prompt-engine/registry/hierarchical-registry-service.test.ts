/**
 * Unit tests for HierarchicalPromptRegistryService
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import type { PromptBundleRegistrationInput } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

function createTestBundle(name: string, version: string, domain = "test-domain"): PromptBundleRegistrationInput {
  return {
    name,
    version,
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
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
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

test("HierarchicalPromptRegistryService.registerBundle stores at global level", () => {
  const registry = new HierarchicalPromptRegistryService();
  const bundle = registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");

  assert.equal(bundle.name, "test-bundle");
  assert.equal(bundle.version, 100);
  assert.equal(bundle.domain, "test-domain");
});

test("HierarchicalPromptRegistryService.getBundle retrieves global bundle", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");

  const found = registry.getBundle("test-bundle", "classification");

  assert.ok(found !== null);
  assert.equal(found!.name, "test-bundle");
});

test("HierarchicalPromptRegistryService.getBundle returns null for non-existent bundle", () => {
  const registry = new HierarchicalPromptRegistryService();

  const found = registry.getBundle("non-existent", "classification");

  assert.equal(found, null);
});

test("HierarchicalPromptRegistryService.registerBundle throws for invalid name", () => {
  const registry = new HierarchicalPromptRegistryService();
  const invalidBundle = createTestBundle("", "v1.0");

  assert.throws(
    () => registry.registerBundle(invalidBundle, "global"),
    (error: unknown) => (error as Error).message.includes("name must be non-empty"),
  );
});

test("HierarchicalPromptRegistryService.registerBundle throws for invalid domain", () => {
  const registry = new HierarchicalPromptRegistryService();
  const invalidBundle = createTestBundle("test-bundle", "v1.0", "");

  assert.throws(
    () => registry.registerBundle(invalidBundle, "global"),
    (error: unknown) => (error as Error).message.includes("domain must be non-empty"),
  );
});

test("HierarchicalPromptRegistryService.registerBundle throws for missing system prompt", () => {
  const registry = new HierarchicalPromptRegistryService();
  const invalidBundle: PromptBundleRegistrationInput = {
    name: "test-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    packId: undefined,
    systemPrompt: { content: "", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: undefined,
    constraints: undefined,
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
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

  assert.throws(
    () => registry.registerBundle(invalidBundle, "global"),
    (error: unknown) => (error as Error).message.includes("systemPrompt content must be non-empty"),
  );
});

test("HierarchicalPromptRegistryService.listBundles returns all global bundles", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("bundle-1", "v1.0"), "global");
  registry.registerBundle(createTestBundle("bundle-2", "v1.0"), "global");

  const bundles = registry.listBundles("global");

  assert.equal(bundles.length, 2);
});

test("HierarchicalPromptRegistryService.deprecateBundle marks bundle as deprecated", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");

  registry.deprecateBundle("test-bundle", "v1.0", "global");
  const found = registry.getBundle("test-bundle", "classification");

  assert.equal(found, null);
});

test("HierarchicalPromptRegistryService supports domain-level override", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");
  registry.registerBundle(createTestBundle("test-bundle", "v2.0"), "domain", "override-domain");

  const globalBundle = registry.getBundle("test-bundle", "classification", undefined, undefined);
  const domainBundle = registry.getBundle("test-bundle", "classification", "override-packs", "override-domain");

  assert.ok(globalBundle !== null);
  assert.equal(globalBundle!.version, 100);
  assert.ok(domainBundle !== null);
  assert.equal(domainBundle!.version, 200);
});

test("HierarchicalPromptRegistryService.listBundleVersions includes multiple registered versions", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");
  registry.registerBundle(createTestBundle("test-bundle", "v1.1"), "global");

  const versions = registry.listBundleVersions("test-bundle");

  assert.equal(versions.length, 2);
  assert.equal(versions[0]?.version, 110);
  assert.equal(versions[1]?.version, 100);
});

test("HierarchicalPromptRegistryService.resolveBundleForTraffic honors weighted traffic split", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("traffic-bundle", "v1.0"), "global");
  registry.registerBundle({
    ...createTestBundle("traffic-bundle", "v2.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 0,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");

  const resolved = registry.resolveBundleForTraffic("traffic-bundle", "classification", undefined, undefined, "stable-key");

  assert.ok(resolved !== null);
  assert.equal(resolved!.version, 100);
});

// Issue 1966 fix: Verify traffic slot weights are normalized for fair allocation
test("HierarchicalPromptRegistryService.resolveBundleForTraffic normalizes weights for fair allocation", () => {
  const registry = new HierarchicalPromptRegistryService();
  // Bundle A with weight 30, Bundle B with weight 70 (total = 100)
  registry.registerBundle({
    ...createTestBundle("fairness-bundle", "v1.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 30,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");
  registry.registerBundle({
    ...createTestBundle("fairness-bundle", "v2.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 70,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");

  // Run 100 times with different traffic keys to get statistical distribution
  const counts = { v1_0: 0, v2_0: 0 };
  for (let i = 0; i < 100; i++) {
    const resolved = registry.resolveBundleForTraffic(
      "fairness-bundle",
      "classification",
      undefined,
      undefined,
      `traffic-key-${i}`,
    );
    // v1.0 normalizes to version 100, v2.0 normalizes to version 200
    if (resolved!.version === 100) counts.v1_0++;
    else counts.v2_0++;
  }

  // Before fix: slot = hash % 100 gives wrong distribution when totalWeight != 100
  // After fix: slot = hash % totalWeight properly normalizes
  // Allow ±15% tolerance for statistical variance
  assert.ok(counts.v1_0 >= 15 && counts.v1_0 <= 45, `v1.0 count ${counts.v1_0} not in expected range [15, 45]`);
  assert.ok(counts.v2_0 >= 55 && counts.v2_0 <= 85, `v2.0 count ${counts.v2_0} not in expected range [55, 85]`);
});

// Issue 1966 fix: Verify normalization works when total weight is not 100
test("HierarchicalPromptRegistryService.resolveBundleForTraffic handles non-100 total weights", () => {
  const registry = new HierarchicalPromptRegistryService();
  // Bundle A with weight 1, Bundle B with weight 2 (total = 3)
  registry.registerBundle({
    ...createTestBundle("small-weights", "v1.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 1,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");
  registry.registerBundle({
    ...createTestBundle("small-weights", "v2.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 2,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");

  // Run 300 times with different traffic keys
  const counts = { v1_0: 0, v2_0: 0 };
  for (let i = 0; i < 300; i++) {
    const resolved = registry.resolveBundleForTraffic(
      "small-weights",
      "classification",
      undefined,
      undefined,
      `small-traffic-key-${i}`,
    );
    // v1.0 normalizes to version 100, v2.0 normalizes to version 200
    if (resolved!.version === 100) counts.v1_0++;
    else counts.v2_0++;
  }

  // With proper normalization: v1.0 should get ~33%, v2.0 should get ~67%
  // Without normalization (hash % 100): bias toward lower slot values
  assert.ok(counts.v1_0 >= 70 && counts.v1_0 <= 130, `v1.0 count ${counts.v1_0} not in expected range [70, 130]`);
  assert.ok(counts.v2_0 >= 170 && counts.v2_0 <= 230, `v2.0 count ${counts.v2_0} not in expected range [170, 230]`);
});

// Issue 1962 fix: Verify findBundle respects version parameter
test("HierarchicalPromptRegistryService.deprecateBundle deprecates specific version with displayVersion format", () => {
  const registry = new HierarchicalPromptRegistryService();
  // Register two versions: v1.0 and v2.0
  registry.registerBundle(createTestBundle("multi-version", "v1.0"), "global");
  registry.registerBundle(createTestBundle("multi-version", "v2.0"), "global");

  // Deprecate using displayVersion format (with "v" prefix)
  registry.deprecateBundle("multi-version", "v1.0", "global");

  // v1.0 should be deprecated but v2.0 should still be available via getBundle
  const versions = registry.listBundleVersions("multi-version");
  assert.equal(versions.length, 2);
  const v1Entry = versions.find((v) => v.displayVersion === "v1.0");
  const v2Entry = versions.find((v) => v.displayVersion === "v2.0");
  assert.equal(v1Entry?.deprecated, true);
  assert.equal(v2Entry?.deprecated, false);
});

// Issue 1962 fix: Verify removeBundle removes specific version
test("HierarchicalPromptRegistryService.removeBundle removes specific version", () => {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle(createTestBundle("remove-test", "v1.0"), "global");
  registry.registerBundle(createTestBundle("remove-test", "v2.0"), "global");

  // Remove v1.0 using displayVersion format
  const removed = registry.removeBundle("remove-test", "v1.0", "global");
  assert.equal(removed, true);

  // v1.0 should be gone, v2.0 should remain
  const versions = registry.listBundleVersions("remove-test");
  assert.equal(versions.length, 1);
  assert.equal(versions[0]?.displayVersion, "v2.0");
});

// Issue 1962 fix: Verify findBundle with version="" falls back to default bundle
test("HierarchicalPromptRegistryService.getBundle returns default bundle when no version specified", () => {
  const registry = new HierarchicalPromptRegistryService();
  // Register v1.0 with lower weight and v2.0 with higher weight
  registry.registerBundle({
    ...createTestBundle("default-test", "v1.0"),
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 20,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");
  registry.registerBundle({
    ...createTestBundle("default-test", "v2.0"),
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 80,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");

  // getBundle without version should return default (highest weight/newest bundle)
  const resolved = registry.getBundle("default-test", "classification");
  assert.ok(resolved !== null);
  assert.equal(resolved!.version, 200); // v2.0 normalizes to version 200
});
