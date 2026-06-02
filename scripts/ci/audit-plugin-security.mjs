#!/usr/bin/env node
/**
 * Audit: plugin security
 *
 * Scans the plugin / SDK surface for fail-open loaders that skip
 * signature / SBOM / waiver checks. Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §5.4.
 *
 * Forbidden:
 *   - `await loadPlugin(...)` without an awaited verify step
 *   - empty catch block swallowing verification errors
 *   - `manifest.signature` referenced only as `if (signature)` rather
 *     than via a verifier call
 *   - `console.warn("signature missing, continuing")` style log+continue
 *
 * Allowlist: `config/quality/plugin-security-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/plugin-security-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const RULES = [
  {
    rule: "plugin.load_without_verify",
    severity: "P0",
    description: "loadPlugin call not preceded by verify/verifyManifest/verifySignature.",
    regex: /(?<!verify\()\bloadPlugin\s*\(/g,
  },
  {
    rule: "plugin.sbom_check_skipped",
    severity: "P0",
    description: "SBOM check branch returns pass without inspecting the SBOM.",
    regex: /if\s*\(\s*sbom\s*\)\s*\{[\s\S]{0,120}?continue\b/g,
  },
  {
    rule: "plugin.continue_on_signature_missing",
    severity: "P0",
    description: "Missing signature is logged but the loader continues.",
    regex: /signature\s*(?:missing|invalid)[^\n]*\n[^\n]*?(?:continue|return\s+plugin)/gi,
  },
  {
    rule: "plugin.catch_swallow_verify",
    severity: "P0",
    description: "Verification error caught and silently ignored.",
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
  },
  {
    rule: "plugin.unsigned_permitted",
    severity: "P0",
    description: "Loader permits unsigned manifests by default.",
    regex: /allowUnsigned\s*[:=]\s*true\b/g,
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
  // Only scan files that touch the plugin SDK surface.
  const text = readFileSync(filePath, "utf8");
  if (!/plugin|sdk|manifest|signature|sbom/i.test(text)) return [];
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|[*\/])/.test(line)) continue;
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
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
