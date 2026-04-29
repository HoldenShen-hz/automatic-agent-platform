import assert from "node:assert/strict";
import test from "node:test";

import { PromptVersionManager } from "../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// PromptVersionManager Tests
// =============================================================================

test("PromptVersionManager.parseVersion parses v1.0 format", () => {
  const manager = new PromptVersionManager();
  const version = manager.parseVersion("v1.0");

  assert.equal(version.major, 1);
  assert.equal(version.minor, 0);
  assert.equal(version.patch, undefined);
});

test("PromptVersionManager.parseVersion parses v1.0.0 format", () => {
  const manager = new PromptVersionManager();
  const version = manager.parseVersion("v1.0.0");

  assert.equal(version.major, 1);
  assert.equal(version.minor, 0);
  assert.equal(version.patch, 0);
});

test("PromptVersionManager.parseVersion parses 1.0 format without v prefix", () => {
  const manager = new PromptVersionManager();
  const version = manager.parseVersion("1.0");

  assert.equal(version.major, 1);
  assert.equal(version.minor, 0);
});

test("PromptVersionManager.parseVersion parses 1.0.0 format without v prefix", () => {
  const manager = new PromptVersionManager();
  const version = manager.parseVersion("1.0.0");

  assert.equal(version.major, 1);
  assert.equal(version.minor, 0);
  assert.equal(version.patch, 0);
});

test("PromptVersionManager.parseVersion throws on invalid format", () => {
  const manager = new PromptVersionManager();
  assert.throws(() => manager.parseVersion("invalid"), ValidationError);
});

test("PromptVersionManager.parseVersion throws on major.minor.patch.patch format", () => {
  const manager = new PromptVersionManager();
  assert.throws(() => manager.parseVersion("1.0.0.0"), ValidationError);
});

test("PromptVersionManager.parseVersion throws on empty string", () => {
  const manager = new PromptVersionManager();
  assert.throws(() => manager.parseVersion(""), ValidationError);
});

test("PromptVersionManager.formatVersion formats without patch", () => {
  const manager = new PromptVersionManager();
  const formatted = manager.formatVersion({ major: 1, minor: 2 });

  assert.equal(formatted, "v1.2");
});

test("PromptVersionManager.formatVersion formats with patch", () => {
  const manager = new PromptVersionManager();
  const formatted = manager.formatVersion({ major: 1, minor: 2, patch: 3 }, true);

  assert.equal(formatted, "v1.2.3");
});

test("PromptVersionManager.formatVersion omits patch when includePatch is false", () => {
  const manager = new PromptVersionManager();
  const formatted = manager.formatVersion({ major: 2, minor: 5, patch: 10 }, false);

  assert.equal(formatted, "v2.5");
});

test("PromptVersionManager.compareVersions returns -1 when v1 < v2", () => {
  const manager = new PromptVersionManager();
  const result = manager.compareVersions("v1.0", "v2.0");

  assert.equal(result, -1);
});

test("PromptVersionManager.compareVersions returns 1 when v1 > v2", () => {
  const manager = new PromptVersionManager();
  const result = manager.compareVersions("v2.0", "v1.0");

  assert.equal(result, 1);
});

test("PromptVersionManager.compareVersions returns 0 when v1 == v2", () => {
  const manager = new PromptVersionManager();
  const result = manager.compareVersions("v1.0", "v1.0");

  assert.equal(result, 0);
});

test("PromptVersionManager.compareVersions compares patch versions", () => {
  const manager = new PromptVersionManager();
  assert.equal(manager.compareVersions("v1.0.1", "v1.0.2"), -1);
  assert.equal(manager.compareVersions("v1.0.2", "v1.0.1"), 1);
});

test("PromptVersionManager.compareVersions treats version without patch as less than with patch", () => {
  const manager = new PromptVersionManager();
  assert.equal(manager.compareVersions("v1.0", "v1.0.1"), -1);
  assert.equal(manager.compareVersions("v1.0.1", "v1.0"), 1);
});

test("PromptVersionManager.compareVersions compares major versions", () => {
  const manager = new PromptVersionManager();
  assert.equal(manager.compareVersions("v1.0.0", "v2.0.0"), -1);
  assert.equal(manager.compareVersions("v2.0.0", "v1.0.0"), 1);
});

test("PromptVersionManager.compareVersions compares minor versions", () => {
  const manager = new PromptVersionManager();
  // v1.2.0 vs v1.5.0: minor 2 vs 5, so 2 - 5 = -3
  assert.equal(manager.compareVersions("v1.2.0", "v1.5.0"), -3);
  assert.equal(manager.compareVersions("v1.5.0", "v1.2.0"), 3);
});

test("PromptVersionManager.getNextVersion returns major bump", () => {
  const manager = new PromptVersionManager();
  const next = manager.getNextVersion("v1.2.3", "major");

  assert.equal(next.major, 2);
  assert.equal(next.minor, 0);
  assert.equal(next.patch, 0);
});

test("PromptVersionManager.getNextVersion returns minor bump", () => {
  const manager = new PromptVersionManager();
  const next = manager.getNextVersion("v1.2.3", "minor");

  assert.equal(next.major, 1);
  assert.equal(next.minor, 3);
  assert.equal(next.patch, 0);
});

