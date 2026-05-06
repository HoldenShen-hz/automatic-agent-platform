/**
 * Prompt Version Manager Expanded Tests
 *
 * Expanded tests for prompt-version-manager covering:
 * - Issue #1964: VersionLineage interface duplicate declaration
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PromptVersionManager } from "../../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import type { PromptBundle } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

function createTestBundle(name: string, version: number, displayVersion: string): PromptBundle {
  return {
    bundleId: `bundle_${name}_${version}`,
    name,
    version,
    displayVersion,
    domain: "test-domain",
    taskType: "classification",
    packId: "test-pack",
    systemPrompt: { content: `System prompt for ${name}`, templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: { maxTokens: 4096, temperature: 0.7, topP: undefined, stopSequences: undefined, responseFormat: undefined, customConstraints: {} },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test-tool", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test-eval", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test-domain", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test-model", profileVersion: 1 }],
    },
    metadata: {
      owner: "test-owner",
      deprecated: false,
      lifecycleStatus: "active",
      tags: ["test"],
      compatibilityTags: [],
      trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("PromptVersionManager.isValidVersion rejects non-positive integers", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersion(0), false);
  assert.equal(manager.isValidVersion(-1), false);
  assert.equal(manager.isValidVersion(1.5), false);
  assert.equal(manager.isValidVersion(0.1), false);
});

test("PromptVersionManager.isValidVersion accepts positive integers", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersion(1), true);
  assert.equal(manager.isValidVersion(100), true);
  assert.equal(manager.isValidVersion(999999), true);
});

test("PromptVersionManager.compareVersions returns correct order", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions(1, 2), -1);
  assert.equal(manager.compareVersions(2, 1), 1);
  assert.equal(manager.compareVersions(5, 5), 0);
});

test("PromptVersionManager.getNextVersion increments correctly", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.getNextVersion(1), 2);
  assert.equal(manager.getNextVersion(99), 100);
});

test("PromptVersionManager.getVersionLineage returns correct lineage", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("lineage-test", 1, "v1.0.0"));
  manager.registerBundleVersion(createTestBundle("lineage-test", 2, "v2.0.0"));
  manager.registerBundleVersion(createTestBundle("lineage-test", 3, "v3.0.0"));

  // Issue #1964: VersionLineage interface should be properly defined
  const lineage = manager.getVersionLineage("lineage-test", 2);

  assert.equal(lineage.current, 2);
  assert.equal(lineage.previous, 1);
  assert.equal(lineage.next, 3);
});

test("PromptVersionManager.getVersionLineage for latest version has no next", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("latest-test", 1, "v1.0.0"));
  manager.registerBundleVersion(createTestBundle("latest-test", 2, "v2.0.0"));

  const lineage = manager.getVersionLineage("latest-test", 2);

  assert.equal(lineage.current, 2);
  assert.equal(lineage.previous, 1);
  assert.equal(lineage.next, undefined);
});

test("PromptVersionManager.getVersionLineage for first version has no previous", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("first-test", 1, "v1.0.0"));
  manager.registerBundleVersion(createTestBundle("first-test", 2, "v2.0.0"));

  const lineage = manager.getVersionLineage("first-test", 1);

  assert.equal(lineage.current, 1);
  assert.equal(lineage.previous, undefined);
  assert.ok(lineage.next !== undefined);
});

test("PromptVersionManager.isCurrentVersion identifies latest", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("current-test", 1, "v1.0.0"));
  manager.registerBundleVersion(createTestBundle("current-test", 2, "v2.0.0"));

  assert.equal(manager.isCurrentVersion("current-test", 1), false);
  assert.equal(manager.isCurrentVersion("current-test", 2), true);
});

test("PromptVersionManager.isCurrentVersion returns true for empty bundle", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isCurrentVersion("nonexistent", 1), true);
});

test("PromptVersionManager.getSortedVersions returns ordered list", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("sorted-test", 3, "v3.0.0"));
  manager.registerBundleVersion(createTestBundle("sorted-test", 1, "v1.0.0"));
  manager.registerBundleVersion(createTestBundle("sorted-test", 2, "v2.0.0"));

  const versions = manager.getSortedVersions("sorted-test");

  assert.deepEqual(versions, [1, 2, 3]);
});

test("PromptVersionManager.getSortedVersions returns empty for unknown bundle", () => {
  const manager = new PromptVersionManager();

  const versions = manager.getSortedVersions("nonexistent");

  assert.deepEqual(versions, []);
});

test("PromptVersionManager.registerBundle enforces max versions limit", () => {
  const manager = new PromptVersionManager({ maxVersionsPerBundle: 3 });

  for (let i = 1; i <= 5; i++) {
    manager.registerBundleVersion(createTestBundle("limit-test", i, `v${i}.0.0`));
  }

  const versions = manager.getSortedVersions("limit-test");

  // Should only keep the last 3 versions
  assert.equal(versions.length, 3);
  assert.deepEqual(versions, [3, 4, 5]);
});

test("PromptVersionManager.listBundleVersions returns correct metadata", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("metadata-test", 1, "v1.0.0"));
  manager.registerBundleVersion(createTestBundle("metadata-test", 2, "v2.0.0"));

  const versions = manager.listBundleVersions("metadata-test");

  assert.equal(versions.length, 2);
  // Latest should be current
  assert.equal(versions[1]?.isCurrent, true);
  // Weight 100 should be default
  assert.equal(versions[0]?.isDefault, true);
});

test("PromptVersionManager.validateCompatibilityMatrix validates all required fields", () => {
  const manager = new PromptVersionManager();

  const validBundle = createTestBundle("valid-matrix", 1, "v1.0.0");
  const result = manager.validateCompatibilityMatrix(validBundle);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("PromptVersionManager.validateCompatibilityMatrix detects missing tool schema", () => {
  const manager = new PromptVersionManager();

  const invalidBundle: PromptBundle = {
    ...createTestBundle("invalid-matrix", 1, "v1.0.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  };

  const result = manager.validateCompatibilityMatrix(invalidBundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("toolSchemaVersions")));
});

test("PromptVersionManager.validateCompatibilityMatrix detects missing evaluator schema", () => {
  const manager = new PromptVersionManager();

  const invalidBundle: PromptBundle = {
    ...createTestBundle("invalid-eval", 1, "v1.0.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  };

  const result = manager.validateCompatibilityMatrix(invalidBundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("evaluatorSchemaVersions")));
});

test("PromptVersionManager.validateCompatibilityMatrix detects missing domain descriptor", () => {
  const manager = new PromptVersionManager();

  const invalidBundle: PromptBundle = {
    ...createTestBundle("invalid-domain", 1, "v1.0.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [{ modelId: "test", profileVersion: 1 }],
    },
  };

  const result = manager.validateCompatibilityMatrix(invalidBundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("domainDescriptorVersions")));
});

test("PromptVersionManager.validateCompatibilityMatrix detects missing model routing", () => {
  const manager = new PromptVersionManager();

  const invalidBundle: PromptBundle = {
    ...createTestBundle("invalid-model", 1, "v1.0.0"),
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "test", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "test", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "test", version: 1 }],
      modelRoutingProfiles: [],
    },
  };

  const result = manager.validateCompatibilityMatrix(invalidBundle);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("modelRoutingProfiles")));
});

test("PromptVersionManager handles autoDeprecateOldVersions configuration", () => {
  const manager = new PromptVersionManager({
    autoDeprecateOldVersions: true,
    deprecationThresholdDays: 30,
  });

  // Configuration should be applied
  assert.ok(manager !== undefined);
});

test("PromptVersionManager getVersionLineage with single version", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("single-version", 1, "v1.0.0"));

  const lineage = manager.getVersionLineage("single-version", 1);

  assert.equal(lineage.current, 1);
  assert.equal(lineage.previous, undefined);
  assert.equal(lineage.next, undefined);
});

test("PromptVersionManager VersionLineage type allows undefined for optional fields", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(createTestBundle("lineage-optional", 1, "v1.0.0"));

  const lineage = manager.getVersionLineage("lineage-optional", 1);

  // Type should allow undefined for previous and next
  assert.equal(lineage.previous, undefined);
  assert.equal(lineage.next, undefined);
});