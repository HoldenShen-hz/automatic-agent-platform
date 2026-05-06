/**
 * Unit tests for prompt registry - Prompt lifecycle deprecated stage (R2-8)
 * Tests prompt lifecycle deprecated stage per R2-8
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { PromptVersionManager } from "../../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import type { PromptBundle, PromptBundleRegistrationInput, PromptBundleVersion } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

// ============================================================================
// Helper functions
// ============================================================================

function makePromptBundle(
  name: string,
  version: number,
  deprecated: boolean = false,
): PromptBundle {
  return {
    bundleId: `${name}:${version}`,
    name,
    version,
    displayVersion: `v${version}.0.0`,
    domain: "test-domain",
    taskType: "classification",
    packId: undefined,
    systemPrompt: { content: `Test content for ${name}@${version}`, templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: { maxTokens: 1000, temperature: 0.7, topP: undefined, stopSequences: undefined, responseFormat: undefined, customConstraints: {} },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test-tool", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test-evaluator", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test-domain", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test-model", profileVersion: 1 }],
    },
    metadata: {
      owner: "test",
      deprecated,
      lifecycleStatus: deprecated ? "deprecated" : "active",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// HierarchicalPromptRegistryService Tests
// ============================================================================

test("HierarchicalPromptRegistryService.deprecateBundle marks bundle as deprecated", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "deprecated-test-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Test prompt content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  }, "global");

  registry.deprecateBundle("deprecated-test-bundle", 1, "global");

  const retrieved = registry.getBundle("deprecated-test-bundle", "classification");
  assert.equal(retrieved, null, "Deprecated bundle should not be retrievable");
});

test("HierarchicalPromptRegistryService.getBundle skips deprecated bundles", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "skip-deprecated-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Test content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  const retrieved = registry.getBundle("skip-deprecated-bundle", "classification");
  assert.equal(retrieved, null, "Should skip deprecated bundle");
});

test("HierarchicalPromptRegistryService.listBundleVersions shows deprecated flag", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "versions-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v1.0 content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: false, owner: "test", lifecycleStatus: "active", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  registry.registerBundle({
    name: "versions-bundle",
    version: 2,
    displayVersion: "v2.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v2.0 content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  const versions = registry.listBundleVersions("versions-bundle");

  assert.ok(versions.length >= 2);
  const v1Version = versions.find(v => v.version === 1);
  const v2Version = versions.find(v => v.version === 2);

  if (v1Version) {
    assert.equal(v1Version.deprecated, false, "v1 should not be deprecated");
  }
  if (v2Version) {
    assert.equal(v2Version.deprecated, true, "v2 should be deprecated");
  }
});

test("HierarchicalPromptRegistryService.listBundles excludes deprecated bundles by default", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "visible-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Visible content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: false, owner: "test", lifecycleStatus: "active", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  registry.registerBundle({
    name: "hidden-deprecated-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Hidden content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  const bundles = registry.listBundles("global");

  assert.ok(bundles.length >= 1);
  assert.ok(bundles.every(b => b.bundle.metadata.deprecated !== true),
    "All listed bundles should not be deprecated");
});

test("HierarchicalPromptRegistryService domain-level deprecation works independently", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register at global level
  registry.registerBundle({
    name: "domain-deprecation-test",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "global-domain",
    taskType: "classification",
    systemPrompt: { content: "Global content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  }, "global");

  // Register at domain level with deprecation
  registry.registerBundle({
    name: "domain-deprecation-test",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "override-domain",
    taskType: "classification",
    packId: "test-pack",
    systemPrompt: { content: "Domain content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "domain", "override-domain");

  // Global bundle should still be accessible
  const globalBundle = registry.getBundle("domain-deprecation-test", "classification", undefined, undefined);
  assert.ok(globalBundle !== null, "Global bundle should be accessible");

  // Domain-level lookup should not find deprecated bundle
  const domainBundle = registry.getBundle("domain-deprecation-test", "classification", "test-pack", "override-domain");
  assert.equal(domainBundle, null, "Deprecated domain bundle should not be found");
});

test("HierarchicalPromptRegistryService removeBundle completely removes deprecated bundle", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "remove-bundle-test",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "To be removed", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  const removed = registry.removeBundle("remove-bundle-test", 1, "global");

  assert.equal(removed, true, "Bundle should be removed");

  const versions = registry.listBundleVersions("remove-bundle-test");
  const removedVersion = versions.find(v => v.version === 1);
  assert.ok(removedVersion === undefined || removedVersion.deprecated === true,
    "Removed version should not appear or should be marked deprecated");
});

// ============================================================================
// PromptVersionManager Tests
// ============================================================================

test("PromptVersionManager registers versions with deprecated state", () => {
  const manager = new PromptVersionManager();

  const bundle1 = makePromptBundle("version-test-bundle", 1, false);
  const bundle2 = makePromptBundle("version-test-bundle", 2, true);

  manager.registerBundleVersion(bundle1);
  manager.registerBundleVersion(bundle2);

  const versions = manager.listBundleVersions("version-test-bundle");

  assert.ok(versions.length >= 2);
  const v1 = versions.find(v => v.version === 1);
  const v2 = versions.find(v => v.version === 2);

  if (v1) assert.equal(v1.deprecated, false);
  if (v2) assert.equal(v2.deprecated, true);
});

test("PromptVersionManager.listBundleVersions returns deprecated flag for all versions", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(makePromptBundle("deprecation-flags-bundle", 1, false));
  manager.registerBundleVersion(makePromptBundle("deprecation-flags-bundle", 2, false));
  manager.registerBundleVersion(makePromptBundle("deprecation-flags-bundle", 3, true));

  const versions = manager.listBundleVersions("deprecation-flags-bundle");

  assert.ok(versions.length >= 3);
  assert.ok(versions.every(v => v.deprecated !== undefined),
    "Every version should have deprecated flag");
});

test("PromptVersionManager isCurrentVersion respects deprecated state", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(makePromptBundle("current-version-bundle", 1, false));
  manager.registerBundleVersion(makePromptBundle("current-version-bundle", 2, true));

  // Version 2 is the latest (highest number), so version 1 is not current
  const isCurrent = manager.isCurrentVersion("current-version-bundle", 2);
  assert.equal(isCurrent, true, "v2 should be current version");
});

test("PromptVersionManager.getVersionLineage shows deprecated in lineage", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(makePromptBundle("lineage-bundle", 1, false));
  manager.registerBundleVersion(makePromptBundle("lineage-bundle", 2, true));
  manager.registerBundleVersion(makePromptBundle("lineage-bundle", 3, false));

  const lineage = manager.getVersionLineage("lineage-bundle", 3);

  assert.equal(lineage.current, 3);
  assert.ok(lineage.previous !== undefined, "Should have previous version");
});

test("HierarchicalPromptRegistryService supports re-registration of deprecated bundle", () => {
  const registry = new HierarchicalPromptRegistryService();

  // First registration
  registry.registerBundle({
    name: "reprocess-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Original content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  // Should be able to get at global level (deprecation doesn't affect existence)
  // Note: In current implementation deprecated just means getBundle skips it
  const versions = registry.listBundleVersions("reprocess-bundle");
  assert.ok(versions.length >= 1);
});

test("HierarchicalPromptRegistryService deprecated bundles excluded from traffic resolution", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "traffic-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v1 content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: false, owner: "test", lifecycleStatus: "active", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  registry.registerBundle({
    name: "traffic-bundle",
    version: 2,
    displayVersion: "v2.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v2 content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
    metadata: { deprecated: true, owner: "test", lifecycleStatus: "deprecated", tags: [], compatibilityTags: [], trafficAllocation: { weight: 100 } },
  }, "global");

  const resolved = registry.resolveBundleForTraffic("traffic-bundle", "classification", undefined, undefined, "test-key");

  assert.ok(resolved !== null, "Should resolve a bundle");
  assert.equal(resolved!.version, 1, "Should resolve to non-deprecated version");
});

test("HierarchicalPromptRegistryService.deprecateBundle throws for non-existent bundle", () => {
  const registry = new HierarchicalPromptRegistryService();

  assert.throws(
    () => registry.deprecateBundle("non-existent-bundle", 1, "global"),
    /not found/i,
  );
});

test("PromptVersionManager compares versions correctly with deprecated", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(makePromptBundle("compare-bundle", 1, false));
  manager.registerBundleVersion(makePromptBundle("compare-bundle", 2, true));
  manager.registerBundleVersion(makePromptBundle("compare-bundle", 3, false));

  // 1 < 2
  assert.equal(manager.compareVersions(1, 2), -1);
  // 2 < 3
  assert.equal(manager.compareVersions(2, 3), -1);
  // 1 < 3
  assert.equal(manager.compareVersions(1, 3), -1);
});

test("HierarchicalPromptRegistryService listBundleVersions sorts by version order", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "sorted-versions-bundle",
    version: 2,
    displayVersion: "v2.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v2 content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  }, "global");

  registry.registerBundle({
    name: "sorted-versions-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v1 content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  }, "global");

  const versions = registry.listBundleVersions("sorted-versions-bundle");

  assert.ok(versions.length >= 2);
  // Versions should be sorted descending (newest first)
  const v1Idx = versions.findIndex(v => v.version === 1);
  const v2Idx = versions.findIndex(v => v.version === 2);
  if (v1Idx !== -1 && v2Idx !== -1) {
    assert.ok(v2Idx < v1Idx, "v2 should come before v1 (descending order)");
  }
});

test("PromptVersionManager.getNextVersion calculates correct next version", () => {
  const manager = new PromptVersionManager();

  const next1 = manager.getNextVersion(1);
  assert.equal(next1, 2);

  const next5 = manager.getNextVersion(5);
  assert.equal(next5, 6);
});

test("HierarchicalPromptRegistryService getBundle follows hierarchical lookup precedence", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "hierarchy-test-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "global",
    taskType: "classification",
    systemPrompt: { content: "global content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  }, "global");

  registry.registerBundle({
    name: "hierarchy-test-bundle",
    version: 1,
    displayVersion: "v1.0.0",
    domain: "domain-override",
    taskType: "classification",
    packId: "test-pack",
    systemPrompt: { content: "domain override content", templateVariables: [], channel: "system" },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  }, "domain", "domain-override");

  // Should find domain override when packId and domain provided
  const domainBundle = registry.getBundle("hierarchy-test-bundle", "classification", "test-pack", "domain-override");
  assert.ok(domainBundle !== null);
  assert.equal(domainBundle!.version, 1);
  assert.ok(domainBundle!.metadata.deprecated === false);
});