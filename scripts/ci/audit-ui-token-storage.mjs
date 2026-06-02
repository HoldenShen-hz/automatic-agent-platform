#!/usr/bin/env node
/**
 * Audit: UI token storage
 *
 * Scans ui/ and src/interaction/ for forbidden token-storage patterns
 * from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §13.1.
 *
 * Forbidden:
 *   - bearer in <meta> tags
 *   - Authorization header stored in IndexedDB
 *   - JWT without `exp` accepted
 *   - PKCE verifier exposed via window globals
 *   - SharedWorker global token shared across origins
 *
 * Allowlist: `config/quality/ui-token-storage-allowlist.json`.
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
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "ui";
})();
const ALLOWLIST_PATH = "config/quality/ui-token-storage-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx", ".html"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp"]);

const RULES = [
  {
    rule: "ui_token.bearer_in_meta",
    severity: "P0",
    description: "bearer token placed inside <meta> tag.",
    regex: /<meta[^>]*\bname=["']?(?:bearer|access[_-]?token|jwt)["']?[^>]*content=["'][^"']+["']/i,
  },
  {
    rule: "ui_token.authorization_in_indexeddb",
    severity: "P0",
    description: "Authorization header stored in IndexedDB.",
    regex: /indexedDB[\s\S]{0,200}?(?:authorization|Authorization)/i,
  },
  {
    rule: "ui_token.jwt_no_exp_accepted",
    severity: "P0",
    description: "JWT without exp is accepted (decodeJwt without exp check).",
    regex: /decodeJwt\s*\([^)]*\)(?![\s\S]{0,80}?exp)/i,
  },
  {
    rule: "ui_token.pkce_in_global",
    severity: "P0",
    description: "PKCE verifier stored on window / global scope.",
    regex: /window\.(?:pkceVerifier|codeVerifier)\s*=/i,
  },
  {
    rule: "ui_token.shared_worker_origin",
    severity: "P1",
    description: "SharedWorker token handler does not scope to origin.",
    regex: /SharedWorker[\s\S]{0,400}?onconnect[\s\S]{0,400}?(?!origin)/i,
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
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    // Some rules need multi-line context. Build a window for them.
    const multi = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 6)).join("\n");
    for (const rule of RULES) {
      const isMultiLine = rule.regex.flags.includes("s") || /\[[^\]]*\][\s\S]{0,400}/.test(rule.regex.source);
      if (isMultiLine) {
        if (rule.regex.test(multi)) {
          findings.push({
            rule: rule.rule,
            severity: rule.severity,
            path: rel,
            line: i + 1,
            message: rule.description,
            snippet: multi.length > 200 ? multi.slice(0, 200) + "…" : multi,
          });
        }
      } else {
        const line = lines[i];
        if (/^\s*(\/\/|[*\/])/.test(line)) continue;
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
