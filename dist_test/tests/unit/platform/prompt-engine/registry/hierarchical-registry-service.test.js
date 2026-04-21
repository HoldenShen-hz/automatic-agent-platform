/**
 * Unit tests for HierarchicalPromptRegistryService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { HierarchicalPromptRegistryService } from "../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
function createTestBundle(name, version, domain = "test-domain") {
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
test("HierarchicalPromptRegistryService.registerBundle stores at global level", () => {
    const registry = new HierarchicalPromptRegistryService();
    const bundle = registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");
    assert.equal(bundle.name, "test-bundle");
    assert.equal(bundle.version, "v1.0");
    assert.equal(bundle.domain, "test-domain");
});
test("HierarchicalPromptRegistryService.getBundle retrieves global bundle", () => {
    const registry = new HierarchicalPromptRegistryService();
    registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");
    const found = registry.getBundle("test-bundle", "classification");
    assert.ok(found !== null);
    assert.equal(found.name, "test-bundle");
});
test("HierarchicalPromptRegistryService.getBundle returns null for non-existent bundle", () => {
    const registry = new HierarchicalPromptRegistryService();
    const found = registry.getBundle("non-existent", "classification");
    assert.equal(found, null);
});
test("HierarchicalPromptRegistryService.registerBundle throws for invalid name", () => {
    const registry = new HierarchicalPromptRegistryService();
    const invalidBundle = createTestBundle("", "v1.0");
    assert.throws(() => registry.registerBundle(invalidBundle, "global"), (error) => error.message.includes("name must be non-empty"));
});
test("HierarchicalPromptRegistryService.registerBundle throws for invalid domain", () => {
    const registry = new HierarchicalPromptRegistryService();
    const invalidBundle = createTestBundle("test-bundle", "v1.0", "");
    assert.throws(() => registry.registerBundle(invalidBundle, "global"), (error) => error.message.includes("domain must be non-empty"));
});
test("HierarchicalPromptRegistryService.registerBundle throws for missing system prompt", () => {
    const registry = new HierarchicalPromptRegistryService();
    const invalidBundle = {
        name: "test-bundle",
        version: "v1.0",
        domain: "test-domain",
        taskType: "classification",
        packId: undefined,
        systemPrompt: { content: "", templateVariables: [], channel: "system" },
        userPrompt: undefined,
        fewShotExamples: undefined,
        constraints: undefined,
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
    assert.throws(() => registry.registerBundle(invalidBundle, "global"), (error) => error.message.includes("System prompt content must be non-empty"));
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
    registry.registerBundle(createTestBundle("test-bundle", "v1.0-domain"), "domain", "override-domain");
    const globalBundle = registry.getBundle("test-bundle", "classification", undefined, undefined);
    const domainBundle = registry.getBundle("test-bundle", "classification", "override-packs", "override-domain");
    assert.ok(globalBundle !== null);
    assert.equal(globalBundle.version, "v1.0");
    assert.ok(domainBundle !== null);
    assert.equal(domainBundle.version, "v1.0-domain");
});
test("HierarchicalPromptRegistryService.listBundleVersions includes multiple registered versions", () => {
    const registry = new HierarchicalPromptRegistryService();
    registry.registerBundle(createTestBundle("test-bundle", "v1.0"), "global");
    registry.registerBundle(createTestBundle("test-bundle", "v1.1"), "global");
    const versions = registry.listBundleVersions("test-bundle");
    assert.equal(versions.length, 2);
    assert.equal(versions[0]?.version, "v1.0");
    assert.equal(versions[1]?.version, "v1.1");
});
test("HierarchicalPromptRegistryService.resolveBundleForTraffic honors weighted traffic split", () => {
    const registry = new HierarchicalPromptRegistryService();
    registry.registerBundle(createTestBundle("traffic-bundle", "v1.0"), "global");
    registry.registerBundle({
        ...createTestBundle("traffic-bundle", "v2.0"),
        metadata: {
            owner: "test-owner",
            deprecated: false,
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
    assert.equal(resolved.version, "v1.0");
});
//# sourceMappingURL=hierarchical-registry-service.test.js.map