/**
 * @issue  ASSURANCE-ASSUMPTION-EXPIRY-001
 * @invariant INV-AUDIT-ASSUMPTION-EXPIRY-001
 * @gate   assurance:assumptions:tick
 * @severity P1
 *
 * Self-test for scripts/assurance/promote-expired-assumptions.mjs.
 *
 * Methodology (per §27.2 of the audit methodology reference):
 *   1. positive seed: expired + unverified assumption MUST be promoted
 *   2. negative seed: future-dated unverified assumption MUST NOT be promoted
 *   3. evasion seed:  expired but already verified assumption MUST NOT be
 *      promoted (status-bypass guard)
 *
 * The seed inputs live under
 *   tests/fixtures/seeded-defects/assumption-promotion/{positive,negative,evasion}/
 * and are pointed at the script via the --assumptions-file / --issues-file
 * / --report-json / --report-md flags, so the test does not touch the
 * repository's actual artifacts/assurance/* files.
 */
import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const fixtureRoot = join(repoRoot, "tests", "fixtures", "seeded-defects", "assumption-promotion");
const scriptPath = join(repoRoot, "scripts", "assurance", "promote-expired-assumptions.mjs");

/**
 * @typedef {Object} PromotionReport
 * @property {string} generatedAt
 * @property {string} now
 * @property {string} assumptionsFile
 * @property {string} issuesFile
 * @property {Array<{ assumptionId: string; issueId: string; sourceRef: string; expiry: string; severity: string }>} promoted
 * @property {Array<{ assumptionId: string; reason: string; expiry?: string; status?: string }>} skipped
 * @property {Array<{ assumptionId: string | null; message: string }>} errors
 * @property {{ promoted: number; skipped: number; errors: number }} counts
 */

/**
 * Run the promote CLI against the supplied fixture dir and return the parsed
 * report. The CLI writes its report and updated inputs into a fresh tmp dir
 * so the repo's real artifacts/assurance/* is never touched.
 *
 * @param {string} fixtureName  "positive" | "negative" | "evasion"
 * @returns {{ report: PromotionReport; tmpDir: string; issueId: string | null }}
 */
function runPromote(fixtureName) {
  const srcAssumptions = join(fixtureRoot, fixtureName, "assumptions.jsonl");
  const srcIssues = join(fixtureRoot, fixtureName, "issues.deduped.jsonl");

  assert.ok(existsSync(srcAssumptions), `missing fixture: ${srcAssumptions}`);
  assert.ok(existsSync(srcIssues), `missing fixture: ${srcIssues}`);

  const tmpDir = mkdtempSync(join(tmpdir(), `aa-promote-${fixtureName}-`));
  const tmpAssumptions = join(tmpDir, "assumptions.jsonl");
  const tmpIssues = join(tmpDir, "issues.deduped.jsonl");
  const tmpReportJson = join(tmpDir, "report.json");
  const tmpReportMd = join(tmpDir, "report.md");

  copyFileSync(srcAssumptions, tmpAssumptions);
  copyFileSync(srcIssues, tmpIssues);

  execFileSync(
    "node",
    [
      scriptPath,
      "--assumptions-file",
      tmpAssumptions,
      "--issues-file",
      tmpIssues,
      "--report-json",
      tmpReportJson,
      "--report-md",
      tmpReportMd,
      "--now",
      "2026-06-02",
    ],
    { cwd: repoRoot, stdio: "pipe", encoding: "utf8" },
  );

  const report = JSON.parse(readFileSync(tmpReportJson, "utf8"));
  const issueId = report.promoted.length === 1 ? report.promoted[0].issueId : null;
  return { report, tmpDir, issueId };
}

/**
 * @param {string} tmpDir
 */
