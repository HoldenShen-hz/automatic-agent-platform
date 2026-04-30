/**
 * PromptVersionManager Unit Tests
 *
 * Tests for PromptVersionManager covering:
 * - Integer version management
 * - Version lineage
 * - Compatibility matrix validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PromptVersionManager } from "../../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import type { PromptBundle } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

function createTestBundle(name: string, version: number, displayVersion?: string): PromptBundle {
  return {
    bundleId: `bundle_${name}_${version}`,
    name,
    version,
    displayVersion: displayVersion ?? `v${version}.0`,
    domain: "test-domain",
    taskType: "classification",
    packId: undefined,
    systemPrompt: {
      content: `Test bundle ${name}`,
      templateVariables: [],
      channel: "system",
    },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: {
      maxTokens: 4096,
      temperature: 0.7,
      topP: undefined,
      stopSequences: undefined,
      responseFormat: undefined,
      customConstraints: {},
    },
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
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("PromptVersionManager.isValidVersion returns true for positive integers", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersion(1), true);
  assert.equal(manager.isValidVersion(10), true);
  assert.equal(manager.isValidVersion(100), true);
});

test("PromptVersionManager.isValidVersion returns false for non-positive integers", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersion(0), false);
  assert.equal(manager.isValidVersion(-1), false);
  assert.equal(manager.isValidVersion(-100), false);
});

test("PromptVersionManager.isValidVersion returns false for non-integers", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersion(1.5), false);
  assert.equal(manager.isValidVersion(0.1), false);
  assert.equal(manager.isValidVersion(NaN), false);
  assert.equal(manager.isValidVersion(Infinity), false);
});

test("PromptVersionManager.compareVersions returns -1 when v1 < v2", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions(1, 2), -1);
  assert.equal(manager.compareVersions(1, 10), -1);
});

test("PromptVersionManager.compareVersions returns 0 when v1 == v2", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions(1, 1), 0);
  assert.equal(manager.compareVersions(100, 100), 0);
});

test("PromptVersionManager.compareVersions returns 1 when v1 > v2", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions(2, 1), 1);
  assert.equal(manager.compareVersions(10, 1), 1);
});

test("PromptVersionManager.getNextVersion returns incremented version", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.getNextVersion(1), 2);
  assert.equal(manager.getNextVersion(10), 11);
});

test("PromptVersionManager.getVersionLineage returns correct lineage", () => {
  const manager = new PromptVersionManager();

  // Register multiple versions
  manager.registerBundleVersion(createTestBundle("lineage-test", 1));
  manager.registerBundleVersion(createTestBundle("lineage-test", 2));
  manager.registerBundleVersion(createTestBundle("lineage-test", 3));

  const lineage = manager.getVersionLineage("lineage-test", 2);

  assert.equal(lineage.current, 2);
  assert.equal(lineage.previous, 1);
  assert.equal(lineage.next, 3);
});

test("PromptVersionManager.getVersionLineage handles first version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("first-version", 1));
  manager.registerBundleVersion(createTestBundle("first-version", 2));

  const lineage = manager.getVersionLineage("first-version", 1);

  assert.equal(lineage.current, 1);
  assert.equal(lineage.previous, undefined, "First version has no previous");
  assert.equal(lineage.next, 2);
});

test("PromptVersionManager.getVersionLineage handles last version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("last-version", 1));
  manager.registerBundleVersion(createTestBundle("last-version", 2));

  const lineage = manager.getVersionLineage("last-version", 2);

  assert.equal(lineage.current, 2);
  assert.equal(lineage.previous, 1);
  assert.equal(lineage.next, undefined, "Last version has no next");
});

test("PromptVersionManager.isCurrentVersion returns true for latest", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("current-test", 1));
  manager.registerBundleVersion(createTestBundle("current-test", 2));

  assert.equal(manager.isCurrentVersion("current-test", 2), true);
  assert.equal(manager.isCurrentVersion("current-test", 1), false);
});

test("PromptVersionManager.isCurrentVersion returns true for single version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("single-version", 1));

  assert.equal(manager.isCurrentVersion("single-version", 1), true);
});

test("PromptVersionManager.isCurrentVersion returns true for empty bundle", () => {
  const manager = new PromptVersionManager();

  // Empty bundle - any version is considered current
  assert.equal(manager.isCurrentVersion("nonexistent", 1), true);
});

test("PromptVersionManager.getSortedVersions returns versions in order", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("sort-test", 3));
  manager.registerBundleVersion(createTestBundle("sort-test", 1));
  manager.registerBundleVersion(createTestBundle("sort-test", 2));

  const versions = manager.getSortedVersions("sort-test");

  assert.deepEqual(versions, [1, 2, 3]);
});

test("PromptVersionManager.getSortedVersions returns empty for nonexistent bundle", () => {
  const manager = new PromptVersionManager();

  const versions = manager.getSortedVersions("nonexistent");

  assert.deepEqual(versions, []);
});

test("PromptVersionManager.registerBundleVersion stores bundle", () => {
  const manager = new PromptVersionManager();
  const bundle = createTestBundle("register-test", 1);

  manager.registerBundleVersion(bundle);

  const versions = manager.getSortedVersions("register-test");
  assert.deepEqual(versions, [1]);
});

test("PromptVersionManager.registerBundleVersion enforces max versions limit", () => {
  const manager = new PromptVersionManager({ maxVersionsPerBundle: 3 });

  for (let i = 1; i <= 5; i++) {
    manager.registerBundleVersion(createTestBundle("limit-test", i));
  }

  const versions = manager.getSortedVersions("limit-test");
  assert.deepEqual(versions, [3, 4, 5], "Should keep only latest 3 versions");
});

test("PromptVersionManager.listBundleVersions returns version metadata", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("metadata-test", 1));
  manager.registerBundleVersion(createTestBundle("metadata-test", 2, "v2.0"));

  const versions = manager.listBundleVersions("metadata-test");

  assert.equal(versions.length, 2);
  assert.ok(versions.some(v => v.version === 1 && v.displayVersion === "v1.0"));
  assert.ok(versions.some(v => v.version === 2 && v.displayVersion === "v2.0"));
});

test("PromptVersionManager.listBundleVersions identifies current version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("current-marker", 1));
  manager.registerBundleVersion(createTestBundle("current-marker", 2));

  const versions = manager.listBundleVersions("current-marker");
  const latest = versions.find(v => v.isCurrent);

  assert.ok(latest !== undefined);
  assert.equal(latest!.version, 2);
});

test("PromptVersionManager.listBundleVersions returns empty for nonexistent", () => {
  const manager = new PromptVersionManager();

  const versions = manager.listBundleVersions("nonexistent");

  assert.deepEqual(versions, []);
});

test("PromptVersionManager.validateCompatibilityMatrix passes valid matrix", () => {
  const manager = new PromptVersionManager();
  const bundle = createTestBundle("valid-matrix", 1);

  // Bundle already has compatibility matrix set up in createTestBundle
  const result = manager.validateCompatibilityMatrix(bundle);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("PromptVersionManager.validateCompatibilityMatrix fails missing toolSchemaVersions", () => {
  const manager = new PromptVersionManager();
  const bundle: PromptBundle = {
    ...createTestBundle("invalid-matrix", 1),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  };

  const result = manager.validateCompatibilityMatrix(bundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("toolSchemaVersions")));
});

test("PromptVersionManager.validateCompatibilityMatrix fails missing evaluatorSchemaVersions", () => {
  const manager = new PromptVersionManager();
  const bundle: PromptBundle = {
    ...createTestBundle("invalid-matrix", 1),
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  };

  const result = manager.validateCompatibilityMatrix(bundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("evaluatorSchemaVersions")));
});

test("PromptVersionManager.validateCompatibilityMatrix fails missing domainDescriptorVersions", () => {
  const manager = new PromptVersionManager();
  const bundle: PromptBundle = {
    ...createTestBundle("invalid-matrix", 1),
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  };

  const result = manager.validateCompatibilityMatrix(bundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("domainDescriptorVersions")));
});

test("PromptVersionManager.validateCompatibilityMatrix fails missing modelRoutingProfiles", () => {
  const manager = new PromptVersionManager();
  const bundle: PromptBundle = {
    ...createTestBundle("invalid-matrix", 1),
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [],
    },
  };

  const result = manager.validateCompatibilityMatrix(bundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("modelRoutingProfiles")));
});

test("PromptVersionManager multiple bundles tracked independently", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createTestBundle("bundle-a", 1));
  manager.registerBundleVersion(createTestBundle("bundle-b", 1));
  manager.registerBundleVersion(createTestBundle("bundle-b", 2));

  const versionsA = manager.listBundleVersions("bundle-a");
  const versionsB = manager.listBundleVersions("bundle-b");

  assert.equal(versionsA.length, 1);
  assert.equal(versionsB.length, 2);
});

test("PromptVersionManager default config values", () => {
  const manager = new PromptVersionManager();

  // Should use default config
  manager.registerBundleVersion(createTestBundle("default-config", 1));

  const versions = manager.getSortedVersions("default-config");
  assert.deepEqual(versions, [1]);
});

test("PromptVersionManager custom config maxVersionsPerBundle", () => {
  const manager = new PromptVersionManager({ maxVersionsPerBundle: 5 });

  for (let i = 1; i <= 10; i++) {
    manager.registerBundleVersion(createTestBundle("custom-limit", i));
  }

  const versions = manager.getSortedVersions("custom-limit");
  assert.equal(versions.length, 5);
});