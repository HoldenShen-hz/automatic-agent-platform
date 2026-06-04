#!/usr/bin/env node
/**
 * Audit: secret sinks
 *
 * Scans src/ for secret-looking values reaching unsafe sinks (console.*,
 * logger.*, throw new Error, event payloads, span attributes, metric
 * labels, JSON.stringify, audit metadata).
 *
 * Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §9.2, §23.3.
 *
 * Allowlist: `config/quality/secret-sink-allowlist.json` with shape:
 *   {
 *     "exact": ["src/foo/bar.ts"],
 *     "prefix": ["src/legacy/"],
 *     "snippets": ["REDACTED"]
 *   }
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

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);
const ALLOWLIST_PATH = "config/quality/secret-sink-allowlist.json";

const SECRET_TOKENS = [
  "token",
  "secret",
  "password",
  "dsn",
  "credential",
  "apiKey",
  "api_key",
  "authorization",
  "privateKey",
  "private_key",
  "clientSecret",
  "client_secret",
  "bearerToken",
  "bearer",
  "jwt",
  "webhookSecret",
  "webhook_secret",
  "kmsKey",
  "vaultToken",
  "accessToken",
  "refreshToken",
];

const SECRET_SINK_PATTERNS = [
  { kind: "console", regex: /console\s*\.\s*(log|info|warn|error|debug|trace)\s*\(/g },
  { kind: "logger", regex: /logger\s*\.\s*(info|warn|error|debug|trace|fatal)\s*\(/g },
  { kind: "throw", regex: /throw\s+new\s+Error\s*\(/g },
  { kind: "event_publish", regex: /\.\s*publish\s*\(/g },
  { kind: "audit_record", regex: /audit\s*\.\s*record\s*\(/g },
  { kind: "span_attribute", regex: /\bsetAttribute\s*\(/g },
  { kind: "metric_label", regex: /\bmetric\s*\.\s*labels?\s*\(/g },
  { kind: "json_stringify", regex: /JSON\s*\.\s*stringify\s*\(/g },
];

// Strings that look like the value is a known-redacted placeholder
const REDACTION_TOKENS = ["[REDACTED]", "<redacted>", "***"];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { exact: new Set(), prefix: [], snippets: [] };
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  return {
    exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
    prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
    snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
  };
}

function isAllowlisted(rel, allowlist) {
  if (allowlist.exact.has(rel)) return true;
  return allowlist.prefix.some((p) => rel.startsWith(p));
}

function isRedaction(line) {
  return REDACTION_TOKENS.some((tok) => line.includes(tok));
}

function lineContainsSecretIdentifier(line, token) {
  const exactOrCamelCaseRe = new RegExp(`\\b${escapeRegex(token)}(?:\\b|(?=[A-Z_]))`);
  return exactOrCamelCaseRe.test(line);
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
    // Skip comments
    if (/^\s*(\/\/|[*\/])/.test(line)) continue;
    if (isRedaction(line)) continue;

    // 1. Sinks receiving a secret identifier by name (e.g. logger.info({ token }))
    for (const token of SECRET_TOKENS) {
      if (!lineContainsSecretIdentifier(line, token)) continue;
      for (const sink of SECRET_SINK_PATTERNS) {
        sink.regex.lastIndex = 0;
        if (sink.regex.test(line)) {
          findings.push({
            rule: `secret_sink.${sink.kind}`,
            severity: "P0",
            path: rel,
            line: i + 1,
            message: `Sink '${sink.kind}' may receive secret identifier '${token}'.`,
            snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
            redactedToken: token,
          });
        }
        sink.regex.lastIndex = 0;
      }
    }
    // 2. String interpolation / template literal that embeds a secret token
    const templateRe = /`[^`]*\$\{[^}]*\}/g;
    templateRe.lastIndex = 0;
    if (templateRe.test(line)) {
      for (const token of SECRET_TOKENS) {
        if (lineContainsSecretIdentifier(line, token) && /throw\s+new\s+Error|console\s*\.\s*(log|error)|logger\s*\./.test(line)) {
          findings.push({
            rule: "secret_sink.interpolation",
            severity: "P0",
            path: rel,
            line: i + 1,
            message: `Secret identifier '${token}' interpolated into error/log message.`,
            snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
          });
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
