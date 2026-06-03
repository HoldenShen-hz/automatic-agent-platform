#!/usr/bin/env node
/**
 * Audit: eval oracle anti-fake (§12.1)
 *
 * Detects common anti-patterns in eval/ and redteam/ runner code that
 * make the runner report pass without actually testing the system.
 * Patterns from
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md
 * §12.1 only.
 *
 * §12.2 (dataset-card audit) lives in `audit-dataset.mjs`.
 * §12.3 (redteam suite audit) lives in `audit-redteam.mjs`.
 * §12.4 (golden / replay fixture audit) lives in `audit-golden.mjs`.
 *
 * Forbidden:
 *   - expectedOutput used as actualOutput (`expect(actual).toBe(expected)`)
 *     inside the same expression that constructs both.
 *   - constant treatment/control scores (literal 0 or 1 returned)
 *   - judge reading the submitted score (`submission.score` or
 *     `result.score` consulted in the judge)
 *   - empty expected arrays returning pass (`if (expected.length === 0) return pass`)
 *   - static scorecard text (the whole report is a hardcoded string)
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const outputPath = join(repoRoot, "artifacts", "assurance", "eval-oracle-report.json");
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : ".";
})();
const ALLOWLIST_PATH = "config/quality/eval-oracle-allowlist.json";

const SCAN_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git", "artifacts", "build", ".tmp", ".test-db", ".cache"]);

const RULES = [
  {
    rule: "eval_oracle.expected_as_actual",
    severity: "P0",
    description: "expectedOutput assigned to actualOutput variable in the same expression.",
    regex:
      /(?:const|let|var)\s+actualOutput\s*=\s*expectedOutput\b[^\n]*/g,
  },
  {
    rule: "eval_oracle.expected_equals_actual",
    severity: "P0",
    description: "expectedOutput used as actualOutput inside an equality expression.",
    regex: /actual(?:Output)?\s*===?\s*expected(?:Output)?/g,
  },
  {
    rule: "eval_oracle.constant_treatment_score",
    severity: "P0",
    description: "treatment/control score hardcoded to a literal 0 or 1.",
    regex:
      /\b(?:treatment|control)(?:Score)?\s*[:=]\s*(?:0|1|0\.0|1\.0|true|false)\b/g,
  },
  {
    rule: "eval_oracle.judge_reads_self_score",
    severity: "P0",
    description: "Judge reads submission.score / result.score to compute its verdict.",
    regex: /judge[A-Za-z_]*\s*[\s\S]{0,200}\b(?:submission|result)\.score\b/g,
  },
  {
    rule: "eval_oracle.empty_expected_passes",
    severity: "P0",
    description: "Empty expected array yields pass without checking anything.",
    regex: /expected\.length\s*===\s*0[^.\n]*\.?[\s\S]{0,40}?(?:pass|return\s+true)/g,
  },
  {
    rule: "eval_oracle.static_scorecard",
    severity: "P1",
    description: "Scorecard result is a hardcoded string constant.",
    regex: /\bbuildScorecard(?:Text)?\s*\(\s*\)\s*[:=]\s*['"`][^'"`\n]{20,}['"`]/g,
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
    const line = lines[i];
    if (/^\s*(\/\/|[*\/])/.test(line)) continue;
    for (const rule of RULES) {
      if (rule.fileLevel) continue;
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
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (checkMode && findings.some((f) => f.severity === "P0")) {
    process.exitCode = 1;
  }
}

main();
