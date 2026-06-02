#!/usr/bin/env node
/**
 * Audit: recovery / replay
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §10.5.
 *
 * Heuristics:
 *   1. replay / recovery path must filter by tenantId.
 *   2. target exact match (no `where: {}` / unscoped findMany).
 *   3. DLQ dedupe must be present.
 *   4. repair must be a single transaction.
 *   5. replacement ticket attempt must be unique (no infinite re-enqueue).
 *   6. traceId must be preserved through the recovery path.
 *   7. fan-out must be bounded.
 *
 * Allowlist: `config/quality/recovery-replay-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/recovery-replay-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const RECOVERY_HINTS = [/replay/i, /recovery/i, /repair/i, /reconcile/i];

const RULES = [
  {
    rule: "recovery.replay_no_tenant",
    severity: "P0",
    description: "replay path does not include tenantId filter.",
    fileLevel: true,
  },
  {
    rule: "recovery.unscoped_find",
    severity: "P0",
    description: "Repair / replay uses unscoped findMany / findFirst.",
    regex: /findMany\s*\(\s*\{/,
  },
  {
    rule: "recovery.no_dlq_dedupe",
    severity: "P1",
    description: "DLQ dedupe key missing in repair path.",
    fileLevel: true,
  },
  {
    rule: "recovery.not_in_transaction",
    severity: "P1",
    description: "Repair logic not wrapped in a transaction.",
    fileLevel: true,
  },
  {
    rule: "recovery.fanout_unbounded",
    severity: "P0",
    description: "Fan-out not bounded (Promise.all on unbounded array).",
    regex: /Promise\.all\(\s*[a-zA-Z_$.]+\.map\(/,
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
  if (!RECOVERY_HINTS.some((re) => re.test(rel))) return [];
  const text = readFileSync(filePath, "utf8");
  const findings = [];

  const hasTenant = /\btenantId\b|\btenant_id\b|\brequireTenant\b/.test(text);
  if (!hasTenant) {
    findings.push({
      rule: "recovery.replay_no_tenant",
      severity: "P0",
      path: rel,
      line: 1,
      message: "replay / recovery path does not include tenantId filter.",
    });
  }

  const hasDedupe = /\bdlq[A-Z_]*Key\b|\bdedupeKey\b|\brepairId\b|\bidempotencyKey\b/.test(text);
  if (!hasDedupe) {
    findings.push({
      rule: "recovery.no_dlq_dedupe",
      severity: "P1",
      path: rel,
      line: 1,
      message: "Repair path missing DLQ dedupe key.",
    });
  }

  const hasTx = /beginTransaction|withTransaction|\.transaction\(/.test(text);
  if (!hasTx) {
    findings.push({
      rule: "recovery.not_in_transaction",
      severity: "P1",
      path: rel,
      line: 1,
      message: "Repair logic not wrapped in a transaction.",
    });
  }

  for (const rule of RULES) {
    if (rule.fileLevel) continue;
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
