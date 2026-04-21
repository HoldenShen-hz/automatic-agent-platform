import assert from "node:assert/strict";
import test from "node:test";
import { normalizePath, isWithinWorkspace, getWorkspaceRelativePath } from "../../../../../src/platform/shared/cache/utils/normalize-path.js";
test("normalizePath returns /workspace prefix for paths within workspace", () => {
    const result = normalizePath("/workspace/src/index.ts", "/workspace");
    assert.equal(result.startsWith("/workspace"), true);
});
test("normalizePath converts backslashes to forward slashes", () => {
    const result = normalizePath("C:\\Users\\project\\file.ts", "/workspace");
    assert.ok(!result.includes("\\"));
});
test("normalizePath resolves relative paths to absolute", () => {
    const result = normalizePath("relative/path/file.ts", "/workspace");
    assert.ok(result.startsWith("/"));
});
test("normalizePath replaces workspace root with /workspace", () => {
    const result = normalizePath("/workspace/src/file.ts", "/workspace");
    assert.equal(result, "/workspace/src/file.ts");
});
test("normalizePath handles subdirectory of workspace", () => {
    const result = normalizePath("/workspace/src/nested/deep/file.ts", "/workspace");
    assert.equal(result, "/workspace/src/nested/deep/file.ts");
});
test("normalizePath handles file outside workspace", () => {
    const result = normalizePath("/tmp/other/file.ts", "/workspace");
    // File outside workspace should not be replaced
    assert.ok(result.startsWith("/tmp"));
});
test("isWithinWorkspace returns true for paths inside workspace", () => {
    assert.equal(isWithinWorkspace("/workspace/src/file.ts", "/workspace"), true);
    assert.equal(isWithinWorkspace("/workspace/file.ts", "/workspace"), true);
});
test("isWithinWorkspace returns false for paths outside workspace", () => {
    assert.equal(isWithinWorkspace("/tmp/file.ts", "/workspace"), false);
    assert.equal(isWithinWorkspace("/home/user/file.ts", "/workspace"), false);
});
test("getWorkspaceRelativePath extracts relative path", () => {
    const result = getWorkspaceRelativePath("/workspace/src/index.ts", "/workspace");
    assert.equal(result, "/src/index.ts");
});
test("getWorkspaceRelativePath returns full path for non-workspace paths", () => {
    const result = getWorkspaceRelativePath("/tmp/file.ts", "/workspace");
    assert.equal(result, "/tmp/file.ts");
});
test("normalizePath normalizes dot paths", () => {
    const result = normalizePath("/workspace/src/../file.ts", "/workspace");
    assert.equal(result, "/workspace/file.ts");
});
test("normalizePath handles trailing slash", () => {
    const result = normalizePath("/workspace/src/", "/workspace");
    assert.equal(result, "/workspace/src");
});
test("normalizePath with deep relative path", () => {
    const result = normalizePath("a/b/c/file.ts", "/workspace");
    assert.ok(result.startsWith("/workspace"));
});
test("normalizePath with windows-style workspace root", () => {
    // Skip on non-Windows platforms since path.resolve doesn't handle Windows paths on macOS/Linux
    if (process.platform !== "win32") {
        return; // Skipped on non-Windows
    }
    const result = normalizePath("C:\\workspace\\src\\file.ts", "C:\\workspace");
    assert.equal(result, "/workspace/src/file.ts");
});
test("isWithinWorkspace works with normalized paths", () => {
    const normalized = normalizePath("/workspace/src/file.ts", "/workspace");
    assert.equal(isWithinWorkspace(normalized, "/workspace"), true);
});
test("getWorkspaceRelativePath handles root file", () => {
    const result = getWorkspaceRelativePath("/workspace/file.ts", "/workspace");
    assert.equal(result, "/file.ts");
});
test("getWorkspaceRelativePath handles empty relative path", () => {
    const result = getWorkspaceRelativePath("/workspace", "/workspace");
    assert.equal(result, "");
});
//# sourceMappingURL=normalize-path.test.js.map