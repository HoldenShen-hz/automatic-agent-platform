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

const repoRoot = resolve(process.cwd());
const outputDir = join(repoRoot, "artifacts", "release");
const assuranceDir = join(repoRoot, "artifacts", "assurance");

const INCLUDED = [
  "artifacts/release/rc-check-report.json",
  "artifacts/assurance/audit-coverage-scorecard.json",
  "artifacts/assurance/review-ledger.normalized.jsonl",
  "artifacts/assurance/historical-promises.jsonl",
  "artifacts/assurance/issues.deduped.jsonl",
  "artifacts/assurance/seeded-defect-report.json",
  "artifacts/assurance/assurance-full-report.json",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data).digest("hex");
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

  // Sign with HMAC-SHA256 if AA_RELEASE_SIGNING_KEY is set; otherwise
  // produce a placeholder sig so the artifact is well-formed.
  const key = process.env.AA_RELEASE_SIGNING_KEY ?? "unkeyed-v1-rc-check-placeholder";
  const sig = hmacSha256(key, bundleJson);
  writeFileSync(join(outputDir, "evidence-bundle.sig"), `${sig}  evidence-bundle.json\n`);

  const summary = {
    generatedAt: stamp,
    bundlePath: "artifacts/release/evidence-bundle.json",
    sigPath: "artifacts/release/evidence-bundle.sig",
    includedReportCount: reportFiles.filter((r) => r.present).length,
    missingReportCount: reportFiles.filter((r) => !r.present).length,
    commitSha: bundle.commitSha,
    branch: bundle.branch,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.missingReportCount > 0) {
    process.stderr.write(`warning: ${summary.missingReportCount} report(s) missing from bundle\n`);
  }
}

main();
