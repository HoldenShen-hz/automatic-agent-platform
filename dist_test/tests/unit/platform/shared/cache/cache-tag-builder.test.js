import assert from "node:assert/strict";
import test from "node:test";
import { TagBuilder, tagBuilder } from "../../../../../src/platform/shared/cache/utils/tag-builder.js";
test("TagBuilder.tool creates correct tag", () => {
    assert.equal(tagBuilder.tool("read"), "tool:read");
    assert.equal(tagBuilder.tool("Bash"), "tool:Bash");
});
test("TagBuilder.session creates correct tag", () => {
    assert.equal(tagBuilder.session("sess-123"), "session:sess-123");
});
test("TagBuilder.file creates correct tag", () => {
    assert.equal(tagBuilder.file("/workspace/src/index.ts"), "file:/workspace/src/index.ts");
});
test("TagBuilder.repo creates correct tag", () => {
    assert.equal(tagBuilder.repo("repo-main"), "repo:repo-main");
});
test("TagBuilder.instruction creates correct tag", () => {
    assert.equal(tagBuilder.instruction("abc123"), "instruction:abc123");
});
test("TagBuilder.model creates correct tag", () => {
    assert.equal(tagBuilder.model("claude-haiku-3-5"), "model:claude-haiku-3-5");
});
test("TagBuilder.division creates correct tag", () => {
    assert.equal(tagBuilder.division("engineering_ops"), "division:engineering_ops");
});
test("TagBuilder.toolContext creates tags for tool name only", () => {
    const tags = tagBuilder.toolContext("read", {});
    assert.deepEqual(tags, ["tool:read"]);
});
test("TagBuilder.toolContext includes session tag when provided", () => {
    const tags = tagBuilder.toolContext("read", {}, "sess-abc");
    assert.deepEqual(tags, ["tool:read", "session:sess-abc"]);
});
test("TagBuilder.toolContext adds path tag from args.path", () => {
    const tags = tagBuilder.toolContext("read", { path: "/workspace/file.ts" });
    assert.deepEqual(tags, ["tool:read", "file:/workspace/file.ts"]);
});
test("TagBuilder.toolContext adds file tag from args.file", () => {
    const tags = tagBuilder.toolContext("read", { file: "/workspace/other.ts" });
    assert.deepEqual(tags, ["tool:read", "file:/workspace/other.ts"]);
});
test("TagBuilder.toolContext adds both path and file tags", () => {
    const tags = tagBuilder.toolContext("read", {
        path: "/workspace/a.ts",
        file: "/workspace/b.ts",
    });
    assert.deepEqual(tags, ["tool:read", "file:/workspace/a.ts", "file:/workspace/b.ts"]);
});
test("TagBuilder.toolContext with session and path", () => {
    const tags = tagBuilder.toolContext("grep", { path: "/workspace/src" }, "sess-1");
    assert.deepEqual(tags, ["tool:grep", "session:sess-1", "file:/workspace/src"]);
});
test("TagBuilder.promptContext creates session and model tags", () => {
    const tags = tagBuilder.promptContext("sess-abc", "claude-haiku-3-5");
    assert.deepEqual(tags, ["session:sess-abc", "model:claude-haiku-3-5"]);
});
test("TagBuilder.promptContext with division adds division tag", () => {
    const tags = tagBuilder.promptContext("sess-abc", "claude-haiku-3-5", "devops");
    assert.deepEqual(tags, ["session:sess-abc", "model:claude-haiku-3-5", "division:devops"]);
});
test("tagBuilder is a singleton instance", () => {
    const tb = new TagBuilder();
    assert.equal(tagBuilder.tool("x"), tb.tool("x"));
    assert.equal(tagBuilder.session("y"), tb.session("y"));
});
//# sourceMappingURL=cache-tag-builder.test.js.map