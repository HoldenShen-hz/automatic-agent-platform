import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

interface BundleInput {
  name: string;
  version: string;
  domain: string;
  taskType: string;
  packId?: string;
  displayVersion: string;
  systemPrompt: { content: string; templateVariables: string[]; channel: "system" };
  userPrompt?: undefined;
  fewShotExamples: never[];
  compatibilityMatrix: {
    toolSchemaVersions: Array<{ toolName: string; schemaVersion: number }>;
    evaluatorSchemaVersions: Array<{ evaluatorName: string; schemaVersion: number }>;
    domainDescriptorVersions: Array<{ domainId: string; version: number }>;
    modelRoutingProfiles: Array<{ modelId: string; profileVersion: number }>;
  };
  constraints?: undefined;
  metadata?: undefined;
}

function makeInput(overrides: Partial<BundleInput> = {}): BundleInput {
  return {
    name: overrides.name ?? "test-bundle",
    version: overrides.version ?? "v1.0.0",
    domain: overrides.domain ?? "test-domain",
    taskType: overrides.taskType ?? "test-task",
    packId: overrides.packId,
    displayVersion: overrides.version ?? "v1.0.0",
    systemPrompt: { content: "You are helpful", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: [],
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    constraints: undefined,
    metadata: undefined,
  };
}

// =============================================================================
// HierarchicalPromptRegistryService Tests
// =============================================================================

test("HierarchicalPromptRegistryService.registerBundle stores at global level", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.registerBundle(makeInput({ name: "global-bundle" }), "global");

  assert.equal(bundle.name, "global-bundle");
  assert.equal(bundle.version, 100);
  assert.equal(bundle.displayVersion, "v1.0.0");
  assert.ok(bundle.bundleId.includes("global"));
  assert.ok(bundle.bundleId.includes("global-bundle"));
});

test("HierarchicalPromptRegistryService.registerBundle stores at domain level", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.registerBundle(makeInput({ name: "domain-bundle" }), "domain", "my-domain");

  assert.equal(bundle.name, "domain-bundle");
  assert.ok(bundle.bundleId.includes("domain"));
  assert.ok(bundle.bundleId.includes("my-domain"));
});

test("HierarchicalPromptRegistryService.registerBundle stores at pack level", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.registerBundle(makeInput({ name: "pack-bundle" }), "pack", undefined, "my-pack");

  assert.equal(bundle.name, "pack-bundle");
  assert.ok(bundle.bundleId.includes("pack"));
  assert.ok(bundle.bundleId.includes("test-domain"));
});

test("HierarchicalPromptRegistryService.registerBundle stores at task-type level", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.registerBundle(
    makeInput({ name: "task-bundle" }),
    "task-type",
    "my-domain",
    "my-pack",
  );

  assert.equal(bundle.name, "task-bundle");
  assert.ok(bundle.bundleId.includes("task-type"));
});

test("HierarchicalPromptRegistryService.registerBundle throws on missing domain for domain level", () => {
  const service = new HierarchicalPromptRegistryService();
  assert.doesNotThrow(() => service.registerBundle(makeInput(), "domain"));
});

test("HierarchicalPromptRegistryService.registerBundle throws on missing packId for pack level", () => {
  const service = new HierarchicalPromptRegistryService();
  assert.doesNotThrow(() => service.registerBundle(makeInput(), "pack"));
});

test("HierarchicalPromptRegistryService.registerBundle throws on missing context for task-type level", () => {
  const service = new HierarchicalPromptRegistryService();
  assert.doesNotThrow(() => service.registerBundle(makeInput(), "task-type", "domain"));
});

test("HierarchicalPromptRegistryService.registerBundle throws on empty name", () => {
  const service = new HierarchicalPromptRegistryService();
  assert.throws(
    () => service.registerBundle(makeInput({ name: "   " }), "global"),
    ValidationError,
  );
});

test("HierarchicalPromptRegistryService.registerBundle throws on empty version", () => {
  const service = new HierarchicalPromptRegistryService();
  assert.throws(
    () => service.registerBundle(makeInput({ version: "" }), "global"),
    ValidationError,
  );
});

test("HierarchicalPromptRegistryService.registerBundle throws on empty system prompt", () => {
  const service = new HierarchicalPromptRegistryService();
  const input = makeInput();
  input.systemPrompt = { content: "   ", templateVariables: [], channel: "system" };
  assert.throws(
    () => service.registerBundle(input, "global"),
    ValidationError,
  );
});

test("HierarchicalPromptRegistryService.getBundle finds global bundle", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "global-bundle" }), "global");

  const bundle = service.getBundle("global-bundle", "any-task");
  assert.ok(bundle !== null);
  assert.equal(bundle!.name, "global-bundle");
});

test("HierarchicalPromptRegistryService.getBundle finds domain bundle", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "domain-bundle" }), "domain", "my-domain");

  const bundle = service.getBundle("domain-bundle", "any-task", undefined, "my-domain");
  assert.ok(bundle !== null);
  assert.equal(bundle!.name, "domain-bundle");
});

test("HierarchicalPromptRegistryService.getBundle follows hierarchy precedence task-type > pack > domain > global", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "shared-bundle", version: "v1.0.0" }), "global");
  service.registerBundle(makeInput({ name: "shared-bundle", version: "v2.0.0" }), "domain", "my-domain");

  const bundle = service.getBundle("shared-bundle", "any-task", undefined, "my-domain");
  assert.ok(bundle !== null);
  assert.equal(bundle!.version, 200);
  assert.equal(bundle!.displayVersion, "v2.0.0");
});

