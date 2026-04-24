import assert from "node:assert/strict";
import test from "node:test";

import { PromptVersionManager } from "../../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import type { PromptBundle } from "../../../../../src/platform/contracts/prompt-bundle/index.js";

// =============================================================================
// PromptVersionManager Parsing Tests
// =============================================================================

test("PromptVersionManager.parseVersion accepts v1.0 format", () => {
  const manager = new PromptVersionManager();
  const result = manager.parseVersion("v1.0");

  assert.equal(result.major, 1);
  assert.equal(result.minor, 0);
  assert.equal(result.patch, undefined);
});

test("PromptVersionManager.parseVersion accepts 1.0 format without v prefix", () => {
  const manager = new PromptVersionManager();
  const result = manager.parseVersion("1.0");

  assert.equal(result.major, 1);
  assert.equal(result.minor, 0);
});

test("PromptVersionManager.parseVersion accepts v1.0.0 format with patch", () => {
  const manager = new PromptVersionManager();
  const result = manager.parseVersion("v1.0.0");

  assert.equal(result.major, 1);
  assert.equal(result.minor, 0);
  assert.equal(result.patch, 0);
});

test("PromptVersionManager.parseVersion accepts 1.0.5 format", () => {
  const manager = new PromptVersionManager();
  const result = manager.parseVersion("1.0.5");

  assert.equal(result.major, 1);
  assert.equal(result.minor, 0);
  assert.equal(result.patch, 5);
});

test("PromptVersionManager.parseVersion accepts version with whitespace", () => {
  const manager = new PromptVersionManager();
  const result = manager.parseVersion("  v2.5  ");

  assert.equal(result.major, 2);
  assert.equal(result.minor, 5);
});

test("PromptVersionManager.parseVersion throws on invalid format", () => {
  const manager = new PromptVersionManager();

  assert.throws(
    () => manager.parseVersion("invalid"),
    (err: unknown) => {
      return err instanceof Error && err.message.includes("does not match semantic version format");
    },
  );
});

test("PromptVersionManager.parseVersion throws on non-numeric version", () => {
  const manager = new PromptVersionManager();

  assert.throws(
    () => manager.parseVersion("v1.a"),
    (err: unknown) => {
      return err instanceof Error && err.message.includes("does not match semantic version format");
    },
  );
});

test("PromptVersionManager.parseVersion throws on missing minor version", () => {
  const manager = new PromptVersionManager();

  assert.throws(
    () => manager.parseVersion("v1"),
    (err: unknown) => {
      return err instanceof Error && err.message.includes("does not match semantic version format");
    },
  );
});

// =============================================================================
// PromptVersionManager Formatting Tests
// =============================================================================

test("PromptVersionManager.formatVersion formats without patch by default", () => {
  const manager = new PromptVersionManager();
  const version = { major: 1, minor: 5 };

  const result = manager.formatVersion(version);

  assert.equal(result, "v1.5");
});

test("PromptVersionManager.formatVersion includes patch when requested", () => {
  const manager = new PromptVersionManager();
  const version = { major: 1, minor: 5, patch: 2 };

  const result = manager.formatVersion(version, true);

  assert.equal(result, "v1.5.2");
});

test("PromptVersionManager.formatVersion omits patch when undefined and includePatch is true", () => {
  const manager = new PromptVersionManager();
  const version = { major: 1, minor: 5 };

  const result = manager.formatVersion(version, true);

  assert.equal(result, "v1.5");
});

// =============================================================================
// PromptVersionManager Comparison Tests
// =============================================================================

test("PromptVersionManager.compareVersions returns -1 when v1 < v2", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v1.0", "v2.0"), -1);
  assert.equal(manager.compareVersions("v1.5", "v2.0"), -1);
  assert.equal(manager.compareVersions("v1.0", "v1.5"), -1);
});

test("PromptVersionManager.compareVersions returns 0 when v1 == v2", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v1.0", "v1.0"), 0);
  assert.equal(manager.compareVersions("v1.0.0", "v1.0.0"), 0);
  assert.equal(manager.compareVersions("2.0", "v2.0"), 0);
});

test("PromptVersionManager.compareVersions returns 1 when v1 > v2", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v2.0", "v1.0"), 1);
  assert.equal(manager.compareVersions("v1.5", "v1.0"), 1);
  assert.equal(manager.compareVersions("v1.0.2", "v1.0.1"), 1);
});

test("PromptVersionManager.compareVersions handles patch versions", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v1.0.1", "v1.0.2"), -1);
  assert.equal(manager.compareVersions("v2.0.0", "v2.0.1"), -1);
  assert.equal(manager.compareVersions("v1.0.10", "v1.0.9"), 1);
});

test("PromptVersionManager.compareVersions treats version without patch as less than with patch", () => {
  const manager = new PromptVersionManager();

  // v1.0 is treated as v1.0.0 for comparison purposes
  assert.equal(manager.compareVersions("v1.0", "v1.0.1"), -1);
  assert.equal(manager.compareVersions("v1.0.0", "v1.0"), 0);
});

