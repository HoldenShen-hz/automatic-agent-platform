#!/usr/bin/env node
/**
 * Evidence bundle creator
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §5.
 * Bundles all assurance artifacts into a single signed manifest.
 */
import { createHash, createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(process.cwd());
const outputDir = join(repoRoot, "artifacts", "release");
const assuranceDir = join(repoRoot, "artifacts", "assurance");
const scriptPath = fileURLToPath(import.meta.url);

export const INCLUDED = [
  "artifacts/release/rc-check-report.json",
  "artifacts/assurance/audit-coverage-scorecard.json",
  "artifacts/assurance/invariant-test-report.json",
  "artifacts/assurance/chaos-test-report.json",
  "artifacts/assurance/audit-tool-test-report.json",
  "artifacts/assurance/eval-oracle-report.json",
  "artifacts/assurance/redteam-report.json",
  "artifacts/assurance/golden-replay-report.json",
  "artifacts/assurance/review-ledger.normalized.jsonl",
  "artifacts/assurance/review-evidence-readiness-report.json",
  "artifacts/assurance/historical-promises.jsonl",
  "artifacts/assurance/assumptions.jsonl",
  "artifacts/assurance/issues.deduped.jsonl",
  "artifacts/assurance/test-to-issue-map.json",
  "artifacts/assurance/issue-to-test-map.json",
  "artifacts/assurance/test-coverage-report.json",
  "artifacts/assurance/historical-issue-regression-map.json",
  "artifacts/assurance/completeness-coverage-matrix.json",
  "artifacts/assurance/seeded-defect-report.json",
  "artifacts/assurance/assurance-full-report.json",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data).digest("hex");
}

function getReleaseSigningKey() {
  const key = process.env.AA_RELEASE_SIGNING_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function getCommitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString();

  const reportFiles = INCLUDED.map((rel) => {
    const abs = join(repoRoot, rel);
    return {
      path: rel,
      present: existsSync(abs),
      sha256: existsSync(abs) ? sha256(abs) : null,
      sizeBytes: existsSync(abs) ? readFileSync(abs).length : 0,
    };
  });
  const missingReports = reportFiles.filter((report) => !report.present).map((report) => report.path);

  const bundle = {
    schemaVersion: "1.0",
    generatedAt: stamp,
    commitSha: getCommitSha(),
    branch: getBranch(),
    configVersion: "1.0",
    contractSchemaVersion: "1.0",
    eventRegistryHash: "n/a",
    validationRunId: `rc-${Date.now()}`,
    includedReports: reportFiles,
  };

  const bundleJson = JSON.stringify(bundle, null, 2);
  writeFileSync(join(outputDir, "evidence-bundle.json"), `${bundleJson}\n`);

  const signingKey = getReleaseSigningKey();
  if (signingKey != null) {
    const sig = hmacSha256(signingKey, bundleJson);
    writeFileSync(join(outputDir, "evidence-bundle.sig"), `${sig}  evidence-bundle.json\n`);
  }

  const summary = {
    generatedAt: stamp,
    status: signingKey != null && missingReports.length === 0 ? "pass" : "fail",
    bundlePath: "artifacts/release/evidence-bundle.json",
    sigPath: signingKey != null ? "artifacts/release/evidence-bundle.sig" : null,
    includedReportCount: reportFiles.filter((r) => r.present).length,
    missingReportCount: missingReports.length,
    missingReports,
    signingKeyConfigured: signingKey != null,
    commitSha: bundle.commitSha,
    branch: bundle.branch,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (missingReports.length > 0) {
    process.stderr.write(`error: ${missingReports.length} required report(s) missing from bundle\n`);
  }
  if (signingKey == null) {
    process.stderr.write("error: AA_RELEASE_SIGNING_KEY is required to sign the release evidence bundle\n");
  }
  if (summary.status !== "pass") {
    process.exitCode = 1;
  }
}

if (process.argv[1] != null && resolve(process.argv[1]).replaceAll("\\", "/") === scriptPath.replaceAll("\\", "/")) {
  main();
}
