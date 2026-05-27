import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePatch,
  isNullPath,
  createSkippedResult,
} from "../../../../../src/platform/five-plane-execution/tool-executor/patch-dsl-support.js";

test("parsePatch handles empty string [patch-dsl-support]", () => {
  const result = parsePatch("");
  assert.deepEqual(result, []);
});

test("parsePatch handles whitespace only [patch-dsl-support]", () => {
  const result = parsePatch("   \n\n  ");
  assert.deepEqual(result, []);
});

test("parsePatch parses unified diff format [patch-dsl-support]", () => {
  const content = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line one
-line two
+line two updated
+line three
 line four`;

  const result = parsePatch(content);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.oldPath, "file.txt");
  assert.equal(result[0]!.newPath, "file.txt");
  assert.equal(result[0]!.hunks.length, 1);
});

test("parsePatch parses codex format [patch-dsl-support]", () => {
  const content = `*** Begin Patch
*** Add File: new.txt
old line
new line
added line
*** End Patch`;

  const result = parsePatch(content);

  assert.ok(result.length >= 1);
});

test("parsePatch detects codex format by header [patch-dsl-support]", () => {
  const content = `*** Begin Patch
*** End Patch`;

  const result = parsePatch(content);

  // Codex format returns empty patches from parseCodexPatch if no valid patches
  assert.deepEqual(result, []);
});

test("isNullPath returns true for empty string [patch-dsl-support]", () => {
  assert.equal(isNullPath(""), true);
});

test("isNullPath returns true for whitespace only [patch-dsl-support]", () => {
  assert.equal(isNullPath("   "), true);
});

test("isNullPath returns true for /dev/null [patch-dsl-support]", () => {
  assert.equal(isNullPath("/dev/null"), true);
});

test("isNullPath returns true for /dev/null with whitespace [patch-dsl-support]", () => {
  assert.equal(isNullPath("  /dev/null  "), true);
});

test("isNullPath returns false for valid path [patch-dsl-support]", () => {
  assert.equal(isNullPath("src/index.ts"), false);
});

test("createSkippedResult returns correct structure [patch-dsl-support]", () => {
  const patch = {
    oldPath: "file.txt",
    newPath: "file.txt",
    hunks: [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 2, lines: ["+new line"] }],
  };

  const result = createSkippedResult(patch);

  assert.equal(result.filePath, "file.txt");
  assert.equal(result.status, "skipped");
  assert.equal(result.hunksApplied, 0);
  assert.equal(result.hunksTotal, 1);
});

test("createSkippedResult uses oldPath when newPath is empty [patch-dsl-support]", () => {
  const patch = {
    oldPath: "deleted.txt",
    newPath: "",
    hunks: [],
  };

  const result = createSkippedResult(patch);

  assert.equal(result.filePath, "deleted.txt");
});
