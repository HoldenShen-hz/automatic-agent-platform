#!/usr/bin/env node
/**
 * Audit: receipt verification
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §11.2.
 *
 * Heuristics:
 *   1. There must be a single receipt factory (or Zod schema) that all
 *      external side-effects call.
 *   2. Each receipt must include a signature/MAC.
 *   3. payloadHash must be the SHA-256 of the canonical body.
 *   4. Schema version must be present and stable.
 *   5. Producer identity must be stamped.
 *   6. There must be a verification test (or factory) that consumers can
 *      call to confirm the receipt.
 *
 * Allowlist: `config/quality/receipt-verification-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/receipt-verification-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const RECEIPT_INDICATORS = [
  /buildReceipt/,
  /writeReceipt/,
  /createReceipt/,
  /receipt\s*\.\s*sign/,
  /signReceipt/,
];

const RULES = [
  {
    rule: "receipt.no_factory",
    severity: "P0",
    description: "No receipt factory function found in the file.",
    fileLevel: true,
  },
  {
    rule: "receipt.missing_signature",
    severity: "P0",
    description: "Receipt has no signature/MAC computation.",
    fileLevel: true,
  },
  {
    rule: "receipt.missing_payload_hash",
    severity: "P0",
    description: "Receipt has no payloadHash / SHA-256 over canonical body.",
    fileLevel: true,
  },
  {
    rule: "receipt.missing_schema_version",
    severity: "P0",
    description: "Receipt has no schemaVersion field.",
    fileLevel: true,
  },
  {
    rule: "receipt.missing_producer",
    severity: "P1",
    description: "Receipt has no producerId / actor identity.",
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
  if (!RECEIPT_INDICATORS.some((re) => re.test(rel)) && !/receipt/i.test(rel)) return [];
  const text = readFileSync(filePath, "utf8");
  const findings = [];

  if (!/buildReceipt|writeReceipt|createReceipt|signReceipt/.test(text)) {
    findings.push({
      rule: "receipt.no_factory",
      severity: "P0",
      path: rel,
      line: 1,
      message: "No receipt factory function found.",
    });
  }
  if (!/(?:hmac|signature|signer|hmacSha256|createHmac)\s*\(/.test(text)) {
    findings.push({
      rule: "receipt.missing_signature",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Receipt has no signature/MAC computation.",
    });
  }
  if (!/payloadHash|sha256|sha-256/.test(text)) {
    findings.push({
      rule: "receipt.missing_payload_hash",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Receipt has no payloadHash / SHA-256 reference.",
    });
  }
  if (!/schemaVersion/.test(text)) {
    findings.push({
      rule: "receipt.missing_schema_version",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Receipt has no schemaVersion field.",
    });
  }
  if (!/producerId|producer|actor|actorId/.test(text)) {
    findings.push({
      rule: "receipt.missing_producer",
      severity: "P1",
      path: rel,
      line: 1,
      message: "Receipt has no producerId / actor identity.",
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
