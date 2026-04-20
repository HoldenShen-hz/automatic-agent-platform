import assert from "node:assert/strict";
import test from "node:test";

import {
  TagBuilder,
  tagBuilder,
} from "../../../../../../src/platform/shared/cache/utils/tag-builder.js";

test("TagBuilder.session creates session-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.session("sess_123"), "session:sess_123");
});

test("TagBuilder.file creates file-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.file("/src/index.ts"), "file:/src/index.ts");
});

test("TagBuilder.tool creates tool-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.tool("Read"), "tool:Read");
});

test("TagBuilder.repo creates repo-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.repo("repo_abc"), "repo:repo_abc");
});

test("TagBuilder.instruction creates instruction-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.instruction("fp_xyz"), "instruction:fp_xyz");
});

test("TagBuilder.model creates model-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.model("claude-3-5-sonnet"), "model:claude-3-5-sonnet");
});

test("TagBuilder.division creates division-scoped tag", () => {
  const builder = new TagBuilder();
  assert.equal(builder.division("div_001"), "division:div_001");
});

test("TagBuilder.toolContext creates tags including tool and optional session", () => {
  const builder = new TagBuilder();
  const tags = builder.toolContext("Read", { path: "/src/index.ts" }, "sess_1");
  assert.ok(tags.includes("tool:Read"));
  assert.ok(tags.includes("session:sess_1"));
  assert.ok(tags.includes("file:/src/index.ts"));
});

test("TagBuilder.toolContext creates tags without session", () => {
  const builder = new TagBuilder();
  const tags = builder.toolContext("Read", { path: "/src/index.ts" });
  assert.ok(tags.includes("tool:Read"));
  assert.ok(!tags.some(t => t.startsWith("session:")));
});

test("TagBuilder.toolContext extracts file from path argument", () => {
  const builder = new TagBuilder();
  const tags = builder.toolContext("Read", { path: "/src/file.ts" });
  assert.ok(tags.includes("file:/src/file.ts"));
});

test("TagBuilder.toolContext extracts file from file argument", () => {
  const builder = new TagBuilder();
  const tags = builder.toolContext("Write", { file: "/src/other.ts" });
  assert.ok(tags.includes("file:/src/other.ts"));
});

test("TagBuilder.promptContext creates tags with session and model", () => {
  const builder = new TagBuilder();
  const tags = builder.promptContext("sess_1", "claude-3-5-sonnet");
  assert.ok(tags.includes("session:sess_1"));
  assert.ok(tags.includes("model:claude-3-5-sonnet"));
});

test("TagBuilder.promptContext includes division when provided", () => {
  const builder = new TagBuilder();
  const tags = builder.promptContext("sess_1", "claude-3-5-sonnet", "div_eng");
  assert.ok(tags.includes("division:div_eng"));
});

test("tagBuilder is a singleton instance", () => {
  assert.ok(tagBuilder instanceof TagBuilder);
});

test("TagBuilder instances are independent", () => {
  const builder1 = new TagBuilder();
  const builder2 = new TagBuilder();
  builder1.session("sess_1");
  assert.equal(builder2.session("sess_2"), "session:sess_2");
});
