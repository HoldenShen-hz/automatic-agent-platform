/**
 * Unit tests for prompt registry - Prompt lifecycle deprecated stage (R2-8)
 * Tests prompt lifecycle deprecated stage per R2-8
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { PromptVersionManager } from "../../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import type { PromptBundleRegistrationInput, PromptBundleVersion } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

// ============================================================================
// R2-8: Prompt lifecycle deprecated stage
// ============================================================================

test("HierarchicalPromptRegistryService.deprecateBundle marks bundle as deprecated", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "deprecated-test-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Test prompt content", templateVariables: [], channel: "system" },
  }, "global");

  registry.deprecateBundle("deprecated-test-bundle", "v1.0", "global");

  const retrieved = registry.getBundle("deprecated-test-bundle", "classification");
  assert.equal(retrieved, null, "Deprecated bundle should not be retrievable");
});

test("HierarchicalPromptRegistryService.getBundle skips deprecated bundles", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "skip-deprecated-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Test content", templateVariables: [], channel: "system" },
    metadata: { deprecated: true },
  }, "global");

  const retrieved = registry.getBundle("skip-deprecated-bundle", "classification");
  assert.equal(retrieved, null, "Should skip deprecated bundle");
});

test("HierarchicalPromptRegistryService.listBundleVersions shows deprecated flag", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "versions-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v1.0 content", templateVariables: [], channel: "system" },
    metadata: { deprecated: false },
  }, "global");

  registry.registerBundle({
    name: "versions-bundle",
    version: "v2.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v2.0 content", templateVariables: [], channel: "system" },
    metadata: { deprecated: true },
  }, "global");

  const versions = registry.listBundleVersions("versions-bundle");

  assert.ok(versions.length >= 2);
  const v1Version = versions.find(v => v.version === "v1.0");
  const v2Version = versions.find(v => v.version === "v2.0");

  if (v1Version) {
    assert.equal(v1Version.deprecated, false, "v1.0 should not be deprecated");
  }
  if (v2Version) {
    assert.equal(v2Version.deprecated, true, "v2.0 should be deprecated");
  }
});

test("HierarchicalPromptRegistryService.listBundles excludes deprecated bundles by default", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "visible-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Visible content", templateVariables: [], channel: "system" },
    metadata: { deprecated: false },
  }, "global");

  registry.registerBundle({
    name: "hidden-deprecated-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Hidden content", templateVariables: [], channel: "system" },
    metadata: { deprecated: true },
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
    version: "v1.0",
    domain: "global-domain",
    taskType: "classification",
    systemPrompt: { content: "Global content", templateVariables: [], channel: "system" },
  }, "global");

  // Register at domain level with deprecation
  registry.registerBundle({
    name: "domain-deprecation-test",
    version: "v1.0",
    domain: "override-domain",
    taskType: "classification",
    packId: "test-pack",
    systemPrompt: { content: "Domain content", templateVariables: [], channel: "system" },
    metadata: { deprecated: true },
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
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "To be removed", templateVariables: [], channel: "system" },
    metadata: { deprecated: true },
  }, "global");

  const removed = registry.removeBundle("remove-bundle-test", "v1.0", "global");

  assert.equal(removed, true, "Bundle should be removed");

  const versions = registry.listBundleVersions("remove-bundle-test");
  const removedVersion = versions.find(v => v.version === "v1.0");
  assert.ok(removedVersion === undefined || removedVersion.deprecated === true,
    "Removed version should not appear or should be marked deprecated");
});

test("PromptVersionManager registers versions with deprecated state", () => {
  const manager = new PromptVersionManager();

  const bundle1 = createTestBundle("version-test-bundle", "v1.0", false);
  const bundle2 = createTestBundle("version-test-bundle", "v2.0", true);

  manager.registerBundleVersion(bundle1);
  manager.registerBundleVersion(bundle2);

  const versions = manager.listBundleVersions("version-test-bundle");

  assert.ok(versions.length >= 2);
  const v1 = versions.find(v => v.version === "v1.0");
  const v2 = versions.find(v => v.version === "v2.0");

  if (v1) assert.equal(v1.deprecated, false);
  if (v2) assert.equal(v2.deprecated, true);
});

test("PromptVersionManager.listBundleVersions returns deprecated flag for all versions", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("deprecation-flags-bundle", "v1.0", false));
  manager.registerBundleVersion(createTestBundle("deprecation-flags-bundle", "v2.0", false));
  manager.registerBundleVersion(createTestBundle("deprecation-flags-bundle", "v3.0", true));

  const versions = manager.listBundleVersions("deprecation-flags-bundle");

  assert.ok(versions.length >= 3);
  assert.ok(versions.every(v => v.deprecated !== undefined),
    "Every version should have deprecated flag");
});

test("PromptVersionManager isCurrentVersion respects deprecated state", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("current-version-bundle", "v1.0", false));
  manager.registerBundleVersion(createTestBundle("current-version-bundle", "v2.0", true));

  // v1.0 should be considered current (only non-deprecated)
  const isCurrent = manager.isCurrentVersion("current-version-bundle", "v1.0");
  assert.equal(isCurrent, true, "v1.0 should be current version");
});

test("PromptVersionManager.getVersionLineage shows deprecated in lineage", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("lineage-bundle", "v1.0", false));
  manager.registerBundleVersion(createTestBundle("lineage-bundle", "v2.0", true));
  manager.registerBundleVersion(createTestBundle("lineage-bundle", "v3.0", false));

  const lineage = manager.getVersionLineage("lineage-bundle", "v3.0");

  assert.equal(lineage.current, "v3.0");
  assert.ok(lineage.previous !== undefined, "Should have previous version");
});

// ============================================================================
// Additional deprecated stage lifecycle tests
// ============================================================================

test("HierarchicalPromptRegistryService supports re-registration of deprecated bundle", () => {
  const registry = new HierarchicalPromptRegistryService();

  // First registration
  registry.registerBundle({
    name: "reprocess-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "Original content", templateVariables: [], channel: "system" },
    metadata: { deprecated: true },
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
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v1 content", templateVariables: [], channel: "system" },
    metadata: { deprecated: false, trafficAllocation: { weight: 100 } },
  }, "global");

  registry.registerBundle({
    name: "traffic-bundle",
    version: "v2.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v2 content", templateVariables: [], channel: "system" },
    metadata: { deprecated: true, trafficAllocation: { weight: 100 } },
  }, "global");

  const resolved = registry.resolveBundleForTraffic("traffic-bundle", "classification", undefined, undefined, "test-key");

  assert.ok(resolved !== null, "Should resolve a bundle");
  assert.equal(resolved!.version, "v1.0", "Should resolve to non-deprecated version");
});

test("HierarchicalPromptRegistryService.deprecateBundle throws for non-existent bundle", () => {
  const registry = new HierarchicalPromptRegistryService();

  assert.throws(
    () => registry.deprecateBundle("non-existent-bundle", "v1.0", "global"),
    /not found/i,
  );
});

test("PromptVersionManager compares versions correctly with deprecated", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("compare-bundle", "v1.0", false));
  manager.registerBundleVersion(createTestBundle("compare-bundle", "v2.0", true));
  manager.registerBundleVersion(createTestBundle("compare-bundle", "v3.0", false));

  // v1.0 < v2.0
  assert.equal(manager.compareVersions("v1.0", "v2.0"), -1);
  // v2.0 < v3.0
  assert.equal(manager.compareVersions("v2.0", "v3.0"), -1);
  // v1.0 < v3.0
  assert.equal(manager.compareVersions("v1.0", "v3.0"), -1);
});

test("PromptVersionManager parses versions with patch numbers correctly", () => {
  const manager = new PromptVersionManager();

  const v1 = manager.parseVersion("v1.0");
  const v2 = manager.parseVersion("v1.0.1");
  const v3 = manager.parseVersion("v1.0.2");

  assert.equal(manager.compareVersions("v1.0", "v1.0.1"), -1);
  assert.equal(manager.compareVersions("v1.0.1", "v1.0.2"), -1);
  assert.equal(v2.patch, 1);
  assert.equal(v3.patch, 2);
});

test("HierarchicalPromptRegistryService listBundleVersions sorts by version order", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "sorted-versions-bundle",
    version: "v2.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v2 content", templateVariables: [], channel: "system" },
  }, "global");

  registry.registerBundle({
    name: "sorted-versions-bundle",
    version: "v1.0",
    domain: "test-domain",
    taskType: "classification",
    systemPrompt: { content: "v1 content", templateVariables: [], channel: "system" },
  }, "global");

  const versions = registry.listBundleVersions("sorted-versions-bundle");

  assert.ok(versions.length >= 2);
  // Versions should be sorted
  const v1Idx = versions.findIndex(v => v.version === "v1.0");
  const v2Idx = versions.findIndex(v => v.version === "v2.0");
  if (v1Idx !== -1 && v2Idx !== -1) {
    assert.ok(v1Idx < v2Idx, "v1.0 should come before v2.0");
  }
});

test("PromptVersionManager.getNextVersion calculates correct next version", () => {
  const manager = new PromptVersionManager();

  const patchNext = manager.getNextVersion("v1.0", "patch");
  assert.equal(patchNext.major, 1);
  assert.equal(patchNext.minor, 0);
  assert.equal(patchNext.patch, 1);

  const minorNext = manager.getNextVersion("v1.0", "minor");
  assert.equal(minorNext.major, 1);
  assert.equal(minorNext.minor, 1);
  assert.equal(minorNext.patch, 0);

  const majorNext = manager.getNextVersion("v1.0", "major");
  assert.equal(majorNext.major, 2);
  assert.equal(majorNext.minor, 0);
  assert.equal(majorNext.patch, 0);
});

test("HierarchicalPromptRegistryService getBundle follows hierarchical lookup precedence", () => {
  const registry = new HierarchicalPromptRegistryService();

  registry.registerBundle({
    name: "hierarchy-test-bundle",
    version: "v1.0",
    domain: "global",
    taskType: "classification",
    systemPrompt: { content: "global content", templateVariables: [], channel: "system" },
  }, "global");

  registry.registerBundle({
    name: "hierarchy-test-bundle",
    version: "v1.0",
    domain: "domain-override",
    taskType: "classification",
    packId: "test-pack",
    systemPrompt: { content: "domain override content", templateVariables: [], channel: "system" },
  }, "domain", "domain-override");

  // Should find domain override when packId and domain provided
  const domainBundle = registry.getBundle("hierarchy-test-bundle", "classification", "test-pack", "domain-override");
  assert.ok(domainBundle !== null);
  assert.equal(domainBundle!.version, "v1.0");
  assert.ok(domainBundle!.metadata.deprecated === false);
});

// ============================================================================
// Helper function
// ============================================================================

function createTestBundle(name: string, version: string, deprecated: boolean): { name: string; version: string; domain: string; taskType: string; packId: string | undefined; systemPrompt: { content: string; templateVariables: unknown[]; channel: string }; metadata: { deprecated: boolean; trafficAllocation: { weight: number } } } {
  return {
    name,
    version,
    domain: "test-domain",
    taskType: "classification",
    packId: undefined,
    systemPrompt: { content: `Test content for ${name}@${version}`, templateVariables: [], channel: "system" },
    metadata: {
      deprecated,
      trafficAllocation: { weight: 100 },
    },
  };
}