import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = resolve(process.cwd(), "scripts/assurance/build-fix-verification-report.mjs");

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

test("build-fix-verification-report distinguishes fully backed fixes from incomplete closures", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-fix-verification-"));
  try {
    writeFile(
      join(workspace, "artifacts", "assurance", "review-ledger.normalized.jsonl"),
      [
        JSON.stringify({
          canonicalIssueId: "AAS-ISSUE-000001",
          sourceFile: "docs_zh/reviews/example.md",
          rowId: "1",
          title: "fully verified closure",
          status: "fixed",
          evidenceRefs: ["audit:tenant-isolation"],
          testRefs: [],
        }),
        JSON.stringify({
          canonicalIssueId: "AAS-ISSUE-000002",
          sourceFile: "docs_zh/reviews/example.md",
          rowId: "2",
          title: "doc-only closure",
          status: "done",
          evidenceRefs: [],
          testRefs: [],
        }),
      ].join("\n") + "\n",
    );
    writeFile(
      join(workspace, "artifacts", "assurance", "issue-to-test-map.json"),
      JSON.stringify(
        {
          generatedAt: "2026-06-03T00:00:00.000Z",
          totalIssues: 1,
          totalTestRefs: 1,
          bindings: {
            "AAS-ISSUE-000001": ["tests/unit/example.test.ts"],
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      join(workspace, "artifacts", "assurance", "test-metadata.json"),
      JSON.stringify(
        {
          generatedAt: "2026-06-03T00:00:00.000Z",
          totalTests: 1,
          entries: [
            {
              path: "tests/unit/example.test.ts",
              gate: "audit:tenant-isolation",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);

    const summary = JSON.parse(result.stdout);
    assert.equal(summary.totalClosedFindings, 2);
    assert.equal(summary.passCount, 1);
    assert.equal(summary.failCount, 1);

    const report = JSON.parse(
      readFileSync(join(workspace, "artifacts", "assurance", "fix-verification-report.json"), "utf8"),
    );
    const passing = report.records.find((record: { canonicalIssueId: string }) => record.canonicalIssueId === "AAS-ISSUE-000001");
    const failing = report.records.find((record: { canonicalIssueId: string }) => record.canonicalIssueId === "AAS-ISSUE-000002");
    assert.equal(passing.status, "pass");
    assert.deepEqual(passing.testsAdded, ["tests/unit/example.test.ts"]);
    assert.deepEqual(passing.gatesObserved, ["audit:tenant-isolation"]);
    assert.equal(failing.status, "fail");
    assert.equal(failing.verification.hasEvidence, false);
    assert.equal(failing.verification.hasTests, false);
    assert.equal(failing.verification.hasGate, false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
