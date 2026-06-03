#!/usr/bin/env node
/**
 * Assurance PR Delta: only runs the audit:* scanners against files
 * changed since --base (default: origin/main).
 *
 * Per docs_zh/contracts/assurance-pipeline-contract.md §3.1.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const base = (() => {
  const idx = process.argv.indexOf("--base");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return "origin/main";
})();

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
  const scriptFile = script.startsWith("audit:") ? script.replace("audit:", "audit-") : script;
  try {
    const out = execFileSync("node", [`scripts/ci/${scriptFile}.mjs`, "--path", focusPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return { ok: true, report: JSON.parse(out) };
  } catch (e) {
    return { ok: false, error: String(e), status: e.status ?? 1 };
  }
}

function runNpmScript(scriptName) {
  try {
    execFileSync("npm", ["run", scriptName], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e), status: e.status ?? 1 };
  }
}

function addCheck(checks, check) {
  if (checks.some((entry) => entry.id === check.id)) {
    return;
  }
  checks.push(check);
}

function main() {
  const changed = getChangedFiles();
  const buckets = classify(changed);
  const stamp = new Date().toISOString();

  const checks = [];
  if (buckets.code.length > 0) {
    addCheck(checks, { id: "audit:fire-and-forget", kind: "audit", focus: "src" });
    addCheck(checks, { id: "audit:determinism", kind: "audit", focus: "src" });
  }
  if (buckets.docs.length > 0) {
    addCheck(checks, { id: "audit:docs-sync", kind: "audit", focus: "." });
    addCheck(checks, { id: "audit:leadership-claims", kind: "audit", focus: "." });
    addCheck(checks, { id: "audit:release-claims", kind: "audit", focus: "." });
  }
  if (buckets.config.length > 0) {
    addCheck(checks, { id: "audit:ci-supply-chain", kind: "audit", focus: "." });
  }
  if (buckets.routes.length > 0) {
    addCheck(checks, { id: "audit:tenant-isolation", kind: "audit", focus: "src" });
  }
  if (buckets.schemas.length > 0) {
    addCheck(checks, { id: "audit:contracts-sync", kind: "audit", focus: "." });
  }
  if (buckets.workflows.length > 0) {
    addCheck(checks, { id: "audit:ci-supply-chain", kind: "audit", focus: "." });
    addCheck(checks, { id: "audit:leadership-claims", kind: "audit", focus: "." });
  }
  if (buckets.redteam.length > 0) {
    addCheck(checks, { id: "audit:eval-oracle", kind: "audit", focus: "." });
  }
  if (buckets.tests.length > 0) {
    addCheck(checks, { id: "test:unit", kind: "npm" });
    addCheck(checks, { id: "test:invariants", kind: "npm" });
  }

  const results = [];
  let blockerCount = 0;
  for (const check of checks) {
    if (check.kind === "npm") {
      const r = runNpmScript(check.id);
      if (!r.ok) {
        blockerCount += 1;
      }
      results.push({
        id: check.id,
        kind: check.kind,
        ok: r.ok,
        blockerFindings: 0,
        findingCount: 0,
        exitStatus: r.ok ? 0 : (r.status ?? 1),
      });
      continue;
    }

    const r = runAudit(check.id, check.focus);
    const findings = r.ok ? (r.report?.findings?.filter?.((f) => f.severity === "P0") ?? []) : [];
    if (!r.ok || findings.length > 0) {
      blockerCount += Math.max(findings.length, 1);
    }
    results.push({
      id: check.id,
      kind: check.kind,
      focus: check.focus,
      ok: r.ok,
      blockerFindings: findings.length,
      findingCount: r.ok ? (r.report?.findingCount ?? 0) : -1,
      exitStatus: r.ok ? 0 : (r.status ?? 1),
    });
  }

  const report = {
    generatedAt: stamp,
    mode: "delta",
    base,
    changedFileCount: changed.length,
    changedFiles: changed,
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