// =============================================================================
// PromptVersionManager Next Version Tests
// =============================================================================

test("PromptVersionManager.getNextVersion for major increment", () => {
  const manager = new PromptVersionManager();

  const next = manager.getNextVersion("v1.5", "major");

  assert.equal(next.major, 2);
  assert.equal(next.minor, 0);
  assert.equal(next.patch, 0);
});

test("PromptVersionManager.getNextVersion for minor increment", () => {
  const manager = new PromptVersionManager();

  const next = manager.getNextVersion("v1.5", "minor");

  assert.equal(next.major, 1);
  assert.equal(next.minor, 6);
  assert.equal(next.patch, 0);
});

test("PromptVersionManager.getNextVersion for patch increment", () => {
  const manager = new PromptVersionManager();

  const next = manager.getNextVersion("v1.5.3", "patch");

  assert.equal(next.major, 1);
  assert.equal(next.minor, 5);
  assert.equal(next.patch, 4);
});

test("PromptVersionManager.getNextVersion handles patch-less version", () => {
  const manager = new PromptVersionManager();

  const next = manager.getNextVersion("v2.3", "patch");

  assert.equal(next.major, 2);
  assert.equal(next.minor, 3);
  assert.equal(next.patch, 1);
});

// =============================================================================
// PromptVersionManager Validation Tests
// =============================================================================

test("PromptVersionManager.isValidVersionFormat returns true for valid formats", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersionFormat("v1.0"), true);
  assert.equal(manager.isValidVersionFormat("1.0"), true);
  assert.equal(manager.isValidVersionFormat("v2.10.5"), true);
  assert.equal(manager.isValidVersionFormat("10.0"), true);
});

test("PromptVersionManager.isValidVersionFormat returns false for invalid formats", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isValidVersionFormat("invalid"), false);
  assert.equal(manager.isValidVersionFormat("v1"), false);
  assert.equal(manager.isValidVersionFormat("1.2.3.4"), false);
  assert.equal(manager.isValidVersionFormat(""), false);
});

// =============================================================================
// PromptVersionManager Version Lineage Tests
// =============================================================================

test("PromptVersionManager.getVersionLineage returns only current when no siblings", () => {
  const manager = new PromptVersionManager();

  const bundle = createMockBundle("TestBundle", "v1.0");
  manager.registerBundleVersion(bundle);

  const lineage = manager.getVersionLineage("TestBundle", "v1.0");

  assert.equal(lineage.current, "v1.0");
  assert.equal(lineage.previous, undefined);
  assert.equal(lineage.next, undefined);
});

test("PromptVersionManager.getVersionLineage returns previous and next when available", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v3.0"));

  const lineage = manager.getVersionLineage("TestBundle", "v2.0");

  assert.equal(lineage.current, "v2.0");
  assert.equal(lineage.previous, "v1.0");
  assert.equal(lineage.next, "v3.0");
});

test("PromptVersionManager.getVersionLineage returns previous only at latest version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0"));

  const lineage = manager.getVersionLineage("TestBundle", "v2.0");

  assert.equal(lineage.current, "v2.0");
  assert.equal(lineage.previous, "v1.0");
  assert.equal(lineage.next, undefined);
});

test("PromptVersionManager.getVersionLineage returns next only at oldest version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0"));

  const lineage = manager.getVersionLineage("TestBundle", "v1.0");

  assert.equal(lineage.current, "v1.0");
  assert.equal(lineage.previous, undefined);
  assert.equal(lineage.next, "v2.0");
});

// =============================================================================
// PromptVersionManager isCurrentVersion Tests
// =============================================================================

test("PromptVersionManager.isCurrentVersion returns true for latest version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0"));

  assert.equal(manager.isCurrentVersion("TestBundle", "v2.0"), true);
});

test("PromptVersionManager.isCurrentVersion returns false for older version", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0"));

  assert.equal(manager.isCurrentVersion("TestBundle", "v1.0"), false);
});

test("PromptVersionManager.isCurrentVersion returns true when only one version exists", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));

  assert.equal(manager.isCurrentVersion("TestBundle", "v1.0"), true);
});

test("PromptVersionManager.isCurrentVersion returns true for empty bundle", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.isCurrentVersion("NonExistent", "v1.0"), true);
});

// =============================================================================
// PromptVersionManager getSortedVersions Tests
// =============================================================================

test("PromptVersionManager.getSortedVersions returns empty for unregistered bundle", () => {
  const manager = new PromptVersionManager();

  const versions = manager.getSortedVersions("NonExistent");
  assert.deepEqual(versions, []);
});

test("PromptVersionManager.getSortedVersions returns versions in sorted order", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v3.0"));

  const versions = manager.getSortedVersions("TestBundle");

  assert.deepEqual(versions, ["v1.0", "v2.0", "v3.0"]);
});

