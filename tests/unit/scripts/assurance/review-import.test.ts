import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { buildReviewImportArtifacts } from "../../../../scripts/assurance/review-import-lib.mjs";

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

test("buildReviewImportArtifacts parses table reviews and produces coverage/conflict artifacts", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-"));
  const reviewsRoot = join(repoRoot, "docs_zh", "reviews");
  const outputDir = join(repoRoot, "artifacts", "assurance");
  writeFile(
    join(reviewsRoot, "platforme-full-review-e.md"),
    [
      "| 编号 | 问题 | 状态 | 问题根因 |",
      "| --- | --- | --- | --- |",
      "| 1 | distributed-rate-limiter hard wait | `todo` | timing drift |",
      "| 2 | electron bridge mismatch | `done` | bridge contract drift |",
      "",
    ].join("\n"),
  );
  writeFile(
    join(reviewsRoot, "system-review-2026-05-26.md"),
    [
      "| ID | 严重级别 | 问题 | Review结论 | 根因归类 | 证据 |",
      "|---|---|---|---|---|---|",
      "| SYS-001 | P1 | electron bridge mismatch | 未解决。当前桥接失效。 | contract drift | ui/apps/electron-win/src/preload.ts |",
      "",
    ].join("\n"),
  );

  const result = buildReviewImportArtifacts({
    repoRoot,
    reviewsRoot: "docs_zh/reviews",
    outputDir: "artifacts/assurance",
    generatedAt: "2026-06-02T12:00:00Z",
  });

  assert.equal(result.rawFindings.length, 3);
  assert.equal(result.coverageReport.reviewSources.length, 2);
  assert.equal(result.coverageReport.overallStatus, "pass");
  assert.equal(result.conflictRecords.length, 1);
  assert.equal(result.conflictRecords[0].decision, "todo");
  assert.equal(result.conflictRecords[0].blocking, true);

  const normalizedPayload = readFileSync(result.outputs.normalizedPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const conflictPayload = readFileSync(result.outputs.conflictsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(normalizedPayload.length, 2);
  assert.equal(conflictPayload.length, 1);
  assert.equal(normalizedPayload.find((entry) => entry.title === "electron bridge mismatch")?.status, "todo");
});

test("buildReviewImportArtifacts marks unstructured review files as parse warnings", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-warn-"));
  const reviewsRoot = join(repoRoot, "docs_zh", "reviews");
  writeFile(
    join(reviewsRoot, "architecture-design-review.md"),
    [
      "# Architecture Design Review",
      "",
      "这是一个暂未结构化的问题综述。",
    ].join("\n"),
  );

  const result = buildReviewImportArtifacts({
    repoRoot,
    reviewsRoot: "docs_zh/reviews",
    outputDir: "artifacts/assurance",
    generatedAt: "2026-06-02T12:00:00Z",
  });

  assert.equal(result.rawFindings.length, 0);
  assert.equal(result.coverageReport.overallStatus, "partial");
  assert.equal(result.coverageReport.filesWithParseWarnings.length, 1);
  assert.equal(result.coverageReport.filesWithParseWarnings[0].sourceFile, "docs_zh/reviews/architecture-design-review.md");
});

test("buildReviewImportArtifacts auto-resolves newer evidenced review rows", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-resolve-"));
  const reviewsRoot = join(repoRoot, "docs_zh", "reviews");
  writeFile(
    join(reviewsRoot, "architecture-design-review.md"),
    [
      "**Review Date**: 2026/05/13",
      "",
      "| 编号 | 问题 | 状态 |",
      "| --- | --- | --- |",
      "| 1 | shared title | `todo` |",
      "",
    ].join("\n"),
  );
  writeFile(
    join(reviewsRoot, "issues-table.md"),
    [
      "> 维护日期：2026-05-17",
      "",
      "| ID | 问题 | 状态 | 证据 |",
      "| --- | --- | --- | --- |",
      "| 1 | shared title | 已解决（本轮落地） | tests/unit/example.test.ts |",
      "",
    ].join("\n"),
  );

  const result = buildReviewImportArtifacts({
    repoRoot,
    reviewsRoot: "docs_zh/reviews",
    outputDir: "artifacts/assurance",
    generatedAt: "2026-06-02T12:00:00Z",
  });

  assert.equal(result.conflictRecords.length, 1);
  assert.equal(result.conflictRecords[0].decision, "fixed");
  assert.equal(result.conflictRecords[0].blocking, false);
});
