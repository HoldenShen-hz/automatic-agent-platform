import test from "node:test";
import assert from "node:assert/strict";
import { HierarchicalPromptRegistryService, PromptVersionManager, } from "../../../../src/platform/prompt-registry/index.js";
test("prompt-registry barrel exports HierarchicalPromptRegistryService", () => {
    assert.equal(typeof HierarchicalPromptRegistryService, "function");
});
test("prompt-registry barrel exports PromptVersionManager", () => {
    assert.equal(typeof PromptVersionManager, "function");
});
test("HierarchicalPromptRegistryService can be instantiated", () => {
    const service = new HierarchicalPromptRegistryService();
    assert.ok(service !== undefined);
});
test("PromptVersionManager can be instantiated with default config", () => {
    const manager = new PromptVersionManager();
    assert.ok(manager !== undefined);
});
test("PromptVersionManager parses valid semantic versions", () => {
    const manager = new PromptVersionManager();
    const version = manager.parseVersion("v1.2");
    assert.equal(version.major, 1);
    assert.equal(version.minor, 2);
});
test("PromptVersionManager parses version with patch", () => {
    const manager = new PromptVersionManager();
    const version = manager.parseVersion("v2.1.3");
    assert.equal(version.major, 2);
    assert.equal(version.minor, 1);
    assert.equal(version.patch, 3);
});
test("PromptVersionManager parses version without v prefix", () => {
    const manager = new PromptVersionManager();
    const version = manager.parseVersion("3.4");
    assert.equal(version.major, 3);
    assert.equal(version.minor, 4);
});
test("PromptVersionManager rejects invalid version format", () => {
    const manager = new PromptVersionManager();
    assert.throws(() => manager.parseVersion("invalid"));
});
test("PromptVersionManager rejects empty version", () => {
    const manager = new PromptVersionManager();
    assert.throws(() => manager.parseVersion(""));
});
test("SemanticVersion type is correctly structured", () => {
    const version = { major: 1, minor: 0, patch: 2 };
    assert.equal(version.major, 1);
    assert.equal(version.minor, 0);
    assert.equal(version.patch, 2);
});
test("VersionLineage type is correctly structured", () => {
    const lineage = { current: "v1.1", previous: "v1.0", next: "v1.2" };
    assert.equal(lineage.current, "v1.1");
    assert.equal(lineage.previous, "v1.0");
    assert.equal(lineage.next, "v1.2");
});
test("HierarchicalPromptRegistryConfig type is correctly structured", () => {
    const config = {
        enableVersioning: true,
        enableTrafficSplit: false,
        defaultMaxTokens: 2048,
        defaultTemperature: 0.5,
    };
    assert.equal(config.enableVersioning, true);
    assert.equal(config.enableTrafficSplit, false);
    assert.equal(config.defaultMaxTokens, 2048);
    assert.equal(config.defaultTemperature, 0.5);
});
test("VersionManagerConfig type is correctly structured", () => {
    const config = {
        allowPrerelease: true,
        maxVersionsPerBundle: 100,
        autoDeprecateOldVersions: true,
        deprecationThresholdDays: 30,
    };
    assert.equal(config.allowPrerelease, true);
    assert.equal(config.maxVersionsPerBundle, 100);
    assert.equal(config.autoDeprecateOldVersions, true);
    assert.equal(config.deprecationThresholdDays, 30);
});
//# sourceMappingURL=index.test.js.map