test("PromptVersionManager.getSortedVersions handles patch versions", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0.2"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0.10"));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0.1"));

  const versions = manager.getSortedVersions("TestBundle");

  assert.deepEqual(versions, ["v1.0.1", "v1.0.2", "v1.0.10"]);
});

// =============================================================================
// PromptVersionManager registerBundleVersion Tests
// =============================================================================

test("PromptVersionManager.registerBundleVersion stores bundle", () => {
  const manager = new PromptVersionManager();

  const bundle = createMockBundle("TestBundle", "v1.0");
  manager.registerBundleVersion(bundle);

  const versions = manager.getSortedVersions("TestBundle");
  assert.deepEqual(versions, ["v1.0"]);
});

test("PromptVersionManager.registerBundleVersion enforces max versions limit", () => {
  const manager = new PromptVersionManager({ maxVersionsPerBundle: 3 });

  for (let i = 1; i <= 5; i++) {
    manager.registerBundleVersion(createMockBundle("TestBundle", `v${i}.0`));
  }

  const versions = manager.getSortedVersions("TestBundle");
  assert.equal(versions.length, 3);
  assert.deepEqual(versions, ["v3.0", "v4.0", "v5.0"]);
});

// =============================================================================
// PromptVersionManager listBundleVersions Tests
// =============================================================================

test("PromptVersionManager.listBundleVersions returns empty for unregistered bundle", () => {
  const manager = new PromptVersionManager();

  const versions = manager.listBundleVersions("NonExistent");
  assert.deepEqual(versions, []);
});

test("PromptVersionManager.listBundleVersions returns version metadata", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0", 100, false));
  manager.registerBundleVersion(createMockBundle("TestBundle", "v2.0", 75, true));

  const versions = manager.listBundleVersions("TestBundle");

  assert.equal(versions.length, 2);

  const v1 = versions.find((v) => v.version === "v1.0");
  const v2 = versions.find((v) => v.version === "v2.0");

  assert.ok(v1 !== undefined);
  assert.ok(v2 !== undefined);
  assert.equal(v1!.isCurrent, true);
  assert.equal(v1!.trafficWeight, 100);
  assert.equal(v2!.isCurrent, false);
  assert.equal(v2!.trafficWeight, 75);
});

test("PromptVersionManager.listBundleVersions marks deprecated bundles", () => {
  const manager = new PromptVersionManager();

  manager.registerBundleVersion(createMockBundle("TestBundle", "v1.0", 100, true));

  const versions = manager.listBundleVersions("TestBundle");

  assert.equal(versions[0]!.deprecated, true);
});

// =============================================================================
// PromptVersionManager Configuration Tests
// =============================================================================

test("PromptVersionManager uses default configuration when none provided", () => {
  const manager = new PromptVersionManager();

  // Default config: allowPrerelease=false, maxVersionsPerBundle=50
  assert.equal(manager.isValidVersionFormat("v1.0-beta"), false); // Should throw if not allowPrerelease
});

test("PromptVersionManager custom configuration overrides defaults", () => {
  const manager = new PromptVersionManager({
    allowPrerelease: true,
    maxVersionsPerBundle: 10,
    autoDeprecateOldVersions: true,
    deprecationThresholdDays: 30,
  });

  // Verify configuration is applied by registering many versions
  for (let i = 1; i <= 15; i++) {
    manager.registerBundleVersion(createMockBundle("TestBundle", `v${i}.0`));
  }

  const versions = manager.getSortedVersions("TestBundle");
  assert.equal(versions.length, 10);
});

// =============================================================================
// Edge Cases
// =============================================================================

test("PromptVersionManager handles large version numbers", () => {
  const manager = new PromptVersionManager();

  const result = manager.parseVersion("v100.500");
  assert.equal(result.major, 100);
  assert.equal(result.minor, 500);
});

test("PromptVersionManager.compareVersions handles large version differences", () => {
  const manager = new PromptVersionManager();

  assert.equal(manager.compareVersions("v1.0", "v100.0"), -1);
  assert.equal(manager.compareVersions("v100.0.0", "v1.0.0"), 1);
});

test("PromptVersionManager handles version strings with mixed case", () => {
  const manager = new PromptVersionManager();

  const result = manager.parseVersion("V2.5");
  assert.equal(result.major, 2);
  assert.equal(result.minor, 5);
});

// =============================================================================
// Helper Functions
// =============================================================================

function createMockBundle(
  name: string,
  version: string,
  weight = 100,
  deprecated = false,
): PromptBundle {
  return {
    bundleId: `bundle-${name}-${version}`,
    name,
    version,
    domain: "test",
    taskType: "simple",
    packId: undefined,
    systemPrompt: { content: "Test", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: {
      maxTokens: undefined,
      temperature: undefined,
      topP: undefined,
      stopSequences: undefined,
      responseFormat: undefined,
      customConstraints: {},
    },
    metadata: {
      owner: "test",
      deprecated,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}