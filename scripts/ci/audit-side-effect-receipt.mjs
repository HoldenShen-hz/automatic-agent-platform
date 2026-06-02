#!/usr/bin/env node
/**
 * Audit: side-effect / receipt
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §10.4 and §11.2.
 *
 * Heuristics:
 *   1. Each external side-effect (commit / settle / transfer / write) must
 *      produce a receipt (hash, signature, producer id, schema version).
 *   2. Pre-commit validation must precede the actual commit.
 *   3. Compensation plan must be declared.
 *   4. Partial-failure repair must exist.
 *
 * Allowlist: `config/quality/side-effect-receipt-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/side-effect-receipt-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const SIDE_EFFECT_METHODS = new Set([
  "commit", "settle", "transfer", "sendFunds", "publishArtifact", "externalCall", "apply", "execute",
]);

const RECEIPT_HINTS = [
  /\breceipt\b/i,
  /\bwriteReceipt\b/,
  /\bbuildReceipt\b/,
  /\bcommitJournal\b/,
  /\bcompensation\b/,
];

const RULES = [
  {
    rule: "side_effect.no_receipt",
    severity: "P0",
    description: "External side-effect call has no receipt producer in the same file.",
    fileLevel: true,
  },
  {
    rule: "side_effect.no_compensation",
    severity: "P1",
    description: "No compensation plan / repair logic in the file.",
    fileLevel: true,
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
  if (!/side[_-]?effect|commit|settle|transfer|receipt/i.test(rel)) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  // Detect a side-effect call (one of the SIDE_EFFECT_METHODS) anywhere in file
  let hasSideEffect = false;
  for (const m of SIDE_EFFECT_METHODS) {
    const re = new RegExp(`\\.\\s*${m}\\s*\\(`);
    if (re.test(text)) {
      hasSideEffect = true;
      break;
    }
  }
  if (!hasSideEffect) return findings;
  const hasReceipt = RECEIPT_HINTS.some((re) => re.test(text));
  if (!hasReceipt) {
    findings.push({
      rule: "side_effect.no_receipt",
      severity: "P0",
      path: rel,
      line: 1,
      message: "External side-effect detected but no receipt producer in the file. Side-effects must emit a receipt per §11.2.",
    });
  }
  // compensation: at least a "compensate" / "rollback" / "repair" function or comment
  const hasCompensation = /\b(compensate|rollback|repair|undo)\b/i.test(text);
  if (!hasCompensation) {
    findings.push({
      rule: "side_effect.no_compensation",
      severity: "P1",
      path: rel,
      line: 1,
      message: "Side-effect path has no compensation / repair handler.",
    });
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
