#!/usr/bin/env node
/**
 * Audit: docs source-of-truth
 *
 * Scans docs_zh/ and docs_en/ (and optionally other docs roots) for
 * source-of-truth drift per
 * docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §20.6
 * and the related contract §20.6 of the issue-ledger.
 *
 * Findings:
 *   1. The same architecture / contract file in docs_zh/ and docs_en/
 *      has a size difference > 30%  → P1
 *   2. A markdown document references an `src/...` path that does not
 *      exist on disk  → P0
 *   3. A markdown document references a `schemas/<file>.schema.json`
 *      that does not exist on disk  → P0
 *   4. docs_zh/quality/issue-ledger/ and src/platform/contracts/ disagree
 *      on contract names  → P1
 *
 * Allowlist: `config/quality/docs-sot-allowlist.json` with shape:
 *   {
 *     "exact": ["docs_zh/foo.md"],
 *     "prefix": ["docs_zh/legacy/"],
 *     "snippets": ["legacy-tbd"]
 *   }
 *
 * Output: JSON `findings[]`.
 * Exit code: 1 with --check if any P0 finding.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const repoRoot = resolve(process.cwd());
const checkMode = process.argv.includes("--check");
const focusPath = (() => {
  const idx = process.argv.indexOf("--path");
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : "docs_zh";
})();

const SCAN_EXTS = new Set([".md", ".mdx"]);
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
const ALLOWLIST_PATH = "config/quality/docs-sot-allowlist.json";

const SIZE_DRIFT_RATIO = 0.3;
const DOCS_ZH = "docs_zh";
const DOCS_EN = "docs_en";

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

function safeReadSize(file) {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

function findBilingualSizeDrift(zhDir, enDir, allowlist) {
  const findings = [];
  if (!existsSync(zhDir) || !existsSync(enDir)) return findings;
  const zhFiles = walk(zhDir);
  for (const zhFile of zhFiles) {
    const rel = relative(zhDir, zhFile);
    const enFile = join(enDir, rel);
    if (!existsSync(enFile)) continue;
    const zhSize = safeReadSize(zhFile);
    const enSize = safeReadSize(enFile);
    if (zhSize === 0 || enSize === 0) continue;
    const ratio = Math.abs(zhSize - enSize) / Math.max(zhSize, enSize);
    if (ratio <= SIZE_DRIFT_RATIO) continue;
    const zhRel = relative(repoRoot, zhFile);
    const enRel = relative(repoRoot, enFile);
    if (isAllowlisted(zhRel, allowlist) || isAllowlisted(enRel, allowlist)) continue;
    findings.push({
      rule: "docs_sot.bilingual_size_drift",
      severity: "P1",
      path: zhRel,
      line: 0,
      message: `docs_zh/ vs docs_en/ size drift > ${SIZE_DRIFT_RATIO * 100}% (zh=${zhSize}B en=${enSize}B ratio=${ratio.toFixed(2)}).`,
      snippet: `zh=${zhRel} en=${enRel}`,
    });
  }
  return findings;
}

function findBrokenSourceReferences(file, allowlist) {
  const findings = [];
  const rel = relative(repoRoot, file);
  if (isAllowlisted(rel, allowlist)) return findings;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*<!--/.test(line)) continue;

    // 1. references to src/...  (within backticks or bare)
    const srcRe = /`?(?:src|tests|schemas|config)\/[A-Za-z0-9._\-\/]+\.[A-Za-z0-9]+`?/g;
    let m;
    srcRe.lastIndex = 0;
    while ((m = srcRe.exec(line)) !== null) {
      const raw = m[0].replace(/`/g, "");
      // Ignore "src/..." placeholders in a URL/anchor and obvious examples
      if (raw.endsWith("...") || raw.includes("*")) continue;
      const abs = resolve(repoRoot, raw);
      if (!existsSync(abs)) {
        findings.push({
          rule: "docs_sot.broken_src_reference",
          severity: "P0",
          path: rel,
          line: i + 1,
          message: `Documentation references '${raw}' but the file does not exist on disk.`,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
    }

    // 2. explicit schemas/<name>.schema.json reference
    const schemaRe = /`?schemas\/[A-Za-z0-9._\-]+\.schema\.json`?/g;
    schemaRe.lastIndex = 0;
    while ((m = schemaRe.exec(line)) !== null) {
      const raw = m[0].replace(/`/g, "");
      const abs = resolve(repoRoot, raw);
      if (!existsSync(abs)) {
        findings.push({
          rule: "docs_sot.broken_schema_reference",
          severity: "P0",
          path: rel,
          line: i + 1,
          message: `Documentation references '${raw}' but the schema does not exist on disk.`,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
    }
  }
  return findings;
}

function findContractNameDrift() {
  const findings = [];
  const issueLedgerDir = join(repoRoot, "docs_zh", "quality", "issue-ledger");
  const contractsDir = join(repoRoot, "src", "platform", "contracts");
  if (!existsSync(issueLedgerDir) || !existsSync(contractsDir)) return findings;
  const issueFiles = readdirSync(issueLedgerDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(issueLedgerDir, f));
  const contractDirs = readdirSync(contractsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const contractNames = new Set();
  for (const d of contractDirs) {
    contractNames.add(d.toLowerCase());
  }
  // For each issue-ledger markdown, look for tokens that look like contract
  // names (CamelCase, with optional underscores) and see whether they exist
  // as a contracts/ subdir.
  const tokenRe = /\b([A-Z][A-Za-z0-9_]+(?:Contract|Envelope|Receipt|Ledger|Manifest|State|Event|Payload))\b/g;
  for (const file of issueFiles) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      tokenRe.lastIndex = 0;
      let m;
      while ((m = tokenRe.exec(line)) !== null) {
        const tok = m[1];
        if (tok.length < 4) continue;
        const stem = tok
          .replace(/(Contract|Envelope|Receipt|Ledger|Manifest|State|Event|Payload)$/, "")
          .toLowerCase();
        // accept either exact contract dir or kebab-case stem
        const candidates = [
          stem,
          stem.replace(/_/g, "-"),
          stem.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
        ];
        if (candidates.some((c) => contractNames.has(c))) continue;
        findings.push({
          rule: "docs_sot.contract_name_drift",
          severity: "P1",
          path: relative(repoRoot, file),
          line: i + 1,
          message: `Issue-ledger references contract name '${tok}' but no matching contracts/ subdir was found.`,
          snippet: line.trim().length > 200 ? line.trim().slice(0, 200) + "…" : line.trim(),
        });
      }
    }
  }
  return findings;
}

function findFindings(target, allowlist) {
  const rel = relative(repoRoot, target);
  if (isAllowlisted(rel, allowlist)) return [];
  if (!SCAN_EXTS.has(extname(target))) return [];
  return findBrokenSourceReferences(target, allowlist);
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
  const allowlist = loadAllowlist();
  const findings = [];
  if (stat.isDirectory()) {
    const files = walk(focusAbs);
    for (const f of files) {
      findings.push(...findFindings(f, allowlist));
    }
  } else if (SCAN_EXTS.has(extname(focusAbs))) {
    findings.push(...findFindings(focusAbs, allowlist));
  }
  // Bilingual size drift is always evaluated repo-wide (cheap, only walks
  // docs_zh when --path is not a single file).
  if (stat.isDirectory()) {
    const zhDir = join(repoRoot, DOCS_ZH);
    const enDir = join(repoRoot, DOCS_EN);
    findings.push(...findBilingualSizeDrift(zhDir, enDir, allowlist));
  }
  // Contract-name drift is repo-wide.
  findings.push(...findContractNameDrift());

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scannedPath: focusPath,
    scannedFileCount: stat.isDirectory() ? walk(focusAbs).length : 1,
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
// silence the unused sep import warning in strict mode
void sep;
