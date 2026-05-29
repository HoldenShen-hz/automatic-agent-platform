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

test("architecture code cross review points to current evidence instead of stale closure claims", () => {
  const review = readFileSync(REVIEW_DOC, "utf8");

  assert.match(review, /维护日期：\d{4}-\d{2}-\d{2}/);
  assert.match(review, /当前收口方式/);
  assert.match(review, /review 问题闭环/);
  assert.match(review, /结构性一致性审计/);
  assert.match(review, /audit-docs-sync\.mjs/);
  assert.match(review, /不再写“24 项全部关闭”/);
  assert.match(review, /每个已关闭结论必须能回指到具体文档、命令或源码修复/);
});
