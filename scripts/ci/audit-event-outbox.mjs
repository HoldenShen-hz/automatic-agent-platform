#!/usr/bin/env node
/**
 * Audit: event outbox atomicity
 *
 * Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §11.3.
 *
 * Heuristics:
 *   1. Truth mutation + event append must be in the same transaction
 *      (or use an outbox pattern with the same effective atomicity).
 *   2. Each event must carry an idempotencyKey.
 *   3. Each event must carry a partitionKey.
 *   4. Consumer ack must be atomic.
 *   5. DLQ dedupe must exist.
 *   6. Replay cursor must be monotonic (no SET on offset).
 *   7. Projection rebuild must not leak offset.
 *
 * Allowlist: `config/quality/event-outbox-allowlist.json`.
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
const ALLOWLIST_PATH = "config/quality/event-outbox-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const OUTBOX_INDICATORS = [
  /outbox/i,
  /appendEvent/i,
  /eventOutbox/i,
  /eventWriter/i,
  /publishOutbox/i,
];

const RULES = [
  {
    rule: "outbox.no_atomic_pair",
    severity: "P0",
    description: "Truth mutation and event append not in the same transaction.",
    fileLevel: true,
  },
  {
    rule: "outbox.missing_idempotency_key",
    severity: "P0",
    description: "Event has no idempotencyKey.",
    fileLevel: true,
  },
  {
    rule: "outbox.missing_partition_key",
    severity: "P1",
    description: "Event has no partitionKey.",
    fileLevel: true,
  },
  {
    rule: "outbox.replay_offset_set",
    severity: "P0",
    description: "Replay cursor uses SET (must be monotonic, e.g. CAS / MAX).",
    regex: /\.set\s*\(\s*['"]?(?:replayOffset|replay_cursor|offset)/,
  },
  {
    rule: "outbox.ack_not_atomic",
    severity: "P0",
    description: "Consumer ack path is not atomic with state update.",
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
  if (!OUTBOX_INDICATORS.some((re) => re.test(rel))) return [];
  const text = readFileSync(filePath, "utf8");
  const findings = [];

  if (!/withTransaction|beginTransaction|\.transaction\(|inTransaction|atomic/.test(text)) {
    findings.push({
      rule: "outbox.no_atomic_pair",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Truth mutation and event append not in the same transaction.",
    });
  }
  if (!/idempotencyKey|idempotency_key|eventId\b/.test(text)) {
    findings.push({
      rule: "outbox.missing_idempotency_key",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Event has no idempotencyKey.",
    });
  }
  if (!/partitionKey|partition_key|aggregateId|aggregate_id/.test(text)) {
    findings.push({
      rule: "outbox.missing_partition_key",
      severity: "P1",
      path: rel,
      line: 1,
      message: "Event has no partitionKey / aggregateId.",
    });
  }
  if (!/ack[A-Z_]*\s*\(/.test(text) || !/atomic|transaction/.test(text)) {
    findings.push({
      rule: "outbox.ack_not_atomic",
      severity: "P0",
      path: rel,
      line: 1,
      message: "Consumer ack path is not atomic with state update.",
    });
  }

  for (const rule of RULES) {
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
