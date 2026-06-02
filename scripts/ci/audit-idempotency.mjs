#!/usr/bin/env node
/**
 * Audit: idempotency
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §10.1.
 *
 * Heuristics:
 *   1. Writes through enqueue / commit / record / publish / append / save
 *      must include an `idempotencyKey` / `dedupeKey` / `idempotency_key`
 *      identifier either inline or via a `withIdempotencyKey(...)` wrapper.
 *   2. Response body fallback (returning a cached 2xx when the underlying
 *      call fails) is forbidden.
 *   3. Large response bodies must not be stored alongside the key.
 *   4. 5xx responses must not be cached.
 *
 * Allowlist: `config/quality/idempotency-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/idempotency-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const WRITE_METHODS = new Set([
  "enqueue", "commit", "publish", "emit", "append", "save", "record", "write", "submit", "settle", "dispatch", "capture",
]);

const IDEMPOTENCY_HINTS = [
  /\bidempotencyKey\b/,
  /\bidempotency_key\b/,
  /\bdedupeKey\b/,
  /\bdedupe_key\b/,
  /\bwithIdempotencyKey\b/,
  /\bidempotencyToken\b/,
];

const FORBIDDEN_PATTERNS = [
  {
    rule: "idempotency.response_cache_on_5xx",
    severity: "P0",
    description: "5xx response must not be cached into the idempotency key store.",
    regex: /cacheIdempotent[\s\S]{0,200}?(?:status\s*>=?\s*500|statusCode\s*>=?\s*500)/,
  },
  {
    rule: "idempotency.body_fallback_on_failure",
    severity: "P0",
    description: "Returning a cached body when the underlying call failed.",
    regex: /if\s*\(\s*!response\.ok\s*\)\s*\{[\s\S]{0,200}?return\s+cached/,
  },
  {
    rule: "idempotency.large_response_stored",
    severity: "P0",
    description: "Storing large response body in idempotency cache.",
    regex: /idempotencyCache\.set\([^)]*response\.body[\s\S]{0,200}?\)/,
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
  if (rel.startsWith("tests/")) return false; // we want to scan fixtures
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
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  const hasIdempotency = IDEMPOTENCY_HINTS.some((re) => re.test(text));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/)/.test(line)) continue;
    // 1. forbidden patterns
    for (const p of FORBIDDEN_PATTERNS) {
      p.regex.lastIndex = 0;
      // multiline; need to look at a window
      const window = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join("\n");
      if (p.regex.test(window)) {
        findings.push({
          rule: p.rule,
          severity: p.severity,
          path: rel,
          line: i + 1,
          message: p.description,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
      p.regex.lastIndex = 0;
    }
    // 2. write call without idempotency key
    for (const m of WRITE_METHODS) {
      const re = new RegExp(`\\.\\s*${m}\\s*\\(`);
      re.lastIndex = 0;
      if (!re.test(line)) continue;
      // Skip if the line mentions idempotency key
      if (hasIdempotency) continue;
      // Skip if the call is inside a `withIdempotencyKey(` wrapper (already covered)
      const ctx = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
      if (/withIdempotencyKey|withIdempotency|dedupeKey|idempotencyKey/.test(ctx)) continue;
      findings.push({
        rule: "idempotency.missing_key",
        severity: "P0",
        path: rel,
        line: i + 1,
        message: `Write call '.${m}(...)' must include an idempotency key.`,
        snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
      });
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
