#!/usr/bin/env node
/**
 * Audit: release claims
 *
 * Scans release-facing docs for strong release claims that, per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §1.3, §4.1, must be
 * backed by an evidenceRef. The hard list:
 *
 *   - "final release"
 *   - "production-ready"
 *   - "industry-leading"
 *   - "release-ready"
 *   - "fully implemented"
 *
 * Each match is paired with the nearest preceding evidenceRef-shaped
 * anchor: `evidenceRef: …`, `<!-- evidenceRef: … -->`, or
 * `[[evidence:...]]`. If no anchor is found in the same line or in the
 * immediately preceding 5 lines, a finding is raised.
 *
 * Allowlist: `config/quality/release-claim-allowlist.json` with
 * `{ "exact": ["docs_zh/some/specific/file.md#anchor"], "prefix": [...] }`
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
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "docs_zh/releases";
})();

const SCAN_EXTS = new Set([".md", ".mdx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "artifacts"]);
const ALLOWLIST_PATH = "config/quality/release-claim-allowlist.json";

const CLAIM_PATTERNS = [
  { kind: "final_release", regex: /\bfinal\s+release\b/i, severity: "P0" },
  { kind: "production_ready", regex: /\bproduction[-\s]?ready\b/i, severity: "P0" },
  { kind: "industry_leading", regex: /\bindustry[-\s]?leading\b/i, severity: "P0" },
  { kind: "release_ready", regex: /\brelease[-\s]?ready\b/i, severity: "P0" },
  { kind: "fully_implemented", regex: /\bfully\s+implemented\b/i, severity: "P1" },
];

const EVIDENCE_PATTERNS = [
  /evidenceRef\s*[:=]/i,
  /<!--\s*evidenceRef\s*[:=]/i,
  /\[\[evidence:/i,
  /<!--\s*evidence:/i,
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

function hasEvidenceNearby(lines, idx) {
  const window = lines.slice(Math.max(0, idx - 5), idx + 1).join("\n");
  return EVIDENCE_PATTERNS.some((re) => re.test(window));
}

function isNegatedClaim(line, matchIndex) {
  const prefix = line.slice(0, matchIndex);
  const window = prefix.slice(Math.max(0, prefix.length - 24));
  return /(不宣称|不是|并非|not\s+(?:yet|currently|considered|treated|deemed)?\s*$|no\s+longer\s*$)/i.test(window);
}

function isInsideInlineCode(line, matchIndex) {
  const before = line.slice(0, matchIndex);
  const backticks = before.match(/`/g);
  return backticks != null && backticks.length % 2 === 1;
}

function isEnumeratedModeLabel(line, matchedText) {
  const normalized = line.toLowerCase();
  const target = matchedText.toLowerCase();
  const targetIndex = normalized.indexOf(target);
  if (targetIndex < 0) return false;
  const before = normalized.slice(0, targetIndex);
  const after = normalized.slice(targetIndex + target.length);
  const slashSeparated = before.includes("/") && /\/\s*$/.test(before) && /^\s*(三档|四档|五档|模式|入口|级|gate)/.test(after);
  if (slashSeparated) return true;
  return /warning-only\s*\/\s*p0\s*\/\s*production-ready/i.test(line);
}

function findFindings(filePath, allowlist) {
  const rel = relative(repoRoot, filePath);
  if (isAllowlisted(rel, allowlist)) return [];
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip code-fenced lines (rough heuristic)
    if (/^\s*```/.test(line)) continue;
    for (const claim of CLAIM_PATTERNS) {
      claim.regex.lastIndex = 0;
      const match = claim.regex.exec(line);
      if (match) {
        const matchIndex = match.index ?? 0;
        if (isInsideInlineCode(line, matchIndex) || isNegatedClaim(line, matchIndex)) {
          claim.regex.lastIndex = 0;
          continue;
        }
        if (isEnumeratedModeLabel(line, match[0])) {
          claim.regex.lastIndex = 0;
          continue;
        }
        const evidence = hasEvidenceNearby(lines, i);
        findings.push({
          rule: `release_claim.${claim.kind}`,
          severity: evidence ? "P3" : claim.severity,
          path: rel,
          line: i + 1,
          message: evidence
            ? `Claim '${claim.kind}' has nearby evidenceRef; considered P3 self-attested.`
            : `Claim '${claim.kind}' is missing an evidenceRef anchor within 5 lines.`,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
          hasEvidenceRef: evidence,
        });
        claim.regex.lastIndex = 0;
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
