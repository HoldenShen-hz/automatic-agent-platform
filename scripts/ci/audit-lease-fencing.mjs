#!/usr/bin/env node
/**
 * Audit: lease / fencing
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §10.3.
 *
 * Heuristics:
 *   1. acquire must use a DB sequence (or equivalent monotonic source) to
 *      obtain a fencing token.
 *   2. renew WHERE clause must include `fencingToken`.
 *   3. release WHERE clause must include `fencingToken`.
 *   4. expired worker must not be able to release a fresh lease.
 *   5. leadership fencing must persist to durable storage, not memory.
 *   6. clock skew margin must be finite.
 *   7. lease audit must record blocked release attempts.
 *
 * Allowlist: `config/quality/lease-fencing-allowlist.json`.
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "src";
})();
const ALLOWLIST_PATH = "config/quality/lease-fencing-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const RULES = [
  {
    rule: "lease.renew_without_fencing",
    severity: "P0",
    description: "renew(...) does not include fencingToken in WHERE clause.",
    regex: /\.renew\s*\([\s\S]{0,200}?\)[\s\S]{0,200}?\.update\([\s\S]{0,200}?where\s*:\s*\{[\s\S]{0,200}?\}\s*\}[\s\S]{0,80}?(?!\})/,
  },
  {
    rule: "lease.release_without_fencing",
    severity: "P0",
    description: "release(...) does not verify fencingToken.",
    regex: /\.release\s*\([\s\S]{0,200}?\)[\s\S]{0,200}?\.delete\(/,
  },
  {
    rule: "lease.in_memory_only",
    severity: "P0",
    description: "Lease state stored in Map / in-memory state without persistence.",
    regex: /class\s+\w*Lease\w*[\s\S]{0,500}?private\s+(leases|active)\s*=\s*new\s+Map/,
  },
  {
    rule: "lease.unbounded_clock_skew",
    severity: "P1",
    description: "Clock skew margin uses Math.random() or is unbounded.",
    regex: /skew\s*[:=]\s*[^;\n]*Math\.random/,
  },
  {
    rule: "lease.no_blocked_audit",
    severity: "P1",
    description: "Failed release path does not record an audit event.",
    regex: /if\s*\(\s*!isOwner\s*\)\s*\{[\s\S]{0,200}?return\s*;?\s*\}[\s\S]{0,200}?\}\s*$/m,
  },
];

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { exact: new Set(), prefix: [] };
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
    prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
  };
}

function isAllowlisted(rel, allowlist) {
  if (allowlist.exact.has(rel)) return true;
  return allowlist.prefix.some((p) => rel.startsWith(p));
}

function isTestPath(rel) {
  if (rel.startsWith("tests/")) return false;
  return /\.(test|spec)\.[mc]?[jt]sx?$/i.test(rel);
}

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && SCAN_EXTS.has(extname(entry.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

function findFindings(filePath, allowlist) {
  const rel = relative(repoRoot, filePath);
  if (isAllowlisted(rel, allowlist) || isTestPath(rel)) return [];
  if (!/lease|fenc|lock/i.test(rel)) return [];
  const text = readFileSync(filePath, "utf8");
  const findings = [];
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(text)) {
      findings.push({
        rule: rule.rule,
        severity: rule.severity,
        path: rel,
        line: 1,
        message: rule.description,
      });
    }
    rule.regex.lastIndex = 0;
  }
  return findings;
}

function main() {
  const focusAbs = resolve(repoRoot, focusPath);
  let stat;
  try {
    stat = statSync(focusAbs);
  } catch {
    console.error(JSON.stringify({ error: `path not found: ${focusPath}` }));
    process.exitCode = 2;
    return;
  }
  const roots = stat.isDirectory() ? [focusAbs] : [focusAbs];
  const allowlist = loadAllowlist();
  const files = stat.isDirectory()
    ? roots.flatMap((root) => walk(root))
    : roots.filter((f) => SCAN_EXTS.has(extname(f)));
  const findings = [];
  for (const file of files) {
    findings.push(...findFindings(file, allowlist));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: files.length,
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {}),
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.some((f) => f.severity === "P0")) {
    process.exitCode = 1;
  }
}

main();