test("PromptVersionManager.getNextVersion returns patch bump", () => {
  const manager = new PromptVersionManager();
  const next = manager.getNextVersion("v1.2.3", "patch");

  assert.equal(next.major, 1);
  assert.equal(next.minor, 2);
  assert.equal(next.patch, 4);
});

test("PromptVersionManager.getNextVersion handles missing patch", () => {
  const manager = new PromptVersionManager();
  const next = manager.getNextVersion("v1.2", "patch");

  assert.equal(next.major, 1);
  assert.equal(next.minor, 2);
  assert.equal(next.patch, 1);
});

test("PromptVersionManager.getNextVersion handles missing patch for minor bump", () => {
  const manager = new PromptVersionManager();
  const next = manager.getNextVersion("v2.5", "minor");

  assert.equal(next.major, 2);
  assert.equal(next.minor, 6);
  assert.equal(next.patch, 0);
});

test("PromptVersionManager.isValidVersionFormat returns true for valid versions", () => {
  const manager = new PromptVersionManager();
  assert.equal(manager.isValidVersionFormat("v1.0"), true);
  assert.equal(manager.isValidVersionFormat("1.0.0"), true);
  assert.equal(manager.isValidVersionFormat("v10.20.30"), true);
  assert.equal(manager.isValidVersionFormat("v0.0.1"), true);
});

test("PromptVersionManager.isValidVersionFormat returns false for invalid versions", () => {
  const manager = new PromptVersionManager();
  assert.equal(manager.isValidVersionFormat("invalid"), false);
  assert.equal(manager.isValidVersionFormat("1"), false);
  assert.equal(manager.isValidVersionFormat("1.0.0.0"), false);
  assert.equal(manager.isValidVersionFormat(""), false);
  assert.equal(manager.isValidVersionFormat("v1"), false);
});

test("PromptVersionManager.getVersionLineage returns correct lineage for middle version", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v2.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v3.0.0"));

  const lineage = manager.getVersionLineage("test-bundle", "v2.0.0");

  assert.equal(lineage.current, "v2.0.0");
  assert.equal(lineage.previous, "v1.0.0");
  assert.equal(lineage.next, "v3.0.0");
});

test("PromptVersionManager.getVersionLineage returns lineage without previous for oldest", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v2.0.0"));

  const lineage = manager.getVersionLineage("test-bundle", "v1.0.0");

  assert.equal(lineage.current, "v1.0.0");
  assert.equal(lineage.previous, undefined);
  assert.equal(lineage.next, "v2.0.0");
});

test("PromptVersionManager.getVersionLineage returns lineage without next for newest", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v2.0.0"));

  const lineage = manager.getVersionLineage("test-bundle", "v2.0.0");

  assert.equal(lineage.current, "v2.0.0");
  assert.equal(lineage.previous, "v1.0.0");
  assert.equal(lineage.next, undefined);
});

test("PromptVersionManager.registerBundleVersion stores bundle", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));

  const versions = manager.getSortedVersions("test-bundle");
  assert.equal(versions.length, 1);
  assert.equal(versions[0], "v1.0.0");
});

test("PromptVersionManager.registerBundleVersion stores multiple versions", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v2.0.0"));

  const versions = manager.getSortedVersions("test-bundle");
  assert.equal(versions.length, 2);
});

test("PromptVersionManager.getSortedVersions returns versions sorted", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v2.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.1"));

  const versions = manager.getSortedVersions("test-bundle");
  assert.equal(versions[0], "v1.0.0");
  assert.equal(versions[1], "v1.0.1");
  assert.equal(versions[2], "v2.0.0");
});

test("PromptVersionManager.listBundleVersions returns version info", () => {
  const manager = new PromptVersionManager();
  manager.registerBundleVersion(makeBundle("test-bundle", "v1.0.0"));

  const versions = manager.listBundleVersions("test-bundle");
  assert.equal(versions.length, 1);
  assert.equal(versions[0]!.version, "v1.0.0");
  assert.equal(versions[0]!.deprecated, false);
});

test("PromptVersionManager.listBundleVersions returns empty for unknown bundle", () => {
  const manager = new PromptVersionManager();
  const versions = manager.listBundleVersions("unknown-bundle");
  assert.equal(versions.length, 0);
});

test("PromptVersionManager.getSortedVersions returns empty for unknown bundle", () => {
  const manager = new PromptVersionManager();
  const versions = manager.getSortedVersions("unknown-bundle");
  assert.equal(versions.length, 0);
});

test("PromptVersionManager.constructor with custom config", () => {
  const manager = new PromptVersionManager({
    allowPrerelease: true,
    maxVersionsPerBundle: 10,
    autoDeprecateOldVersions: true,
    deprecationThresholdDays: 30,
  });

  assert.equal(manager.isValidVersionFormat("v1.0"), true);
});

function makeBundle(name: string, version: string) {
  return {
    name,
    version,
    domain: "test-domain",
    taskType: "test-task",
    packId: undefined,
    systemPrompt: { content: "You are helpful", templateVariables: [], channel: "system" as const },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: { maxTokens: 1000, temperature: 0.7, topP: undefined, stopSequences: undefined, responseFormat: undefined, customConstraints: {} },
    metadata: {
      owner: "test",
      deprecated: false,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    },
    bundleId: `${name}:${version}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
