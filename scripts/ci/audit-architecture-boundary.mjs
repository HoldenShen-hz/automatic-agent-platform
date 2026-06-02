#!/usr/bin/env node
/**
 * Audit: architecture boundary
 *
 * Enforces the five-plane import rules from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §7.1:
 *
 *   - interface        → may import contracts/shared only
 *   - control          → may import contracts/state abstractions only
 *   - orchestration    → may import contracts/execution abstractions only
 *   - execution        → may import contracts/state abstractions only
 *   - state-evidence   → no reverse plane dependency
 *
 * The detection looks for `import … from "<plane>/…"` statements and
 * emits a finding when the target plane is not in the allowed set for
 * the source plane.
 *
 * Allowlist: `config/quality/architecture-boundary-allowlist.json` with
 * `{ "exact": ["src/path/to/file.ts:line"], "prefix": ["src/path/"] }`
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
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "src/platform";
})();
const ALLOWLIST_PATH = "config/quality/architecture-boundary-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

// Per-plane allow rules. A value of `null` means "no restrictions".
// A value of an array means the source plane may only import from these
// (or any path outside the planes).
const PLANE_RULES = {
  "five-plane-interface": [
    "five-plane-contracts",
    "shared",
  ],
  "five-plane-control-plane": [
    "five-plane-contracts",
    "shared",
    "five-plane-state-evidence",
  ],
  "five-plane-orchestration": [
    "five-plane-contracts",
    "shared",
    "five-plane-execution",
    "five-plane-state-evidence",
  ],
  "five-plane-execution": [
    "five-plane-contracts",
    "shared",
    "five-plane-state-evidence",
  ],
  "five-plane-state-evidence": [
    "shared",
  ],
};

const PLANE_TARGETS = Object.keys(PLANE_RULES);

const IMPORT_REGEX = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+(?:[^'";]+?\s+from\s+)|from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { exact: new Set(), prefix: [] };
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
    prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
  };
}

function isAllowlisted(rel, line, allowlist) {
  const ref = `${rel}:${line}`;
  if (allowlist.exact.has(ref)) return true;
  if (allowlist.exact.has(rel)) return true;
  return allowlist.prefix.some((p) => rel.startsWith(p));
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

function detectPlane(relPath) {
  // The five planes are under src/platform/<plane>/
  for (const plane of PLANE_TARGETS) {
    const marker = `src/platform/${plane}/`;
    if (relPath.startsWith(marker)) {
      return plane;
    }
  }
  return null;
}

function detectTargetPlane(specifier) {
  if (!specifier.startsWith(".")) return null;
  // Only the relative form points into src/, so a target plane is one
  // whose directory appears in the specifier path.
  for (const plane of PLANE_TARGETS) {
    if (specifier.includes(`/five-plane-${plane.replace("five-plane-", "")}/`)) {
      return plane;
    }
  }
  return null;
}

function findFindings(filePath, allowlist) {
  const rel = relative(repoRoot, filePath);
  const sourcePlane = detectPlane(rel);
  // Files outside the five planes (e.g. tests/fixtures/seeded-defects/)
  // are scanned with empty allow-list so any plane import is flagged
  // as a P0 violation. This is necessary to test the scanner from
  // fixtures without polluting the production source tree.
  const allowed = sourcePlane ? PLANE_RULES[sourcePlane] : null;
  if (sourcePlane && !allowed) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    IMPORT_REGEX.lastIndex = 0;
    let m;
    while ((m = IMPORT_REGEX.exec(line)) !== null) {
      const spec = m[1];
      const target = detectTargetPlane(spec);
      if (!target) continue;
      if (allowed && allowed.includes(target)) continue;
      if (isAllowlisted(rel, i + 1, allowlist)) continue;
      findings.push({
        rule: "architecture_boundary.reverse_or_unauthorized",
        severity: "P0",
        path: rel,
        line: i + 1,
        message: sourcePlane
          ? `Plane '${sourcePlane}' may not import from '${target}' (allowed: ${allowed.join(", ")}).`
          : `File is outside the five planes but imports from '${target}' (a plane import is a P0 boundary violation).`,
        snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        specifier: spec,
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
