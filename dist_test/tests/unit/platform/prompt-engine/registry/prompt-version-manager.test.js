/**
 * Unit tests for PromptVersionManager
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PromptVersionManager } from "../../../../../src/platform/prompt-engine/registry/prompt-version-manager.js";
test("PromptVersionManager.parseVersion accepts v{major}.{minor} format", () => {
    const manager = new PromptVersionManager();
    const version = manager.parseVersion("v1.0");
    assert.equal(version.major, 1);
    assert.equal(version.minor, 0);
    assert.equal(version.patch, undefined);
});
test("PromptVersionManager.parseVersion accepts v{major}.{minor}.{patch} format", () => {
    const manager = new PromptVersionManager();
    const version = manager.parseVersion("v2.3.1");
    assert.equal(version.major, 2);
    assert.equal(version.minor, 3);
    assert.equal(version.patch, 1);
});
test("PromptVersionManager.parseVersion accepts format without v prefix", () => {
    const manager = new PromptVersionManager();
    const version = manager.parseVersion("1.0");
    assert.equal(version.major, 1);
    assert.equal(version.minor, 0);
});
test("PromptVersionManager.parseVersion rejects invalid format", () => {
    const manager = new PromptVersionManager();
    assert.throws(() => manager.parseVersion("invalid"), (error) => error.message.includes("does not match semantic version format"));
});
test("PromptVersionManager.compareVersions returns -1 when v1 < v2", () => {
    const manager = new PromptVersionManager();
    const result = manager.compareVersions("v1.0", "v2.0");
    assert.equal(result, -1);
});
test("PromptVersionManager.compareVersions returns 0 when v1 == v2", () => {
    const manager = new PromptVersionManager();
    const result = manager.compareVersions("v1.0", "v1.0");
    assert.equal(result, 0);
});
test("PromptVersionManager.compareVersions returns 1 when v1 > v2", () => {
    const manager = new PromptVersionManager();
    const result = manager.compareVersions("v2.0", "v1.0");
    assert.equal(result, 1);
});
test("PromptVersionManager.compareVersions sorts patch versions correctly", () => {
    const manager = new PromptVersionManager();
    assert.equal(manager.compareVersions("v1.0.0", "v1.0.1"), -1);
    assert.equal(manager.compareVersions("v1.0.2", "v1.0.1"), 1);
});
test("PromptVersionManager.getNextVersion returns minor bump for minor update", () => {
    const manager = new PromptVersionManager();
    const next = manager.getNextVersion("v1.0", "minor");
    assert.equal(next.major, 1);
    assert.equal(next.minor, 1);
    assert.equal(next.patch, 0);
});
test("PromptVersionManager.getNextVersion returns major bump for major update", () => {
    const manager = new PromptVersionManager();
    const next = manager.getNextVersion("v1.0", "major");
    assert.equal(next.major, 2);
    assert.equal(next.minor, 0);
    assert.equal(next.patch, 0);
});
test("PromptVersionManager.formatVersion formats correctly with and without patch", () => {
    const manager = new PromptVersionManager();
    assert.equal(manager.formatVersion({ major: 1, minor: 0 }), "v1.0");
    assert.equal(manager.formatVersion({ major: 1, minor: 0, patch: 1 }, true), "v1.0.1");
});
test("PromptVersionManager.isValidVersionFormat validates correctly", () => {
    const manager = new PromptVersionManager();
    assert.equal(manager.isValidVersionFormat("v1.0"), true);
    assert.equal(manager.isValidVersionFormat("1.0.0"), true);
    assert.equal(manager.isValidVersionFormat("invalid"), false);
    assert.equal(manager.isValidVersionFormat(""), false);
});
//# sourceMappingURL=prompt-version-manager.test.js.map