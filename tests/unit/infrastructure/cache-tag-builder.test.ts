/**
 * Infrastructure: Tag Builder Tests
 *
 * Tests for the TagBuilder utility that provides consistent
 * tag generation for cache invalidation.
 */

import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";

// Tag Builder
import {
  TagBuilder,
  tagBuilder,
} from "../../../src/platform/shared/cache/utils/tag-builder.js";

describe("TagBuilder", () => {
  let builder: TagBuilder;

  beforeEach(() => {
    builder = new TagBuilder();
  });

  describe("session", () => {
    it("creates session tag with session ID", () => {
      const tag = builder.session("session-123");
      assert.equal(tag, "session:session-123");
    });

    it("handles empty session ID", () => {
      const tag = builder.session("");
      assert.equal(tag, "session:");
    });

    it("handles special characters in session ID", () => {
      const tag = builder.session("sess_123-abc");
      assert.equal(tag, "session:sess_123-abc");
    });
  });

  describe("file", () => {
    it("creates file tag with path", () => {
      const tag = builder.file("/workspace/src/index.ts");
      assert.equal(tag, "file:/workspace/src/index.ts");
    });

    it("handles relative paths", () => {
      const tag = builder.file("src/index.ts");
      assert.equal(tag, "file:src/index.ts");
    });

    it("handles empty path", () => {
      const tag = builder.file("");
      assert.equal(tag, "file:");
    });
  });

  describe("tool", () => {
    it("creates tool tag with tool name", () => {
      const tag = builder.tool("read");
      assert.equal(tag, "tool:read");
    });

    it("handles namespaced tools", () => {
      const tag = builder.tool("tool.read");
      assert.equal(tag, "tool:tool.read");
    });
  });

  describe("repo", () => {
    it("creates repo tag with repo ID", () => {
      const tag = builder.repo("my-repo-001");
      assert.equal(tag, "repo:my-repo-001");
    });
  });

  describe("instruction", () => {
    it("creates instruction tag with fingerprint", () => {
      const tag = builder.instruction("abc123def456");
      assert.equal(tag, "instruction:abc123def456");
    });
  });

  describe("model", () => {
    it("creates model tag with model name", () => {
      const tag = builder.model("claude-3-opus");
      assert.equal(tag, "model:claude-3-opus");
    });
  });

  describe("division", () => {
    it("creates division tag with division ID", () => {
      const tag = builder.division("division-001");
      assert.equal(tag, "division:division-001");
    });
  });

  describe("toolContext", () => {
    it("creates tags for tool call without session", () => {
      const tags = builder.toolContext("read", {
        path: "/workspace/src/index.ts",
      });

      assert.ok(tags.includes("tool:read"));
      assert.ok(tags.some((t) => t.startsWith("file:")));
    });

    it("creates tags for tool call with session", () => {
      const tags = builder.toolContext(
        "read",
        { path: "/workspace/src/index.ts" },
        "session-123",
      );

      assert.ok(tags.includes("tool:read"));
      assert.ok(tags.includes("session:session-123"));
      assert.ok(tags.some((t) => t.startsWith("file:")));
    });

    it("adds file tag for path property", () => {
      const tags = builder.toolContext("glob", { path: "/workspace/src" });

      assert.ok(tags.some((t) => t === "file:/workspace/src"));
    });

    it("adds file tag for file property", () => {
      const tags = builder.toolContext("read", { file: "/workspace/test.ts" });

      assert.ok(tags.some((t) => t === "file:/workspace/test.ts"));
    });

    it("handles multiple file references", () => {
      const tags = builder.toolContext("grep", {
        path: "/workspace/src/index.ts",
        file: "/workspace/src/app.ts",
      });

      const fileTags = tags.filter((t) => t.startsWith("file:"));
      assert.equal(fileTags.length, 2);
    });

    it("returns only tool tag when no session and no file path", () => {
      const tags = builder.toolContext("bash", { cmd: "ls" });

      assert.equal(tags.length, 1);
      assert.equal(tags[0], "tool:bash");
    });

    it("handles array path (glob pattern)", () => {
      const tags = builder.toolContext("glob", {
        files: ["/a", "/b"],
      } as Record<string, unknown>);

      assert.ok(tags.includes("tool:glob"));
      // No file tags for files property, only path/file
      const fileTags = tags.filter((t) => t.startsWith("file:"));
      assert.equal(fileTags.length, 0);
    });
  });

  describe("promptContext", () => {
    it("creates tags for prompt context", () => {
      const tags = builder.promptContext("session-123", "claude-3-opus");

      assert.ok(tags.includes("session:session-123"));
      assert.ok(tags.includes("model:claude-3-opus"));
    });

    it("adds division tag when provided", () => {
      const tags = builder.promptContext(
        "session-123",
        "claude-3-opus",
        "division-001",
      );

      assert.ok(tags.includes("session:session-123"));
      assert.ok(tags.includes("model:claude-3-opus"));
      assert.ok(tags.includes("division:division-001"));
    });

    it("returns only session and model when no division", () => {
      const tags = builder.promptContext("session-123", "claude-3-opus");

      assert.equal(tags.length, 2);
    });
  });
});

describe("tagBuilder singleton", () => {
  it("is a TagBuilder instance", () => {
    assert.ok(tagBuilder instanceof TagBuilder);
  });

  it("can be used directly", () => {
    const tag = tagBuilder.tool("read");
    assert.equal(tag, "tool:read");
  });

  it("has all instance methods", () => {
    assert.ok(typeof tagBuilder.session === "function");
    assert.ok(typeof tagBuilder.file === "function");
    assert.ok(typeof tagBuilder.tool === "function");
    assert.ok(typeof tagBuilder.repo === "function");
    assert.ok(typeof tagBuilder.instruction === "function");
    assert.ok(typeof tagBuilder.model === "function");
    assert.ok(typeof tagBuilder.division === "function");
    assert.ok(typeof tagBuilder.toolContext === "function");
    assert.ok(typeof tagBuilder.promptContext === "function");
  });
});
