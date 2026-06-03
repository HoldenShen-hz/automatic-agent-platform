import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const createScript = join(repoRoot, "scripts", "assurance", "create-release-evidence-bundle.mjs");
const verifyScript = join(repoRoot, "scripts", "assurance", "verify-release-evidence-bundle.mjs");

const REQUIRED_REPORTS = [
  "artifacts/release/rc-check-report.json",
  "artifacts/assurance/audit-coverage-scorecard.json",
  "artifacts/assurance/eval-oracle-report.json",
  "artifacts/assurance/redteam-report.json",
  "artifacts/assurance/golden-replay-report.json",
  "artifacts/assurance/review-ledger.normalized.jsonl",
  "artifacts/assurance/review-evidence-readiness-report.json",
  "artifacts/assurance/historical-promises.jsonl",
  "artifacts/assurance/assumptions.jsonl",
  "artifacts/assurance/issues.deduped.jsonl",
  "artifacts/assurance/test-to-issue-map.json",
  "artifacts/assurance/historical-issue-regression-map.json",
  "artifacts/assurance/completeness-coverage-matrix.json",
  "artifacts/assurance/seeded-defect-report.json",
  "artifacts/assurance/assurance-full-report.json",
];

function writeWorkspaceFile(workspace: string, relativePath: string, contents: string): void {
  const target = join(workspace, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function seedRequiredReports(workspace: string): void {
  for (const reportPath of REQUIRED_REPORTS) {
    writeWorkspaceFile(workspace, reportPath, `{"path":"${reportPath}"}\n`);
  }
}

test("create-release-evidence-bundle fails closed without AA_RELEASE_SIGNING_KEY", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-evidence-bundle-missing-key-"));
  try {
    seedRequiredReports(workspace);
    const result = spawnSync(process.execPath, [createScript], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, AA_RELEASE_SIGNING_KEY: "" },
    });

    assert.equal(result.status, 1);
    assert.equal(existsSync(join(workspace, "artifacts", "release", "evidence-bundle.json")), true);
    assert.equal(existsSync(join(workspace, "artifacts", "release", "evidence-bundle.sig")), false);

    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "fail");
    assert.equal(summary.signingKeyConfigured, false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("create and verify release evidence bundle require complete reports and a real signing key", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-evidence-bundle-signed-"));
  const signingKey = "release-signing-key-for-test";
  try {
    seedRequiredReports(workspace);
    const create = spawnSync(process.execPath, [createScript], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, AA_RELEASE_SIGNING_KEY: signingKey },
    });
    assert.equal(create.status, 0, create.stderr);

    const createSummary = JSON.parse(create.stdout);
    assert.equal(createSummary.status, "pass");
    assert.equal(createSummary.missingReportCount, 0);
    assert.equal(createSummary.signingKeyConfigured, true);

    const verify = spawnSync(process.execPath, [verifyScript], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, AA_RELEASE_SIGNING_KEY: signingKey },
    });
    assert.equal(verify.status, 0, verify.stderr);

    const verifySummary = JSON.parse(verify.stdout);
    assert.equal(verifySummary.status, "pass");
    assert.deepEqual(verifySummary.missingReports, []);
    assert.deepEqual(verifySummary.reportIntegrityFailures, []);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("verify-release-evidence-bundle fails when required reports are missing from the bundle", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-evidence-bundle-missing-report-"));
  const signingKey = "release-signing-key-for-test";
  try {
    seedRequiredReports(workspace);
    rmSync(join(workspace, "artifacts", "assurance", "redteam-report.json"), { force: true });

    const create = spawnSync(process.execPath, [createScript], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, AA_RELEASE_SIGNING_KEY: signingKey },
    });
    assert.equal(create.status, 1);

    const verify = spawnSync(process.execPath, [verifyScript], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, AA_RELEASE_SIGNING_KEY: signingKey },
    });
    assert.equal(verify.status, 1);

    const verifySummary = JSON.parse(verify.stdout);
    assert.equal(verifySummary.status, "fail");
    assert.deepEqual(verifySummary.missingReports, ["artifacts/assurance/redteam-report.json"]);

    const bundle = JSON.parse(
      readFileSync(join(workspace, "artifacts", "release", "evidence-bundle.json"), "utf8"),
    );
    const redteamEntry = bundle.includedReports.find(
      (entry: { path: string }) => entry.path === "artifacts/assurance/redteam-report.json",
    );
    assert.equal(redteamEntry.present, false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
