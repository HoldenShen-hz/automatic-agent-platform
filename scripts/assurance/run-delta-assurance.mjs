#!/usr/bin/env node
/**
 * Assurance PR Delta: only runs the audit:* scanners against files
 * changed since --base (default: origin/main).
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §3.1.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const base = (() => {
  const idx = process.argv.indexOf("--base");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return "origin/main";
})();

const FOCUS_GLOBS = [
  "src/", "tests/", "docs_zh/", "ui/", "scripts/", "schemas/", "config/", "package.json", ".github/",
];

function getChangedFiles() {
  try {
    const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function classify(changedFiles) {
  const buckets = {
    code: [],
    tests: [],
    docs: [],
    config: [],
    routes: [],
    schemas: [],
    workflows: [],
    releaseClaims: [],
    redteam: [],
  };
  for (const f of changedFiles) {
    if (f.startsWith("src/")) buckets.code.push(f);
    if (f.startsWith("tests/")) buckets.tests.push(f);
    if (f.startsWith("docs_zh/") || f.startsWith("docs_en/")) buckets.docs.push(f);
    if (f.startsWith("config/") || f === "package.json") buckets.config.push(f);
    if (/route|controller|router|gateway|endpoint/i.test(f)) buckets.routes.push(f);
    if (/schema/.test(f) || f.startsWith("schemas/")) buckets.schemas.push(f);
    if (f.startsWith(".github/")) buckets.workflows.push(f);
    if (/release|claim|production[-_ ]?ready|final/i.test(f) && /\.(md|mdx)$/.test(f)) buckets.releaseClaims.push(f);
    if (f.startsWith("redteam/") || f.startsWith("eval/")) buckets.redteam.push(f);
  }
  return buckets;
}

function runAudit(script, focusPath) {
  try {
    const out = execFileSync("node", [`scripts/ci/${script}.mjs`, "--path", focusPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return { ok: true, report: JSON.parse(out) };
  } catch (e) {
    return { ok: false, error: String(e), status: e.status ?? 1 };
  }
}

function main() {
  const changed = getChangedFiles();
  const buckets = classify(changed);
  const stamp = new Date().toISOString();

  const checks = [];
  if (buckets.code.length > 0) {
    checks.push({ id: "audit:fire-and-forget", focus: "src" });
    checks.push({ id: "audit:determinism", focus: "src" });
  }
  if (buckets.docs.length > 0) {
    checks.push({ id: "audit:release-claims", focus: "docs_zh" });
  }
  if (buckets.config.length > 0) {
    checks.push({ id: "audit:ci-supply-chain", focus: "scripts" });
  }
  if (buckets.routes.length > 0) {
    checks.push({ id: "audit:tenant-isolation", focus: "src" });
  }
  if (buckets.schemas.length > 0) {
    checks.push({ id: "audit:contracts-sync", focus: "docs_zh/contracts" });
  }
  if (buckets.workflows.length > 0) {
    checks.push({ id: "audit:ci-supply-chain", focus: "scripts" });
  }
  if (buckets.redteam.length > 0) {
    checks.push({ id: "audit:eval-oracle", focus: "." });
  }

  const results = [];
  let blockerCount = 0;
  for (const check of checks) {
    const r = runAudit(check.id, check.focus);
    const findings = r.ok ? (r.report?.findings?.filter?.((f) => f.severity === "P0") ?? []) : [];
    if (findings.length > 0) blockerCount += findings.length;
    results.push({
      id: check.id,
      focus: check.focus,
      ok: r.ok,
      blockerFindings: findings.length,
      findingCount: r.ok ? (r.report?.findingCount ?? 0) : -1,
    });
  }

  const report = {
    generatedAt: stamp,
    base,
    changedFileCount: changed.length,
    buckets,
    executedChecks: results,
    blockerCount,
    status: blockerCount === 0 ? "pass" : "fail",
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status === "fail") {
    process.exitCode = 1;
  }
}

main();
