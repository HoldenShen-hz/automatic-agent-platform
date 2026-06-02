#!/usr/bin/env node
/**
 * Audit: queue
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §10.2.
 *
 * Heuristics:
 *   1. enqueue must be atomic (single-statement INSERT or SETNX, not
 *      read-then-write).
 *   2. dequeue must respect visibility timeout (the worker fetches a
 *      record whose `visibleAt` is now/past).
 *   3. ack/nack state transitions must be limited to a closed enum.
 *   4. retry backoff cap must be finite (not Math.random()).
 *   5. DLQ dedupe key must be present.
 *   6. Redis Lua / SQLite transaction boundary must enclose enqueue.
 *
 * Allowlist: `config/quality/queue-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/queue-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const RULES = [
  {
    rule: "queue.enqueue_non_atomic",
    severity: "P0",
    description: "Enqueue performs a non-atomic check-then-insert.",
    regex: /if\s*\(\s*!\s*(?:already|exists|has)\s*\)\s*\{[\s\S]{0,200}?\.enqueue\s*\(/,
  },
  {
    rule: "queue.dequeue_ignores_visibility",
    severity: "P0",
    description: "Dequeue does not filter by visibility timestamp.",
    regex: /\.dequeue\s*\([\s\S]{0,200}?\)\s*\{[\s\S]{0,200}?(?!\.where\(\{\s*visibleAt)/,
  },
  {
    rule: "queue.ack_nack_state_unbounded",
    severity: "P1",
    description: "ack/nack accepts free-form string state instead of enum.",
    regex: /\.ack\(\s*['"]?[a-zA-Z_-]+['"]?\s*,/,
  },
  {
    rule: "queue.retry_backoff_random",
    severity: "P0",
    description: "Retry backoff uses Math.random() and is not deterministic.",
    regex: /(?:retry|backoff)\s*[:=]\s*[^;\n]*Math\.random/,
  },
  {
    rule: "queue.dlq_no_dedupe",
    severity: "P1",
    description: "DLQ insert missing dedupe key.",
    regex: /\.dlq\(\s*\{[^}]*\}/,
  },
  {
    rule: "queue.no_lua_or_transaction",
    severity: "P2",
    description: "Redis enqueue without Lua / SQLite without transaction.",
    regex: /redis\.set\s*\([\s\S]{0,200}?\)[\s\S]{0,200}?(?!\.eval|beginTransaction)/,
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
  if (!/queue|enqueue|dequeue|dlq|worker/i.test(rel)) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/)/.test(line)) continue;
    const window = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 5)).join("\n");
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(window)) {
        findings.push({
          rule: rule.rule,
          severity: rule.severity,
          path: rel,
          line: i + 1,
          message: rule.description,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
        rule.regex.lastIndex = 0;
      }
    }
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
