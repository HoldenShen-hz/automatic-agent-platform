import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateReviewImportResult,
  parseHeadingBlocks,
  parseMarkdownTables,
  resolveConflict,
} from "../../../../scripts/assurance/review-import-lib.mjs";

test("parseMarkdownTables extracts structured review rows with normalized status and evidence", () => {
  const findings = parseMarkdownTables(
    [
      "**Review Date**: 2026/05/17",
      "",
      "| ID | 严重级别 | 问题 | 状态 | 证据 |",
      "| --- | --- | --- | --- | --- |",
      "| SYS-001 | P1 | electron bridge mismatch | 已解决（本轮落地） | tests/unit/ui/release-console.test.ts; docs_zh/contracts/foo.md |",
      "",
    ].join("\n"),
    "docs_zh/reviews/system-review.md",
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rowId, "SYS-001");
  assert.equal(findings[0].title, "electron bridge mismatch");
  assert.equal(findings[0].status, "fixed");
  assert.equal(findings[0].severity, "P1");
  assert.deepEqual(findings[0].evidenceRefs, [
    "tests/unit/ui/release-console.test.ts",
    "docs_zh/contracts/foo.md",
  ]);
  assert.equal(findings[0].sourceRefs[0], "docs_zh/reviews/system-review.md#SYS-001");
  assert.equal(findings[0].latestReviewDate, "2026-05-17T00:00:00.000Z");
  assert.equal(findings[0].freshness, null);
});

test("parseHeadingBlocks extracts heading findings with default todo status", () => {
  const findings = parseHeadingBlocks(
    [
      "#### 1. [UI] [P0] [tenant isolation regression]",
      "",
      "Need follow-up.",
      "",
    ].join("\n"),
    "docs_zh/reviews/sample.md",
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rowId, "1");
  assert.equal(findings[0].title, "tenant isolation regression");
  assert.equal(findings[0].status, "todo");
  assert.equal(findings[0].severity, "P0");
  assert.equal(findings[0].sourceRefs[0], "docs_zh/reviews/sample.md#1");
});

test("resolveConflict prefers stronger evidence and newer review rows", () => {
  const resolution = resolveConflict([
    {
      status: "todo",
      sourceFile: "docs_zh/reviews/platforme-full-review-d.md",
      title: "shared title",
      evidenceRefs: [],
      latestReviewDate: "2026-05-13T00:00:00.000Z",
    },
    {
      status: "fixed",
      sourceFile: "docs_zh/reviews/issues-table.md",
      title: "shared title",
      evidenceRefs: ["tests/unit/example.test.ts"],
      latestReviewDate: "2026-05-17T00:00:00.000Z",
    },
  ]);

  assert.equal(resolution.decision, "fixed");
  assert.equal(resolution.autoResolved, true);
  assert.equal(resolution.conflictType, "review_fixed_vs_test_failed");
  assert.equal(
    resolution.decisionBasis,
    "executable_test_evidence_precedes_review_note",
  );
});

test("resolveConflict classifies fixed review vs failing test evidence", () => {
  const resolution = resolveConflict([
    {
      status: "fixed",
      severity: "P1",
      category: "ui_contract.bridge_or_endpoint_mismatch",
      sourceFile: "docs_zh/reviews/issues-table.md",
      rowId: "1",
      sourceRefs: ["docs_zh/reviews/issues-table.md#1"],
      title: "shared title",
      evidenceRefs: [],
      latestReviewDate: "2026-05-13T00:00:00.000Z",
    },
    {
      status: "todo",
      severity: "P1",
      category: "ui_contract.bridge_or_endpoint_mismatch",
      sourceFile: "docs_zh/reviews/system-review-2026-05-26.md",
      rowId: "SYS-001",
      sourceRefs: ["docs_zh/reviews/system-review-2026-05-26.md#SYS-001"],
      title: "shared title",
      evidenceRefs: ["tests/regression/ui/bridge-mismatch.test.ts"],
      latestReviewDate: "2026-05-26T00:00:00.000Z",
    },
  ]);

  assert.equal(resolution.decision, "todo");
  assert.equal(resolution.autoResolved, true);
  assert.equal(resolution.conflictType, "review_fixed_vs_test_failed");
  assert.equal(resolution.decisionBasis, "executable_test_evidence_precedes_review_note");
});

test("evaluateReviewImportResult fail-closes on parse warnings, dropped rows, and blocking conflicts", () => {
  const evaluation = evaluateReviewImportResult({
    coverageReport: {
      unscannedReviewFiles: [],
      filesWithParseWarnings: [{ sourceFile: "docs_zh/reviews/review.md" }],
      reviewSources: [{ droppedRows: 1 }],
    },
    conflictRecords: [{ blocking: true }],
  });

  assert.equal(evaluation.pass, false);
  assert.deepEqual(evaluation.reasons, [
    "parse_warnings:1",
    "dropped_rows_present",
    "conflicts:1",
  ]);
});

test("evaluateReviewImportResult allows opted-in warnings and auto-resolved conflicts", () => {
  const evaluation = evaluateReviewImportResult(
    {
      coverageReport: {
        unscannedReviewFiles: [],
        filesWithParseWarnings: [{ sourceFile: "docs_zh/reviews/review.md" }],
        reviewSources: [{ droppedRows: 0 }],
      },
      conflictRecords: [{ blocking: false }],
    },
    {
      allowParseWarnings: true,
      allowConflicts: true,
    },
  );

  assert.equal(evaluation.pass, true);
  assert.deepEqual(evaluation.reasons, []);
});
