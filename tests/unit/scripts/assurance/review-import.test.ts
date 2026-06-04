import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { buildReviewImportArtifacts } from "../../../../scripts/assurance/review-import-lib.mjs";

type ConflictCandidate = {
  severity: string | null;
};

type NormalizedFinding = {
  title: string;
  freshness: string | null;
};

function writeFile(path: string, content: string) {
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
  assert.equal(result.conflictRecords[0].blocking, false);
  assert.equal(result.reviewEvidenceReadinessReport.summary.totalSources, 2);
  assert.equal(result.reviewEvidenceReadinessReport.summary.eligibleSources, 0);

  const normalizedPayload = readFileSync(result.outputs.normalizedPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const conflictPayload = readFileSync(result.outputs.conflictsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const reviewEvidencePayload = JSON.parse(readFileSync(result.outputs.reviewEvidencePath, "utf8"));
  assert.equal(normalizedPayload.length, 2);
  assert.equal(conflictPayload.length, 1);
  assert.equal(reviewEvidencePayload.reviewSources.length, 2);
  assert.equal(normalizedPayload.find((entry) => entry.title === "electron bridge mismatch")?.status, "todo");
  assert.equal(conflictPayload[0].conflictType, "doc_claim_vs_runtime");
  assert.equal(conflictPayload[0].decisionBasis, "runtime_or_code_evidence_precedes_doc_claim");
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

test("buildReviewImportArtifacts marks review evidence readiness when blind spots and dual review are declared", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-readiness-"));
  const reviewsRoot = join(repoRoot, "docs_zh", "reviews");
  writeFile(
    join(reviewsRoot, "release-review.md"),
    [
      "> Reviewer: Alice",
      "> Reviewed by: Bob",
      "reviewed files: src/platform/foo.ts",
      "reviewed contracts: docs_zh/contracts/foo.md",
      "reviewed tests: tests/unit/foo.test.ts",
      "reviewed CI gates: rc:check",
      "unverified assumptions: production traffic pattern",
      "missed areas: runtime-only rollback path",
      "confidence score: 0.82",
      "无法自动验证：跨区域故障注入",
      "需要 runtime/chaos 测试：灰度回滚链路",
      "",
      "| ID | 严重级别 | 问题 | 状态 | 证据 |",
      "| --- | --- | --- | --- | --- |",
      "| R1 | P0 | tenant isolation regression | `done` | tests/redteam/p0/cross-tenant-access.test.ts |",
    ].join("\n"),
  );

  const result = buildReviewImportArtifacts({
    repoRoot,
    reviewsRoot: "docs_zh/reviews",
    outputDir: "artifacts/assurance",
    generatedAt: "2026-06-02T12:00:00Z",
  });

  assert.equal(result.reviewEvidenceReadinessReport.summary.totalSources, 1);
  assert.equal(result.reviewEvidenceReadinessReport.summary.eligibleSources, 1);
  assert.equal(result.reviewEvidenceReadinessReport.summary.dualPersonRequiredCount, 1);
  assert.equal(result.reviewEvidenceReadinessReport.summary.dualPersonSatisfiedCount, 1);
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
  assert.equal(result.conflictRecords[0].conflictType, "review_fixed_vs_test_failed");
});

test("buildReviewImportArtifacts records severity mismatch conflicts even when statuses match", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-severity-"));
  const reviewsRoot = join(repoRoot, "docs_zh", "reviews");
  writeFile(
    join(reviewsRoot, "platforme-full-review-e.md"),
    [
      "| 编号 | 严重级别 | 问题 | 状态 | 证据 |",
      "| --- | --- | --- | --- | --- |",
      "| 1 | P2 | shared severity title | `todo` | docs_zh/contracts/foo.md |",
      "",
    ].join("\n"),
  );
  writeFile(
    join(reviewsRoot, "system-review-2026-05-26.md"),
    [
      "| ID | 严重级别 | 问题 | Review结论 | 根因归类 | 证据 |",
      "|---|---|---|---|---|---|",
      "| SYS-009 | P0 | shared severity title | 未解决。当前桥接失效。 | contract drift | docs_zh/contracts/foo.md |",
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
  assert.equal(result.conflictRecords[0].conflictType, "severity_mismatch");
  assert.equal(result.conflictRecords[0].blocking, false);
  assert.deepEqual(
    result.conflictRecords[0].candidates.map((candidate: ConflictCandidate) => candidate.severity),
    ["P2", "P0"],
  );
});

test("buildReviewImportArtifacts infers freshness for current and resolved review rows", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "aa-review-import-freshness-"));
  const reviewsRoot = join(repoRoot, "docs_zh", "reviews");
  writeFile(
    join(reviewsRoot, "platforme-full-review-e.md"),
    [
      "**Review Date**: 2026/04/01",
      "",
      "| 编号 | 问题 | 状态 | 证据 |",
      "| --- | --- | --- | --- |",
      "| 1 | stale row | `todo` |  |",
      "| 2 | resolved row | `fixed` | tests/unit/example.test.ts |",
      "",
    ].join("\n"),
  );

  const result = buildReviewImportArtifacts({
    repoRoot,
    reviewsRoot: "docs_zh/reviews",
    outputDir: "artifacts/assurance",
    generatedAt: "2026-06-02T12:00:00Z",
  });

  const stale = result.normalizedFindings.find((entry: NormalizedFinding) => entry.title === "stale row");
  const resolved = result.normalizedFindings.find((entry: NormalizedFinding) => entry.title === "resolved row");
  assert.equal(stale?.freshness, "stale");
  assert.equal(resolved?.freshness, "revalidated");
});
