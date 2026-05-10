import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { PromptVersionManager } from "../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
import { PromptTemplateRegistryService, hashPromptPrefix } from "../../../../src/platform/prompt-engine/registry/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Integration: HierarchicalPromptRegistryService + PromptVersionManager
// =============================================================================

test("Integration: HierarchicalPromptRegistryService and PromptVersionManager share bundle lifecycle", () => {
  const registry = new HierarchicalPromptRegistryService();
  const versionManager = new PromptVersionManager();

  // Register a bundle in the registry
  const bundle = registry.registerBundle(
    {
      name: "integration-bundle",
      version: 1,
      displayVersion: "v1.0.0",
      domain: "test-domain",
      taskType: "test-task",
      systemPrompt: { content: "You are a helpful assistant", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );

  // Register the same bundle in version manager
  versionManager.registerBundleVersion(bundle);

  // Verify both systems have the bundle
  const retrievedFromRegistry = registry.getBundle("integration-bundle", "test-task");
  assert.ok(retrievedFromRegistry !== null);
  assert.equal(retrievedFromRegistry!.version, "v1.0.0");

  const versions = versionManager.listBundleVersions("integration-bundle");
  assert.equal(versions.length, 1);
  assert.equal(versions[0]!.version, "v1.0.0");

  // Register new version in registry
  const newBundle = registry.registerBundle(
    {
      name: "integration-bundle",
      version: 2,
      displayVersion: "v2.0.0",
      domain: "test-domain",
      taskType: "test-task",
      systemPrompt: { content: "You are a very helpful assistant", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );
  versionManager.registerBundleVersion(newBundle);

  // Verify version lineage
  const lineage = versionManager.getVersionLineage("integration-bundle", "v1.0.0");
  assert.equal(lineage.current, "v1.0.0");
  assert.equal(lineage.next, "v2.0.0");

  // Verify latest version in registry
  const latestFromRegistry = registry.getBundle("integration-bundle", "test-task");
  assert.ok(latestFromRegistry !== null);
  assert.equal(latestFromRegistry!.version, "v2.0.0");
});

test("Integration: hashPromptPrefix with PromptTemplateRegistryService", () => {
  const prefix = "You are a helpful assistant";
  const hash = hashPromptPrefix(prefix);

  const service = new PromptTemplateRegistryService();
  const template = service.registerTemplate({
    templateKey: "test-template",
    version: "v1.0.0",
    owner: "test-owner",
    fixedPrefix: prefix,
    domainBlock: "general",
  });

  assert.equal(template.fixedPrefixHash, hash);
  assert.equal(template.fixedPrefixHash.length, 16);

  // Same prefix produces same hash
  const sameHash = hashPromptPrefix(prefix);
  assert.equal(template.fixedPrefixHash, sameHash);
});

test("Integration: HierarchicalPromptRegistryService with domain hierarchy", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register global default
  const globalBundle = registry.registerBundle(
    {
      name: "company-prompt",
      version: 1,
      displayVersion: "v1.0.0",
      domain: "shared",
      taskType: "general",
      systemPrompt: { content: "Company default prompt", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );

  // Register domain override
  const domainBundle = registry.registerBundle(
    {
      name: "company-prompt",
      version: 2,
      displayVersion: "v1.0.0",
      domain: "finance",
      taskType: "general",
      systemPrompt: { content: "Finance-specific prompt", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "domain",
    "finance",
  );

  // Get bundle for finance domain - should get domain-level override
  const financeBundle = registry.getBundle("company-prompt", "general", undefined, "finance");
  assert.ok(financeBundle !== null);
  assert.equal(financeBundle!.bundleId, domainBundle.bundleId);
  assert.equal(financeBundle!.systemPrompt.content, "Finance-specific prompt");

  // Get bundle for engineering domain - should fall back to global
  const engBundle = registry.getBundle("company-prompt", "general", undefined, "engineering");
  assert.ok(engBundle !== null);
  assert.equal(engBundle!.bundleId, globalBundle.bundleId);
  assert.equal(engBundle!.systemPrompt.content, "Company default prompt");

  // Verify versions exist for both
  const allVersions = registry.listBundleVersions("company-prompt");
  assert.equal(allVersions.length, 2);
});

test("Integration: HierarchicalPromptRegistryService traffic resolution", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Register two versions with traffic weights
  registry.registerBundle(
    {
      name: "ab-test-bundle",
      version: 1,
      displayVersion: "v1.0.0",
      domain: "test",
      taskType: "test-task",
      systemPrompt: { content: "Control version", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );

  registry.registerBundle(
    {
      name: "ab-test-bundle",
      version: 2,
      displayVersion: "v2.0.0",
      domain: "test",
      taskType: "test-task",
      systemPrompt: { content: "Treatment version", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );

  // Resolve bundle for multiple tasks - should deterministically select based on traffic
  const resolved1 = registry.resolveBundleForTraffic("ab-test-bundle", "test-task", undefined, undefined, "user-1");
  const resolved2 = registry.resolveBundleForTraffic("ab-test-bundle", "test-task", undefined, undefined, "user-2");
  const resolved3 = registry.resolveBundleForTraffic("ab-test-bundle", "test-task", undefined, undefined, "user-3");

  // All resolutions should return a valid bundle
  assert.ok(resolved1 !== null);
  assert.ok(resolved2 !== null);
  assert.ok(resolved3 !== null);

  // Same traffic key should return same bundle
  const resolvedAgain = registry.resolveBundleForTraffic("ab-test-bundle", "test-task", undefined, undefined, "user-1");
  assert.equal(resolved1!.version, resolvedAgain!.version);
});

test("Integration: PromptVersionManager version comparison and lineage", () => {
  const manager = new PromptVersionManager();

  // Register multiple versions
  manager.registerBundleVersion(makeBundle("prompt-v1", "v1.0.0"));
  manager.registerBundleVersion(makeBundle("prompt-v1", "v1.1.0"));
  manager.registerBundleVersion(makeBundle("prompt-v1", "v2.0.0"));

  // Compare versions
  assert.equal(manager.compareVersions("v1.0.0", "v1.1.0"), -1);
  assert.equal(manager.compareVersions("v2.0.0", "v1.1.0"), 1);
  assert.equal(manager.compareVersions("v1.1.0", "v1.1.0"), 0);

  // Get next versions
  assert.equal(manager.formatVersion(manager.getNextVersion("v1.0.0", "minor")), "v1.1");
  assert.equal(manager.formatVersion(manager.getNextVersion("v1.1.0", "major")), "v2.0");
  assert.equal(manager.formatVersion(manager.getNextVersion("v1.1.0", "patch"), true), "v1.1.1");

  // Verify sorted versions
  const sorted = manager.getSortedVersions("prompt-v1");
  assert.deepEqual(sorted, ["v1.0.0", "v1.1.0", "v2.0.0"]);
});

test("Integration: PromptTemplateRegistryService template retrieval and listing", () => {
  const service = new PromptTemplateRegistryService();

  // Register multiple templates
  service.registerTemplate({
    templateKey: "customer-support",
    version: "v1.0.0",
    owner: "support-team",
    fixedPrefix: "You are a customer support agent",
    domainBlock: "support",
  });

  service.registerTemplate({
    templateKey: "customer-support",
    version: "v2.0.0",
    owner: "support-team",
    fixedPrefix: "You are an expert customer support agent",
    domainBlock: "support",
  });

  service.registerTemplate({
    templateKey: "sales-agent",
    version: "v1.0.0",
    owner: "sales-team",
    fixedPrefix: "You are a sales agent",
    domainBlock: "sales",
  });

  // Get specific version
  const v1 = service.getTemplate("customer-support", "v1.0.0");
  assert.ok(v1 !== null);
  assert.equal(v1!.version, "v1.0.0");

  // List all versions of a template
  const versions = service.listVersions("customer-support");
  assert.equal(versions.length, 2);

  // List all templates
  const allTemplates = service.listTemplates();
  assert.equal(allTemplates.length, 3);
});

test("Integration: Deprecation across registry and version manager", () => {
  const registry = new HierarchicalPromptRegistryService();
  const versionManager = new PromptVersionManager();

  // Register bundles
  const bundle = registry.registerBundle(
    {
      name: "deprecating-bundle",
      version: 1,
      displayVersion: "v1.0.0",
      domain: "test",
      taskType: "test",
      systemPrompt: { content: "Old content", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );

  versionManager.registerBundleVersion(bundle);

  // Deprecate in registry
  registry.deprecateBundle("deprecating-bundle", "1", "global");

  // Verify deprecated bundle is not returned
  const retrieved = registry.getBundle("deprecating-bundle", "test");
  assert.equal(retrieved, null);

  // But version still exists in list
  const versions = registry.listBundleVersions("deprecating-bundle");
  assert.equal(versions.length, 1);
  assert.equal(versions[0]!.deprecated, true);
});

test("Integration: PromptTemplateRegistryService deduplication", () => {
  const service = new PromptTemplateRegistryService();

  // Register with deduplicated fields
  const template = service.registerTemplate({
    templateKey: "dedup-test",
    version: "v1.0.0",
    owner: "test-owner",
    fixedPrefix: "Hello",
    domainBlock: "test",
    compatibilityTags: ["tag1", "tag2", "tag1", "tag3"],
    variableSpecs: [
      { key: "name", required: true },
      { key: "name", required: false },
      { key: "age", required: true },
    ],
  });

  // Tags should be deduplicated
  assert.equal(template.compatibilityTags.length, 3);
  assert.ok(template.compatibilityTags.includes("tag1"));
  assert.ok(template.compatibilityTags.includes("tag2"));
  assert.ok(template.compatibilityTags.includes("tag3"));

  // Variable specs should be deduplicated by key
  assert.equal(template.variableSpecs.length, 2);
});

test("Integration: HierarchicalPromptRegistryService listBundles with multiple levels", () => {
  const registry = new HierarchicalPromptRegistryService();

  // Create bundles at different levels
  registry.registerBundle(
    {
      name: "global-prompt",
      version: 1,
      displayVersion: "v1.0.0",
      domain: "common",
      taskType: "general",
      systemPrompt: { content: "Global", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "global",
  );

  registry.registerBundle(
    {
      name: "domain-prompt",
      version: 2,
      displayVersion: "v1.0.0",
      domain: "special",
      taskType: "general",
      systemPrompt: { content: "Domain level", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "domain",
    "special",
  );

  registry.registerBundle(
    {
      name: "pack-prompt",
      version: 3,
      displayVersion: "v1.0.0",
      domain: "special",
      taskType: "general",
      systemPrompt: { content: "Pack level", templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: [],
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
    },
    "domain",
    "special",
    "premium-pack",
  );

  // List all bundles (only global-level when no filter provided)
  const allBundles = registry.listBundles();
  assert.equal(allBundles.length, 1);
  assert.equal(allBundles[0]!.bundle.name, "global-prompt");

  // List domain bundles for specific domain
  const domainBundles = registry.listBundles("domain", "special");
  assert.equal(domainBundles.length, 1);
  assert.equal(domainBundles[0]!.bundle.name, "domain-prompt");

  // List pack bundles for specific pack - use domain level with packId as domain
  const packBundles = registry.listBundles("domain", undefined, "premium-pack");
  assert.equal(packBundles.length, 1);
  assert.equal(packBundles[0]!.bundle.name, "pack-prompt");
});

function makeBundle(name: string, version: string) {
  return {
    name,
    version: Number(version),
    displayVersion: version,
    domain: "test-domain",
    taskType: "test-task",
    packId: undefined,
    systemPrompt: { content: "You are helpful", templateVariables: [], channel: "system" as const },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: { maxTokens: 1000, temperature: 0.7, topP: undefined, stopSequences: undefined, responseFormat: undefined, customConstraints: {} },
    compatibilityMatrix: {
      toolSchemaVersions: [],
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [],
      modelRoutingProfiles: [],
    },
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "active" as const,
      tags: [],
      compatibilityTags: [],
      trafficAllocation: { weight: 100, startTime: undefined, endTime: undefined, targeting: undefined },
    },
    bundleId: `${name}:${version}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
