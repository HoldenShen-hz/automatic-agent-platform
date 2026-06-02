#!/usr/bin/env node
/**
 * Audit: determinism
 *
 * Scans src/ for non-deterministic primitives (Date.now / Math.random /
 * new Date() / crypto.randomBytes) used outside of test files.
 *
 * The hard rule from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §20.6.2:
 *   - "Date.now / Math.random / new Date" must never appear in business
 *     code that influences an ID / hash / event timestamp / report path.
 *
 * Allowlist:
 *   - tests/ and any `*.test.ts` / `*.spec.ts` file is exempt
 *   - scripts/ is exempt (scripts may intentionally use the wall clock)
 *   - explicit allowlist via config/quality/determinism-allowlist.json
 *
 * Output: JSON to stdout with `findings[]`.
 * Exit code: 1 if any P0 finding, else 0 (or no --check mode).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "src";
})();

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const ALLOWLIST_PATH = "config/quality/determinism-allowlist.json";
const TEST_FILE_REGEX = /\.(test|spec)\.[mc]?[jt]sx?$/i;

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { exact: new Set(), prefix: [] };
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  const exact = new Set(Array.isArray(raw.exact) ? raw.exact : []);
  const prefix = Array.isArray(raw.prefix) ? raw.prefix : [];
  return { exact, prefix };
}

function isAllowlisted(rel, allowlist) {
  if (allowlist.exact.has(rel)) return true;
  return allowlist.prefix.some((p) => rel.startsWith(p));
}

function isTestPath(rel) {
  // tests/fixtures/seeded-defects/ and tests/fixtures/migration/ are NOT exempt
  // because the audit must be able to scan seeded-defect fixtures.
  if (rel.startsWith("tests/")) {
    if (rel.startsWith("tests/fixtures/")) return false;
    return true;
  }
  return TEST_FILE_REGEX.test(rel);
}

function isSeedInjection(text, varName) {
  // Heuristic: when Math.random is the default but a seed override exists,
  // the call site is OK. We look for the pattern `varName = <seed>` near
  // the call (within ~5 lines).
  return new RegExp(`${varName}\\s*=\\s*seed`, "i").test(text);
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

const PATTERNS = [
  {
    rule: "determinism.date_now",
    severity: "P0",
    regex: /\bDate\s*\.\s*now\s*\(/g,
    message: "Date.now() is non-deterministic; use a Clock injected from above.",
  },
  {
    rule: "determinism.math_random",
    severity: "P0",
    regex: /\bMath\s*\.\s*random\s*\(/g,
    message: "Math.random() is non-deterministic; inject a PRNG or a seed-aware Random.",
  },
  {
    rule: "determinism.new_date_no_arg",
    severity: "P0",
    regex: /\bnew\s+Date\s*\(\s*\)/g,
    message: "new Date() with no argument reads the wall clock; use a Clock.",
  },
  {
    rule: "determinism.random_bytes_module_level",
    severity: "P1",
    regex: /randomBytes\s*\(\s*\d+\s*\)/g,
    message: "randomBytes() used at runtime; module-level secret gen must come from a SecretProvider.",
  },
];

function findFindings(filePath, allowlist) {
  const rel = relative(repoRoot, filePath);
  if (isTestPath(rel) || isAllowlisted(rel, allowlist)) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (/^\s*(\/\/|[*\/])/.test(line)) continue;
      if (pattern.regex.test(line)) {
        findings.push({
          rule: pattern.rule,
          severity: pattern.severity,
          path: rel,
          line: i + 1,
          message: pattern.message,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
      pattern.regex.lastIndex = 0;
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
  // When the focus path is a single file, return it directly.
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
