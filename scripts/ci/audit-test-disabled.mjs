#!/usr/bin/env node
/**
 * Audit: test-disabled (skip / only / todo / flaky)
 *
 * Scans tests/ for disabled/skip/flaky patterns in test files and emits
 * findings per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §44.15.1.
 *
 * Rules:
 *   P0  .only(...)              -> forbidden by default
 *   P0  .skip / .todo / xit / xtest without `@quarantine` metadata on the
 *       immediately preceding line
 *   P1  `flaky` mentioned in a comment without a `@quarantine` reference
 *   P1  `@quarantine` metadata missing required fields (quarantineId, expiry,
 *       owner, reason)
 *
 * Required metadata shape (must be on the line immediately preceding the
 * skip call):
 *   // @quarantine AAS-QUAR-000001 expiry=2026-07-01 owner=alice reason="flaky network"
 *
 * Allowlist: config/quality/disabled-tests-allowlist.json with shape:
 *   {
 *     "exact":   ["tests/foo/bar.test.ts"],
 *     "prefix":  ["tests/legacy/"],
 *     "rules":   ["disabled_tests.bare_skip"]
 *   }
 *
 * Output (JSON to stdout):
 *   { generatedAt, scannedPath, scannedFileCount, findingCount,
 *     bySeverity, findings: [{ rule, severity, path, line, column, message,
 *                              snippet }] }
 *
 * Exit code:
 *   0  no P0/P1 findings (with --check) or report mode (no --check)
 *   1  one or more P0/P1 findings (with --check)
 *   2  invalid usage / IO error
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputRoot = join(repoRoot, "artifacts", "assurance");
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "tests";
})();

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "artifacts",
  "build",
  ".tmp",
  ".test-db",
  ".cache",
]);

const ALLOWLIST_PATH = "config/quality/disabled-tests-allowlist.json";

// Pattern catalogue ------------------------------------------------------------

/**
 * Matches the test call site itself (not metadata).
 * Captures: (kind, name?).
 */