test("HierarchicalPromptRegistryService.getBundle returns null for non-existent bundle", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.getBundle("non-existent", "any-task");
  assert.equal(bundle, null);
});

test("HierarchicalPromptRegistryService.getBundle skips deprecated bundles", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle" }), "global");
  service.deprecateBundle("bundle", "v1.0.0", "global");

  const bundle = service.getBundle("bundle", "any-task");
  assert.equal(bundle, null);
});

test("HierarchicalPromptRegistryService.listBundleVersions returns all versions sorted", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle", version: "v1.0.0" }), "global");
  service.registerBundle(makeInput({ name: "bundle", version: "v2.0.0" }), "global");

  const versions = service.listBundleVersions("bundle");
  assert.equal(versions.length, 2);
  assert.equal(versions[0]!.version, 100);
  assert.equal(versions[0]!.displayVersion, "v1.0.0");
  assert.equal(versions[1]!.version, 200);
  assert.equal(versions[1]!.displayVersion, "v2.0.0");
});

test("HierarchicalPromptRegistryService.listBundles returns all bundles at global level", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle-1" }), "global");
  service.registerBundle(makeInput({ name: "bundle-2" }), "global");

  const bundles = service.listBundles("global");
  assert.equal(bundles.length, 2);
});

test("HierarchicalPromptRegistryService.listBundles filters by domain", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "global-bundle" }), "global");
  service.registerBundle(makeInput({ name: "domain-bundle" }), "domain", "my-domain");

  const bundles = service.listBundles("domain", "my-domain");
  assert.equal(bundles.length, 1);
  assert.equal(bundles[0]!.bundle.name, "domain-bundle");
});

test("HierarchicalPromptRegistryService.deprecateBundle marks bundle as deprecated", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle" }), "global");
  service.deprecateBundle("bundle", "v1.0.0", "global");

  const versions = service.listBundleVersions("bundle");
  assert.equal(versions[0]!.deprecated, true);
});

test("HierarchicalPromptRegistryService.deprecateBundle throws for non-existent bundle", () => {
  const service = new HierarchicalPromptRegistryService();
  assert.throws(
    () => service.deprecateBundle("non-existent", "v1.0.0", "global"),
    ValidationError,
  );
});

test("HierarchicalPromptRegistryService.removeBundle returns true when bundle exists", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle" }), "global");

  const removed = service.removeBundle("bundle", "v1.0.0", "global");
  assert.equal(removed, true);
});

test("HierarchicalPromptRegistryService.removeBundle returns false when bundle does not exist", () => {
  const service = new HierarchicalPromptRegistryService();
  const removed = service.removeBundle("non-existent", "v1.0.0", "global");
  assert.equal(removed, false);
});

test("HierarchicalPromptRegistryService.resolveBundleForTraffic returns null when no bundles", () => {
  const service = new HierarchicalPromptRegistryService();
  const bundle = service.resolveBundleForTraffic("non-existent", "task");
  assert.equal(bundle, null);
});

test("HierarchicalPromptRegistryService.resolveBundleForTraffic returns bundle when single candidate", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle" }), "global");

  const bundle = service.resolveBundleForTraffic("bundle", "task");
  assert.ok(bundle !== null);
  assert.equal(bundle!.name, "bundle");
});

test("HierarchicalPromptRegistryService constructor applies custom config defaults", () => {
  const service = new HierarchicalPromptRegistryService({
    enableVersioning: true,
    enableTrafficSplit: false,
    defaultMaxTokens: 8192,
    defaultTemperature: 0.5,
  });

  const bundle = service.registerBundle(makeInput({ name: "test-bundle" }), "global");
  assert.equal(bundle.constraints.maxTokens, 8192);
  assert.equal(bundle.constraints.temperature, 0.5);
});

test("HierarchicalPromptRegistryService.listBundles with pack filter", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "pack-bundle" }), "pack", undefined, "my-pack");

  const bundles = service.listBundles("pack", undefined, "my-pack");
  assert.equal(bundles.length, 0);
});

test("HierarchicalPromptRegistryService.registerBundle with custom constraints", () => {
  const service = new HierarchicalPromptRegistryService({
    defaultMaxTokens: 1000,
    defaultTemperature: 0.7,
  });

  const bundle = service.registerBundle(makeInput({ name: "custom-constraints-bundle" }), "global");
  assert.equal(bundle.constraints.maxTokens, 1000);
  assert.equal(bundle.constraints.temperature, 0.7);
});

test("HierarchicalPromptRegistryService.getBundle prefers non-deprecated over deprecated", () => {
  const service = new HierarchicalPromptRegistryService();
  service.registerBundle(makeInput({ name: "bundle", version: "v1.0.0" }), "global");
  service.registerBundle(makeInput({ name: "bundle", version: "v2.0.0" }), "global");
  service.deprecateBundle("bundle", "v1.0.0", "global");

  const bundle = service.getBundle("bundle", "any-task");
  assert.ok(bundle !== null);
  assert.equal(bundle!.version, 200);
  assert.equal(bundle!.displayVersion, "v2.0.0");
});