function readAssumptionsAfter(tmpDir) {
  const text = readFileSync(join(tmpDir, "assumptions.jsonl"), "utf8");
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

/**
 * @param {string} tmpDir
 */
function readIssuesAfter(tmpDir) {
  const text = readFileSync(join(tmpDir, "issues.deduped.jsonl"), "utf8");
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

const keptTmpDirs = [];
function trackTmp(dir) {
  keptTmpDirs.push(dir);
  return dir;
}
after(() => {
  for (const d of keptTmpDirs) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

describe("assurance: promote-expired-assumptions self-test", () => {
  before(() => {
    assert.ok(existsSync(scriptPath), `script missing: ${scriptPath}`);
    assert.ok(existsSync(fixtureRoot), `fixture dir missing: ${fixtureRoot}`);
  });

  it("positive: expired + unverified assumption is promoted and the source row is marked expired", () => {
    const { report, tmpDir, issueId } = runPromote("positive");
    trackTmp(tmpDir);

    assert.equal(report.counts.promoted, 1, `expected 1 promotion, got ${report.counts.promoted}`);
    assert.equal(report.counts.errors, 0, `unexpected errors: ${JSON.stringify(report.errors)}`);
    assert.ok(issueId, "promoted entry missing issueId");
    assert.match(issueId, /^AAS-ISSUE-\d{6,}$/, `unexpected issueId format: ${issueId}`);

    // Linked back to the assumption via linkedPromiseIds.
    const issues = readIssuesAfter(tmpDir);
    const issue = issues.find((i) => i.issueId === issueId);
    assert.ok(issue, "promoted issue not present in issues.deduped.jsonl");
    assert.equal(issue.source, "audit");
    assert.equal(issue.category, "audit.assumption-expired");
    assert.equal(issue.severity, "P1");
    assert.equal(issue.status, "open");
    assert.ok(
      Array.isArray(issue.linkedPromiseIds) && issue.linkedPromiseIds.includes("AAS-ASSUMPTION-EXPIRED-000001"),
      `linkedPromiseIds missing assumption id: ${JSON.stringify(issue.linkedPromiseIds)}`,
    );

    // Source assumption has been marked expired in-place.
    const assumptions = readAssumptionsAfter(tmpDir);
    assert.equal(assumptions.length, 1);
    assert.equal(assumptions[0].assumptionId, "AAS-ASSUMPTION-EXPIRED-000001");
    assert.equal(assumptions[0].status, "expired");
  });

  it("negative: future-dated unverified assumption is NOT promoted", () => {
    const { report, tmpDir } = runPromote("negative");
    trackTmp(tmpDir);

    assert.equal(report.counts.promoted, 0, `expected 0 promotions, got ${report.counts.promoted}`);
    assert.equal(report.counts.errors, 0, `unexpected errors: ${JSON.stringify(report.errors)}`);
    assert.equal(report.counts.skipped, 1);
    assert.equal(report.skipped[0].assumptionId, "AAS-ASSUMPTION-FUTURE-000001");
    assert.equal(report.skipped[0].reason, "not-yet-due");

    // No new issues and assumption status untouched.
    const issues = readIssuesAfter(tmpDir);
    assert.equal(issues.length, 0, "issues.deduped.jsonl should remain empty");
    const assumptions = readAssumptionsAfter(tmpDir);
    assert.equal(assumptions.length, 1);
    assert.equal(assumptions[0].status, "unverified");
  });

  it("evasion: expired but already verified assumption is NOT promoted (status bypass)", () => {
    const { report, tmpDir } = runPromote("evasion");
    trackTmp(tmpDir);

    assert.equal(report.counts.promoted, 0, `expected 0 promotions, got ${report.counts.promoted}`);
    assert.equal(report.counts.errors, 0, `unexpected errors: ${JSON.stringify(report.errors)}`);
    assert.equal(report.counts.skipped, 1);
    assert.equal(report.skipped[0].assumptionId, "AAS-ASSUMPTION-VERIFIED-000001");
    assert.match(
      String(report.skipped[0].reason),
      /^status-bypass:/,
      `expected status-bypass reason, got ${report.skipped[0].reason}`,
    );

    const issues = readIssuesAfter(tmpDir);
    assert.equal(issues.length, 0, "issues.deduped.jsonl should remain empty");
    const assumptions = readAssumptionsAfter(tmpDir);
    assert.equal(assumptions.length, 1);
    // Verified status is preserved (not downgraded to expired) because the
    // promotion pipeline only acts on unverified entries.
    assert.equal(assumptions[0].status, "verified");
  });

  it("re-running promote on the same expired assumption is a no-op (idempotent)", () => {
    // 1st run promotes the row.
    const first = runPromote("positive");
    trackTmp(first.tmpDir);
    assert.equal(first.report.counts.promoted, 1);

    // 2nd run on the same tmp dir must NOT promote again.
    const second = execFileSync(
      "node",
      [
        scriptPath,
        "--assumptions-file",
        join(first.tmpDir, "assumptions.jsonl"),
        "--issues-file",
        join(first.tmpDir, "issues.deduped.jsonl"),
        "--report-json",
        join(first.tmpDir, "report-2.json"),
        "--report-md",
        join(first.tmpDir, "report-2.md"),
        "--now",
        "2026-06-02",
      ],
      { cwd: repoRoot, stdio: "pipe", encoding: "utf8" },
    );
    const report2 = JSON.parse(readFileSync(join(first.tmpDir, "report-2.json"), "utf8"));
    assert.equal(report2.counts.promoted, 0, "2nd run must not re-promote the same assumption");
    assert.equal(report2.counts.skipped, 1);
    assert.match(
      String(report2.skipped[0].reason),
      /^already-promoted:/,
      `expected already-promoted reason, got ${report2.skipped[0].reason}`,
    );
    void second;
  });

  it("empty ledger is a no-op tick (no errors, exit code 0)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "aa-promote-empty-"));
    trackTmp(tmpDir);
    writeFileSync(join(tmpDir, "assumptions.jsonl"), "", "utf8");
    writeFileSync(join(tmpDir, "issues.deduped.jsonl"), "", "utf8");
    mkdirSync(join(tmpDir, "out"), { recursive: true });

    const out = execFileSync(
      "node",
      [
        scriptPath,
        "--assumptions-file",
        join(tmpDir, "assumptions.jsonl"),
        "--issues-file",
        join(tmpDir, "issues.deduped.jsonl"),
        "--report-json",
        join(tmpDir, "out", "report.json"),
        "--report-md",
        join(tmpDir, "out", "report.md"),
        "--now",
        "2026-06-02",
      ],
      { cwd: repoRoot, stdio: "pipe", encoding: "utf8" },
    );
    const report = JSON.parse(readFileSync(join(tmpDir, "out", "report.json"), "utf8"));
    assert.equal(report.counts.promoted, 0);
    assert.equal(report.counts.skipped, 0);
    assert.equal(report.counts.errors, 0);
    void out;
  });
});
