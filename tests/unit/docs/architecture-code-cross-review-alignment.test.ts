import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REVIEW_DOC = join(
  process.cwd(),
  "docs_zh",
  "reviews",
  "architecture-code-cross-review.md",
);

test("architecture code cross review reflects the 2026-04-25 closure snapshot", () => {
  const review = readFileSync(REVIEW_DOC, "utf8");

  assert.match(review, /2026-04-25/);
  assert.match(review, /24 项/);
  assert.match(review, /已关闭|全部关闭|已完成闭环/);
  assert.match(review, /contracts\/index\.ts/);
  assert.match(review, /PlatformAdapter/);
  assert.match(review, /SchemaInventoryService/);
});
