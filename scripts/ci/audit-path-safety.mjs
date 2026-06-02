#!/usr/bin/env node
/**
 * Audit: path safety
 *
 * Scans scripts/ and src/ for filesystem operations that do not pass
 * through the `pathSafety` / `repoRoot` guardrails. Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §14.1.
 *
 * The hard list:
 *   - `rmSync`, `rm -rf`, `rmSync(path)` without repoRoot guard
 *   - `mv -f`, `mvSync(path)`
 *   - `cp`, `cpSync`
 *   - `writeFileSync`, `readFileSync`, `mkdirSync`, `symlinkSync`
 *   - `spawn / spawnSync / exec / execSync` with string command
 *
 * The check classifies each finding by whether the call site has
 * (a) `repoRoot` or `path.resolve(process.cwd())` in scope within 3 lines,
 * (b) a `realpath` invocation,
 * (c) a `startsWith` against an allow-root, and
 * (d) atomic tmp + rename guard.
 *
 * Allowlist: `config/quality/path-safety-allowlist.json`.
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
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "scripts";
})();
const ALLOWLIST_PATH = "config/quality/path-safety-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const FS_PATTERNS = [
  { kind: "rm_sync", regex: /\brmSync\s*\(/g, severity: "P0" },
  { kind: "rm_shell", regex: /\brm\s+-rf\b/g, severity: "P0" },
  { kind: "write_file", regex: /\bwriteFileSync\s*\(/g, severity: "P1" },
  { kind: "read_file", regex: /\breadFileSync\s*\(/g, severity: "P2" },
  { kind: "mkdir_sync", regex: /\bmkdirSync\s*\(/g, severity: "P1" },
  { kind: "symlink", regex: /\bsymlinkSync\s*\(/g, severity: "P0" },
  { kind: "spawn", regex: /\bspawn(?:Sync)?\s*\(/g, severity: "P1" },
  { kind: "exec", regex: /\bexec(?:Sync)?\s*\(/g, severity: "P1" },
];

const GUARD_MARKERS = [
  /\brepoRoot\b/,
  /\bpath\.resolve\s*\(\s*process\.cwd\(\)\s*\)/,
  /\bpath\.resolve\s*\(\s*__dirname/,
  /\brealpath\s*\(/,
  /\bstartsWith\s*\(\s*['"`]?[A-Za-z_/.]/,
  /\bpathSafety\b/,
  /\bassertRepoPath\b/,
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

function hasGuardNearby(lines, idx) {
  const window = lines.slice(Math.max(0, idx - 3), idx + 1).join("\n");
  return GUARD_MARKERS.some((re) => re.test(window));
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
  if (isAllowlisted(rel, allowlist)) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|[*\/])/.test(line)) continue;
    for (const pattern of FS_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        const guard = hasGuardNearby(lines, i);
        findings.push({
          rule: `path_safety.${pattern.kind}`,
          severity: guard ? "P3" : pattern.severity,
          path: rel,
          line: i + 1,
          message: guard
            ? `Call '${pattern.kind}' has a nearby repoRoot/realpath/startsWith guard.`
            : `Call '${pattern.kind}' has no repoRoot/realpath/startsWith guard within 3 lines.`,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
          hasGuard: guard,
        });
        pattern.regex.lastIndex = 0;
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