const DISABLED_CALL_PATTERNS = [
  { kind: "only", regex: /\b(test|it|describe|t)\.only\s*\(/g },
  { kind: "skip", regex: /\b(test|it|describe|t)\.skip\s*\(/g },
  { kind: "todo", regex: /\b(test|it|describe|t)\.todo\s*\(/g },
  { kind: "xit", regex: /\bxit\s*\(/g },
  { kind: "xtest", regex: /\bxtest\s*\(/g },
];

/**
 * Metadata pattern. The `// @quarantine ...` line must be on the line
 * IMMEDIATELY preceding the skip call. We allow `quarantineId` (alias
 * `id`) as the only required identifier field; expiry, owner and reason
 * are required per §44.15.1.
 */
const QUARANTINE_METADATA = /\/\/\s*@quarantine\s+(.+)/;
const QUARANTINE_ID = /\b(?:quarantineId|id)\s*=\s*([A-Z][\w-]+)/;
const QUARANTINE_EXPIRY = /\bexpiry\s*=\s*(\d{4}-\d{2}-\d{2})/;
const QUARANTINE_OWNER = /\bowner\s*=\s*([^\s]+)/;
const QUARANTINE_REASON = /\breason\s*=\s*(?:"([^"]+)"|'([^']+)'|(\S+))/;

const FLAKY_COMMENT = /\bflaky\b/i;

// Allowlist -------------------------------------------------------------------

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { exact: new Set(), prefix: [], rules: new Set() };
  }
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    return {
      exact: new Set(Array.isArray(raw.exact) ? raw.exact : []),
      prefix: Array.isArray(raw.prefix) ? raw.prefix : [],
      rules: new Set(Array.isArray(raw.rules) ? raw.rules : []),
    };
  } catch {
    return { exact: new Set(), prefix: [], rules: new Set() };
  }
}

function isAllowlisted(rel, allowlist) {
  if (allowlist.exact.has(rel)) return true;
  return allowlist.prefix.some((p) => rel === p || rel.startsWith(p.endsWith("/") ? p : p + "/"));
}

// Walk ------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && SCAN_EXTS.has(extname(e.name))) {
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

  const ruleAllowed = (rule) => allowlist.rules.has(rule);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip pure-comment lines for the disabled-call pattern matching.
    // We do NOT skip the standalone "flaky" comment rule below.
    const isCommentLine = /^\s*(\/\/|[*])/.test(line) || /^\s*\*/.test(line);
    if (isCommentLine) {
      // Only the flaky comment rule is allowed to fire on comment lines.
    }

    for (const { kind, regex } of DISABLED_CALL_PATTERNS) {
      if (isCommentLine) continue;
      regex.lastIndex = 0;
      let match = regex.exec(line);
      if (!match) continue;
      const callName = (match[1] ?? kind).toString();
      const snippet = line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim();

      // .only: P0 forbidden
      if (kind === "only") {
        if (ruleAllowed("disabled_tests.only")) continue;
        findings.push({
          rule: "disabled_tests.only",
          severity: "P0",
          path: rel,
          line: i + 1,
          column: (match.index ?? 0) + 1,
          message: `Forced-only ${callName}.only(...) call is forbidden in committed test code.`,
          snippet,
        });
        continue;
      }

      // .skip / .todo / xit / xtest: require @quarantine metadata on the
      // immediately preceding line.
      const prev = i > 0 ? lines[i - 1] : "";
      const meta = prev.match(QUARANTINE_METADATA);
      const ruleName = kind === "skip" ? "disabled_tests.bare_skip" : "disabled_tests.bare_todo";
      if (ruleAllowed(ruleName)) continue;

      if (!meta) {
        findings.push({
          rule: ruleName,
          severity: "P0",
          path: rel,
          line: i + 1,
          column: (match.index ?? 0) + 1,
          message: `${callName}.${kind}() has no @quarantine metadata on the preceding line.`,
          snippet,
        });
        continue;
      }

      const payload = meta[1] ?? "";
      const id = payload.match(QUARANTINE_ID);
      const exp = payload.match(QUARANTINE_EXPIRY);
      const own = payload.match(QUARANTINE_OWNER);
      const reason = payload.match(QUARANTINE_REASON);
      if (!id) {
        findings.push({
          rule: "disabled_tests.quarantine_missing_id",
          severity: "P1",
          path: rel,
          line: i, // metadata line
          column: 1,
          message: `@quarantine metadata is missing quarantineId= (or id=) field.`,
          snippet: prev.trim(),
        });
      }
      if (!exp) {
        findings.push({
          rule: "disabled_tests.quarantine_missing_expiry",
          severity: "P1",
          path: rel,
          line: i,
          column: 1,
          message: `@quarantine metadata is missing expiry=YYYY-MM-DD field.`,
          snippet: prev.trim(),
        });
      }
      if (!own) {
        findings.push({
          rule: "disabled_tests.quarantine_missing_owner",
          severity: "P1",
          path: rel,
          line: i,
          column: 1,
          message: `@quarantine metadata is missing owner= field.`,
          snippet: prev.trim(),
        });
      }
      if (!reason) {
        findings.push({
          rule: "disabled_tests.quarantine_missing_reason",
          severity: "P1",
          path: rel,
          line: i,
          column: 1,
          message: `@quarantine metadata is missing reason="..." field.`,
          snippet: prev.trim(),
        });
      }
    }

    // Standalone "flaky" comment (no quarantine reference) — only for
    // P0-disabled nearby. We scope to lines that mention "flaky" but lack
    // an explicit @quarantine or "fixed"/"removed" marker.
    if (FLAKY_COMMENT.test(line) && !/@quarantine/i.test(line) && !/\bfixed\b|\bremoved\b|\bclosed\b/i.test(line)) {
      if (ruleAllowed("disabled_tests.flaky_no_ledger")) continue;
      // Only flag if the line is inside a tests/ source file
      findings.push({
        rule: "disabled_tests.flaky_no_ledger",
        severity: "P1",
        path: rel,
        line: i + 1,
        column: 1,
        message: `Comment mentions "flaky" without referencing a @quarantine ledger entry.`,
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
    process.stderr.write(`${JSON.stringify({ error: `path not found: ${focusPath}` })}\n`);
    process.exitCode = 2;
    return;
  }
  const allowlist = loadAllowlist();
  const files = stat.isDirectory()
    ? walk(focusAbs)
    : [focusAbs].filter((f) => SCAN_EXTS.has(extname(f)));
  const findings = [];
  for (const f of files) {
    findings.push(...findFindings(f, allowlist));
  }
  const bySeverity = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: files.length,
    findingCount: findings.length,
    bySeverity,
    findings,
  };
  const flakyReport = {
    generatedAt: report.generatedAt,
    repoRoot,
    scannedPath: focusPath,
    findingCount: findings.filter((finding) => finding.rule === "disabled_tests.flaky_no_ledger").length,
    findings: findings.filter((finding) => finding.rule === "disabled_tests.flaky_no_ledger"),
  };
  const quarantineReport = {
    generatedAt: report.generatedAt,
    repoRoot,
    scannedPath: focusPath,
    findingCount: findings.filter((finding) => finding.rule.startsWith("disabled_tests.quarantine_")).length,
    findings: findings.filter((finding) => finding.rule.startsWith("disabled_tests.quarantine_")),
  };

  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, "disabled-tests-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(join(outputRoot, "flaky-tests-report.json"), `${JSON.stringify(flakyReport, null, 2)}\n`, "utf8");
  writeFileSync(join(outputRoot, "quarantine-tests-report.json"), `${JSON.stringify(quarantineReport, null, 2)}\n`, "utf8");

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (checkMode && ((bySeverity.P0 ?? 0) > 0 || (bySeverity.P1 ?? 0) > 0)) {
    process.exitCode = 1;
  }
}

main();
