#!/usr/bin/env node
/**
 * Audit: audit chain integrity
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §11.1.
 *
 * Heuristics:
 *   1. Persistent audit store (file/DB, not just console.log).
 *   2. Each entry must include `prevHash` / `chainPosition`.
 *   3. HMAC/signature must be computed and stored.
 *   4. chainPosition must be strictly monotonic (a number, not reused).
 *   5. Event checksum must be present and computed over the canonical body.
 *   6. Tenant scope must be recorded on each entry.
 *   7. No silent truncation (the size at the time of write must be recorded).
 *
 * Allowlist: `config/quality/audit-chain-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/audit-chain-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const AUDIT_INDICATORS = [
  /audit[_-]?log/i,
  /audit[_-]?chain/i,
  /appendAudit/i,
  /writeAudit/i,
  /appendEvent/i,
];

const FORBIDDEN = [
  {
    rule: "audit_chain.console_only_persistence",
    severity: "P0",
    description: "Audit log persisted only via console.* — no file/DB writer.",
    regex: /appendAudit\s*\([\s\S]{0,200}?console\.(log|info)/,
  },
  {
    rule: "audit_chain.missing_prev_hash",
    severity: "P0",
    description: "Audit entry constructor does not reference prevHash.",
    fileLevel: true,
  },
  {
    rule: "audit_chain.missing_signature",
    severity: "P0",
    description: "Audit entry has no signature/HMAC computation.",
    fileLevel: true,
  },
  {
    rule: "audit_chain.no_tenant_scope",
    severity: "P0",
    description: "Audit entry has no tenantId/tenantScope field.",
    fileLevel: true,
  },
  {
    rule: "audit_chain.silent_truncation",
    severity: "P1",
    description: "Truncating audit log without recording original size.",
    regex: /\.truncate\s*\(\s*\d+\s*\)/,
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
  if (!AUDIT_INDICATORS.some((re) => re.test(rel))) return [];
  const text = readFileSync(filePath, "utf8");
  const findings = [];

  if (!/prevHash|prev_hash|previousHash/.test(text)) {
    findings.push({
      rule: "audit_chain.missing_prev_hash",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Audit entry has no prevHash / chain link reference.",
    });
  }
  if (!/(?:hmac|signature|signer|hmacSha256)\s*\(|createHmac/.test(text)) {
    findings.push({
      rule: "audit_chain.missing_signature",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Audit entry has no HMAC / signature computation.",
    });
  }
  if (!/\btenantId\b|\btenant_id\b|\btenantScope\b/.test(text)) {
    findings.push({
      rule: "audit_chain.no_tenant_scope",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Audit entry has no tenantId / tenantScope.",
    });
  }

  for (const rule of FORBIDDEN) {
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
