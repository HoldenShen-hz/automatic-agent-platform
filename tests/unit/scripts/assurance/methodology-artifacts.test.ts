import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const regressionMapScript = join(repoRoot, "scripts", "assurance", "build-historical-issue-regression-map.mjs");
const completenessMatrixScript = join(repoRoot, "scripts", "assurance", "build-completeness-coverage-matrix.mjs");

function writeWorkspaceFile(workspace: string, relativePath: string, contents: string): void {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

test("build-historical-issue-regression-map classifies fixed issues with gates and tests", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-historical-regression-"));
  try {
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/issues.deduped.jsonl",
      [
        JSON.stringify({
          issueId: "AAS-ISSUE-000001",
          description: "release claim overreach",
          category: "doc_state.release_claim_overreach",
          severity: "P0",
          invariantViolated: "INV-RELEASE-001",
          requiredGate: ["audit:release-claims"],
          evidence: [],
          owner: "release-owner",
          expiry: null,
          status: "open",
          linkedReviewIds: ["AAS-REVIEW-SRC-000001"],
          linkedPromiseIds: ["AAS-PROMISE-000001"],
        }),
      ].join("\n") + "\n",
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/review-ledger.normalized.jsonl",
      [
        JSON.stringify({
          reviewSourceId: "AAS-REVIEW-SRC-000001",
          sourceFile: "docs_zh/reviews/release-review.md",
          rowId: "1",
          title: "release claim overreach",
          status: "fixed",
          category: "doc_state.release_claim_overreach",
          sourceKind: "review_table",
          sourceRefs: ["docs_zh/reviews/release-review.md#1"],
          evidenceRefs: ["tests/audit-tools/release-claims-auditor.test.ts"],
        }),
      ].join("\n") + "\n",
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/issue-to-test-map.json",
      JSON.stringify({
        bindings: {
          "AAS-ISSUE-000001": ["tests/audit-tools/release-claims-auditor.test.ts"],
        },
      }),
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/seeded-defect-report.json",
      JSON.stringify({
        results: [
          {
            gate: "audit-release-claims",
            manifest: "AAS-SEED-RELEASE_CLAIMS-001",
            seeds: [
              { kind: "positive", pass: true },
              { kind: "negative", pass: true },
              { kind: "evasion", pass: true },
            ],
          },
        ],
      }),
    );

    const result = spawnSync(process.execPath, [regressionMapScript], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.issueCount, 1);

    const report = JSON.parse(readFileSync(join(workspace, "artifacts/assurance/historical-issue-regression-map.json"), "utf8"));
    assert.equal(report.mappings[0].classification, "Fixed with Gate");
    assert.deepEqual(report.mappings[0].missingControls, []);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("build-completeness-coverage-matrix reports coverage for release-claim domain", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-completeness-matrix-"));
  try {
    writeWorkspaceFile(
      workspace,
      "package.json",
      JSON.stringify({
        scripts: {
          "ci:baseline": "npm run audit:release-claims",
        },
      }),
    );
    writeWorkspaceFile(
      workspace,
      "scripts/assurance/rc-check.mjs",
      'const steps = [{ command: "audit:release-claims" }];\n',
    );
    writeWorkspaceFile(
      workspace,
      "tests/audit-tools/release-claims-auditor.test.ts",
      "test file\n",
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/static-audit-report.json",
      JSON.stringify({
        audits: [{ id: "release_claims" }],
      }),
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/review-ledger.normalized.jsonl",
      [
        JSON.stringify({
          reviewSourceId: "AAS-REVIEW-SRC-000001",
          sourceFile: "docs_zh/reviews/release-review.md",
          rowId: "1",
          title: "industry-leading release claim",
          status: "fixed",
          category: "doc_state.release_claim_overreach",
          sourceKind: "review_table",
          sourceRefs: ["docs_zh/reviews/release-review.md#1"],
          evidenceRefs: ["tests/audit-tools/release-claims-auditor.test.ts"],
        }),
      ].join("\n") + "\n",
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/review-evidence-readiness-report.json",
      JSON.stringify({
        reviewSources: [
          {
            sourceFile: "docs_zh/reviews/release-review.md",
            releaseEvidenceEligible: true,
          },
        ],
      }),
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/issues.deduped.jsonl",
      [
        JSON.stringify({
          issueId: "AAS-ISSUE-000001",
          sourceRef: "docs_zh/reviews/release-review.md#1",
          description: "industry-leading release claim",
          category: "doc_state.release_claim_overreach",
          owner: "release-owner",
          evidence: ["docs_zh/reviews/release-review.md#1"],
        }),
      ].join("\n") + "\n",
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/historical-promises.jsonl",
      [
        JSON.stringify({
          promiseId: "AAS-PROMISE-000001",
          sourceFile: "docs_zh/reference/release.md",
          sourceSection: "L1",
          promiseText: "production-ready",
        }),
      ].join("\n") + "\n",
    );
    writeWorkspaceFile(
      workspace,
      "artifacts/assurance/seeded-defect-report.json",
      JSON.stringify({
        results: [
          {
            gate: "audit-release-claims",
            seeds: [
              { kind: "positive", pass: true },
              { kind: "negative", pass: true },
              { kind: "evasion", pass: true },
            ],
          },
        ],
      }),
    );

    const result = spawnSync(process.execPath, [completenessMatrixScript], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(join(workspace, "artifacts/assurance/completeness-coverage-matrix.json"), "utf8"));
    const releaseClaimDomain = report.domains.find((domain: { domainId: string }) => domain.domainId === "release_claim_distortion");
    assert.equal(releaseClaimDomain.status, "pass");
    assert.equal(releaseClaimDomain.coverage.staticScan.present, true);
    assert.equal(releaseClaimDomain.coverage.dynamicTest.present, true);
    assert.equal(releaseClaimDomain.coverage.manualReview.present, true);
    assert.equal(releaseClaimDomain.coverage.historicalPromise.present, true);
    assert.equal(releaseClaimDomain.coverage.ciGate.present, true);
    assert.equal(releaseClaimDomain.coverage.regressionSeed.present, true);
    assert.equal(releaseClaimDomain.coverage.ownerCoverage.present, true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
